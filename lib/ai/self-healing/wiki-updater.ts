/**
 * Phase 24: Self-Healing Wiki Updater
 *
 * Auto-updates wiki pages based on log analysis findings.
 * DRY-RUN by default: logs intent to library_wiki_updates without writing files.
 * Manual review required before enabling write mode.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── Types ───────────────────────────────────────────────────────────

export interface WikiUpdateResult {
  pageSlug: string;
  reason: string;
  beforeContent: string | null;
  afterContent: string | null;
  id?: string;
  dryRun: boolean;
  written: boolean;
}

// ── Path Resolution ──────────────────────────────────────────────────

function resolveWikiPath(pageSlug: string): string {
  const base = join(process.cwd(), "docs");

  // Map slugs to expected paths
  const pathMap: Record<string, string> = {
    "nmi-golden-vault": "docs/PRD_NMI_GOLDEN_VAULT.md",
    "billing-patterns":
      "connectors/neptune/skills/custom-skills/playbook-skills/playbooks/billing/patterns.md",
    "disputes-patterns":
      "connectors/neptune/skills/custom-skills/playbook-skills/playbooks/disputes/patterns.md",
    "support-patterns":
      "connectors/neptune/skills/custom-skills/playbook-skills/playbooks/customer-support/patterns.md",
    "smart-retry":
      "lib/billing/smart-retry.ts",
    "playbook-router":
      "connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md",
  };

  return pathMap[pageSlug] || join(base, `${pageSlug}.md`);
}

// ── Persist ──────────────────────────────────────────────────────────

async function persistUpdate(
  pageSlug: string,
  reason: string,
  before: string | null,
  after: string | null,
  dryRun: boolean
): Promise<string | undefined> {
  if (!process.env.POSTGRES_URL) return undefined;

  const db = drizzle(postgres(process.env.POSTGRES_URL, { max: 1 }));

  try {
    const result = await db.execute(sql`
      INSERT INTO library_wiki_updates (page_slug, reason, before_content, after_content, triggered_by, dry_run)
      VALUES (${pageSlug}, ${reason}, ${before ?? null}, ${after ?? null}, 'log_analysis', ${dryRun})
      RETURNING id
    `);
    return ((result as any).rows[0] as any)?.id;
  } catch (err) {
    console.warn(
      "[wiki-updater] Failed to persist update:",
      (err as Error).message
    );
    return undefined;
  }
}

// ── Main Export ──────────────────────────────────────────────────────

/**
 * Update a wiki page with new content, logging the change.
 *
 * Default: DRY-RUN mode (logs intent, does NOT write files).
 * Set `writeMode: true` to actually write to disk (requires HIGH confidence).
 *
 * @param pageSlug - Wiki page identifier (e.g., 'nmi-golden-vault')
 * @param reason - Why the update is being made
 * @param newContent - The proposed new content
 * @param options - { writeMode?: boolean, append?: boolean }
 */
export async function updateWiki(
  pageSlug: string,
  reason: string,
  newContent: string,
  options: { writeMode?: boolean; append?: boolean } = {}
): Promise<WikiUpdateResult> {
  const { writeMode = false, append = false } = options;
  const filePath = resolveWikiPath(pageSlug);

  let beforeContent: string | null = null;
  let afterContent: string | null = null;
  let written = false;

  // Read current content
  if (existsSync(filePath)) {
    beforeContent = readFileSync(filePath, "utf-8");
  }

  if (append && beforeContent) {
    afterContent = beforeContent + "\n\n" + newContent;
  } else {
    afterContent = newContent;
  }

  // Write to disk if enabled
  if (writeMode) {
    try {
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, afterContent, "utf-8");
      written = true;
      console.log(
        `[wiki-updater] ✅ Updated ${pageSlug}: ${reason}`
      );
    } catch (err) {
      console.error(
        `[wiki-updater] ❌ Failed to write ${pageSlug}:`,
        (err as Error).message
      );
    }
  }

  // Always persist the update record
  const id = await persistUpdate(
    pageSlug,
    reason,
    beforeContent,
    afterContent,
    !writeMode
  );

  if (!writeMode) {
    console.log(
      `[wiki-updater] 🔍 DRY RUN: Would update "${pageSlug}" — ${reason}`
    );
  }

  return {
    pageSlug,
    reason,
    beforeContent,
    afterContent,
    id,
    dryRun: !writeMode,
    written,
  };
}
