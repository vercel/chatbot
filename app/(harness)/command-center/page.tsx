/**
 * /command-center — Server Component
 *
 * Phase 29: Neptune Command Center UI
 * Auth gate: validates next-auth session, redirects to /login if unauthenticated.
 * Passes session to Client component for role-based UI.
 */

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { CommandCenterClient } from "./client";

export default async function CommandCenterPage() {
  const session = await auth();

  // Auth gate — must be signed in
  if (!session?.user) {
    redirect("/login");
  }

  // Block guests — command center requires a real account
  if (session.user.type === "guest") {
    redirect("/access-denied");
  }

  return <CommandCenterClient user={session.user} />;
}
