/**
 * /discovery — Discovery Workflows Dashboard
 *
 * Phase 38 Stream 5: Shows workflow template picker + active/completed runs.
 * Users can select a workflow template, configure parameters, and launch a run.
 * Active runs show live progress via SSE.
 */

import type { Metadata } from "next";
import { auth } from "@/app/(auth)/auth";
import { DiscoveryClient } from "./client";

export const metadata: Metadata = {
  title: "Discovery Workflows — Neptune Chat",
  description: "Audit Slack, cross-reference CRM, find misalignments",
};

export default async function DiscoveryPage() {
  const session = await auth();
  return <DiscoveryClient hasSession={!!session?.user} />;
}
