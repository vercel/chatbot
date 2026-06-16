/**
 * /library/neptune — Agent-as-Connector View
 * Phase 22: Special detail view for Neptune itself — the AI agent.
 * Shows native skills, custom skills, and agent metadata.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { NeptuneClient } from "./client";

export const metadata: Metadata = {
  title: "Neptune — Agent-as-Connector",
  description: "The AI agent — native skills, custom skills, and agent metadata",
};

export default async function NeptunePage() {
  cookies(); // Force dynamic rendering

  return <NeptuneClient />;
}
