#!/usr/bin/env tsx
/**
 * ADD INDEX.MD — Auto-generate index.md for every directory in cortex/
 *
 * Reads all .md files in each directory, extracts frontmatter, and generates
 * a conformant index.md with file listing table and subdirectory listing.
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-layer/add-index-md.ts [--dry-run] [--force]
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Author: hermes agent | Date: 2026-06-17
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CORTEX_ROOT = path.resolve(process.cwd(), "jarvis/cortex");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const VERBOSE = args.includes("--verbose");

// ============================================================================
// FRONTMATTER PARSER (shared)
// ============================================================================

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlBlock = match[1];
  const fm: Record<string, unknown> = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("- ")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fm[key] = value;
    }
  }

  return Object.keys(fm).length > 0 ? fm : null;
}

// ============================================================================
// INDEX GENERATOR
// ============================================================================

function generateIndex(dirPath: string, relativePath: string): string {
  const dirName = path.basename(dirPath) || "Knowledge Root";
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  const mdFiles: { name: string; fm: Record<string, unknown> | null }[] = [];
  const subdirs: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "index.md") continue;

    if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const content = fs.readFileSync(path.join(dirPath, entry.name), "utf-8");
        const fm = parseFrontmatter(content);
        mdFiles.push({ name: entry.name, fm });
      } catch {
        mdFiles.push({ name: entry.name, fm: null });
      }
    } else if (entry.isDirectory()) {
      subdirs.push(entry.name);
    }
  }

  const lines: string[] = [
    "---",
    `name: "${dirName}"`,
    "type: index",
    `description: "Index of ${relativePath || dirName}"`,
    `generated: "${new Date().toISOString()}"`,
    "generator: add-index-md.ts",
    "---",
    "",
    `# ${dirName}`,
    "",
    "> Auto-generated index for OKF compatibility.",
    `> [View in Knowledge Graph](/knowledge?dir=${encodeURIComponent(relativePath)})`,
    "",
  ];

  // Files table
  if (mdFiles.length > 0) {
    lines.push("## Files", "");
    lines.push("| Name | Type | Description | Version | Tags |");
    lines.push("|------|------|-------------|---------|------|");

    for (const file of mdFiles.sort((a, b) => a.name.localeCompare(b.name))) {
      const type = (file.fm?.type as string) || inferType(file.name);
      const desc = ((file.fm?.description as string) || "").slice(0, 60);
      const version = (file.fm?.version as string) || "-";
      const tags = file.fm?.tags
        ? (Array.isArray(file.fm.tags) ? file.fm.tags.join(", ") : String(file.fm.tags))
        : "-";

      lines.push(
        `| [${file.name}](./${file.name}) | ${type} | ${desc} | ${version} | ${tags} |`
      );
    }
    lines.push("");
  }

  // Subdirectories
  if (subdirs.length > 0) {
    lines.push("## Subdirectories", "");
    lines.push("| Path | Description |");
    lines.push("|------|-------------|");
    for (const subdir of subdirs.sort()) {
      lines.push(`| [${subdir}/](./${subdir}/) | ${subdir} directory |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function inferType(fileName: string): string {
  if (fileName.includes("SKILL") || fileName.includes("skill")) return "skill";
  if (fileName.includes("playbook")) return "playbook";
  if (fileName.includes("prd") || fileName.includes("PRD")) return "prd";
  if (fileName.includes("trd") || fileName.includes("TRD")) return "trd";
  if (fileName.includes("research")) return "research";
  if (fileName.includes("mission")) return "mission";
  if (fileName.includes("log")) return "log";
  return "concept";
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   INDEX.MD GENERATOR                   ║");
  console.log("║   NEPTUNE-KNOWLEDGE-SPEC v1.0          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`Root: ${CORTEX_ROOT}`);
  console.log(`Dry Run: ${DRY_RUN} | Force: ${FORCE}`);
  console.log("");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  function processDir(dirPath: string, relativePath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    // Check if this directory needs an index
    const indexPath = path.join(dirPath, "index.md");
    const hasIndex = fs.existsSync(indexPath);

    if (!hasIndex || FORCE) {
      const indexContent = generateIndex(dirPath, relativePath);

      if (DRY_RUN) {
        console.log(`  [dry-run] Would create: ${relativePath}/index.md`);
        if (!hasIndex) created++;
        else updated++;
      } else {
        fs.writeFileSync(indexPath, indexContent, "utf-8");
        if (!hasIndex) {
          console.log(`  ✅ Created: ${relativePath}/index.md`);
          created++;
        } else {
          console.log(`  🔄 Updated: ${relativePath}/index.md`);
          updated++;
        }
      }
    } else {
      if (VERBOSE) console.log(`  ⏭️  Skipped: ${relativePath}/index.md (exists)`);
      skipped++;
    }

    // Recurse into subdirectories
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
  console.log(`Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);

  if (DRY_RUN) {
    console.log("\n💡 Dry run complete. Run without --dry-run to write files.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
