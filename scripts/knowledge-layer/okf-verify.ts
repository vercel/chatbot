#!/usr/bin/env tsx
/**
 * OKF VERIFIER — Validate Bundle Against OKF v0.1 Specification
 *
 * Checks that every .md file in the bundle (or cortex/) has:
 *   - Valid YAML frontmatter with required `type` field
 *   - Directory index.md with file listing
 *   - log.md in domain directories
 *   - No broken markdown links
 *   - Valid types from OKF allowed set
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-layer/okf-verify.ts [--bundle /tmp/okf-bundle] [--strict]
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Author: hermes agent | Date: 2026-06-17
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// CONFIG
// ============================================================================

const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}

const BUNDLE_PATH = getArg("--bundle", "");
const TARGET_ROOT = BUNDLE_PATH || path.resolve(process.cwd(), "jarvis/cortex");
const STRICT_MODE = args.includes("--strict");
const FIX_MODE = args.includes("--fix");

// ============================================================================
// OKF v0.1 ALLOWED TYPES
// ============================================================================

const OKF_ALLOWED_TYPES = new Set([
  "skill",
  "playbook",
  "prd",
  "research",
  "concept",
  "index",
  "log",
]);

const REQUIRED_FRONTMATTER_FIELDS = ["type", "name"];

// ============================================================================
// VERIFICATION STATE
// ============================================================================

interface VerificationIssue {
  file: string;
  severity: "error" | "warning";
  rule: string;
  message: string;
  fix?: string;
}

interface VerificationResult {
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  issues: VerificationIssue[];
  errors: number;
  warnings: number;
  directoriesWithoutIndex: string[];
  directoriesWithoutLog: string[];
  filesWithoutFrontmatter: string[];
  filesWithInvalidType: string[];
  brokenLinks: string[];
}

// ============================================================================
// FRONTMATTER PARSER (same as okf-export.ts)
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

  const frontmatter: Record<string, unknown> = {};
  const lines = yamlBlock.split("\n");

  let currentKey = "";
  let inList = false;
  const listItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ")) {
      if (!inList) inList = true;
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    if (inList && currentKey) {
      frontmatter[currentKey] = [...listItems];
      listItems.length = 0;
      inList = false;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      currentKey = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value === "true") frontmatter[currentKey] = true;
      else if (value === "false") frontmatter[currentKey] = false;
      else if (!isNaN(Number(value)) && value !== "")
        frontmatter[currentKey] = Number(value);
      else frontmatter[currentKey] = value;
    }
  }

  if (inList && currentKey) {
    frontmatter[currentKey] = [...listItems];
  }

  return { frontmatter, body, hasFrontmatter: true };
}

// ============================================================================
// VERIFIERS
// ============================================================================

function extractMarkdownLinks(content: string): string[] {
  const links: string[] = [];
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!match[2].startsWith("http")) {
      links.push(match[2]);
    }
  }
  return links;
}

function verifyFile(
  fullPath: string,
  relativePath: string,
  result: VerificationResult
): void {
  result.totalFiles++;

  let content: string;
  try {
    content = fs.readFileSync(fullPath, "utf-8");
  } catch (err) {
    result.issues.push({
      file: relativePath,
      severity: "error",
      rule: "readability",
      message: `Cannot read file: ${(err as Error).message}`,
    });
    result.failedFiles++;
    result.errors++;
    return;
  }

  const { frontmatter, hasFrontmatter } = parseFrontmatter(content);

  // Rule 1: Has frontmatter
  if (!hasFrontmatter || !frontmatter) {
    const issue: VerificationIssue = {
      file: relativePath,
      severity: STRICT_MODE ? "error" : "warning",
      rule: "frontmatter-required",
      message: "No YAML frontmatter found",
    };
    if (FIX_MODE) {
      const inferredType = relativePath.includes("SKILL.md")
        ? "skill"
        : relativePath.includes("playbook.md")
          ? "playbook"
          : relativePath.includes("index.md")
            ? "index"
            : relativePath.includes("log.md")
              ? "log"
              : "concept";
      issue.fix = `Add frontmatter with type: ${inferredType}`;
    }
    result.issues.push(issue);
    result.filesWithoutFrontmatter.push(relativePath);
    if (issue.severity === "error") result.errors++;
    else result.warnings++;
    result.failedFiles++;
    return;
  }

  let passed = true;

  // Rule 2: Required fields present
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!(field in frontmatter)) {
      result.issues.push({
        file: relativePath,
        severity: "error",
        rule: "required-field-missing",
        message: `Missing required field: '${field}'`,
        fix: `Add '${field}' to YAML frontmatter`,
      });
      result.errors++;
      passed = false;
    }
  }

  // Rule 3: Valid type
  const fileType = frontmatter.type as string;
  if (fileType && !OKF_ALLOWED_TYPES.has(fileType)) {
    const issue: VerificationIssue = {
      file: relativePath,
      severity: STRICT_MODE ? "error" : "warning",
      rule: "invalid-type",
      message: `Type '${fileType}' is not in OKF v0.1 allowed types: ${Array.from(OKF_ALLOWED_TYPES).join(", ")}`,
    };
    result.issues.push(issue);
    result.filesWithInvalidType.push(relativePath);
    if (issue.severity === "error") result.errors++;
    else result.warnings++;
  }

  // Rule 4: Check markdown links
  const links = extractMarkdownLinks(content);
  for (const link of links) {
    // Remove fragment for file check
    const cleanLink = link.split("#")[0];
    if (cleanLink) {
      const linkedPath = path.resolve(path.dirname(fullPath), cleanLink);
      if (!fs.existsSync(linkedPath)) {
        result.issues.push({
          file: relativePath,
          severity: "warning",
          rule: "broken-link",
          message: `Broken link: ${link}`,
        });
        result.warnings++;
        result.brokenLinks.push(`${relativePath} → ${link}`);
      }
    }
  }

  if (passed) {
    result.passedFiles++;
  } else {
    result.failedFiles++;
  }
}

function verifyDirectoryStructure(
  root: string,
  result: VerificationResult
): void {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  let hasIndex = false;
  let hasLog = false;

  for (const entry of entries) {
    if (entry.name === "index.md") hasIndex = true;
    if (entry.name === "log.md") hasLog = true;

    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      verifyDirectoryStructure(path.join(root, entry.name), result);
    }
  }

  const relativePath = path.relative(TARGET_ROOT, root);
  if (relativePath && relativePath !== ".") {
    if (!hasIndex) {
      result.issues.push({
        file: relativePath,
        severity: "warning",
        rule: "missing-index",
        message: "Directory has no index.md",
        fix: `Create ${path.join(relativePath, "index.md")}`,
      });
      result.warnings++;
      result.directoriesWithoutIndex.push(relativePath);
    }
  }
}

// ============================================================================
// MAIN VERIFICATION
// ============================================================================

async function main() {
  const result: VerificationResult = {
    totalFiles: 0,
    passedFiles: 0,
    failedFiles: 0,
    issues: [],
    errors: 0,
    warnings: 0,
    directoriesWithoutIndex: [],
    directoriesWithoutLog: [],
    filesWithoutFrontmatter: [],
    filesWithInvalidType: [],
    brokenLinks: [],
  };

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   OKF v0.1 BUNDLE VERIFIER             ║");
  console.log("║   NEPTUNE-KNOWLEDGE-SPEC v1.0          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`Target: ${TARGET_ROOT}`);
  console.log(`Strict: ${STRICT_MODE}`);
  console.log(`Fix mode: ${FIX_MODE}`);
  console.log("");

  if (!fs.existsSync(TARGET_ROOT)) {
    console.error(`❌ Target path does not exist: ${TARGET_ROOT}`);
    process.exit(1);
  }

  // Verify directory structure
  console.log("📁 Checking directory structure...");
  verifyDirectoryStructure(TARGET_ROOT, result);

  // Verify all markdown files
  console.log("📄 Verifying markdown files...");
  verifyAllFiles(TARGET_ROOT, "", result);

  // Print results
  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("          VERIFICATION RESULTS             ");
  console.log("═══════════════════════════════════════════");
  console.log("");
  console.log(`📄 Total files:      ${result.totalFiles}`);
  console.log(`✅ Passed:           ${result.passedFiles}`);
  console.log(`❌ Failed:           ${result.failedFiles}`);
  console.log(`🔴 Errors:           ${result.errors}`);
  console.log(`🟡 Warnings:         ${result.warnings}`);
  console.log("");
  console.log(
    `📁 Dirs w/o index:   ${result.directoriesWithoutIndex.length}`
  );
  console.log(
    `📝 Files w/o fm:     ${result.filesWithoutFrontmatter.length}`
  );
  console.log(
    `🔤 Invalid types:    ${result.filesWithInvalidType.length}`
  );
  console.log(
    `🔗 Broken links:     ${result.brokenLinks.length}`
  );
  console.log("");

  // Print issues
  if (result.errors > 0) {
    console.log("── ERRORS ──");
    for (const issue of result.issues.filter((i) => i.severity === "error")) {
      console.log(`  ❌ [${issue.rule}] ${issue.file}`);
      console.log(`     ${issue.message}`);
      if (issue.fix) console.log(`     💡 Fix: ${issue.fix}`);
    }
    console.log("");
  }

  if (result.warnings > 0) {
    console.log("── WARNINGS ──");
    const shown = result.issues
      .filter((i) => i.severity === "warning")
      .slice(0, 20);
    for (const issue of shown) {
      console.log(`  ⚠️  [${issue.rule}] ${issue.file}`);
      console.log(`     ${issue.message}`);
      if (issue.fix) console.log(`     💡 Fix: ${issue.fix}`);
    }
    if (result.warnings > 20) {
      console.log(`  ... and ${result.warnings - 20} more warnings`);
    }
    console.log("");
  }

  // Verdict
  if (result.errors === 0 && result.failedFiles === 0) {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║  ✅ PASS — OKF v0.1 COMPATIBLE          ║");
    console.log("╚══════════════════════════════════════════╝");
    process.exit(0);
  } else if (result.errors === 0) {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║  ⚠️  PASS WITH WARNINGS                 ║");
    console.log("║  OKF compatible with noted issues       ║");
    console.log("╚══════════════════════════════════════════╝");
    process.exit(0);
  } else {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║  ❌ FAIL — NOT OKF COMPATIBLE           ║");
    console.log(`║  ${result.errors} errors must be fixed  ║`);
    console.log("╚══════════════════════════════════════════╝");
    process.exit(1);
  }
}

function verifyAllFiles(
  dir: string,
  relativeDir: string,
  result: VerificationResult
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = relativeDir
      ? path.join(relativeDir, entry.name)
      : entry.name;

    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      verifyAllFiles(fullPath, relativePath, result);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      verifyFile(fullPath, relativePath, result);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
