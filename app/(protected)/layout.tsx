import React from "react";
import { auth } from "@clerk/nextjs/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();

  return <div className="mt-16">{children}</div>;
}
