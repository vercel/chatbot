/**
 * /discovery/[runId] — Discovery Run Detail & Report Viewer
 *
 * Shows live progress during execution, then full report with tabs
 * once completed: Summary | Findings | Customers | Graph | Download.
 */

import type { Metadata } from "next";
import { auth } from "@/app/(auth)/auth";
import { RunDetailClient } from "./client";

export const metadata: Metadata = {
  title: "Run Detail — Discovery Workflows",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const session = await auth();
  return <RunDetailClient runId={runId} hasSession={!!session?.user} />;
}
