#!/usr/bin/env tsx
/**
 * ADD TYPE FIELD — Migration script to add `type` field to all YAML frontmatter
 *
 * Walks all .md files in cortex/ and adds the `type` field to frontmatter
 * based on file path heuristics. Creates a backup before modifying.
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-layer/add-type-field.ts [--dry-run] [--backup]
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Author: hermes agent | Date: 2026-06-17
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CORTEX_ROOT = path.resolve(process.cwd(), "jarvis/cortex");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BACKUP = args.includes("--backup");

// ============================================================================
// TYPE INFERENCE
// ============================================================================

function inferType(filePath: string, fileName: string): string {
  const full = filePath + "/" + fileName;

  if (fileName === "index.md") return "index";
  if (fileName === "log.md") return "log";
  if (fileName === "SKILL.md" || full.includes("skills/")) return "skill";
  if (fileName === "playbook.md" || full.includes("playbooks/")) return "playbook";
  if (fileName === "prd.md" || (full.includes("/prd/") && !full.includes("trd.md") && !full.includes("design-doc") && !full.includes("navigation") && !full.includes("implementation"))) return "prd";
  if (fileName === "trd.md" || full.includes("trd.md")) return "trd";
  if (fileName === "design-doc.md" || full.includes("design-doc")) return "design";
  if (fileName === "navigation.md" || full.includes("navigation")) return "navigation";
  if (fileName === "implementation.md" || full.includes("implementation")) return "implementation";
  if (fileName === "research.md" || full.includes("/research/")) return "research";
  if (fileName === "mission.md" || full.includes("/missions/")) return "mission";
  if (full.includes("/memories/")) return "memory";
  if (full.includes("/connector")) return "connector";
  if (full.includes("/workflow")) return "workflow";

  return "concept";
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   TYPE FIELD MIGRATION                 ║");
  console.log("║   NEPTUNE-KNOWLEDGE-SPEC v1.0          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`Root: ${CORTEX_ROOT}`);
  console.log(`Dry Run: ${DRY_RUN} | Backup: ${BACKUP}`);
  console.log("");

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  function processFile(filePath: string, fileName: string) {
    const fullPath = path.join(filePath, fileName);
    let content: string;

    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch (err) {
      console.error(`  ❌ Cannot read: ${path.relative(CORTEX_ROOT, fullPath)}`);
      errors++;
      return;
    }

    // Check if frontmatter exists and has type
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      // No frontmatter — add minimal one
      const inferredType = inferType(filePath, fileName);
      const newContent = `---\ntype: ${inferredType}\nname: "${path.basename(fileName, '.md')}"\n---\n\n${content}`;

      const relPath = path.relative(CORTEX_ROOT, fullPath);
      if (DRY_RUN) {
        console.log(`  [dry-run] Would add fm: ${relPath} (type: ${inferredType})`);
      } else {
        if (BACKUP) {
          fs.writeFileSync(fullPath + ".bak", content, "utf-8");
        }
        fs.writeFileSync(fullPath, newContent, "utf-8");
        console.log(`  ✅ Added: ${relPath} (type: ${inferredType})`);
      }
      updated++;
      return;
    }

    const yamlBlock = fmMatch[1];

    // Check if type field already exists
    if (/^type:\s*\S/m.test(yamlBlock)) {
      skipped++;
      return;
    }

    // Add type field after the first line of frontmatter
    const inferredType = inferType(filePath, fileName);
    const newYaml = yamlBlock.replace(/^/, `type: ${inferredType}\n`);
    const newContent = content.replace(fmMatch[1], newYaml);

    const relPath = path.relative(CORTEX_ROOT, fullPath);
    if (DRY_RUN) {
      console.log(`  [dry-run] Would add type: ${relPath} → ${inferredType}`);
    } else {
      if (BACKUP) {
        fs.writeFileSync(fullPath + ".bak", content, "utf-8");
      }
      fs.writeFileSync(fullPath, newContent, "utf-8");
      console.log(`  ✅ Updated: ${relPath} (type: ${inferredType})`);
    }
    updated++;
  }

  function walkDir(dirPath: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile() && entry.name.endsWith(".md")) {
        processFile(dirPath, entry.name);
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        walkDir(fullPath);
      }
    }
  }

  console.log("📁 Walking files...\n");
  walkDir(CORTEX_ROOT);

  console.log("");
  console.log("═══ COMPLETE ═══");
  console.log(`Updated: ${updated} | Skipped (has type): ${skipped} | Errors: ${errors}`);

  if (DRY_RUN) {
    console.log("\n💡 Dry run complete. Run without --dry-run to write changes.");
    console.log("   Add --backup to create .bak files before modifying.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
