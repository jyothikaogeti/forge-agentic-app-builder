"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Message, StatusStep } from "@/types/workspace";
import { Button } from "./ui/button";
import PricingModal from "./PricingModal";

interface ChatPanelProps {
  userId: string;
  workspaceId: string | null;
  appTitle: string | null;
  initialPrompt: string | null;
  messages: Message[];
  isGenerating: boolean;
  isImproving: boolean;
  statusLog: StatusStep[];
  credits: number;
  generationError: {
    type: "busy" | "rate_limit" | "invalid_response" | "interrupted" | "failed";
    message: string;
    retryAfter?: number;
  } | null;
  onRetry: () => Promise<void>;
  onGenerate: (prompt: string, imageUrl?: string) => Promise<void>;
  onStop: () => void;
}

export default function ChatPanel({
  userId,
  workspaceId,
  appTitle,
  initialPrompt,
  messages,
  isGenerating,
  isImproving,
  statusLog,
  credits,
  generationError,
  onGenerate,
  onRetry,
  onStop,
}: ChatPanelProps) {
  const { user } = useUser();

  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasAutoSubmittedRef = useRef(false);

  const noCredits = credits <= 0;
  const canSubmit =
    input.trim().length > 0 && !isGenerating && !isImproving && !noCredits;

  const lastMessage = messages[messages.length - 1];
  const lastUserMessageIndex = messages.reduce(
    (lastIndex, message, index) =>
      message.role === "user" ? index : lastIndex,
    -1,
  );
  const isStreamingAssistant = isImproving && lastMessage?.role === "assistant";

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, isGenerating, isImproving]);

  useEffect(() => {
    if (!initialPrompt || hasAutoSubmittedRef.current || messages.length > 0)
      return;
    hasAutoSubmittedRef.current = true;
    onGenerate(initialPrompt);
  }, []);

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isGenerating || isImproving || noCredits) return;
    setInput("");
    setImageUrl(null);
    await onGenerate(trimmedInput, imageUrl ?? undefined);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setIsUploading(true);

    try {
      const fileExtension = file.name.split(".").pop();
      const path = `${userId}/${workspaceId ?? "new"}/${Date.now()}.${fileExtension}`;

      const { error } = await supabase.storage
        .from("workspace-images")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("workspace-images")
        .getPublicUrl(path);

      setImageUrl(data.publicUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-[320px] bg-[#0d0d0d] flex flex-col shrink-0">
      <div className="flex justify-between items-center border-b border-white/6 px-4 py-3">
        <span className="min-w-0 flex-1 wrap-break-word bg-linear-to-r from-sky-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent text-sm font-bold font-serif tracking-[-0.02rem] drop-shadow-[0_2px_8px_rgba(59,130,246,0.2)]">
          {appTitle}
        </span>

        <PricingModal reason={noCredits ? "credits" : "upgrade"}>
          <span
            className={cn(
              "text-[11px] rounded-full transition-colors shrink-0 px-2 py-0.5",
              noCredits
                ? "bg-red-500/15 text-red-400/80 hover:bg-red-500/25"
                : "bg-white/6 text-white/30 hover:bg-white/10 hover:text-white/50",
            )}
          >
            {noCredits
              ? "No credits · Upgrade"
              : `${credits} credit${credits !== 1 ? "s" : ""}`}
          </span>
        </PricingModal>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 && !isGenerating && (
          <div className="flex justify-center items-center h-full">
            <p className="text-white/20 text-xs text-center">
              Describe what you want to build
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((message, i) => {
            const islast = i === messages.length - 1;
            const isLiveStream = islast && isStreamingAssistant;

            return (
              <div key={i}>
                {message.role === "user" ? (
                  <div className="flex justify-end items-start gap-2">
                    <div className="max-w-[85%] space-y-1.5">
                      {message.imageUrl && (
                        <Image
                          src={message.imageUrl}
                          alt="Uploaded Image"
                          className="w-full max-h-40 rounded-lg object-cover"
                        />
                      )}
                      <div className="bg-white/10 rounded-2xl rounded-br-sm px-3.5 py-2.5">
                        <p className="text-white/80 text-[13px] leading-relaxed wrap-break-word">
                          {message.content}
                        </p>
                      </div>
                    </div>

                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName ?? "You"}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-white/10 text-white/50 text-[10px] font-semibold flex justify-center items-center rounded-full shrink-0 mt-0.5">
                        {user?.firstName?.[0] ?? "You"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Image
                      src="/assistant-logo.png"
                      alt="Forge"
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-lg shrink-0 mt-0.5"
                    />

                    <div className="min-w-0 bg-white/5 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      {isLiveStream && !message.content ? (
                        <div className="flex items-center gap-2">
                          <Wand2 className="w-3 h-3 text-blue-400/60 shrink-0 animate-pulse" />
                          <span className="text-white/30 text-[12px] animate-pulse">
                            Cline is thinking...
                          </span>
                        </div>
                      ) : isLiveStream && message.content ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Wand2 className="w-3 h-3 text-blue-400/60 shrink-0" />
                            <span className="text-blue-400/50 text-[10px] font-medium uppercase tracking-wider">
                              Agent reasoning
                            </span>
                          </div>

                          <p className="text-white/35 text-[12px] leading-relaxed wrap-break-word">
                            {message.content}
                            <span className="w-0.5 h-3 bg-blue-400/60 align-middle inline-block animate-[blink_1s_ease-in-out_infinite] ml-0.5" />
                          </p>
                        </div>
                      ) : (
                        <div className="prose prose-sm prose-invert max-w-none text-white/70 text-[13px] leading-relaxed wrap-break-word [&_code]:bg-white/10 [&_code]:text-blue-300/80 [&_code]:text-xs [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {message.role === "user" &&
                  i === lastUserMessageIndex &&
                  (isGenerating || statusLog.length > 0) && (
                    <div className="flex items-start gap-2 mt-3 mb-1">
                      <Image
                        src="/assistant-logo.png"
                        alt="Forge"
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-lg shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1 bg-white/2.5 border border-white/6 rounded-tl-sm rounded-2xl px-3 py-2.5">
                        <div className="space-y-2">
                          {statusLog.map((status, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                              <div className="w-4 h-4 flex justify-center items-center shrink-0">
                                {status.status === "running" ? (
                                  <Loader2 className="w-3 h-3 text-blue-400/80 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3 text-blue-400/80" />
                                )}
                              </div>

                              <span
                                className={cn(
                                  "text-[12px] transition-colors duration-300",
                                  status.status === "running"
                                    ? "text-white/75"
                                    : "text-white/25",
                                )}
                              >
                                {status.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}

          {generationError && !isGenerating && (
            <div className="flex items-start gap-2">
              <Image
                src="/assistant-logo.png"
                alt="Forge"
                width={24}
                height={24}
                className="w-6 h-6 rounded-md shrink-0 mt-0.5"
              />

              <div className="min-w-0 bg-red-500/5 border border-red-500/10 rounded-2xl rounded-tl-sm px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <X className="w-3 h-3 text-red-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-red-300/80 text-[12px] font-medium">
                      {generationError.type === "busy"
                        ? "Gemini is busy right now"
                        : generationError.type === "rate_limit"
                          ? "Gemini quota reached"
                          : generationError.type === "interrupted"
                            ? "Gemini response was interrupted"
                            : generationError.type === "invalid_response"
                              ? "Gemini returned an incomplete response"
                              : "Generation failed"}
                    </p>

                    <p className="text-white/35 text-[11px] leading-relaxed mt-1">
                      {generationError.message}
                    </p>

                    {generationError.retryAfter && (
                      <p className="text-white/25 text-[10px] mt-1.5">
                        Retry available in about {generationError.retryAfter}{" "}
                        seconds.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={onRetry}
                      disabled={noCredits}
                      className="mt-2.5 h-7 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {noCredits && (
        <div className="bg-red-950/40 border border-red-500/15 rounded-xl px-4 py-3 mx-3 mb-2">
          <p className="text-red-400/80 text-[12px] font-medium mb-2">
            You&apos;ve used all your credits
          </p>
          <PricingModal reason="credits">
            <span className="bg-white text-black text-xs rounded-full inline-flex items-center gap-1.5 cursor-pointer h-8 px-3 active:scale-95">
              <Sparkles className="w-3 h-3" />
              Upgrade plan
            </span>
          </PricingModal>
        </div>
      )}

      <div className="border-t border-white/6 p-3">
        {imageUrl && (
          <div className="relative w-fit mb-2">
            <Image
              src={imageUrl}
              alt="Uploaded Image"
              className="w-16 h-16 rounded-lg object-cover"
            />
            <Button
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black/80 text-white/60 flex justify-center items-center rounded-full hover:text-white"
              onClick={() => setImageUrl(null)}
            >
              <X className="w-2.5 h-2.5" />
            </Button>
          </div>
        )}

        <div
          className={cn(
            "bg-white/4 border rounded-xl transition-colors",
            isGenerating || isImproving || noCredits
              ? "border-white/4 opacity-60"
              : "border-white/8 hover:border-white/12",
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating || isImproving || noCredits}
            placeholder={
              noCredits
                ? "Upgrade to keep building..."
                : isImproving
                  ? "Cline is improving your app..."
                  : isGenerating
                    ? "Generating..."
                    : "Ask AI to modify..."
            }
            rows={1}
            style={{ maxHeight: 160 }}
            className="w-full bg-transparent text-white/80 text-[13px] resize-none px-3.5 pt-3 pb-2 placeholder:text-white/20 focus:outline-none"
          />

          <div className="flex justify-between items-center px-2 pb-2">
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-white/25 rounded-lg hover:bg-white/6 hover:text-white/50 disabled:opacity-40"
              onClick={() => fileRef.current?.click()}
              disabled={isGenerating || isImproving || isUploading || noCredits}
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Paperclip className="w-3.5 h-3.5" />
              )}
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {isGenerating || isImproving ? (
              <Button
                size="icon"
                className="w-7 h-7 bg-white/10 text-white/60 rounded-lg transition-all hover:bg-white/20 hover:text-white active:scale-95"
                onClick={onStop}
              >
                <Square className="w-3 h-3 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                className={cn(
                  "w-7 h-7 rounded-lg transition-all",
                  canSubmit
                    ? "bg-white text-black hover:bg-white/90 active:scale-95"
                    : "bg-white/8 text-white/20 shadow-none",
                )}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {isGenerating || isImproving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="text-white/15 text-[10px] text-center mt-1.5">
          {isGenerating || isImproving
            ? "Click ■ to stop generation"
            : "Press ⏎ to generate · Shift + ⏎ for new line"}
        </p>
      </div>
    </div>
  );
}
