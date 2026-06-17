#!/usr/bin/env npx tsx
/**
 * export-okf-bundle.ts — Phase 34 Stream 3
 * Walks cortex + playbooks + skills and outputs an OKF-compatible bundle.
 * Validates against OKF v0.1 spec, generates manifest.yaml, creates ZIP.
 *
 * Usage: npx tsx scripts/export-okf-bundle.ts [--output /tmp/neptune-okf-bundle]
 *
 * Author: abhiswami2121@gmail.com
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = "/tmp/neptune-okf-bundle";

// Knowledge roots to include in the bundle
const BUNDLE_ROOTS = [
  { source: "connectors", alias: "connectors" as const },
  { source: "playbooks", alias: "playbooks" as const },
  { source: "skills", alias: "skills" as const },
  { source: "shared-skills", alias: "shared-skills" as const },
  { source: "workflows", alias: "workflows" as const },
  { source: "jarvis/cortex", alias: "cortex" as const },
  { source: "docs", alias: "docs" as const },
  { source: "connector-skills", alias: "connector-skills" as const },
  { source: "proofs", alias: "proofs" as const },
] as const;

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.git/,
  /\.vercel/,
  /\.ts$/,
  /\.tsx$/,
  /\.json$/,
  /\.yaml$/,
  /\.yml$/,
  /\.lock$/,
  /\.env/,
];

interface BundleFile {
  path: string;
  type: string;
  name: string;
  description: string;
  version: string;
  updated: string;
  tags: string[];
  links: string[];
  size: number;
}

interface BundleDomain {
  name: string;
  path: string;
  file_count: number;
  concepts: BundleFile[];
}

interface BundleManifest {
  okf_version: string;
  bundle: {
    name: string;
    version: string;
    exported: string;
    total_files: number;
    total_directories: number;
    source_repo: string;
    source_commit: string;
  };
  domains: BundleDomain[];
  files: BundleFile[];
}

// --- YAML parsing ---

function extractFrontmatter(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return yaml.load(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractLinks(content: string): string[] {
  const links: string[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[2]);
  }
  return [...new Set(links)];
}

// --- File collection ---

function shouldInclude(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".md" && ext !== ".mdx") return false;

  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(filePath)) return false;
  }

  return true;
}

function collectFiles(sourceDir: string, basePath: string): BundleFile[] {
  const files: BundleFile[] = [];
  const fullPath = path.join(ROOT, sourceDir);

  if (!fs.existsSync(fullPath)) return files;

  function walk(dir: string, relativeDir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const relPath = path.join(relativeDir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(entryPath, relPath);
        } else if (entry.isFile() && shouldInclude(entryPath)) {
          const fm = extractFrontmatter(entryPath);
          const content = fs.readFileSync(entryPath, "utf-8");
          const stat = fs.statSync(entryPath);

          files.push({
            path: relPath,
            type: (fm?.type as string) || "concept",
            name: (fm?.name as string) || (fm?.description as string) || path.basename(entry.name, path.extname(entry.name)),
            description: (fm?.description as string) || (fm?.headline as string) || "",
            version: (fm?.version as string) || "0.1.0",
            updated: (fm?.updated as string) || stat.mtime.toISOString().split("T")[0],
            tags: (fm?.tags as string[]) || [],
            links: extractLinks(content),
            size: stat.size,
          });
        }
      }
    } catch (err) {
      console.error(`  ⚠️ Error walking ${dir}: ${err}`);
    }
  }

  walk(fullPath, basePath);
  return files;
}

// --- Generation ---

function generateManifest(allFiles: BundleFile[]): BundleManifest {
  const now = new Date().toISOString();

  // Group files by first path segment (domain)
  const domainMap = new Map<string, BundleFile[]>();
  for (const file of allFiles) {
    const domain = file.path.split("/")[0];
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(file);
  }

  const domains: BundleDomain[] = [];
  for (const [name, concepts] of domainMap) {
    domains.push({
      name,
      path: `${name}/`,
      file_count: concepts.length,
      concepts,
    });
  }

  // Get git commit
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {}

  // Count unique directories
  const dirs = new Set(allFiles.map(f => path.dirname(f.path)));

  return {
    okf_version: "0.1",
    bundle: {
      name: "neptune-cortex",
      version: "1.0.0",
      exported: now,
      total_files: allFiles.length,
      total_directories: dirs.size,
      source_repo: "github.com/abhiswami2121/neptune-chat",
      source_commit: commit,
    },
    domains,
    files: allFiles,
  };
}

function generateBundleIndex(manifest: BundleManifest): string {
  const now = new Date().toISOString().split("T")[0];

  let content = `---
type: index
name: "Neptune Cortex — OKF Bundle"
description: "Complete OKF v0.1 bundle of the Neptune Chat knowledge base"
version: "1.0.0"
updated: "${now}"
---

# Neptune Cortex — OKF v0.1 Bundle

This bundle contains the complete knowledge base of **Neptune Chat**, exported in OKF v0.1 format.

## Bundle Info

| Metric | Value |
|--------|-------|
| Total Files | ${manifest.bundle.total_files} |
| Total Directories | ${manifest.bundle.total_directories} |
| Source Repo | [${manifest.bundle.source_repo}](https://${manifest.bundle.source_repo}) |
| Source Commit | \`${manifest.bundle.source_commit}\` |
| Exported | ${manifest.bundle.exported} |
| OKF Version | ${manifest.okf_version} |

## Domains

`;

  for (const domain of manifest.domains) {
    content += `### ${domain.name}\n`;
    content += `**${domain.file_count} files** in \`${domain.path}\`\n\n`;
    content += `| File | Type | Version |\n`;
    content += `|------|------|--------|\n`;
    for (const file of domain.concepts.slice(0, 10)) {
      content += `| [${file.path}](./${file.path}) | ${file.type} | ${file.version} |\n`;
    }
    if (domain.concepts.length > 10) {
      content += `| ... | ... ${domain.concepts.length - 10} more files ... | |\n`;
    }
    content += `\n`;
  }

  content += `---\n*Bundle generated by Neptune OKF Export Tool. OKF v0.1 compatible.*\n`;

  return content;
}

function generateBundleLog(): string {
  const now = new Date().toISOString().split("T")[0];
  return `---
type: index
name: "Bundle Change Log"
description: "Chronological record of this OKF bundle's changes"
version: "1.0.0"
updated: "${now}"
---

# Bundle Change Log

## ${now}
- **Created:** Initial OKF v0.1 bundle export from neptune-chat
- **Source:** github.com/abhiswami2121/neptune-chat
- **Tool:** scripts/export-okf-bundle.ts
`;
}

// --- Validation ---

interface ValidationError {
  file: string;
  severity: "error" | "warning";
  message: string;
}

function validateOkfBundle(allFiles: BundleFile[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const file of allFiles) {
    // Check required fields
    if (!file.name) {
      errors.push({ file: file.path, severity: "error", message: "Missing 'name' field" });
    }
    if (!file.type || file.type === "concept") {
      errors.push({ file: file.path, severity: "warning", message: `Type is '${file.type}' — consider a more specific type` });
    }
    if (file.version === "0.1.0") {
      errors.push({ file: file.path, severity: "warning", message: "Version is 0.1.0 — bump to 1.0.0 when stable" });
    }

    // Check links validity
    for (const link of file.links) {
      const linkedFileExists = allFiles.some(f => f.path === link || f.path.endsWith(link));
      if (!linkedFileExists) {
        errors.push({ file: file.path, severity: "warning", message: `Broken link: ${link}` });
      }
    }

    // Check tags
    if (file.tags.length === 0) {
      errors.push({ file: file.path, severity: "warning", message: "No tags defined" });
    }
  }

  return errors;
}

// --- Execution ---

async function main() {
  const args = process.argv.slice(2);
  const outputArg = args.indexOf("--output");
  const outputDir = outputArg !== -1 ? args[outputArg + 1] : DEFAULT_OUTPUT;

  console.log("📦 Neptune OKF Bundle Export — Phase 34 Stream 3");
  console.log(`📂 Source: ${ROOT}`);
  console.log(`📂 Output: ${outputDir}\n`);

  // Collect all files
  console.log("🔍 Collecting knowledge files...");
  const allFiles: BundleFile[] = [];
  for (const root of BUNDLE_ROOTS) {
    const files = collectFiles(root.source, root.alias);
    allFiles.push(...files);
    console.log(`  📁 ${root.source}: ${files.length} files`);
  }

  console.log(`\n📊 Total files collected: ${allFiles.length}`);

  // Generate manifest
  console.log("\n📋 Generating manifest...");
  const manifest = generateManifest(allFiles);
  const manifestYaml = yaml.dump(manifest, { indent: 2, lineWidth: 120 });

  // Create output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, "_okf"), { recursive: true });

  // Write spec version
  fs.writeFileSync(path.join(outputDir, "_okf", "spec-version.txt"), "0.1\n", "utf-8");

  // Write manifest
  fs.writeFileSync(path.join(outputDir, "manifest.yaml"), manifestYaml, "utf-8");
  console.log("  ✅ manifest.yaml written");

  // Write index.md
  const bundleIndex = generateBundleIndex(manifest);
  fs.writeFileSync(path.join(outputDir, "index.md"), bundleIndex, "utf-8");
  console.log("  ✅ index.md written");

  // Write log.md
  const bundleLog = generateBundleLog();
  fs.writeFileSync(path.join(outputDir, "log.md"), bundleLog, "utf-8");
  console.log("  ✅ log.md written");

  // Copy files
  console.log("\n📋 Copying files to bundle...");
  let copied = 0;
  for (const root of BUNDLE_ROOTS) {
    const sourcePath = path.join(ROOT, root.source);
    const destPath = path.join(outputDir, root.alias);

    if (!fs.existsSync(sourcePath)) continue;

    // Use rsync-like copy
    function copyDir(src: string, dest: string) {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destFilePath = path.join(dest, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          copyDir(srcPath, destFilePath);
        } else if (entry.isFile() && shouldInclude(srcPath)) {
          fs.copyFileSync(srcPath, destFilePath);
          copied++;
        }
      }
    }

    copyDir(sourcePath, destPath);
    console.log(`  📁 ${root.source} → ${root.alias}/`);
  }

  console.log(`\n📊 Total files copied: ${copied}`);

  // Validate
  console.log("\n🔍 Validating against OKF v0.1 spec...");
  const validationErrors = validateOkfBundle(manifest.files);
  const criticalErrors = validationErrors.filter(e => e.severity === "error");
  const warnings = validationErrors.filter(e => e.severity === "warning");

  if (criticalErrors.length > 0) {
    console.log(`  ❌ ${criticalErrors.length} errors:`);
    for (const err of criticalErrors.slice(0, 5)) {
      console.log(`     ${err.file}: ${err.message}`);
    }
  }
  if (warnings.length > 0) {
    console.log(`  ⚠️ ${warnings.length} warnings (sample):`);
    for (const warn of warnings.slice(0, 5)) {
      console.log(`     ${warn.file}: ${warn.message}`);
    }
    if (warnings.length > 5) {
      console.log(`     ... and ${warnings.length - 5} more`);
    }
  }
  if (validationErrors.length === 0) {
    console.log("  ✅ No issues found");
  }

  // Create ZIP
  console.log("\n📦 Creating ZIP archive...");
  const zipPath = `${outputDir}.zip`;
  try {
    execSync(`cd ${path.dirname(outputDir)} && zip -r ${zipPath} ${path.basename(outputDir)} -x "*.ts" "*.tsx" "*.json" "*.lock"`, { stdio: "pipe" });
    const zipStat = fs.statSync(zipPath);
    console.log(`  ✅ ZIP created: ${zipPath} (${(zipStat.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.log(`  ⚠️ ZIP creation skipped (zip not available): ${err}`);
  }

  // Summary
  console.log(`\n✅ Phase 34 Stream 3 Complete`);
  console.log(`📊 Bundle: ${manifest.bundle.total_files} files in ${manifest.bundle.total_directories} dirs`);
  console.log(`📊 ${manifest.domains.length} domains`);
  console.log(`📂 Output: ${outputDir}/`);
  console.log(`🔗 Source commit: ${manifest.bundle.source_commit}`);

  // Write validation report
  const reportPath = path.join(outputDir, "_okf", "validation-report.txt");
  const report = [
    `OKF v0.1 Validation Report`,
    `Generated: ${new Date().toISOString()}`,
    `Bundle: neptune-cortex v1.0.0`,
    `Total files: ${manifest.bundle.total_files}`,
    ``,
    `Errors: ${criticalErrors.length}`,
    `Warnings: ${warnings.length}`,
    ``,
    ...validationErrors.map(e => `[${e.severity.toUpperCase()}] ${e.file}: ${e.message}`),
  ].join("\n");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`📋 Validation report: ${reportPath}`);
}

main().catch(err => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
