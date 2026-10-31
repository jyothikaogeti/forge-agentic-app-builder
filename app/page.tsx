"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowRight, Check, ChevronRight, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRICING_PLANS } from "@/lib/constants";
import { FEATURES, PLACEHOLDERS, STEPS, SUGGESTIONS } from "@/lib/data";
import { HoleBackground } from "@/components/animate-ui/components/backgrounds/hole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BlueTitle,
  GrayTitle,
  SectionHeading,
  SectionLabel,
} from "@/components/Reusables";

export default function Home() {
  const { has, isSignedIn } = useAuth();
  const router = useRouter();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (prompt || isFocused) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [prompt, isFocused]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 200) + "px";
  }, [prompt]);

  const handleSubmit = () => {
    if (!prompt.trim() || !isSignedIn) return;
    router.push(`/workspace?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] selection:bg-white/20">
      <section className="relative text-center flex flex-col items-center overflow-hidden px-4 pt-40 pb-24">
        <HoleBackground
          className="absolute inset-0 w-full h-full"
          strokeColor="rgba(255,255,255,0.05)"
          style={{
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
          }}
        />

        <Badge variant="outline" className="backdrop-blur-sm gap-2 p-4">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Powered by Gemini 3.5 Flash
        </Badge>

        <h1 className="max-w-3xl text-5xl text-balance font-serif leading-tight tracking-tight mx-auto z-10 sm:text-6xl lg:text-7xl">
          <GrayTitle>Forge your dream</GrayTitle>
          <br />
          <BlueTitle>from a single prompt.</BlueTitle>
        </h1>

        <p className="max-w-xl mx-auto text-white/40 text-base text-balance leading-relaxed z-10 mt-6">
          Describe what you want to build. AI writes the code, picks the
          packages, and renders a live preview all inside your browser.
        </p>

        <div className="relative max-w-2xl mx-auto w-full mt-12">
          <div
            className={cn(
              "bg-[#111111] border rounded-2xl duration-200",
              isFocused
                ? "border-white/20 ring-1 ring-white/8"
                : "border-white/8",
            )}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              placeholder={PLACEHOLDERS[placeholderIndex]}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              rows={1}
              style={{ minHeight: 56, maxHeight: 200 }}
              className="w-full bg-transparent text-sm resize-none px-5 pt-5 pb-4 placeholder:text-white/20 focus:outline-none sm:text-base"
            />

            <div className="flex justify-between items-center border-t border-white/6 px-4 py-2.5">
              <span className="text-white/20 text-xs">
                Press ⏎ to generate · Shift + ⏎ for new line
              </span>

              {isSignedIn ? (
                <Button
                  variant={prompt.trim() ? "default" : "secondary"}
                  className="font-semibold rounded-full h-8 px-5"
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                >
                  Generate
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <SignInButton>
                  <Button className="bg-white font-semibold rounded-full h-8 px-5">
                    Generate
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                className="bg-white/4 text-white/40 text-xs border border-white/8 rounded-full px-3 py-1.5 hover:bg-white/8 hover:text-white/70 hover:border-white/15"
                onClick={() => handleSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs mt-10">
          No credit card required · 10 free generations on sign up
        </p>
      </section>

      <section className="px-4 pb-32">
        <div className="max-w-5xl mx-auto bg-[#0f0f0f] border border-white/8 shadow shadow-black/60 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 bg-red-400 rounded-full" />
              <div className="w-3 h-3 bg-yellow-400 rounded-full" />
              <div className="w-3 h-3 bg-green-400 rounded-full" />
            </div>

            <div className="w-64 h-6 bg-white/5 flex justify-center items-center mx-auto rounded-md px-3">
              <span className="text-white/25 text-xs">forge.app/workspace</span>
            </div>
          </div>

          <div className="flex h-105">
            <div className="w-80 bg-[#0d0d0d] border-r border-white/6 flex flex-col">
              <div className="border-b border-white/6 px-4 py-3">
                <p className="text-white/30 text-xs uppercase tracking-wider">
                  Chat
                </p>
              </div>

              <div className="flex-1 space-y-4 px-4 py-4">
                <div className="flex justify-end">
                  <div className="max-w-55 bg-white/10 rounded-2xl rounded-br-sm px-3.5 py-2.5">
                    <p className="text-white/80 text-xs">
                      Build a kanban board with 3 columns and drag-and-drop
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="w-6 h-6 bg-white flex justify-center items-center rounded-md shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-black fill-black" />
                  </div>

                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <p className="text-white/60 text-xs">
                      I&apos;ll build a kanban board with Todo, In Progress, and
                      Done columns. I&apos;ll use{" "}
                      <code className="text-blue-400/80">@dnd-kit/core</code>{" "}
                      for smooth drag-and-drop...
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="w-6 h-6 bg-white flex justify-center items-center rounded-md shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-black fill-black" />
                  </div>

                  <div className="bg-white/5 flex items-center gap-1 rounded-2xl rounded-tl-sm px-3.5 py-3">
                    {[0, 0.15, 0.3].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/6 px-3 py-3">
                <div className="bg-white/5 flex items-center gap-2 rounded-xl px-3 py-2">
                  <span className="flex-1 text-white/20 text-xs">
                    Ask AI to modify...
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-white/20" />
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-1 border-b border-white/6 px-4">
                <button className="text-white text-xs border-b-2 border-blue-400 px-3 py-2.5">
                  Preview
                </button>

                <button className="text-white/30 text-xs px-3 py-2.5">
                  Code
                </button>
              </div>

              <div className="bg-[#141414] flex flex-1 gap-3 overflow-hidden p-5">
                {["Todo", "In Progress", "Done"].map((col, index) => (
                  <div key={col} className="w-1/3 flex flex-col gap-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white/40 text-xs uppercase tracking-wider">
                        {col}
                      </span>

                      <span className="bg-white/8 text-white/30 text-xs rounded-full px-1.5 py-0.5">
                        {[3, 2, 1][index]}
                      </span>
                    </div>

                    {Array.from({ length: [3, 2, 1][index] }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-[#1a1a1a] border border-white/8 rounded-lg p-2.5"
                      >
                        <div
                          className="bg-white/15 rounded-full h-2 mb-1.5"
                          style={{ width: `${60 + i * 15}%` }}
                        />
                        <div className="w-3/4 h-1.5 bg-white/8 rounded-full" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-32">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <SectionLabel>Everything you need</SectionLabel>
          <SectionHeading grayText="From prompt" blueText="to production." />
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 gap-px bg-white/6 border border-white/6 rounded-2xl overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="bg-[#0a0a0a] group p-7 hover:bg-[#0f0f0f]"
            >
              <div className="w-9 h-9 bg-white/4 border border-white/8 flex justify-center items-center rounded-lg mb-4 group-hover:bg-white/8 group-hover:border-white/15">
                <Icon className="w-4 h-4 text-white/60 group-hover:text-blue-400/70" />
              </div>

              <p className="text-sm font-semibold mb-2">{label}</p>

              <p className="text-white/40 text-sm leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 pb-32">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <SectionLabel>How it works</SectionLabel>
          <SectionHeading grayText="Four steps" blueText="to a working app." />
        </div>

        <div className="max-w-3xl mx-auto">
          {STEPS.map((step, i) => (
            <div key={step.step} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-white/4 flex justify-center items-center border border-white/10 rounded-full">
                  <span className="text-white/50 text-xs font-semibold font-mono">
                    {step.step}
                  </span>
                </div>

                {i < STEPS.length - 1 && (
                  <div className="w-px h-full bg-white/6 mt-2" />
                )}
              </div>

              <div className="pt-1.5 pb-10">
                <p className="text-sm font-semibold mb-1.5 sm:text-base">
                  {step.label}
                </p>

                <p className="text-white/40 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 pb-32">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <SectionLabel>Simple pricing</SectionLabel>
          <SectionHeading grayText="Start free," blueText="scale when ready." />

          <p className="max-w-sm mx-auto text-white/35 text-sm mt-4">
            No credit card required. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const planOrder: Record<string, number> = {
              free: 0,
              starter: 1,
              pro: 2,
            };

            const activePlanKey = isSignedIn
              ? has?.({ plan: "pro" })
                ? "pro"
                : has?.({ plan: "starter" })
                  ? "starter"
                  : "free"
              : null;

            const isActive = isSignedIn && activePlanKey === plan.key;

            const isDowngrade =
              isSignedIn &&
              activePlanKey !== null &&
              !isActive &&
              planOrder[plan.key] < planOrder[activePlanKey];

            return (
              <div
                key={plan.key}
                className={cn(
                  "relative flex flex-col border rounded-2xl transition-colors p-7",
                  plan.featured
                    ? "bg-blue-500/4 border-blue-500/25"
                    : "bg-[#0f0f0f] border-white/8",
                )}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#0a0a0a] text-blue-400 text-[11px] font-medium border border-blue-500/20 rounded-full px-3 py-1">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white/90 text-sm font-semibold">
                    {plan.label}
                  </p>

                  {isActive && (
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20 rounded-full px-2 py-0.5">
                      Active
                    </span>
                  )}
                </div>

                <p className="text-white/35 text-xs leading-relaxed mb-6">
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-serif">
                    {plan.price === 0 ? (
                      <GrayTitle>$0</GrayTitle>
                    ) : (
                      <BlueTitle>${plan.price}</BlueTitle>
                    )}
                  </span>

                  {plan.price > 0 && (
                    <span className="text-white/30 text-sm">/mo</span>
                  )}
                </div>

                <p className="text-white/25 text-xs mb-6">
                  {plan.price === 0 ? "Always free" : "Only billed monthly"}
                </p>

                <div className="border-t border-white/6 space-y-3 pt-6 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "w-4 h-4 flex justify-center items-center rounded-full shrink-0",
                          plan.featured ? "bg-blue-500/15" : "bg-white/8",
                        )}
                      >
                        <Check
                          className={cn(
                            "w-2.5 h-2.5",
                            plan.featured ? "text-blue-400" : "text-white/50",
                          )}
                        />
                      </div>
                      <span className="text-white/55 text-xs">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto">
                  {isActive ? (
                    <Button
                      variant="ghost"
                      className="w-full bg-transparent text-white/60 text-sm font-semibold border border-white/10 rounded-full cursor-not-allowed opacity-50"
                      disabled
                    >
                      ✓ Current plan
                    </Button>
                  ) : plan.price === 0 ? (
                    isSignedIn ? (
                      <Button
                        variant="ghost"
                        className="w-full bg-transparent text-white/60 text-sm font-semibold border border-white/10 rounded-full cursor-not-allowed opacity-50"
                        disabled
                      >
                        Default plan
                      </Button>
                    ) : (
                      <SignInButton>
                        <Button
                          variant="ghost"
                          className="w-full bg-transparent text-white/60 text-sm font-semibold border border-white/10 rounded-full hover:bg-white/6 hover:text-white/90"
                        >
                          Get started free
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </SignInButton>
                    )
                  ) : isSignedIn ? (
                    <CheckoutButton
                      planId={plan.planId}
                      planPeriod="month"
                      checkoutProps={{
                        appearance: {
                          elements: {
                            drawerRoot: {
                              zIndex: 1000,
                            },
                          },
                        },
                      }}
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full text-sm font-semibold rounded-full transition-all",
                          plan.featured
                            ? "bg-blue-500 text-white hover:bg-blue-400 active:scale-95"
                            : "bg-transparent text-white/60 border border-white/10 hover:bg-white/6 hover:text-white/90",
                        )}
                      >
                        {isDowngrade ? "Downgrade" : "Get started"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </CheckoutButton>
                  ) : (
                    <SignInButton>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full text-sm font-semibold rounded-full transition-all",
                          plan.featured
                            ? "bg-blue-500 text-white hover:bg-blue-400 active:scale-95"
                            : "bg-transparent text-white/60 border border-white/10 hover:bg-white/6 hover:text-white/90",
                        )}
                      >
                        Get started
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto text-center border border-white/8 rounded-2xl overflow-hidden px-10 py-24 mb-32">
        <HoleBackground
          className="absolute inset-0 w-full h-full"
          strokeColor="rgba(255,255,255,0.05)"
          style={{
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
          }}
        />

        <SectionHeading grayText="Start building," blueText="for free." />

        <p className="text-white/40 text-sm leading-relaxed mb-8">
          Get 10 free generations on sign up. No credit card required.
          <br />
          Upgrade when you&apos;re ready.
        </p>

        <SignInButton>
          <Button
            size="lg"
            className="relative bg-white rounded-full h-11 px-8"
          >
            Get started free
            <ChevronRight className="w-4 h-4" />
          </Button>
        </SignInButton>
      </section>

      <footer className="relative border-t border-white/7 flex flex-wrap justify-center items-center mx-auto z-10 px-6 py-6">
        <p className="text-blue-400 text-xs font-semibold font-serif uppercase tracking-[0.11em]">
          Made with <span className="text-purple-700">💜</span> by Jyothika
        </p>
      </footer>
    </main>
  );
}
