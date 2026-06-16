/**
 * /library — Agent OS Desktop Home
 * Phase 22: The liquid glass landing page with twin-view toggle + 4 category cards.
 *
 * Features:
 *  - Glass hero section with stats
 *  - Twin view toggle (Playbook ↔ Connector)
 *  - 4 category cards (Playbooks, Connectors, Skills, Workflows)
 *  - ⌘K command palette
 *  - Mobile responsive
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { LibraryClient } from "./client";

export const metadata: Metadata = {
  title: "Library — Agent OS File System",
  description: "Browse playbooks, connectors, skills, and workflows",
};

export default async function LibraryPage() {
  cookies(); // Force dynamic rendering

  // Fetch counts server-side
  let playbookCount = 15;
  let connectorCount = 17;
  let skillCount = 48;
  let workflowCount = 12;

  try {
    const [connRes, skillRes] = await Promise.allSettled([
      fetch("http://localhost:3000/api/connectors", { cache: "no-store" }),
      fetch("http://localhost:3000/api/skills", { cache: "no-store" }),
    ]);

    if (connRes.status === "fulfilled" && connRes.value.ok) {
      const data = await connRes.value.json();
      connectorCount = data.summary?.total ?? data.connectors?.length ?? 17;
    }
    if (skillRes.status === "fulfilled" && skillRes.value.ok) {
      const data = await skillRes.value.json();
      skillCount = data.summary?.totalSkills ?? data.skills?.length ?? 48;
    }
  } catch {
    // Use defaults
  }

  return (
    <LibraryClient
      playbookCount={playbookCount}
      connectorCount={connectorCount}
      skillCount={skillCount}
      workflowCount={workflowCount}
    />
  );
}
