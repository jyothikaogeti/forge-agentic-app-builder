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
      if (isGenerating) return;

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
    [userId, credits, isGenerating, pushStatusStep, completeStatusSteps],
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

      if (credits < MINIMUM_CREDITS_TO_GENERATE) {
        return;
      }

      if (!workspaceIdRef.current) {
        return;
      }

      const currentFileData = fileDataRef.current;

      if (!currentFileData) {
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

      try {
        const response = await fetch("/api/improve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            workspaceId: workspaceIdRef.current,
            userRequest,
            fileData: currentFileData,
          }),
          signal: abortController.signal,
        });

        if (response.status === 403) {
          toast.error("Upgrade to Starter or Pro to use Improve with AI.");

          setMessages((prev) => prev.slice(0, -2));

          return;
        }

        if (response.status === 402) {
          toast.error("Not enough credits.");

          setMessages((prev) => prev.slice(0, -2));

          return;
        }

        if (!response.ok || !response.body) {
          throw new Error("Improve failed");
        }

        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        let accumulatedThinking = "";

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

            if (event.type === "thinking") {
              accumulatedThinking += event.text;

              setMessages((prev) => {
                const updatedMessages = [...prev];

                updatedMessages[updatedMessages.length - 1] = {
                  role: "assistant",
                  content: accumulatedThinking,
                };

                return updatedMessages;
              });
            } else if (event.type === "done") {
              setFileData(event.fileData);

              setCredits(event.creditsRemaining);

              setMessages((prev) => {
                const updatedMessages = [...prev];

                updatedMessages[updatedMessages.length - 1] = {
                  role: "assistant",
                  content: event.summary,
                };

                return updatedMessages;
              });
            } else if (event.type === "error") {
              throw new Error(event.message ?? "Improve failed.");
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        toast.error(error instanceof Error ? error.message : "Improve failed.");

        setMessages((prev) => prev.slice(0, -2));
      } finally {
        improveAbortRef.current = null;

        setIsImproving(false);
      }
    },
    [userId, credits, isGenerating, isImproving],
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
