"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { ProjectSummary } from "@/types/project";

export async function getUserProjects(): Promise<ProjectSummary[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    select: {
      id: true,
    },
  });
  if (!user) redirect("/");

  const workspace = await prisma.workspace.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      title: true,
      messages: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return workspace.map((w) => {
    const messages = Array.isArray(w.messages) ? w.messages : [];
    const firstUserMessage = messages.find(
      (message): message is { role: string; content: string } =>
        typeof message === "object" &&
        message !== null &&
        (message as Record<string, unknown>).role === "user",
    );

    return {
      id: w.id,
      title: w.title,
      firstPrompt: firstUserMessage?.content?.slice(0, 120) ?? null,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      messageCount: Array.isArray(w.messages) ? w.messages.length : 0,
    };
  });
}

export async function deleteProject(workspaceId: string): Promise<void> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    select: {
      id: true,
    },
  });
  if (!user) redirect("/");

  await prisma.workspace.deleteMany({
    where: {
      id: workspaceId,
      userId: user?.id,
    },
  });

  revalidatePath("/projects");
}
