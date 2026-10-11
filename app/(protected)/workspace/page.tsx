import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getWorkspaceId, getWorkspaceUser } from "@/actions/workspace";
import WorkspaceClient from "@/components/WorkspaceClient";

interface WorkspacePageProps {
  searchParams: Promise<{
    prompt?: string;
    id?: string;
  }>;
}

export default async function WorkspacePage({
  searchParams,
}: WorkspacePageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { prompt, id } = await searchParams;

  let workspace = null;

  const user = await getWorkspaceUser();
  if (id) {
    workspace = await getWorkspaceId(id, user.id);
  }

  return (
    <WorkspaceClient
      userId={user.id}
      userPlan={user.plan}
      userCredits={user.credits}
      workspace={workspace}
      initialPrompt={prompt ?? null}
    />
  );
}
