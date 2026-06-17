/**
 * /missions/[id]/plan-review — Plan Review Page (Server Component)
 *
 * Part of ENHANCED PLANNING PATTERN (Stream 4):
 *   After VPS enhancement completes, human reviews the enhanced plan here.
 *
 * Shows:
 *  - Side-by-side draft vs enhanced plan comparison
 *  - Research findings accordion
 *  - Pitfalls identified
 *  - Enhanced acceptance criteria checklist
 *  - Budget visualization (tokens + time)
 *  - Approve / Modify / Reject / Re-draft action buttons
 *
 * Auth: Clerk authenticated users only.
 *
 * Phase 38: Autonomous Coding Platform
 */

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { PlanReviewClient } from "./client";

export default async function PlanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return <PlanReviewClient missionId={id} user={session.user as { id?: string; name?: string | null; email?: string }} />;
}
