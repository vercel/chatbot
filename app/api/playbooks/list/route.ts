/**
 * GET /api/playbooks/list — List all available playbooks.
 *
 * Scans the playbooks/ directory for playbook.md files and routines.json.
 * Returns name, path, priority, version, workflow count, and skill count.
 */

import { NextResponse } from "next/server";
import { readdir, readFile, access } from "fs/promises";
import { join } from "path";

interface PlaybookSummary {
  name: string;
  path: string;
  priority: string;
  version: string;
  status: string;
  workflows: number;
  skills: number;
  description: string;
}

export async function GET() {
  try {
    const playbooksDir = join(process.cwd(), "playbooks");
    const entries = await readdir(playbooksDir, { withFileTypes: true });
    const playbooks: PlaybookSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = join(playbooksDir, entry.name);
      const mdFiles = (await readdir(dirPath)).filter(
        (f) => f.startsWith("playbook-") && f.endsWith(".md")
      );

      let priority = "P2";
      let version = "0.0.0";
      let status = "inactive";
      let description = "";
      let workflowCount = 0;
      let skillCount = 0;

      // Try to read routines.json for metadata
      try {
        const routinesPath = join(dirPath, "routines.json");
        await access(routinesPath);
        const routinesRaw = await readFile(routinesPath, "utf-8");
        const routines = JSON.parse(routinesRaw);
        priority = routines.priority || priority;
        version = routines.version || version;
        status = routines.status || status;
        description = routines.description || "";
        workflowCount = routines.workflows?.length || 0;
        skillCount = routines.skills?.length || 0;
      } catch {
        // No routines.json — derive from file system
      }

      // Count workflow YAML files
      try {
        const wfDir = join(dirPath, "workflows");
        const wfFiles = await readdir(wfDir);
        if (wfFiles.length > workflowCount) workflowCount = wfFiles.length;
      } catch {
        // No workflows directory
      }

      playbooks.push({
        name: entry.name,
        path: `playbooks/${entry.name}`,
        priority,
        version,
        status,
        workflows: workflowCount,
        skills: skillCount,
        description,
      });
    }

    // Sort by priority (P0 first) then name
    const prioOrder = { P0: 0, P1: 1, P2: 2 };
    playbooks.sort(
      (a, b) =>
        (prioOrder[a.priority as keyof typeof prioOrder] ?? 3) -
          (prioOrder[b.priority as keyof typeof prioOrder] ?? 3) ||
        a.name.localeCompare(b.name)
    );

    return NextResponse.json(playbooks);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to list playbooks", detail: err?.message },
      { status: 500 }
    );
  }
}
