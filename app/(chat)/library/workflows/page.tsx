/**
 * /library/workflows — Workflows Browser
 * Phase 22: Placeholder workflows grid page.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { WorkflowsClient } from "./client";

export const metadata: Metadata = {
  title: "Workflows — Agent Library",
  description: "Browse all automation workflows",
};

export default async function WorkflowsPage() {
  cookies();
  return <WorkflowsClient />;
}
