"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MINIMUM_CREDITS_TO_GENERATE } from "@/lib/constants";
import {
  FileData,
  Message,
  StatusStep,
  WorkspaceData,
} from "@/types/workspace";
import ChatPanel from "./ChatPanel";
import CodePanel from "./CodePanel";

interface WorkspaceProps {
  userId: string;
  userPlan: string;
  userCredits: number;
  workspace: WorkspaceData | null;
  initialPrompt: string | null;
}

type GenerationError = {
  type: "busy" | "rate_limit" | "invalid_response" | "interrupted" | "failed";
  message: string;
  retryAfter?: number;
};

function parseMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter(
    (message): message is Message =>
      typeof message === "object" &&
      message !== null &&
      "role" in message &&
      "content" in message,
  );
}

function parseFileData(raw: unknown): FileData | null {
  if (!raw || typeof raw !== "object") return null;

  const file = raw as Record<string, unknown>;

  if (!file.files || !file.dependencies) {
    return null;
  }

  return raw as FileData;
}

export default function WorkspaceClient({
  userId,
  userPlan,
  userCredits,
  workspace,
  initialPrompt,
}: WorkspaceProps) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    workspace?.id ?? null,
  );

  const [messages, setMessages] = useState<Message[]>(
    parseMessages(workspace?.messages),
  );
  const [fileData, setFileData] = useState<FileData | null>(
    parseFileData(workspace?.fileData),
  );
  const [credits, setCredits] = useState(userCredits);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusStep[]>([]);
  const [generationError, setGenerationError] =
    useState<GenerationError | null>(null);

  const workspaceIdRef = useRef<string | null>(workspaceId);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fileDataRef = useRef<FileData | null>(fileData);

  useEffect(() => {
    fileDataRef.current = fileData;
  }, [fileData]);

  const generateAbortRef = useRef<AbortController | null>(null);
  const improveAbortRef = useRef<AbortController | null>(null);

  const lastGenerationRef = useRef<{
    prompt: string;
    imageUrl?: string;
  } | null>(null);

  const pushStatusStep = useCallback((label: string) => {
    setStatusLog((prev) => [
      ...prev.map((step, i) =>
        i === prev.length - 1
          ? {
              ...step,
              status: "done" as const,
            }
          : step,
      ),
      {
        label,
        status: "running" as const,
      },
    ]);
  }, []);

  const completeStatusSteps = useCallback(() => {
    setStatusLog((prev) =>
      prev.map((step) => ({
        ...step,
        status: "done" as const,
      })),
    );
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string, imageUrl?: string, isRetry = false) => {
      if (isGenerating || isImproving) return;

      if (credits < MINIMUM_CREDITS_TO_GENERATE) {
        return;
      }

      const userMessage: Message = {
        role: "user",
        content: prompt,
        ...(imageUrl ? { imageUrl } : {}),
      };

      lastGenerationRef.current = {
        prompt,
        imageUrl,
      };

      setGenerationError(null);

      if (!isRetry) {
        setMessages((prev) => [...prev, userMessage]);
      }

      const currentMessages = messagesRef.current;

      const requestMessages = isRetry
        ? currentMessages
        : [...currentMessages, userMessage];

      const currentWorkspaceId = workspaceIdRef.current;

      setIsGenerating(true);
      setStatusLog([
        {
          label: isRetry ? "Retrying..." : "Thinking...",
          status: "running",
        },
      ]);

      const abortController = new AbortController();

      generateAbortRef.current = abortController;

      try {
        const res = await fetch("/api/gen-ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            userId,
            messages: requestMessages,
            fileData: fileDataRef.current,
          }),
        });

        if (res.status === 402) {
          const error: GenerationError = {
            type: "failed",
            message: "Not enough credits.",
          };

          setGenerationError(error);
          completeStatusSteps();

          toast.error(error.message);

          return;
        }

        if (res.status === 429) {
          const error: GenerationError = {
            type: "rate_limit",
            message: "Too many requests. Please try again shortly.",
          };

          setGenerationError(error);
          completeStatusSteps();

          toast.error(error.message);

          return;
        }

        if (!res.ok || !res.body) {
          const error: GenerationError = {
            type: "failed",
            message: "Generation failed. Please try again.",
          };

          setGenerationError(error);
          completeStatusSteps();

          toast.error(error.message);

          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, {
            stream: true,
          });

          const lines = buffer.split("\n\n");

          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue;
            }

            let event: any;

            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (event.type === "status") {
              pushStatusStep(event.message);
            } else if (event.type === "done") {
              completeStatusSteps();

              setWorkspaceId(event.workspaceId);

              setFileData(event.fileData);

              setCredits(event.creditsRemaining);

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: event.assistantMessage,
                },
              ]);

              setGenerationError(null);

              window.history.replaceState(
                null,
                "",
                `/workspace?id=${event.workspaceId}`,
              );
            } else if (event.type === "error") {
              const streamError = new Error(
                event.message ?? "Something went wrong. Please try again.",
              ) as Error & {
                generationError?: GenerationError;
              };

              streamError.generationError = {
                type:
                  event.errorType ??
                  (event.status === 429
                    ? "rate_limit"
                    : event.status === 503
                      ? "busy"
                      : event.status === 502
                        ? "interrupted"
                        : "failed"),

                message:
                  event.message ?? "Something went wrong. Please try again.",

                retryAfter: event.retryAfter,
              };

              throw streamError;
            }
          }
        }

        if (buffer.startsWith("data: ")) {
          let event: any;

          try {
            event = JSON.parse(buffer.slice(6));
          } catch {
            event = null;
          }

          if (event) {
            if (event.type === "status") {
              pushStatusStep(event.message);
            } else if (event.type === "done") {
              completeStatusSteps();

              setWorkspaceId(event.workspaceId);

              setFileData(event.fileData);

              setCredits(event.creditsRemaining);

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: event.assistantMessage,
                },
              ]);

              setGenerationError(null);

              window.history.replaceState(
                null,
                "",
                `/workspace?id=${event.workspaceId}`,
              );
            } else if (event.type === "error") {
              const streamError = new Error(
                event.message ?? "Something went wrong. Please try again.",
              ) as Error & {
                generationError?: GenerationError;
              };

              streamError.generationError = {
                type:
                  event.errorType ??
                  (event.status === 429
                    ? "rate_limit"
                    : event.status === 503
                      ? "busy"
                      : event.status === 502
                        ? "interrupted"
                        : "failed"),

                message:
                  event.message ?? "Something went wrong. Please try again.",

                retryAfter: event.retryAfter,
              };

              throw streamError;
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          completeStatusSteps();
          return;
        }

        const generationError =
          error && typeof error === "object" && "generationError" in error
            ? (
                error as {
                  generationError?: GenerationError;
                }
              ).generationError
            : undefined;

        setGenerationError(
          generationError ?? {
            type: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.",
          },
        );

        completeStatusSteps();

        toast.error(
          generationError?.message ??
            (error instanceof Error ? error.message : "Something went wrong."),
        );
      } finally {
        generateAbortRef.current = null;

        setIsGenerating(false);
      }
    },
    [
      userId,
      credits,
      isGenerating,
      isImproving,
      pushStatusStep,
      completeStatusSteps,
    ],
  );

  const handleRetryGenerate = useCallback(async () => {
    const lastGeneration = lastGenerationRef.current;

    if (!lastGeneration) {
      return;
    }

    await handleGenerate(lastGeneration.prompt, lastGeneration.imageUrl, true);
  }, [handleGenerate]);

  const handleImprove = useCallback(
    async (userRequest: string) => {
      if (isGenerating || isImproving) {
        return;
      }

      const workspaceId = workspaceIdRef.current;

      if (!workspaceId || !fileDataRef.current) {
        return;
      }

      if (credits < MINIMUM_CREDITS_TO_GENERATE) {
        toast.error("Not enough credits");
        return;
      }

      setIsImproving(true);

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: userRequest,
        },
        {
          role: "assistant",
          content: "",
        },
      ]);

      const abortController = new AbortController();
      improveAbortRef.current = abortController;

      let accumulatedThinking = "";
      let completed = false;

      const removeOptimisticMessages = () => {
        setMessages((prev) => prev.slice(0, -2));
      };

      try {
        const response = await fetch("/api/improve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId,
            userRequest,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorMessage = `Improve failed (${response.status})`;
          try {
            const errorData: unknown = await response.json();

            if (typeof errorData === "object" && errorData !== null) {
              const data = errorData as {
                error?: unknown;
                message?: unknown;
              };

              if (typeof data.message === "string") {
                errorMessage = data.message;
              } else if (typeof data.error === "string") {
                errorMessage = data.error;
              }
            }
          } catch {
            // Keep the fallback error message if the response isn't valid JSON.
          }

          if (response.status === 401) {
            errorMessage = "Please sign in to continue.";
          } else if (response.status === 402) {
            errorMessage = "Not enough credits.";
          } else if (response.status === 403) {
            errorMessage = "Upgrade to Pro to use Improve with AI.";
          } else if (response.status === 404) {
            errorMessage = "Workspace not found.";
          } else if (response.status === 503) {
            errorMessage =
              "AI service is currently unavailable. Please try again.";
          }

          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error("The server returned an empty response");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        const processEvent = (frame: string) => {
          if (completed) return;

          const data = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");

          if (!data) return;

          let event: unknown;

          try {
            event = JSON.parse(data);
          } catch {
            return;
          }

          if (typeof event !== "object" || event === null) {
            return;
          }

          const parsed = event as {
            type?: unknown;
            text?: unknown;
            fileData?: unknown;
            creditsRemaining?: unknown;
            summary?: unknown;
            message?: unknown;
          };

          if (parsed.type === "thinking") {
            if (typeof parsed.text !== "string") return;

            accumulatedThinking += parsed.text;

            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;

              if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: accumulatedThinking,
                };
              }

              return updated;
            });
          } else if (parsed.type === "done") {
            if (
              typeof parsed.summary !== "string" ||
              !parsed.summary.trim() ||
              typeof parsed.creditsRemaining !== "number" ||
              typeof parsed.fileData !== "object" ||
              parsed.fileData === null
            ) {
              throw new Error(
                "The server returned an invalid completion response.",
              );
            }

            const updatedFileData = parsed.fileData as FileData;

            completed = true;

            fileDataRef.current = updatedFileData;
            setFileData(updatedFileData);

            setCredits(parsed.creditsRemaining);

            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;

              if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: parsed.summary as string,
                };
              }

              return updated;
            });
          } else if (parsed.type === "error") {
            throw new Error(
              typeof parsed.message === "string"
                ? parsed.message
                : "Unable to complete improvements.",
            );
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, {
            stream: true,
          });

          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            processEvent(frame);
          }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
          processEvent(buffer);
        }

        if (!completed) {
          throw new Error(
            "The connection ended before Improve finished. Please try again.",
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (!completed) {
            removeOptimisticMessages();
          }
          return;
        }

        if (!completed) {
          removeOptimisticMessages();
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to complete improvements.",
        );
      } finally {
        improveAbortRef.current = null;
        setIsImproving(false);
      }
    },
    [credits, isGenerating, isImproving],
  );

  const handleStop = useCallback(() => {
    generateAbortRef.current?.abort();
    improveAbortRef.current?.abort();
  }, []);

  const handleFilePatch = useCallback((patches: FileData) => {
    setFileData(patches);
  }, []);

  return (
    <div className="bg-[#0a0a0a] flex h-[calc(100vh-4rem)] overflow-hidden">
      <ChatPanel
        userId={userId}
        workspaceId={workspaceId}
        appTitle={fileData?.title ?? workspace?.title ?? null}
        initialPrompt={initialPrompt}
        messages={messages}
        isGenerating={isGenerating}
        isImproving={isImproving}
        statusLog={statusLog}
        credits={credits}
        generationError={generationError}
        onGenerate={handleGenerate}
        onRetry={handleRetryGenerate}
        onStop={handleStop}
      />

      <CodePanel
        fileData={fileData}
        appTitle={fileData?.title ?? workspace?.title ?? null}
        isProUser={userPlan === "pro"}
        statusLog={statusLog}
        isGenerating={isGenerating}
        isImproving={isImproving}
        onImprove={handleImprove}
        onFixError={(error) =>
          handleGenerate(
            `There is an error in the preview:\n${error}\nPlease fix it.`,
          )
        }
        onFilePatch={handleFilePatch}
      />
    </div>
  );
}
