import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { getUser } from "@/lib/getUser";
import { Button } from "@/components/ui/button";
import PricingModal from "@/components/PricingModal";

export default async function Header() {
  const user = await getUser();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/7 border-b border-white/6 backdrop-blur-md z-100">
      <nav className="max-w-7xl h-full flex justify-between items-center mx-auto px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 select-none">
          <Image
            src="/forge-logo.png"
            alt="Forge Logo"
            width={100}
            height={100}
            className="w-auto h-9 rounded-md"
          />
        </Link>

        <div className="flex items-center gap-5">
          <Show when="signed-in">
            <Link
              href="/projects"
              className="text-white/40 text-[13px] font-medium transition-colors hover:text-white/80"
            >
              Projects
            </Link>

            {user && (
              <PricingModal>
                <span className="bg-white/5 text-white/70 text-xs border border-white/10 rounded-full inline-flex items-center gap-1.5 h-8 px-3">
                  <Zap className="w-3 h-3 fill-white/70" />
                  {user.credits} credits
                </span>
              </PricingModal>
            )}

            <UserButton />
          </Show>

          <Show when="signed-out">
            <SignInButton>
              <Button
                size="sm"
                variant="ghost"
                className="text-white/50 text-[13px] font-medium hover:bg-transparent hover:text-white/90"
              >
                Sign In
              </Button>
            </SignInButton>

            <SignUpButton>
              <Button
                size="sm"
                className="bg-white text-black text-[13px] font-semibold rounded-full inline-flex items-center gap-1.5 h-8 px-4 hover:bg-white/90 active:scale-95"
              >
                Get Started
                <ArrowRight className="w-3 h-3 opacity-60" />
              </Button>
            </SignUpButton>
          </Show>
        </div>
      </nav>
    </header>
  );
}
