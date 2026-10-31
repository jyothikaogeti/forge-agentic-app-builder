"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";

import { ProjectSummary } from "@/types/project";
import DeleteProjectModal from "./DeleteProjectModal";

interface ProjectCardProps {
  projects: ProjectSummary[];
}

export default function ProjectCard({ projects }: ProjectCardProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg: grid-cols-3">
      {projects.map((project) => {
        const title = project.title ?? "Untitled Project";
        const timeAgo = formatDistanceToNow(new Date(project.updatedAt), {
          addSuffix: true,
        });
        const messageCount = Math.floor(project.messageCount / 2);

        return (
          <div
            key={project.id}
            className="relative group bg-[#0f0f0f] flex flex-col border border-white/6 rounded-xl transition-colors p-4  hover:bg-[#111111] hover:border-white/10"
          >
            <Link
              href={`/workspace?id=${project.id}`}
              className="absolute rounded-xl inset-0"
              aria-label={`Open ${title}`}
            />

            <div className="flex justify-between items-start gap-2 mb-2">
              <p className="text-white/80 text-sm font-medium leading-snug line-clamp-1">
                {title}
              </p>

              <DeleteProjectModal project={project}>
                <span className="relative text-white/20 z-10 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              </DeleteProjectModal>
            </div>

            {project.firstPrompt && (
              <p className="text-white/30 text-[12px] leading-relaxed line-clamp-2 mb-3">
                {project.firstPrompt}
              </p>
            )}

            <div className="flex items-center mt-auto gap-3 border-t border-white/4 pt-2">
              <span className="text-white/25 text-[11px] flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {messageCount} message{messageCount !== 1 ? "s" : ""}
              </span>
              <span className="text-white/20 text-[11px]">{timeAgo}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
