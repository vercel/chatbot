/**
 * /missions/[id] — Autonomous Mission Detail Page (Server Component)
 *
 * Full-page mission dashboard with:
 *  - Live SSE-streamed mission status
 *  - Per-stream progress visualization
 *  - Step timeline with real-time updates
 *  - Intervention controls (Pause / Resume / Inject / Abort)
 *  - Deploy timeline + live URL link
 *  - Terminal event log
 *
 * Auth: Clerk authenticated users only.
 *
 * Phase 38: Autonomous Coding Platform
 */

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { MissionDetailClient } from "./client";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return <MissionDetailClient missionId={id} user={session.user} />;
}
