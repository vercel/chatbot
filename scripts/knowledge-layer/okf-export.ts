#!/usr/bin/env tsx
/**
 * OKF EXPORT — Generate Pure OKF v0.1 Bundle from NKS Cortex
 *
 * Walks the cortex/ directory tree, strips Neptune-extended frontmatter fields,
 * and produces a pure OKF-compliant bundle at the specified output path.
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-layer/okf-export.ts [--output /tmp/okf-bundle] [--dry-run]
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Author: hermes agent | Date: 2026-06-17
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// ============================================================================
// CONFIG
// ============================================================================

const CORTEX_ROOT = path.resolve(process.cwd(), "jarvis/cortex");
const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}

const OUTPUT_DIR = getArg("--output", "/tmp/okf-bundle");
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");

// ============================================================================
// TYPES
// ============================================================================

interface OkfFrontmatter {
  type: string;
  name: string;
  description?: string;
  version?: string;
  tags?: string[];
}

interface NksFrontmatter extends OkfFrontmatter {
  // Neptune-extended (will be stripped)
  domain?: string;
  mcp?: string;
  custom_client?: boolean;
  status?: string;
  owner?: string;
  budget?: number;
  eta?: string;
  dependencies?: string[];
  prd_ref?: string;
  session_id?: string;
  persistence?: string;
  scope?: string;
  refs?: string[];
  connectors?: string[];
  skills?: string[];
  workflows?: string[];
  functions?: string[];
  sources?: string[];
  summary?: string;
}

interface FileRecord {
  relativePath: string;
  fullPath: string;
  frontmatter: NksFrontmatter | null;
  content: string;
  strippedContent: string;
}

interface ExportStats {
  totalFiles: number;
  okfFiles: number;
  strippedFiles: number;
  skippedDirs: number;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// NEPTUNE-EXTENDED FIELDS TO STRIP
// ============================================================================

const NEPTUNE_EXTENDED_FIELDS = new Set([
  "domain",
  "mcp",
  "custom_client",
  "status",
  "owner",
  "budget",
  "eta",
  "dependencies",
  "prd_ref",
  "session_id",
  "persistence",
  "scope",
  "refs",
  "connectors",
  "skills",
  "workflows",
  "functions",
  "sources",
  "summary",
]);

// Directories to skip (Neptune-specific)
const SKIP_DIRS = new Set([
  "architecture",
  "code-patterns",
  "operational",
  "knowledge-base",
  "connectors",
  "functions",
  "workflows",
  "results",
  "memories",
  "spec",
]);

// ============================================================================
// FRONTMATTER PARSER
// ============================================================================

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
  hasFrontmatter: boolean;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)?$/);
  if (!match) {
    return { frontmatter: null, body: content, hasFrontmatter: false };
  }

  const yamlBlock = match[1];
  const body = match[2] || "";

  // Simple YAML parser (handles most NKS frontmatter)
  const frontmatter: Record<string, unknown> = {};
  const lines = yamlBlock.split("\n");

  let currentKey = "";
  let inList = false;
  const listItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // List item
    if (trimmed.startsWith("- ")) {
      if (!inList) {
        inList = true;
      }
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    // Flush list
    if (inList && currentKey) {
      frontmatter[currentKey] = [...listItems];
      listItems.length = 0;
      inList = false;
    }

    // Key: Value
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      currentKey = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Parse boolean
      if (value === "true") {
        frontmatter[currentKey] = true;
      } else if (value === "false") {
        frontmatter[currentKey] = false;
      } else if (!isNaN(Number(value)) && value !== "") {
        frontmatter[currentKey] = Number(value);
      } else {
        frontmatter[currentKey] = value;
      }
    }
  }

  // Flush remaining list
  if (inList && currentKey) {
    frontmatter[currentKey] = [...listItems];
  }

  return { frontmatter, body, hasFrontmatter: true };
}

// ============================================================================
// STRIPPING LOGIC
// ============================================================================

function stripNeptuneFields(
  frontmatter: Record<string, unknown>
): OkfFrontmatter {
  const okfFm: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!NEPTUNE_EXTENDED_FIELDS.has(key)) {
      // Map Neptune-specific types to OKF types
      if (key === "type" && typeof value === "string") {
        const typeMap: Record<string, string> = {
          trd: "prd",
          design: "prd",
          navigation: "prd",
          implementation: "prd",
          memory: "concept",
          connector: "concept",
          workflow: "concept",
        };
        okfFm[key] = typeMap[value] || value;
      } else {
        okfFm[key] = value;
      }
    }
  }

  return okfFm as OkfFrontmatter;
}

function rebuildFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ["---"];

  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === "string") {
      // Quote strings with special chars
      if (/[:\n#]/.test(value)) {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push("---");
  return lines.join("\n");
}

// ============================================================================
// FILE WALKER
// ============================================================================

function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.has(dirName);
}

function walkDirectory(
  dir: string,
  relativeTo: string,
  stats: ExportStats
): FileRecord[] {
  const records: FileRecord[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
          stats.skippedDirs++;
          if (VERBOSE) console.log(`  [skip-dir] ${relativePath}`);
          continue;
        }
        records.push(...walkDirectory(fullPath, relativeTo, stats));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const { frontmatter, body, hasFrontmatter } =
            parseFrontmatter(content);

          let strippedContent: string;

          if (hasFrontmatter && frontmatter) {
            const okfFm = stripNeptuneFields(frontmatter);
            const newFm = rebuildFrontmatter(okfFm as Record<string, unknown>);
            strippedContent = `${newFm}\n\n${body}`;
            stats.strippedFiles++;

            if (VERBOSE && Object.keys(frontmatter).length > Object.keys(okfFm).length) {
              console.log(`  [strip] ${relativePath}`);
            }
          } else {
            // No frontmatter — add minimal OKF frontmatter
            const inferredType = inferType(relativePath);
            strippedContent = `---\ntype: ${inferredType}\nname: "${path.basename(entry.name, '.md')}"\n---\n\n${body}`;
            stats.warnings.push(`No frontmatter in ${relativePath} — added minimal`);
          }

          records.push({
            relativePath,
            fullPath,
            frontmatter: frontmatter as NksFrontmatter | null,
            content,
            strippedContent,
          });
          stats.totalFiles++;
          stats.okfFiles++;
        } catch (err) {
          stats.errors.push(
            `Error reading ${relativePath}: ${(err as Error).message}`
          );
        }
      }
    }
  } catch (err) {
    stats.errors.push(
      `Error walking ${path.relative(relativeTo, dir)}: ${(err as Error).message}`
    );
  }

  return records;
}

function inferType(relativePath: string): string {
  if (relativePath.includes("SKILL.md")) return "skill";
  if (relativePath.includes("playbook.md")) return "playbook";
  if (relativePath.includes("prd.md")) return "prd";
  if (relativePath.includes("mission.md")) return "research"; // OKF compat
  if (relativePath.includes("research.md")) return "research";
  if (relativePath.includes("index.md")) return "index";
  if (relativePath.includes("log.md")) return "log";
  return "concept";
}

// ============================================================================
// INDEX GENERATOR
// ============================================================================

function generateBundleIndex(records: FileRecord[], stats: ExportStats): string {
  const byDir: Map<string, FileRecord[]> = new Map();

  for (const rec of records) {
    const dir = path.dirname(rec.relativePath);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(rec);
  }

  const lines: string[] = [
    "---",
    'type: index',
    'name: "Neptune Knowledge Bundle"',
    "description: OKF v0.1 compatible knowledge bundle exported from Neptune Knowledge Spec v1.0",
    `version: "1.0.0"`,
    `generated: "${new Date().toISOString()}"`,
    `totalFiles: ${stats.okfFiles}`,
    "---",
    "",
    "# Neptune Knowledge Bundle — OKF v0.1 Compatible",
    "",
    `> Generated: ${new Date().toISOString()}`,
    `> Source: NEPTUNE-KNOWLEDGE-SPEC v1.0`,
    `> Total files: ${stats.okfFiles}`,
    "",
    "## Files by Directory",
    "",
  ];

  const sortedDirs = Array.from(byDir.keys()).sort();

  for (const dir of sortedDirs) {
    const files = byDir.get(dir)!.sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath)
    );

    lines.push(`### ${dir || "(root)"}`);
    lines.push("");

    for (const file of files) {
      const fileName = path.basename(file.relativePath);
      const type = file.frontmatter?.type || inferType(file.relativePath);
      const description = file.frontmatter?.description || "";
      const version = file.frontmatter?.version || "0.1.0";
      const truncatedDesc =
        description.length > 80
          ? description.slice(0, 77) + "..."
          : description;

      lines.push(
        `- [${fileName}](./${file.relativePath}) — **${type}** v${version} — ${truncatedDesc}`
      );
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

async function main() {
  const stats: ExportStats = {
    totalFiles: 0,
    okfFiles: 0,
    strippedFiles: 0,
    skippedDirs: 0,
    warnings: [],
    errors: [],
  };

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   NEPTUNE → OKF v0.1 BUNDLE EXPORTER    ║");
  console.log("║   NEPTUNE-KNOWLEDGE-SPEC v1.0           ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`Source: ${CORTEX_ROOT}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log("");

  // Walk
  console.log("📁 Walking cortex directory tree...");
  const records = walkDirectory(CORTEX_ROOT, CORTEX_ROOT, stats);

  // Generate bundle index
  console.log("📄 Generating OKF bundle index...");
  const bundleIndex = generateBundleIndex(records, stats);

  if (DRY_RUN) {
    console.log("");
    console.log("═══ DRY RUN — No files written ═══");
    console.log("");
    console.log(`Total files found: ${stats.totalFiles}`);
    console.log(`OKF-compatible files: ${stats.okfFiles}`);
    console.log(`Neptune fields stripped: ${stats.strippedFiles}`);
    console.log(`Directories skipped: ${stats.skippedDirs}`);
    console.log(`Warnings: ${stats.warnings.length}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      for (const w of stats.warnings) console.log(`  - ${w}`);
    }
    if (stats.errors.length > 0) {
      console.log("\n❌ Errors:");
      for (const e of stats.errors) console.log(`  - ${e}`);
    }

    console.log("\n✅ Dry run complete. Run without --dry-run to export.");
    return;
  }

  // Write output
  console.log(`\n💾 Writing to ${OUTPUT_DIR}...`);

  // Clean output dir
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write each file
  for (const rec of records) {
    const outPath = path.join(OUTPUT_DIR, rec.relativePath);
    const outDir = path.dirname(outPath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, rec.strippedContent, "utf-8");
  }

  // Write bundle index
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "index.md"),
    bundleIndex,
    "utf-8"
  );

  // Write manifest
  const manifest = {
    format: "OKF v0.1",
    source: "NEPTUNE-KNOWLEDGE-SPEC v1.0",
    generated: new Date().toISOString(),
    exporter: "scripts/knowledge-layer/okf-export.ts",
    stats: {
      totalFiles: stats.totalFiles,
      okfCompatibleFiles: stats.okfFiles,
      neptuneFieldsStripped: stats.strippedFiles,
      directoriesSkipped: stats.skippedDirs,
      warnings: stats.warnings.length,
      errors: stats.errors.length,
    },
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "okf-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  // Summary
  console.log("");
  console.log("═══ EXPORT COMPLETE ═══");
  console.log("");
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`📄 Total files: ${stats.totalFiles}`);
  console.log(`✅ OKF compatible: ${stats.okfFiles}`);
  console.log(`🔄 Fields stripped: ${stats.strippedFiles}`);
  console.log(`⏭️  Dirs skipped: ${stats.skippedDirs}`);
  console.log(`⚠️  Warnings: ${stats.warnings.length}`);
  console.log(`❌ Errors: ${stats.errors.length}`);
  console.log(`📋 Manifest: ${path.join(OUTPUT_DIR, "okf-manifest.json")}`);
  console.log("");

  if (stats.warnings.length > 0) {
    console.log("Warnings:");
    for (const w of stats.warnings.slice(0, 10))
      console.log(`  ⚠️  ${w}`);
    if (stats.warnings.length > 10)
      console.log(`  ... and ${stats.warnings.length - 10} more`);
  }

  if (stats.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of stats.errors)
      console.log(`  ❌ ${e}`);
    process.exit(1);
  }

  // Auto-verify if verify script exists
  console.log("\n🔍 Running verification...");
  try {
    execSync(`pnpm tsx scripts/knowledge-layer/okf-verify.ts --bundle ${OUTPUT_DIR}`, {
      stdio: "inherit",
    });
  } catch {
    console.log("⚠️  Verification script not found or failed. Run manually:");
    console.log(`   pnpm tsx scripts/knowledge-layer/okf-verify.ts --bundle ${OUTPUT_DIR}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
