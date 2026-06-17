#!/usr/bin/env tsx
/**
 * ADD LOG.MD — Auto-generate log.md from git history for each domain directory
 *
 * Extracts commit messages affecting files in each directory and generates
 * an append-only changelog in OKF log.md format.
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-layer/add-log-md.ts [--dry-run] [--days 90]
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Author: hermes agent | Date: 2026-06-17
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const CORTEX_ROOT = path.resolve(process.cwd(), "jarvis/cortex");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}

const DAYS = parseInt(getArg("--days", "90"), 10);

// ============================================================================
// GIT HISTORY EXTRACTOR
// ============================================================================

function getGitLog(dirPath: string, since: string): string[] {
  try {
    const relativePath = path.relative(process.cwd(), dirPath);
    const cmd = `git log --pretty=format:"%h|%ai|%an|%s" --since="${since}" -- "${relativePath}/"`;
    const output = execSync(cmd, { encoding: "utf-8", cwd: process.cwd() });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// LOG GENERATOR
// ============================================================================

function generateLog(dirPath: string, relativePath: string): string {
  const dirName = path.basename(dirPath) || "Knowledge Root";
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const gitEntries = getGitLog(dirPath, since);

  const lines: string[] = [
    "---",
    `name: "${dirName} Changelog"`,
    "type: log",
    `description: "Changelog for ${relativePath || dirName}"`,
    `generated: "${new Date().toISOString()}"`,
    "generator: add-log-md.ts",
    "---",
    "",
    `# Changelog — ${dirName}`,
    "",
    `> Auto-generated from git history (last ${DAYS} days).`,
    `> Entries are append-only. Add new entries at the top.`,
    "",
  ];

  if (gitEntries.length === 0) {
    lines.push("_No changes in the last " + DAYS + " days._");
    lines.push("");
    return lines.join("\n");
  }

  // Group by date
  const byDate: Map<string, string[]> = new Map();
  for (const entry of gitEntries) {
    const [hash, dateStr, author, ...messageParts] = entry.split("|");
    const date = dateStr.split(" ")[0]; // YYYY-MM-DD
    if (!byDate.has(date)) byDate.set(date, []);
    const message = messageParts.join("|");
    byDate.get(date)!.push(`${hash}|${dateStr}|${author}|${message}`);
  }

  // Sort dates descending
  const sortedDates = Array.from(byDate.keys()).sort().reverse();

  for (const date of sortedDates) {
    lines.push(`## ${date}`, "");
    for (const entry of byDate.get(date)!) {
      const [hash, dateStr, author, ...messageParts] = entry.split("|");
      const message = messageParts.join("|");
      lines.push(`- **${message}**`);
      lines.push(`  - commit: \`${hash}\` | author: ${author} | ${dateStr}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   LOG.MD GENERATOR (from git history)  ║");
  console.log("║   NEPTUNE-KNOWLEDGE-SPEC v1.0          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`Root: ${CORTEX_ROOT}`);
  console.log(`Days: ${DAYS}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log("");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  function processDir(dirPath: string, relativePath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const hasMdFiles = entries.some(
      (e) => e.isFile() && e.name.endsWith(".md") && e.name !== "log.md"
    );

    // Only create log.md for directories that have content files
    if (hasMdFiles) {
      const logPath = path.join(dirPath, "log.md");
      const hasLog = fs.existsSync(logPath);

      if (!hasLog) {
        const logContent = generateLog(dirPath, relativePath);

        if (DRY_RUN) {
          console.log(`  [dry-run] Would create: ${relativePath}/log.md`);
          created++;
        } else {
          fs.writeFileSync(logPath, logContent, "utf-8");
          console.log(`  ✅ Created: ${relativePath}/log.md`);
          created++;
        }
      } else {
        skipped++;
      }
    }

    // Recurse
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        processDir(
          path.join(dirPath, entry.name),
          relativePath ? path.join(relativePath, entry.name) : entry.name
        );
      }
    }
  }

  console.log("📁 Processing directories...\n");
  processDir(CORTEX_ROOT, "");

  console.log("");
  console.log("═══ COMPLETE ═══");
  console.log(`Created: ${created} | Skipped: ${skipped}`);

  if (DRY_RUN) {
    console.log("\n💡 Dry run complete. Run without --dry-run to write files.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
