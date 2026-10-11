"use client";

import React from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRICING_PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BlueTitle, GrayTitle } from "@/components/Reusables";

interface PricingModalProps {
  children: React.ReactNode;
  reason?: "credits" | "upgrade";
}

export default function PricingModal({
  children,
  reason = "upgrade",
}: PricingModalProps) {
  const { has, isSignedIn } = useAuth();

  const title =
    reason === "credits" ? "You're out of credits" : "Upgrade your plan";
  const description =
    reason === "credits"
      ? "You've used all your credits. Upgrade to keep building."
      : "Choose a plan that fits how much you build.";

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

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] bg-[#0f0f0f] text-white border-white/8 overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl text-white/90 font-serif tracking-tight">
            <BlueTitle className="text-4xl">{title}</BlueTitle>
          </DialogTitle>
          <DialogDescription className="text-white/35 text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
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
                  "relative flex flex-col border rounded-2xl transition-colors p-5",
                  plan.featured
                    ? "bg-blue-500/4 border-blue-500/50"
                    : "bg-[#0a0a0a] border-white/12",
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
                      <SignInButton mode="modal">
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
                        {isDowngrade ? "Downgrade" : "Upgrade"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </CheckoutButton>
                  ) : (
                    <SignInButton mode="modal">
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full text-sm font-semibold rounded-full transition-all",
                          plan.featured
                            ? "bg-blue-500 text-white hover:bg-blue-400 active:scale-95"
                            : "bg-transparent text-white/60 border border-white/10 hover:bg-white/6 hover:text-white/90",
                        )}
                      >
                        Upgrade
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
