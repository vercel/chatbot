/**
 * Skills Library — browse 28 skills with categorization, search, and detail drawer.
 * Mobile-first. Fetches from /api/skills at the client for interactivity.
 */
import { auth } from "@/app/(auth)/auth";
import { cookies } from "next/headers";
import { SkillsLibraryClient } from "./client";

export default async function SkillsPage() {
  // Force dynamic rendering to bypass CDN cache
  cookies();
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Sign in required</p>
          <p className="text-sm">Sign in to browse the skills library.</p>
        </div>
      </div>
    );
  }

  return <SkillsLibraryClient />;
}
