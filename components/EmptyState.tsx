import { Zap } from "lucide-react";
import Link from "next/link";

export default function EmptyState() {
  return (
    <div className="flex flex-col justify-center items-center text-center py-32">
      <div className="w-12 h-12 bg-white/4 flex justify-center items-center border border-white/8 rounded-xl mb-4">
        <Zap className="w-5 h-5 text-white/20" />
      </div>

      <p className="text-white/40 text-sm font-medium mb-1">No projects yet</p>

      <p className="text-white/20 text-xs mb-6">
        Head to the homepage and describe what you want to build.
      </p>

      <Link
        href="/"
        className="bg-white text-black text-[13px] font-semibold inline-flex items-center gap-1.5 rounded-full transition-opacity h-8 px-4 hover:opacity-90"
      >
        Start building
      </Link>
    </div>
  );
}
