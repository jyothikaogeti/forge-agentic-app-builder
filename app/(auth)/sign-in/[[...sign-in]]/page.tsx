import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-theme";
import { HoleBackground } from "@/components/animate-ui/components/backgrounds/hole";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#08060D] flex items-center justify-center px-4">
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
      <SignIn appearance={clerkAppearance} forceRedirectUrl="/" />
    </main>
  );
}
