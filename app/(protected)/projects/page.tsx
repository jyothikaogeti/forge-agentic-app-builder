import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import Link from "next/link";

import { getUserProjects } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { BlueTitle } from "@/components/Reusables";
import EmptyState from "@/components/EmptyState";
import ProjectCard from "@/components/ProjectCard";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const projects = await getUserProjects();

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <BlueTitle className="text-6xl">Projects</BlueTitle>
            <p className="text-white/30 text-sm mt-3">
              All your AI-generated apps in one place.
            </p>
          </div>

          <Link href="/">
            <Button className="cursor-pointer">
              <Zap className="w-3 h-3 fill-black" />
              New project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectCard projects={projects} />
        )}
      </div>
    </main>
  );
}
