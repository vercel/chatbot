#!/usr/bin/env tsx
/**
 * NKS v1.0 Conformance Validator
 *
 * Validates all .md files across cortex/, playbooks/, skills/, connectors/, docs/,
 * shared-skills/, workflows/, proofs/, jarvis/ against the Neptune-Knowledge-Spec v1.0.
 *
 * Checks:
 *   - YAML frontmatter present
 *   - Required fields: type, name, description, version, updated, access
 *   - index.md per directory
 *   - log.md per domain root
 *   - Markdown links valid (no broken cross-refs)
 *   - Type field valid (from allowed NKS types)
 *
 * Auto-fix mode (--fix):
 *   - Adds missing index.md to directories with .md files
 *   - Adds missing type field to frontmatter
 *   - Updates stale updated timestamps (>90 days)
 *
 * Usage:
 *   pnpm tsx scripts/validate-nks-conformance.ts [--fix] [--report-only]
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const KNOWLEDGE_ROOTS = [
  "jarvis/cortex",
  "playbooks",
  "skills",
  "connectors",
  "shared-skills",
  "workflows",
  "docs",
  "proofs",
  "jarvis",
];

const REQUIRED_FIELDS = ["type", "name", "description", "version", "updated", "access"] as const;
const VALID_TYPES = new Set([
  "index", "concept", "prd", "spec", "playbook", "skill",
  "connector", "mission", "research", "memory", "workflow",
  "template", "audit", "design", "log",
]);
const VALID_ACCESS = new Set(["public", "internal", "restricted", "customer"]);

const args = process.argv.slice(2);
const FIX_MODE = args.includes("--fix");
const REPORT_ONLY = args.includes("--report-only");
const VERBOSE = args.includes("--verbose");

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileIssue {
  file: string;
  category: "missing_frontmatter" | "missing_required_field" | "invalid_type" |
            "invalid_access" | "invalid_version" | "broken_link" | "stale_timestamp" |
            "missing_index" | "missing_log" | "auto_fixed";
  severity: "error" | "warning" | "info";
  detail: string;
  autoFixed?: boolean;
}

interface ConformanceReport {
  generatedAt: string;
  totalFiles: number;
  totalDirs: number;
  conformantFiles: number;
  issues: FileIssue[];
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  autoFixable: number;
  needManual: number;
  html: string;
}

interface Frontmatter {
  type?: string;
  name?: string;
  description?: string;
  version?: string;
  updated?: string;
  access?: string;
  [key: string]: unknown;
}

// ─── YAML Frontmatter Parser ──────────────────────────────────────────────────

function parseFrontmatter(content: string): { fm: Frontmatter | null; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)?$/);
  if (!match) return { fm: null, body: content };

  const yamlBlock = match[1];
  const body = match[2] || "";
  const fm: Record<string, unknown> = {};

  const lines = yamlBlock.split("\n");
  let currentKey = "";
  const listItems: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Handle list items
    if (trimmed.startsWith("- ")) {
      inList = true;
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    // Flush list
    if (inList && currentKey) {
      fm[currentKey] = [...listItems];
      listItems.length = 0;
      inList = false;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      currentKey = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      // Strip quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parse booleans and numbers
      if (value === "true") fm[currentKey] = true;
      else if (value === "false") fm[currentKey] = false;
      else if (value === "" || value === "null" || value === "~") fm[currentKey] = null;
      else if (!isNaN(Number(value))) fm[currentKey] = Number(value);
      else fm[currentKey] = value;
    }
  }

  // Flush final list
  if (inList && currentKey) {
    fm[currentKey] = [...listItems];
  }

  return { fm: fm as Frontmatter, body };
}

// ─── Markdown Link Extractor ──────────────────────────────────────────────────

function extractLinks(content: string, filePath: string): { url: string; resolved: string; label: string }[] {
  const links: { url: string; resolved: string; label: string }[] = [];
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const label = match[1];
    const url = match[2];
    if (url.startsWith("http") || url.startsWith("#") || url.startsWith("mailto:")) continue;

    const resolved = (path as any).normalize(
      path.join(path.dirname(filePath), url.split("#")[0])
    );
    links.push({ url, resolved, label });
  }

  return links;
}

// ─── Main Validator ────────────────────────────────────────────────────────────

function validateAll(): ConformanceReport {
  const issues: FileIssue[] = [];
  const allMdFiles: string[] = [];
  const allDirs = new Set<string>();
  const allPaths = new Set<string>();

  console.log("🔍 Scanning knowledge directories...\n");

  // ── Collect all files and dirs ──
  for (const root of KNOWLEDGE_ROOTS) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) {
      if (VERBOSE) console.log(`  ⚠️  ${root}/ not found, skipping`);
      continue;
    }

    const walk = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        allDirs.add(dir);

        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          const relPath = path.relative(ROOT, entryPath);
          allPaths.add(relPath);

          if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
            allMdFiles.push(entryPath);
          } else if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            walk(entryPath);
          }
        }
      } catch {}
    };

    walk(rootPath);
  }

  console.log(`📁 Found ${allMdFiles.length} .md files in ${allDirs.size} directories\n`);

  let conformantCount = 0;
  const dirHasMd = new Set<string>(); // directories that contain .md files

  // ── Validate each file ──
  for (const filePath of allMdFiles) {
    const relPath = path.relative(ROOT, filePath);
    let content: string;

    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      issues.push({ file: relPath, category: "missing_frontmatter", severity: "error", detail: "Cannot read file" });
      continue;
    }

    const parentDir = path.dirname(filePath);
    dirHasMd.add(parentDir);

    const { fm, body } = parseFrontmatter(content);

    // ── Check frontmatter exists ──
    if (!fm) {
      issues.push({ file: relPath, category: "missing_frontmatter", severity: "error", detail: "No YAML frontmatter found" });

      // Auto-fix: add full frontmatter
      if (FIX_MODE) {
        autoFixAddFrontmatter(filePath, content, relPath);
        issues.push({ file: relPath, category: "auto_fixed", severity: "info", detail: "Auto-added full frontmatter", autoFixed: true });
      }
      continue;
    }

    // ── Check required fields ──
    let fileConformant = true;
    for (const field of REQUIRED_FIELDS) {
      if (!fm[field]) {
        issues.push({
          file: relPath,
          category: "missing_required_field",
          severity: "error",
          detail: `Missing required field: ${field}`
        });
        fileConformant = false;

        // Auto-fix: add type field
        if (FIX_MODE && field === "type") {
          const inferredType = inferType(relPath);
          if (inferredType) {
            autoFixAppendField(filePath, content, "type", `"${inferredType}"`);
            issues.push({ file: relPath, category: "auto_fixed", severity: "info", detail: `Auto-added type: ${inferredType}`, autoFixed: true });
            // Re-read for subsequent field checks
            content = fs.readFileSync(filePath, "utf-8");
          }
        }

        // Auto-fix: add access field (most common missing field)
        if (FIX_MODE && field === "access") {
          autoFixAppendField(filePath, content, "access", "internal");
          issues.push({ file: relPath, category: "auto_fixed", severity: "info", detail: `Auto-added access: internal`, autoFixed: true });
          content = fs.readFileSync(filePath, "utf-8");
        }
      }
    }

    // ── Check type validity ──
    if (fm.type && !VALID_TYPES.has(fm.type)) {
      issues.push({ file: relPath, category: "invalid_type", severity: "error", detail: `Invalid type: "${fm.type}"` });
      fileConformant = false;
    }

    // ── Check access validity ──
    if (fm.access && !VALID_ACCESS.has(fm.access)) {
      issues.push({ file: relPath, category: "invalid_access", severity: "warning", detail: `Invalid access: "${fm.access}"` });
    }

    // ── Check version format ──
    if (fm.version && typeof fm.version === "string" && !/^\d+\.\d+\.\d+/.test(fm.version)) {
      issues.push({ file: relPath, category: "invalid_version", severity: "warning", detail: `Non-semver version: "${fm.version}"` });
    }

    // ── Check stale timestamp (>90 days) ──
    if (fm.updated && typeof fm.updated === "string") {
      const match = fm.updated.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const daysSince = (Date.now() - new Date(match[1]).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 90) {
          issues.push({ file: relPath, category: "stale_timestamp", severity: "warning", detail: `Last updated ${Math.round(daysSince)} days ago` });

          if (FIX_MODE) {
            autoFixUpdateTimestamp(filePath, content);
            issues.push({ file: relPath, category: "auto_fixed", severity: "info", detail: "Updated timestamp to today", autoFixed: true });
          }
        }
      }
    }

    // ── Check markdown links ──
    const links = extractLinks(content, relPath);
    for (const link of links) {
      if (!allPaths.has(link.resolved)) {
        issues.push({ file: relPath, category: "broken_link", severity: "warning", detail: `Broken link: ${link.url} → ${link.resolved}` });
      }
    }

    if (fileConformant) conformantCount++;

    if (VERBOSE && fileConformant) {
      console.log(`  ✅ ${relPath}`);
    }
  }

  // ── Check for missing index.md ──
  for (const dir of dirHasMd) {
    const indexPath = path.join(dir, "index.md");
    if (!fs.existsSync(indexPath)) {
      const relDir = path.relative(ROOT, dir);
      issues.push({ file: relDir, category: "missing_index", severity: "warning", detail: "Directory has .md files but no index.md" });

      if (FIX_MODE) {
        genIndexMd(dir);
        issues.push({ file: relDir, category: "auto_fixed", severity: "info", detail: "Auto-generated index.md", autoFixed: true });
      }
    }
  }

  // ── Check for missing log.md ──
  for (const root of KNOWLEDGE_ROOTS) {
    const rootPath = path.join(ROOT, root);
    if (!fs.existsSync(rootPath)) continue;

    const checkLog = (dir: string, depth: number): void => {
      if (depth > 1) return; // Check at root + 1 level only
      const logPath = path.join(dir, "log.md");
      const hasMd = dirHasMd.has(dir) || dirHasMd.has(dir + "/"); // simplified
      if (!fs.existsSync(logPath)) {
        const relDir = path.relative(ROOT, dir);
        if (depth === 0) {
          issues.push({ file: relDir, category: "missing_log", severity: "warning", detail: "Domain root has no log.md" });
          if (FIX_MODE) {
            genLogMd(dir);
            issues.push({ file: relDir, category: "auto_fixed", severity: "info", detail: "Auto-generated log.md", autoFixed: true });
          }
        }
      }
    };
    checkLog(rootPath, 0);
  }

  // ── Compile report ──
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = { error: 0, warning: 0, info: 0 };

  for (const issue of issues) {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  }

  const autoFixable = Object.values(byCategory).reduce((sum, v) => sum + v, 0);

  return {
    generatedAt: new Date().toISOString(),
    totalFiles: allMdFiles.length,
    totalDirs: allDirs.size,
    conformantFiles: conformantCount,
    issues,
    byCategory,
    bySeverity,
    autoFixable: issues.filter(i => i.category === "missing_index" || i.category === "missing_required_field" || i.category === "stale_timestamp").length,
    needManual: issues.filter(i => i.category === "broken_link" || i.category === "missing_frontmatter").length,
    html: "",
  };
}

// ─── Helper: Infer Type ────────────────────────────────────────────────────────

function inferType(filePath: string): string | null {
  const rel = path.relative(ROOT, filePath);
  if (rel.includes("playbook")) return "playbook";
  if (rel.includes("/skills/")) return "skill";
  if (rel.includes("connector")) return "connector";
  if (rel.includes("prd")) return "prd";
  if (rel.includes("research")) return "research";
  if (rel.includes("spec")) return "spec";
  if (rel.includes("design")) return "design";
  if (rel.includes("audit")) return "audit";
  if (rel.endsWith("index.md")) return "index";
  if (rel.endsWith("log.md")) return "log";
  return "concept";
}

// ─── Auto-fix Functions ────────────────────────────────────────────────────────

function autoFixAppendField(filePath: string, content: string, field: string, value: string): void {
  // Append a field to existing YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return;

  const fmBlock = match[1];
  // Insert before the closing --- (last line of match[0] minus ---)
  const closingIdx = content.indexOf("\n---", match.index! + 4);
  if (closingIdx === -1) return;

  const beforeClose = content.slice(0, closingIdx);
  const afterClose = content.slice(closingIdx);
  const newContent = `${beforeClose}\n${field}: ${value}${afterClose}`;
  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`  🔧 Auto-fixed ${path.relative(ROOT, filePath)}: added ${field}: ${value}`);
}

function autoFixAddFrontmatter(filePath: string, content: string, relPath: string): void {
  const now = new Date().toISOString().split("T")[0];
  const inferredType = inferType(relPath) || "concept";
  const name = path.basename(filePath, path.extname(filePath)).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const fm = `---
type: "${inferredType}"
name: "${name}"
description: "Auto-generated description for ${name}"
version: "1.0.0"
updated: "${now}"
access: internal
---

`;
  // Check if content starts with # (heading)
  const newContent = fm + content.trimStart();
  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`  🔧 Auto-fixed ${relPath}: added full frontmatter`);
}

function autoFixAddField(filePath: string, content: string, field: string, value: string): void {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    // No frontmatter at all — add one
    const now = new Date().toISOString().split("T")[0];
    const newFm = `---
type: "${value}"
name: "${path.basename(filePath, path.extname(filePath))}"
description: "Auto-generated description"
version: "1.0.0"
updated: "${now}"
access: internal
---
${content}`;
    fs.writeFileSync(filePath, newFm, "utf-8");
    console.log(`  🔧 Auto-fixed ${path.relative(ROOT, filePath)}: added full frontmatter`);
    return;
  }

  const fmBlock = match[1];
  const newFmBlock = `${fmBlock}\n${field}: "${value}"`;
  const newContent = content.replace(/^---\n([\s\S]*?)\n---/, `---\n${newFmBlock}\n---`);
  fs.writeFileSync(filePath, newContent, "utf-8");
  console.log(`  🔧 Auto-fixed ${path.relative(ROOT, filePath)}: added ${field}: "${value}"`);
}

function autoFixUpdateTimestamp(filePath: string, content: string): void {
  const today = new Date().toISOString().split("T")[0];
  const newContent = content.replace(/updated:\s*"?\d{4}-\d{2}-\d{2}"?/g, `updated: "${today}"`);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`  🔧 Auto-fixed ${path.relative(ROOT, filePath)}: updated timestamp to ${today}`);
  }
}

function genIndexMd(dirPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith(".md") && !e.name.startsWith("."));
  const subDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules");
  const now = new Date().toISOString().split("T")[0];
  const dirName = path.basename(dirPath);

  let content = `---
type: index
name: "${dirName}"
description: "Index of knowledge artifacts in ${dirName}/"
version: "1.0.0"
updated: "${now}"
access: internal
---

# ${dirName}

## Files
${mdFiles.map(f => `- [${f.name.replace(".md", "")}](./${f.name})`).join("\n") || "- (No .md files)"}

## Subdirectories
${subDirs.map(d => `- [${d.name}/](./${d.name}/index.md)`).join("\n") || "- (No subdirectories)"}

---
*Auto-generated by validate-nks-conformance.ts. NKS v1.0 compliant.*
`;

  const indexPath = path.join(dirPath, "index.md");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, content, "utf-8");
  }
}

function genLogMd(dirPath: string): void {
  const now = new Date().toISOString().split("T")[0];
  const dirName = path.basename(dirPath);

  const content = `---
type: index
name: "${dirName} Change Log"
description: "Chronological change log for ${dirName}/"
version: "1.0.0"
updated: "${now}"
access: internal
---

# ${dirName} Change Log

## ${now}
- Initial log.md created by NKS conformance validator

---
*Auto-generated by validate-nks-conformance.ts.*
`;

  const logPath = path.join(dirPath, "log.md");
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, content, "utf-8");
  }
}

// ─── Generate HTML Report ──────────────────────────────────────────────────────

function generateHtml(report: ConformanceReport): string {
  const conformanceRate = report.totalFiles > 0
    ? ((report.conformantFiles / report.totalFiles) * 100).toFixed(1)
    : "0.0";

  const categoryRows = Object.entries(report.byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, count]) => `<tr><td>${cat}</td><td>${count}</td></tr>`)
    .join("");

  const issueRows = report.issues
    .filter(i => i.severity === "error" || i.severity === "warning")
    .slice(0, 100)
    .map(i => `<tr>
      <td style="color:${i.severity === 'error' ? '#ef4444' : '#f59e0b'}">${i.severity.toUpperCase()}</td>
      <td>${i.category}</td>
      <td style="font-size:12px">${i.file}</td>
      <td style="font-size:12px">${i.detail}</td>
      ${i.autoFixed ? '<td style="color:#14b8a6">✅ Fixed</td>' : '<td></td>'}
    </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NKS Conformance Report — ${new Date().toISOString().split("T")[0]}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; max-width: 1200px; margin: 0 auto; background: #0f172a; color: #e2e8f0; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; color: #94a3b8; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.25rem; border: 1px solid #334155; }
    .card .value { font-size: 2rem; font-weight: 700; }
    .card .label { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
    .success { color: #14b8a6; } .warning { color: #f59e0b; } .error { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; }
    .bar { height: 8px; border-radius: 4px; margin: 0.5rem 0; }
    .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .auto-fix-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
    .tag { padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.75rem; }
    .tag-auto { background: #14b8a620; color: #14b8a6; border: 1px solid #14b8a640; }
    .tag-manual { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
  </style>
</head>
<body>
  <h1>📋 NKS v1.0 Conformance Report</h1>
  <p style="color: #94a3b8; font-size: 0.875rem;">Generated: ${report.generatedAt} | Validator: validate-nks-conformance.ts</p>

  <div class="cards">
    <div class="card">
      <div class="value">${report.totalFiles}</div>
      <div class="label">Total .md Files Scanned</div>
    </div>
    <div class="card">
      <div class="value success">${report.conformantFiles}</div>
      <div class="label">Fully Conformant Files</div>
    </div>
    <div class="card">
      <div class="value ${Number(conformanceRate) > 80 ? 'success' : Number(conformanceRate) > 50 ? 'warning' : 'error'}">${conformanceRate}%</div>
      <div class="label">Conformance Rate</div>
      <div class="bar" style="background:#334155"><div class="bar-fill" style="width:${conformanceRate}%;background:${Number(conformanceRate) > 80 ? '#14b8a6' : Number(conformanceRate) > 50 ? '#f59e0b' : '#ef4444'}"></div></div>
    </div>
    <div class="card">
      <div class="value">${report.totalDirs}</div>
      <div class="label">Total Directories</div>
    </div>
    <div class="card">
      <div class="value error">${report.bySeverity.error || 0}</div>
      <div class="label">Errors</div>
    </div>
    <div class="card">
      <div class="value warning">${report.bySeverity.warning || 0}</div>
      <div class="label">Warnings</div>
    </div>
  </div>

  <div class="auto-fix-list">
    <span class="tag tag-auto">🔧 ${report.autoFixable} auto-fixable</span>
    <span class="tag tag-manual">✋ ${report.needManual} need manual fix</span>
  </div>

  <h2>Issues by Category</h2>
  <table>
    <tr><th>Category</th><th>Count</th></tr>
    ${categoryRows}
  </table>

  <h2>Top Issues (${
    report.issues.filter(i => i.severity === "error" || i.severity === "warning").length
  } total)</h2>
  <table>
    <tr><th>Severity</th><th>Category</th><th>File</th><th>Detail</th><th>Auto-Fix</th></tr>
    ${issueRows}
  </table>

  <p style="margin-top: 2rem; font-size: 0.75rem; color: #475569; text-align: center;">
    NKS v1.0 Conformance Validator · Neptune-Knowledge-Spec Reference Implementation
  </p>
</body>
</html>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log("══════════════════════════════════════════");
  console.log("  NKS v1.0 Conformance Validator");
  console.log("  Mode: " + (FIX_MODE ? "🔧 AUTO-FIX" : "📋 REPORT"));
  console.log("══════════════════════════════════════════\n");

  const report = validateAll();

  const conformanceRate = report.totalFiles > 0
    ? ((report.conformantFiles / report.totalFiles) * 100).toFixed(1)
    : "0.0";

  console.log("\n══════════════════════════════════════════");
  console.log(`  📊 SUMMARY`);
  console.log(`  Total files:    ${report.totalFiles}`);
  console.log(`  Conformant:     ${report.conformantFiles} (${conformanceRate}%)`);
  console.log(`  Errors:         ${report.bySeverity.error || 0}`);
  console.log(`  Warnings:       ${report.bySeverity.warning || 0}`);
  console.log(`  Auto-fixable:   ${report.autoFixable}`);
  console.log(`  Need manual:    ${report.needManual}`);
  console.log("══════════════════════════════════════════");

  // Generate HTML report
  const html = generateHtml(report);
  const htmlPath = path.join(ROOT, "docs", "nks-conformance-report-2026-06-17.html");
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`\n✅ HTML report: ${htmlPath}`);

  // Generate Markdown report
  const mdPath = path.join(ROOT, "docs", "nks-conformance-report-2026-06-17.md");
  const mdContent = `# NKS v1.0 Conformance Report
**Generated:** ${report.generatedAt}
**Validator:** validate-nks-conformance.ts

## Summary

| Metric | Value |
|--------|-------|
| Total .md files | ${report.totalFiles} |
| Fully conformant | ${report.conformantFiles} |
| Conformance rate | ${conformanceRate}% |
| Errors | ${report.bySeverity.error || 0} |
| Warnings | ${report.bySeverity.warning || 0} |
| Auto-fixable | ${report.autoFixable} |
| Need manual fix | ${report.needManual} |
| Total directories | ${report.totalDirs} |

## Issues by Category

${Object.entries(report.byCategory).sort(([,a],[,b]) => b - a).map(([cat, count]) => `| ${cat} | ${count} |`).join("\n")}

## Top Issues

${report.issues.filter(i => i.severity === "error" || i.severity === "warning").slice(0, 50).map(i => `- **${i.severity.toUpperCase()}** [${i.category}] \`${i.file}\`: ${i.detail}${i.autoFixed ? " ✅ Fixed" : ""}`).join("\n")}

---
*Report generated by validate-nks-conformance.ts. NEPTUNE-KNOWLEDGE-SPEC v1.0.*
`;
  fs.writeFileSync(mdPath, mdContent, "utf-8");
  console.log(`✅ Markdown report: ${mdPath}`);

  // Output brief for CI
  const exitCode = (report.bySeverity.error || 0) > 0 && !FIX_MODE ? 1 : 0;
  process.exit(exitCode);
}

main();
