/**
 * Playbooks — hierarchical file-tree view of system prompt, workspace playbook,
 * skills, and domain playbooks organized by organization.
 */
import { auth } from "@/app/(auth)/auth";
import { cookies } from "next/headers";
import { PlaybooksClient } from "./client";

export default async function PlaybooksPage() {
  // Force dynamic rendering to bypass CDN cache
  cookies();
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Sign in required</p>
          <p className="text-sm">Sign in to browse playbooks.</p>
        </div>
      </div>
    );
  }

  return <PlaybooksClient />;
}
