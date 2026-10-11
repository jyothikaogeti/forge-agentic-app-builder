"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { WorkspaceData, WorkspaceUser } from "@/types/workspace";
import { prisma } from "@/lib/prisma";

export async function getWorkspaceUser(): Promise<WorkspaceUser> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const user = await prisma.user.findUnique({
    where: {
      clerkId,
    },
    select: {
      id: true,
      credits: true,
      plan: true,
    },
  });

  if (!user) redirect("/");
  return user;
}

export async function getWorkspaceId(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceData> {
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
      userId,
    },
    select: {
      id: true,
      title: true,
      messages: true,
      fileData: true,
    },
  });

  if (!workspace) redirect("/");
  return workspace;
}
