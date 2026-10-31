import { auth } from "@clerk/nextjs/server";
import { Agent, createTool } from "@cline/sdk";
import { NextRequest } from "next/server";
import { z } from "zod";

import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import type { FileData, Message } from "@/types/workspace";
import { prisma } from "@/lib/prisma";

const improveRequestSchema = z.object({
  workspaceId: z.string().min(1),
  userRequest: z.string().trim().min(1).max(10000),
});

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({ type, ...(payload as object) })}\n\n`;
}

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { message: "Invalid JSON request body" },
      { status: 400 },
    );
  }

  const parsed = improveRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        message: "Invalid request",
        errors: z.flattenError(parsed.error),
      },
      { status: 400 },
    );
  }

  const { workspaceId, userRequest } = parsed.data;

  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    select: {
      id: true,
      credits: true,
      plan: true,
    },
  });

  if (!user)
    return Response.json({ message: "User not found" }, { status: 404 });
  if (user.plan !== "pro")
    return Response.json({ message: "Upgrade required" }, { status: 403 });
  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json({ message: "Insufficient credits" }, { status: 402 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId: user.id,
    },
    select: {
      fileData: true,
      updatedAt: true,
    },
  });

  if (!workspace) {
    return Response.json({ message: "Workspace not found" }, { status: 404 });
  }

  const fileData = workspace.fileData as FileData | null;

  if (
    !fileData ||
    !fileData.files ||
    typeof fileData.files !== "object" ||
    Array.isArray(fileData.files) ||
    Object.keys(fileData.files).length === 0 ||
    !Object.entries(fileData.files).every(
      ([path, file]) =>
        typeof path === "string" &&
        file !== null &&
        typeof file === "object" &&
        !Array.isArray(file) &&
        typeof file.code === "string",
    )
  ) {
    return Response.json(
      { message: "Workspace has no valid project files to improve" },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not configured");

    return Response.json(
      { message: "The improvement service is temporarily unavailable." },
      { status: 503 },
    );
  }

  const reservation = await prisma.user.updateMany({
    where: {
      id: user.id,
      credits: {
        gte: CREDIT_COST_PER_GENERATION,
      },
    },
    data: {
      credits: {
        decrement: CREDIT_COST_PER_GENERATION,
      },
    },
  });

  if (reservation.count === 0) {
    return Response.json({ message: "Insufficient credits" }, { status: 402 });
  }

  let creditReserved = true;

  const refundCredit = async () => {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        credits: {
          increment: CREDIT_COST_PER_GENERATION,
        },
      },
    });
  };

  const encoder = new TextEncoder();

  let streamCancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        if (streamCancelled) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          streamCancelled = true;
        }
      };

      try {
        let finalSummary = "";

        const patchedFiles: Record<string, { code: string }> = {
          ...fileData.files,
        };

        const updateFileTool = createTool({
          name: "update_file",
          description:
            "Update or rewrite a file in the React sandbox. Call once per file you need to change.",
          inputSchema: z.object({
            path: z
              .string()
              .describe("File path exactly as it appears, e.g. /App.js"),
            code: z.string().describe("Complete new contents of the file"),
            reason: z
              .string()
              .describe("One sentence explaining what you changed and why"),
          }),
          async execute({ path, code, reason }) {
            if (
              path.split("/").some((part) => part === "..") ||
              ["__proto__", "constructor", "prototype"].includes(path)
            ) {
              throw new Error("Invalid file path");
            }

            patchedFiles[path] = { code };

            enqueue(sseEvent("file_patch", { path, code, reason }));

            return `Updated ${path}: ${reason}`;
          },
        });

        const doneImprovingTool = createTool({
          name: "done_improving",
          description:
            "Call this when you have finished making all improvements.",
          inputSchema: z.object({
            summary: z
              .string()
              .describe(
                "A short friendly summary of all the improvements you made (1-3 sentences)",
              ),
          }),
          lifecycle: {
            completesRun: true,
          },
          async execute({ summary }) {
            finalSummary = summary;
            return "Done.";
          },
        });

        // Serialize current files for context
        const fileContext = Object.entries(fileData.files)
          .map(([path, { code }]) => `${path}\n${code}`)
          .join("\n-\n");

        const agent = new Agent({
          providerId: "gemini",
          modelId: "gemini-3.8-flash",
          apiKey: process.env.GEMINI_API_KEY,
          maxIterations: 8,
          systemPrompt: `You are an expert React developer improving a live browser preview app.
        The app uses React (functional components), Tailwind CSS for styling, and runs in Sandpack.
        You CANNOT use TypeScript, CSS modules, or real npm install — only what's already available.
        Available packages: react, react-dom, tailwindcss (CDN), lucide-react, recharts, react-router-dom, framer-motion, date-fns, zod, react-hook-form.

        Here are the current files:
        ${fileContext}

        WORKFLOW:
          1. Understand what the user wants improved.
          2. Identify which files need to change.
          3. Call update_file for each file that needs changes (always include the COMPLETE file, not just the diff).
          4. Once all files are updated, call done_improving with a short summary.

        RULES:
          - Always write complete file contents — never partial snippets.
          - Keep all existing functionality unless asked to remove it.
          - The entry point is always /App.js with a default export.
          - All imports must reference files you've updated or packages in the available list above.`,
          tools: [updateFileTool, doneImprovingTool],
          toolPolicies: {
            update_file: {
              autoApprove: true,
            },
            done_improving: {
              autoApprove: true,
            },
          },
        });

        agent.subscribe((event) => {
          if (event.type === "assistant-text-delta" && event.text) {
            enqueue(
              sseEvent("thinking", {
                text: event.text,
              }),
            );
          }

          if (event.type === "tool-started") {
            const toolName = event.toolCall?.toolName;
            if (toolName === "update_file") {
              const path =
                (event.toolCall?.input as { path?: string })?.path ?? "a file";
              enqueue(
                sseEvent("thinking", {
                  text: `Updating ${path}...`,
                }),
              );
            } else if (toolName === "done_improving") {
              enqueue(
                sseEvent("thinking", {
                  text: "Finalizing improvements...",
                }),
              );
            }
          }
        });

        enqueue(
          sseEvent("status", {
            message: "Cline agent starting...",
          }),
        );

        const result = await agent.run(userRequest);

        if (result.status === "failed") {
          throw new Error(result.error?.message ?? "Agent run failed");
        }

        if (streamCancelled) {
          throw new Error("Client disconnected before the run completed");
        }

        const summary = finalSummary.trim();

        if (!summary) {
          throw new Error("Agent did not complete");
        }

        const newFileData: FileData = {
          files: patchedFiles,
          dependencies: fileData.dependencies,
          title: fileData.title,
        };

        await prisma.$transaction(
          async (tx) => {
            const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" 
              FROM "Workspace"
              WHERE "id" = ${workspaceId} 
                AND "userId" = ${user.id}
              FOR UPDATE`;

            if (locked.length === 0)
              throw new Error("Workspace not found or no longer accessible");

            const currentWorkspace = await tx.workspace.findFirst({
              where: {
                id: workspaceId,
                userId: user.id,
              },
              select: {
                messages: true,
                fileData: true,
              },
            });

            if (!currentWorkspace)
              throw new Error("Workspace not found or no longer accessible");

            if (
              JSON.stringify(currentWorkspace.fileData) !==
              JSON.stringify(workspace.fileData)
            ) {
              throw new Error("WORKSPACE_CHANGED");
            }

            const storedMessages = Array.isArray(currentWorkspace.messages)
              ? (currentWorkspace.messages as unknown as Message[])
              : [];

            const updatedMessages: Message[] = [
              ...storedMessages,
              { role: "user", content: userRequest },
              { role: "assistant", content: summary },
            ];

            await tx.workspace.update({
              where: {
                id: workspaceId,
                userId: user.id,
              },
              data: {
                fileData: newFileData as never,
                messages: updatedMessages as never,
              },
            });
          },
          { maxWait: 10000, timeout: 15000 },
        );

        creditReserved = false;

        const balance = await prisma.user
          .findUnique({
            where: {
              id: user.id,
            },
            select: {
              credits: true,
            },
          })
          .catch(() => null);

        enqueue(
          sseEvent("done", {
            fileData: newFileData,
            summary,
            creditsRemaining:
              balance?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
          }),
        );
      } catch (error) {
        console.error("Improve error:", error);

        const message =
          error instanceof Error && error.message === "WORKSPACE_CHANGED"
            ? "The workspace changed while improvements were being generated. Reload the workspace and try again."
            : "Unable to complete improvements. Please try again.";

        enqueue(
          sseEvent("error", {
            message,
          }),
        );
      } finally {
        if (creditReserved) {
          creditReserved = false;
          try {
            await refundCredit();
          } catch (refundError) {
            console.error("Improve failed to refund credit", refundError);
          }
        }

        if (!streamCancelled) {
          try {
            controller.close();
          } catch {
            streamCancelled = true;
          }
        }
      }
    },
    cancel() {
      streamCancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
