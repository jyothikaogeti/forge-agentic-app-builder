"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProject } from "@/actions/projects";
import { ProjectSummary } from "@/types/project";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteProjectModalProps {
  project: ProjectSummary;
  children: React.ReactNode;
}

export default function DeleteProjectModal({
  project,
  children,
}: DeleteProjectModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProject(project.id);
        toast.success("Project Deleted");
        router.refresh();
      } catch {
        toast.error("Failed to delete project. Please try again.");
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>
      <DialogContent className="bg-[#111111] text-white border-white/8 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white/90 text-sm font-semibold">
            Delete project ?
          </DialogTitle>
          <DialogDescription className="text-white/35 text-xs">
            &ldquo;{project.title ?? "Untitled project"}&rdquo; will be
            permanently deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <DialogClose>
            <span className="text-white/40 text-xs pr-2 hover:text-white/70">
              Cancel
            </span>
          </DialogClose>

          <Button
            size="sm"
            className="bg-red-500/90 text-white text-xs font-semibold rounded-full h-8 px-4 hover:bg-red-500 disabled:opacity-50"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
