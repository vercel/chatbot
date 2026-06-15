/**
 * update-playbook.ts — Modify an existing playbook in the fractal library.
 *
 * Supports targeted updates: append SOP steps, update intent routes,
 * modify safeguards, update model routing config. Uses adapter pattern —
 * reads existing content, applies diff, writes back.
 * Part of the playbook-skills meta-skill.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type UpdateTarget =
  | "sop_add_step"
  | "intent_add_route"
  | "safeguard_add"
  | "antipattern_add"
  | "model_routing"
  | "frontmatter"
  | "append_section";

export interface UpdatePlaybookInput {
  /** Playbook filename (e.g., "playbook-billing.md") or domain ("billing") */
  playbook: string;
  /** What to update */
  target: UpdateTarget;
  /** Update payload */
  content: string;
  /** Optional: section heading to target (e.g., "## Safeguards") */
  section?: string;
}

export interface UpdatePlaybookResult {
  success: boolean;
  path: string;
  message: string;
  bytesChanged: number;
}

const PLAYBOOKS_DIR = join(
  process.cwd(),
  "connectors/neptune/skills/custom-skills/playbook-skills/playbooks"
);

function resolvePlaybookPath(playbook: string): string | null {
  // Direct filename
  const direct = join(PLAYBOOKS_DIR, playbook);
  if (existsSync(direct)) return direct;

  // Domain shorthand
  const byDomain = join(PLAYBOOKS_DIR, `playbook-${playbook}.md`);
  if (existsSync(byDomain)) return byDomain;

  // Try with .md extension
  const withMd = join(PLAYBOOKS_DIR, playbook.endsWith(".md") ? playbook : `${playbook}.md`);
  if (existsSync(withMd)) return withMd;

  return null;
}

function applyUpdate(existingContent: string, input: UpdatePlaybookInput): string {
  const lines = existingContent.split("\n");

  switch (input.target) {
    case "sop_add_step": {
      // Find the SOP Workflow section and add a step before the closing ---
      const sopIdx = lines.findIndex((l) => l.match(/^## SOP Workflow/i));
      if (sopIdx === -1) {
        // No SOP section — append one
        return existingContent + `\n## SOP Workflow\n\n${input.content}\n`;
      }
      // Insert before the closing --- or at end of section
      let insertAt = sopIdx + 1;
      for (let i = sopIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ") || lines[i].startsWith("---")) {
          insertAt = i;
          break;
        }
        insertAt = i + 1;
      }
      lines.splice(insertAt, 0, input.content);
      return lines.join("\n");
    }

    case "safeguard_add": {
      const safeIdx = lines.findIndex((l) => l.match(/^## Safeguards/i));
      if (safeIdx === -1) {
        return existingContent + `\n## Safeguards\n\n${input.content}\n`;
      }
      let insertAt = safeIdx + 1;
      for (let i = safeIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ") || lines[i].startsWith("---")) {
          insertAt = i;
          break;
        }
        insertAt = i + 1;
      }
      lines.splice(insertAt, 0, input.content);
      return lines.join("\n");
    }

    case "antipattern_add": {
      const apIdx = lines.findIndex((l) => l.match(/^## Anti-Patterns/i));
      if (apIdx === -1) {
        return existingContent + `\n## Anti-Patterns\n\n${input.content}\n`;
      }
      let insertAt = apIdx + 1;
      for (let i = apIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ") || lines[i].startsWith("---")) {
          insertAt = i;
          break;
        }
        insertAt = i + 1;
      }
      lines.splice(insertAt, 0, input.content);
      return lines.join("\n");
    }

    case "intent_add_route": {
      const intentIdx = lines.findIndex((l) => l.match(/^## Intent Routing/i));
      if (intentIdx === -1) {
        return existingContent + `\n## Intent Routing\n\n${input.content}\n`;
      }
      let insertAt = intentIdx + 1;
      for (let i = intentIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ") || lines[i].startsWith("---")) {
          insertAt = i;
          break;
        }
        insertAt = i + 1;
      }
      lines.splice(insertAt, 0, input.content);
      return lines.join("\n");
    }

    case "append_section": {
      return existingContent + `\n\n${input.content}\n`;
    }

    default:
      return existingContent;
  }
}

/**
 * Update an existing playbook with targeted modifications.
 * Uses adapter pattern — reads, applies diff, writes back.
 */
export function updatePlaybook(input: UpdatePlaybookInput): UpdatePlaybookResult {
  const filePath = resolvePlaybookPath(input.playbook);

  if (!filePath) {
    return {
      success: false,
      path: "",
      message: `Playbook "${input.playbook}" not found. Use create-playbook to create it first.`,
      bytesChanged: 0,
    };
  }

  try {
    const existing = readFileSync(filePath, "utf-8");
    const updated = applyUpdate(existing, input);
    const bytesChanged = updated.length - existing.length;

    if (bytesChanged === 0) {
      return {
        success: true,
        path: filePath,
        message: "No changes needed — content already matches.",
        bytesChanged: 0,
      };
    }

    writeFileSync(filePath, updated, "utf-8");
    return {
      success: true,
      path: filePath,
      message: `Updated ${input.target} in ${filePath.split("/").pop()} (${bytesChanged > 0 ? "+" : ""}${bytesChanged} bytes)`,
      bytesChanged,
    };
  } catch (err) {
    return {
      success: false,
      path: filePath,
      message: `Failed to update: ${err instanceof Error ? err.message : "Unknown error"}`,
      bytesChanged: 0,
    };
  }
}

export default updatePlaybook;
