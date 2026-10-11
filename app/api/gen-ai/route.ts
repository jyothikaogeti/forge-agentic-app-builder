import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import { FileData, Message } from "@/types/workspace";
import { arcjetClient } from "@/lib/arcjet";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are an expert React developer. Your job  is to generate complete, working React applications based on user prompts.

  RULES:
  1. Always respond with a valid JSON object — no markdown fences, no extra text.
  2. The JSON must match this exact shape:
  {
    "assistantMessage": "<brief explanation of what you built/changed>",
    "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
    "files": {
      "/App.js": { "code": "<full file content>" },
      "/components/SomeComponent.js": { "code": "<full file content>"}
    },
    "dependencies": {
      "some-package": "latest"
    }
  }
  3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
  4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
  5. The entry point must always be /App.js and must export a default component.
  6. All imports must reference files you include in "files" or packages in "dependencies".
  7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
  8. When modifying existing code, include ALL files (both changed and unchanged) in "files".
  9. Keep code clean, readable, and production-quality.
  10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.
  
  ASSISTANT MESSAGE REQUIREMENTS:
  The assistantMessage is shown to the user after generation completes.

  Write 3-5 natural, specific sentences.
  Explain:
  - What application was created or changed.
  - The most important features implemented.
  - Important UI/design improvements.
  - Important interactions or functionality.
  - For modifications, explain what was improved.

  Do NOT make the message generic.

  Do NOT use phrases like "I have built a beautiful application" unless you immediately explain what was actually built.

  Do NOT mention:
  - internal reasoning
  - Gemini
  - prompts
  - JSON
  - AI generation
  - hidden thoughts
  - model behavior
  - implementation limitations

  Make the summary specific to the user's request.

  Example:
  "I built a Recipe Finder with recipe search, category filtering, a random recipe selector, and a shopping-list workflow. The interface uses a warm, food-focused visual style with responsive recipe cards and clear navigation. I also added useful loading, empty, and interaction states so the application feels polished and complete. The functionality is organized into reusable React components and is ready to run."
`;

const genAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({
    type,
    ...(payload as object),
  })}\n\n`;
}

function getCleanThoughtLabel(text: string): string | null {
  const normalized = text.replace(/\*\*/g, "").replace(/\n+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (
    lower.includes("scope") ||
    lower.includes("objective") ||
    lower.includes("requirement") ||
    lower.includes("goal") ||
    lower.includes("parameter") ||
    lower.includes("user request") ||
    lower.includes("understand the request") ||
    lower.includes("understand what")
  ) {
    return "Planning the application...";
  }

  if (
    lower.includes("architecture") ||
    lower.includes("application structure") ||
    lower.includes("project structure") ||
    lower.includes("organizing") ||
    lower.includes("structure the application")
  ) {
    return "Structuring the application...";
  }

  if (
    lower.includes("component") ||
    lower.includes("reusable component") ||
    lower.includes("component hierarchy") ||
    lower.includes("component structure")
  ) {
    return "Building the components...";
  }

  if (
    lower.includes("layout") ||
    lower.includes("page layout") ||
    lower.includes("screen layout") ||
    lower.includes("ui structure") ||
    lower.includes("interface structure")
  ) {
    return "Creating the layout...";
  }

  if (
    lower.includes("navigation") ||
    lower.includes("navbar") ||
    lower.includes("sidebar") ||
    lower.includes("menu") ||
    lower.includes("routing")
  ) {
    return "Setting up navigation...";
  }

  if (
    lower.includes("interface") ||
    lower.includes("visual hierarchy") ||
    lower.includes("visual design") ||
    lower.includes("design system") ||
    lower.includes("user interface")
  ) {
    return "Designing the interface...";
  }

  if (
    lower.includes("styling") ||
    lower.includes("style") ||
    lower.includes("tailwind") ||
    lower.includes("typography") ||
    lower.includes("spacing") ||
    lower.includes("colors") ||
    lower.includes("color palette") ||
    lower.includes("border") ||
    lower.includes("shadow")
  ) {
    return "Applying the styling...";
  }

  if (
    lower.includes("responsive") ||
    lower.includes("mobile") ||
    lower.includes("tablet") ||
    lower.includes("desktop") ||
    lower.includes("screen sizes")
  ) {
    return "Making it responsive...";
  }

  if (
    lower.includes("data") ||
    lower.includes("dataset") ||
    lower.includes("data structure") ||
    lower.includes("data model") ||
    lower.includes("mock data")
  ) {
    return "Preparing the application data...";
  }

  if (
    lower.includes("logic") ||
    lower.includes("business logic") ||
    lower.includes("application logic") ||
    lower.includes("processing")
  ) {
    return "Building the application logic...";
  }

  if (
    lower.includes("state") ||
    lower.includes("state management") ||
    lower.includes("useState") ||
    lower.includes("useReducer")
  ) {
    return "Managing application state...";
  }

  if (
    lower.includes("interactive") ||
    lower.includes("interaction") ||
    lower.includes("user interaction") ||
    lower.includes("click") ||
    lower.includes("button interaction") ||
    lower.includes("event handler")
  ) {
    return "Adding interactive features...";
  }

  if (
    lower.includes("form") ||
    lower.includes("input") ||
    lower.includes("validation") ||
    lower.includes("form validation") ||
    lower.includes("user input")
  ) {
    return "Building the forms...";
  }

  if (
    lower.includes("search") ||
    lower.includes("filter") ||
    lower.includes("sorting") ||
    lower.includes("sort")
  ) {
    return "Adding search and filtering...";
  }

  if (
    lower.includes("loading state") ||
    lower.includes("loading") ||
    lower.includes("skeleton")
  ) {
    return "Adding loading states...";
  }

  if (
    lower.includes("error state") ||
    lower.includes("error handling") ||
    lower.includes("empty state")
  ) {
    return "Handling application states...";
  }

  if (
    lower.includes("functionality") ||
    lower.includes("implement") ||
    lower.includes("implementation") ||
    lower.includes("feature") ||
    lower.includes("function")
  ) {
    return "Building application functionality...";
  }

  if (
    lower.includes("accessibility") ||
    lower.includes("accessible") ||
    lower.includes("aria") ||
    lower.includes("keyboard navigation")
  ) {
    return "Improving accessibility...";
  }

  if (
    lower.includes("performance") ||
    lower.includes("optimization") ||
    lower.includes("optimize") ||
    lower.includes("efficient")
  ) {
    return "Optimizing the application...";
  }

  if (
    lower.includes("polish") ||
    lower.includes("refine") ||
    lower.includes("refinement") ||
    lower.includes("visual polish")
  ) {
    return "Polishing the experience...";
  }

  if (
    lower.includes("review") ||
    lower.includes("check") ||
    lower.includes("verify") ||
    lower.includes("validation")
  ) {
    return "Reviewing the application...";
  }

  if (
    lower.includes("final") ||
    lower.includes("complete") ||
    lower.includes("finish") ||
    lower.includes("ready")
  ) {
    return "Finalizing the project...";
  }

  return null;
}

function trimMessages(messages: Message[]): Message[] {
  if (messages.length <= 10) {
    return messages;
  }

  return [messages[0], ...messages.slice(-8)];
}

async function validateDependencies(
  deps: Record<string, string>,
): Promise<Record<string, string>> {
  const validDependencies: Record<string, string> = {};

  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });

        if (res.ok) {
          validDependencies[pkg] = version;
        }
      } catch {
        console.warn(`[GEN-AI] ⚠️ Could not validate package: ${pkg}`);
      }
    }),
  );

  return validDependencies;
}

function buildContents(messages: Message[], fileData: FileData | null) {
  const trimmedMessages = trimMessages(messages);

  return trimmedMessages.map((message, i) => {
    const role = message.role === "assistant" ? "model" : "user";

    if (message.role === "user") {
      let text = message.content;

      if (message.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant, such as an img src or background image: ${message.imageUrl}
        User request: ${text}`;
      }

      const isLast = i === trimmedMessages.length - 1;

      if (isLast && fileData) {
        text += `
          Current project files for context: ${JSON.stringify(fileData, null, 2)}

          IMPORTANT:
          When modifying the existing project, preserve useful existing functionality and include ALL project files in your response.
        `;
      }

      return {
        role,
        parts: [{ text }],
      };
    }

    return {
      role,
      parts: [{ text: message.content }],
    };
  });
}

function isRetryableGeminiError(error: unknown): boolean {
  const status = getGeminiErrorStatus(error);
  const message = getGeminiErrorMessage(error).toLowerCase();

  if (status === 429) {
    return false;
  }

  if (
    message.includes("incomplete json") ||
    message.includes("incomplete json segment")
  ) {
    return true;
  }

  if (
    status === 503 ||
    message.includes("high demand") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable")
  ) {
    return true;
  }

  return (
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    message.includes("connection reset") ||
    message.includes("deadline exceeded")
  );
}

function isDailyQuotaExceeded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("GenerateRequestsPerDay") ||
    message.includes("generate_content_free_tier_requests") ||
    message.includes("GenerateRequestsPerDayPerProject") ||
    message.includes("quota_exceeded")
  );
}

function getGeminiErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}

function getGeminiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getRetryAfterSeconds(error: unknown): number | undefined {
  const message = getGeminiErrorMessage(error);

  const secondsMatch = message.match(/Please retry in\s+([\d.]+)s/i);

  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);

    if (Number.isFinite(seconds)) {
      return Math.ceil(seconds);
    }
  }

  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);

  if (retryDelayMatch) {
    const seconds = Number(retryDelayMatch[1]);

    if (Number.isFinite(seconds)) {
      return seconds;
    }
  }

  return undefined;
}

async function generateGeminiWithRetry(
  contents: ReturnType<typeof buildContents>,
  enqueue: (chunk: string) => void,
): Promise<string> {
  const maxAttempts = 3;

  const emittedStatuses = new Set<string>();

  const sendStatus = (message: string) => {
    if (emittedStatuses.has(message)) {
      return;
    }

    emittedStatuses.add(message);

    console.log("[GEN-AI] Status:", message);

    enqueue(
      sseEvent("status", {
        message,
      }),
    );
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let accumulated = "";

    try {
      console.log(`[GEN-AI] Gemini attempt ${attempt}/${maxAttempts}`);

      console.log("[GEN-AI] Model: gemini-3.8-flash");

      const geminiStream = await genAi.models.generateContentStream({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
          responseMimeType: "application/json",
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      });

      console.log("[GEN-AI] Gemini stream created");

      let chunkCount = 0;
      let thoughtCount = 0;

      for await (const chunk of geminiStream) {
        chunkCount++;

        const parts = chunk.candidates?.[0]?.content?.parts ?? [];

        for (const part of parts) {
          if (!part.text) {
            continue;
          }

          if (part.thought) {
            thoughtCount++;

            const label = getCleanThoughtLabel(part.text);

            if (label) {
              sendStatus(label);
            }

            continue;
          }

          accumulated += part.text;
        }
      }

      console.log("[GEN-AI] ✅ Gemini stream completed");

      console.log("[GEN-AI] 📊 Gemini stream stats:", {
        chunkCount,
        thoughtCount,
        responseLength: accumulated.length,
        statusesSent: [...emittedStatuses],
      });

      if (!accumulated.trim()) {
        throw new Error("Gemini returned an empty response.");
      }

      return accumulated;
    } catch (error) {
      const status = getGeminiErrorStatus(error);

      const message = getGeminiErrorMessage(error);

      const retryable = isRetryableGeminiError(error);

      const dailyQuotaExceeded = isDailyQuotaExceeded(error);

      const retryAfter = getRetryAfterSeconds(error);

      console.error("[GEN-AI] ❌ Gemini attempt failed:", {
        attempt,
        maxAttempts,
        status,
        retryable,
        dailyQuotaExceeded,
        retryAfter,
        message,
      });

      // 429 quota
      if (status === 429 || dailyQuotaExceeded) {
        const quotaError = new Error("Gemini quota limit reached.") as Error & {
          status?: number;
          retryAfter?: number;
        };

        quotaError.status = 429;
        quotaError.retryAfter = retryAfter;

        throw quotaError;
      }

      // Non-retryable error
      if (!retryable) {
        throw error;
      }

      // Last retry
      if (attempt === maxAttempts) {
        const normalizedMessage = message.toLowerCase();

        // Incomplete Gemini stream
        if (
          normalizedMessage.includes("incomplete json") ||
          normalizedMessage.includes("incomplete json segment")
        ) {
          const incompleteError = new Error(
            "Gemini response was interrupted before it finished.",
          ) as Error & {
            status?: number;
          };

          incompleteError.status = 502;

          throw incompleteError;
        }

        // Gemini high demand
        const busyError = new Error(
          "Gemini is currently experiencing high demand. Please try again in a little while.",
        ) as Error & {
          status?: number;
        };

        busyError.status = 503;

        throw busyError;
      }

      // Retry temporary errors
      const delay = Math.min(3000 * 2 ** (attempt - 1), 10000);

      sendStatus(
        `Gemini response was interrupted. Retrying in ${Math.ceil(
          delay / 1000,
        )} seconds...`,
      );

      console.log(`[GEN-AI] Waiting ${delay}ms before retry...`);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }

  throw new Error("Gemini generation failed after all retry attempts.");
}

export async function POST(request: NextRequest) {
  console.log("[GEN-AI] 🚀 REQUEST STARTED");
  console.log("[GEN-AI] Time:", new Date().toISOString());

  const { userId: clerkId } = await auth();

  console.log("[GEN-AI] 🔐 Clerk user:", clerkId);

  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { workspaceId, messages, fileData } = body as {
    workspaceId: string | null;
    messages: Message[];
    fileData: FileData | null;
  };

  console.log("[GEN-AI] 📥 Request data:", {
    workspaceId,
    messageCount: messages?.length ?? 0,
    hasFileData: Boolean(fileData),
  });

  if (!messages?.length) {
    return Response.json({ message: "No messages provided" }, { status: 400 });
  }

  const arcjetRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(body),
  });

  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";

  const decision = await arcjetClient.protect(arcjetRequest, {
    requested: 1,
    userId: clerkId,
    detectPromptInjectionMessage: lastUserMessage,
  });

  if (decision.isDenied()) {
    console.log("[GEN-AI] ❌ Arcjet blocked request");

    return Response.json(
      { message: decision.reason?.type ?? "Request blocked" },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    select: {
      id: true,
      credits: true,
    },
  });

  if (!user) {
    console.log("[GEN-AI] ❌ Database user not found");
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  console.log("[GEN-AI] 💳 User credits:", user.credits);

  if (user.credits < CREDIT_COST_PER_GENERATION) {
    console.log("[GEN-AI] ❌ Insufficient credits");
    return Response.json({ message: "Insufficient credits" }, { status: 402 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch (error) {
          console.error("[GEN-AI] ❌ SSE enqueue failed:", error);
        }
      };

      try {
        console.log("[GEN-AI] 🧱 Building Gemini contents...");

        const contents = buildContents(messages, fileData);

        console.log("[GEN-AI] 🧱 Contents built:", {
          count: contents.length,
        });

        console.log("[GEN-AI] 🤖 Starting Gemini request...");

        const accumulated = await generateGeminiWithRetry(contents, enqueue);

        console.log("[GEN-AI] 🎉 Gemini generation successful");
        console.log("[GEN-AI] 📄 Final response length:", accumulated.length);

        let parsed: {
          assistantMessage: string;
          title?: string;
          files: Record<string, { code: string }>;
          dependencies: Record<string, string>;
        };

        try {
          parsed = JSON.parse(accumulated);
        } catch (error) {
          console.error("[GEN-AI] ❌ Invalid JSON from Gemini");
          console.error(
            "[GEN-AI] Raw response preview:",
            accumulated.slice(0, 2000),
          );

          enqueue(
            sseEvent("error", {
              type: "invalid_response",
              status: 500,
              message:
                "Gemini returned an incomplete response. Please try again.",
            }),
          );

          controller.close();
          return;
        }

        const {
          title: aiTitle,
          assistantMessage,
          files,
          dependencies,
        } = parsed;

        if (!files || typeof files !== "object" || !files["/App.js"]) {
          console.error("[GEN-AI] ❌ Missing /App.js");

          enqueue(
            sseEvent("error", {
              message: "AI response is missing /App.js. Please try again.",
            }),
          );

          controller.close();
          return;
        }

        enqueue(
          sseEvent("status", {
            message: "Validating packages...",
          }),
        );

        console.log("[GEN-AI] 📦 Validating dependencies...");

        const validatedDependencies = await validateDependencies(
          dependencies ?? {},
        );

        console.log(
          "[GEN-AI] 📦 Valid dependencies:",
          Object.keys(validatedDependencies),
        );

        const newFileData: FileData = {
          title: aiTitle,
          files,
          dependencies: validatedDependencies,
        };

        enqueue(
          sseEvent("status", {
            message: "Saving your project...",
          }),
        );

        console.log("[GEN-AI] 💾  Saving workspace...");

        const lastUserMsg = messages[messages.length - 1];

        const updatedMessages: Message[] = [
          ...messages,
          {
            role: "assistant",
            content: assistantMessage,
          },
        ];

        const workspace = await prisma.$transaction(
          async (tx) => {
            const ws = workspaceId
              ? await tx.workspace.update({
                  where: {
                    id: workspaceId,
                    userId: user.id,
                  },
                  data: {
                    messages: updatedMessages as never,
                    fileData: newFileData as never,
                  },
                })
              : await tx.workspace.create({
                  data: {
                    userId: user.id,
                    title: aiTitle ?? lastUserMsg.content.slice(0, 80),
                    messages: updatedMessages as never,
                    fileData: newFileData as never,
                  },
                });

            await tx.user.update({
              where: {
                id: user.id,
              },
              data: {
                credits: {
                  decrement: CREDIT_COST_PER_GENERATION,
                },
              },
            });

            return ws;
          },
          {
            maxWait: 10000,
            timeout: 15000,
          },
        );

        console.log("[GEN-AI] ✅ Workspace saved:", workspace.id);

        const updatedUser = await prisma.user.findUnique({
          where: {
            id: user.id,
          },
          select: {
            credits: true,
          },
        });

        const creditsRemaining =
          updatedUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION;

        console.log("[GEN-AI] 💳 Remaining credits:", creditsRemaining);

        enqueue(
          sseEvent("done", {
            workspaceId: workspace.id,
            assistantMessage,
            fileData: newFileData,
            creditsRemaining,
          }),
        );

        console.log("[GEN-AI] 🎉 REQUEST COMPLETED");
      } catch (error) {
        console.error("[GEN-AI] ❌ FATAL ERROR");
        console.error("[GEN-AI] Error:", error);

        if (error instanceof Error) {
          console.error("[GEN-AI] Error name:", error.name);
          console.error("[GEN-AI] Error message:", error.message);
          console.error("[GEN-AI] Stack:", error.stack);
        }

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        const errorStatus = getGeminiErrorStatus(error);

        const retryAfter =
          typeof error === "object" &&
          error !== null &&
          "retryAfter" in error &&
          typeof (
            error as {
              retryAfter?: unknown;
            }
          ).retryAfter === "number"
            ? (
                error as {
                  retryAfter: number;
                }
              ).retryAfter
            : getRetryAfterSeconds(error);

        let userMessage = "Something went wrong. Please try again.";

        let errorType:
          | "busy"
          | "rate_limit"
          | "invalid_response"
          | "interrupted"
          | "failed" = "failed";

        if (errorStatus === 429 || isDailyQuotaExceeded(error)) {
          errorType = "rate_limit";

          userMessage = retryAfter
            ? `Gemini quota has been reached. Please try again in about ${retryAfter} seconds.`
            : "Gemini quota has been reached. Please try again shortly.";
        } else if (
          errorStatus === 502 ||
          errorMessage.toLowerCase().includes("interrupted")
        ) {
          errorType = "interrupted";

          userMessage =
            "Gemini's response was interrupted before it finished. Please try again.";
        } else if (
          errorStatus === 503 ||
          errorMessage.toLowerCase().includes("high demand") ||
          errorMessage.toLowerCase().includes("temporarily unavailable")
        ) {
          errorType = "busy";

          userMessage =
            "Gemini is currently experiencing high traffic. Please try again shortly.";
        } else if (
          errorMessage.toLowerCase().includes("invalid json") ||
          errorMessage.toLowerCase().includes("incomplete json")
        ) {
          errorType = "invalid_response";

          userMessage =
            "Gemini returned an incomplete response. Please try again.";
        }

        console.log("[GEN-AI] Sending SSE error:", {
          errorType,
          status: errorStatus,
          retryAfter,
          message: userMessage,
        });

        enqueue(
          sseEvent("error", {
            errorType,
            status: errorStatus ?? 500,
            message: userMessage,
            retryAfter,
          }),
        );
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
