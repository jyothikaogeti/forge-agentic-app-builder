export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  imageUrl?: string;
}

export interface FileData {
  title?: string;
  files: Record<string, { code: string }>;
  dependencies: Record<string, string>;
}

export interface StatusStep {
  label: string;
  status: "running" | "done";
}

export interface WorkspaceData {
  id: string;
  title: string | null;
  messages: unknown;
  fileData: unknown;
}

export interface WorkspaceUser {
  id: string;
  credits: number;
  plan: string;
}
