/**
 * Memory — view current agent state: system prompt, loaded playbook, skills in scope,
 * conversation context, and recent cortex files.
 */
import { auth } from "@/app/(auth)/auth";
import { cookies } from "next/headers";
import { MemoryClient } from "./client";

export default async function MemoryPage() {
  // Force dynamic rendering to bypass CDN cache
  cookies();
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Sign in required</p>
          <p className="text-sm">Sign in to view agent memory.</p>
        </div>
      </div>
    );
  }

  return <MemoryClient />;
}
