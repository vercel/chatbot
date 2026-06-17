#!/usr/bin/env npx tsx
/**
 * generate-okf-indexes.ts — Phase 34 Stream 2
 * Auto-generates index.md for every knowledge directory in neptune-chat.
 * Adds `type` field to all YAML frontmatter in .md files.
 * Creates log.md at top-level knowledge roots.
 *
 * OKF v0.1 compatibility layer — Phase 34.
 * Author: abhiswami2121@gmail.com
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const ROOT = path.resolve(__dirname, "..");

// Directories to scan for OKF compliance
const KNOWLEDGE_ROOTS = [
  "connectors",
  "playbooks",
  "skills",
  "shared-skills",
  "workflows",
  "jarvis",
  "jarvis/cortex",
  "docs",
  "proofs",
];

// Directories to exclude from index generation
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".vscode",
  ".cursor",
  ".agents",
  ".github",
  "public",
  "secrets",
  "vendor",
  "tests",
  "functions",
  "hooks",
  "lib",
  "components",
  "app",
  "artifacts",
  "__pycache__",
  "dist",
]);

// Files to exclude from content listings
const EXCLUDE_FILES = new Set([
  ".DS_Store",
  "pnpm-lock.yaml",
  "tsconfig.tsbuildinfo",
]);

interface FileInfo {
  name: string;
  path: string;
  type: string;
  description: string;
  yamlType?: string;
  version?: string;
}

interface YamlFrontmatter {
  type?: string;
  name?: string;
  description?: string;
  version?: string;
  domain?: string;
  tags?: string[];
  [key: string]: unknown;
}

// --- YAML extraction ---

function extractFrontmatter(filePath: string): YamlFrontmatter | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const parsed = yaml.load(match[1]) as Record<string, unknown>;
    return parsed as YamlFrontmatter;
  } catch {
    return null;
  }
}

// --- Type detection from filename/contents ---

function detectType(filePath: string, fm: YamlFrontmatter | null): string {
  // Use existing type field if present
  if (fm?.type) return fm.type;

  const basename = path.basename(filePath).toLowerCase();
  const dirname = path.dirname(filePath).toLowerCase();

  // Filename-based detection
  if (basename === "playbook.md" || basename.startsWith("playbook-")) return "playbook";
  if (basename === "skill.md" || basename === "skills.md") return "skill";
  if (basename === "index.md") return "index";
  if (basename === "log.md") return "index";
  if (basename.includes("prd")) return "prd";
  if (basename.includes("spec")) return "spec";
  if (basename.includes("research")) return "research";
  if (basename.includes("audit")) return "research";
  if (basename.includes("guide")) return "concept";
  if (basename.includes("pattern")) return "concept";
  if (basename.includes("anti-pattern")) return "concept";
  if (basename.includes("mission")) return "mission";
  if (basename.includes("memory")) return "memory";
  if (basename.includes("manifest")) return "index";
  if (basename.includes("readme")) return "index";

  // Directory-based detection
  if (dirname.includes("/playbooks") || dirname.includes("\\playbooks")) return "playbook";
  if (dirname.includes("/skills") || dirname.includes("\\skills")) return "skill";
  if (dirname.includes("/research") || dirname.includes("\\research")) return "research";
  if (dirname.includes("/missions") || dirname.includes("\\missions")) return "mission";
  if (dirname.includes("/docs") || dirname.includes("\\docs")) return "spec";
  if (dirname.includes("/workflows") || dirname.includes("\\workflows")) return "concept";
  if (dirname.includes("/connectors") || dirname.includes("\\connectors")) return "connector";
  if (dirname.includes("/proofs") || dirname.includes("\\proofs")) return "concept";

  // YAML field-based
  if (fm?.playbook || fm?.connector || fm?.name) return "playbook";

  return "concept";
}

function extractDescription(filePath: string, fm: YamlFrontmatter | null): string {
  if (fm?.description) return fm.description;
  if (fm?.headline) return (fm.headline as string).replace(/\n/g, " ").trim();

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    // Try to find first heading or meaningful paragraph
    const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n\n# (.+)/);
    if (bodyMatch) return bodyMatch[1];

    const paraMatch = content.match(/^---\n[\s\S]*?\n---\n\n([^#].+)/);
    if (paraMatch) return paraMatch[1].trim().slice(0, 200);
  } catch {}

  return `Knowledge artifact: ${path.basename(filePath)}`;
}

// --- Main logic ---

function isKnowledgeDir(dirPath: string): boolean {
  const rel = path.relative(ROOT, dirPath);
  if (!rel) return false;
  const parts = rel.split(path.sep);
  if (parts[0] && EXCLUDE_DIRS.has(parts[0])) return false;

  // Only process dirs under knowledge roots
  for (const root of KNOWLEDGE_ROOTS) {
    if (rel.startsWith(root) || rel === root) return true;
  }
  return false;
}

function getKnowledgeFiles(dirPath: string): FileInfo[] {
  const files: FileInfo[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !EXCLUDE_FILES.has(entry.name)) {
        const filePath = path.join(dirPath, entry.name);
        const fm = extractFrontmatter(filePath);
        files.push({
          name: entry.name,
          path: filePath,
          type: detectType(filePath, fm),
          description: extractDescription(filePath, fm),
          yamlType: fm?.type,
          version: fm?.version as string | undefined,
        });
      }
    }
  } catch {}
  return files;
}

function generateIndexContent(dirPath: string, dirName: string, files: FileInfo[], subDirs: string[]): string {
  const now = new Date().toISOString().split("T")[0];
  const relPath = path.relative(ROOT, dirPath) || ".";

  let content = `---
type: index
name: "${dirName}"
description: "Index of all knowledge artifacts in ${relPath}/"
version: "1.0.0"
updated: "${now}"
---

# ${dirName}

This directory contains knowledge artifacts for the \`${relPath}/\` domain.

## Contents

`;

  if (files.length > 0) {
    content += `| File | Type | Description |\n`;
    content += `|------|------|-------------|\n`;
    for (const f of files) {
      // Don't list index.md inside itself
      if (f.name === "index.md") continue;
      const desc = f.description.length > 60 ? f.description.slice(0, 57) + "..." : f.description;
      content += `| [${f.name}](./${f.name}) | ${f.type} | ${desc} |\n`;
    }
    content += `\n`;
  }

  if (subDirs.length > 0) {
    content += `## Subdirectories\n\n`;
    for (const d of subDirs) {
      content += `- [${d}/](./${d}/index.md)\n`;
    }
    content += `\n`;
  }

  content += `---\n*Index auto-generated by OKF compatibility layer. Last updated: ${now}.*\n`;

  return content;
}

function addTypeToYaml(filePath: string, detectedType: string): boolean {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return false;

    const fm = yaml.load(match[1]) as Record<string, unknown>;

    // Skip if already has type
    if (fm.type) return false;

    // Add type field
    const lines = content.split("\n");
    let insertIdx = -1;
    let inFrontmatter = false;
    let frontmatterStart = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
          frontmatterStart = i;
        } else {
          insertIdx = i;
          break;
        }
      }
    }

    if (insertIdx === -1) return false;

    // Insert type field before closing ---
    const newLines = [
      ...lines.slice(0, insertIdx),
      `type: "${detectedType}"`,
      ...lines.slice(insertIdx),
    ];

    fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function generateLogMd(knowledgeRoot: string): void {
  const dirPath = path.join(ROOT, knowledgeRoot);
  const logPath = path.join(dirPath, "log.md");
  const now = new Date().toISOString().split("T")[0];

  if (fs.existsSync(logPath)) {
    // Append to existing
    const existing = fs.readFileSync(logPath, "utf-8");
    if (!existing.includes("Phase 34")) {
      const entry = `\n## ${now}\n- **Phase 34:** OKF v0.1 compatibility layer added — index.md, type fields, log.md\n`;
      fs.writeFileSync(logPath, existing + entry, "utf-8");
    }
    return;
  }

  const content = `---
type: index
name: "${path.basename(knowledgeRoot)} Change Log"
description: "Chronological change log for ${knowledgeRoot}/"
version: "1.0.0"
updated: "${now}"
---

# ${path.basename(knowledgeRoot)} Change Log

## ${now}
- **Phase 34:** OKF v0.1 compatibility layer added
- **Added:** \`type\` field to all YAML frontmatter
- **Added:** \`index.md\` to all subdirectories
- **Added:** Cross-links standardized as relative markdown links
`;

  fs.writeFileSync(logPath, content, "utf-8");
  console.log(`  ✅ Created log.md: ${knowledgeRoot}/log.md`);
}

// --- Execution ---

function walkAndIndex(dirPath: string): { indexed: number; typed: number } {
  let indexed = 0;
  let typed = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    // Collect files and subdirs
    const mdFiles = entries.filter(e => e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".mdx")));
    const subDirs = entries.filter(e => e.isDirectory() && !EXCLUDE_DIRS.has(e.name) && !e.name.startsWith("."));

    // Add type to all .md files
    for (const file of mdFiles) {
      const filePath = path.join(dirPath, file.name);
      if (file.name === "index.md") continue; // Skip index files

      const fm = extractFrontmatter(filePath);
      const detectedType = detectType(filePath, fm);
      if (addTypeToYaml(filePath, detectedType)) {
        typed++;
        console.log(`  📝 Added type="${detectedType}" to ${path.relative(ROOT, filePath)}`);
      }
    }

    // Generate index.md
    const dirName = path.basename(dirPath);
    const files = getKnowledgeFiles(dirPath);
    const subDirNames = subDirs.map(d => d.name);

    const indexContent = generateIndexContent(dirPath, dirName, files, subDirNames);
    const indexPath = path.join(dirPath, "index.md");
    fs.writeFileSync(indexPath, indexContent, "utf-8");
    indexed++;
    console.log(`  📄 Created index.md in ${path.relative(ROOT, dirPath)}/`);

    // Recurse into subdirectories
    for (const subDir of subDirs) {
      const result = walkAndIndex(path.join(dirPath, subDir.name));
      indexed += result.indexed;
      typed += result.typed;
    }
  } catch (err) {
    console.error(`  ⚠️ Error processing ${dirPath}: ${err}`);
  }

  return { indexed, typed };
}

// --- Main ---

console.log("🔧 OKF Compatibility Layer — Phase 34 Stream 2");
console.log(`📂 Root: ${ROOT}\n`);

let totalIndexed = 0;
let totalTyped = 0;

for (const root of KNOWLEDGE_ROOTS) {
  const dirPath = path.join(ROOT, root);
  if (!fs.existsSync(dirPath)) {
    console.log(`  ⏭️ Skipping (not found): ${root}`);
    continue;
  }

  console.log(`\n📁 Processing: ${root}/`);

  // Generate log.md at root level
  generateLogMd(root);

  // Walk and index
  const result = walkAndIndex(dirPath);
  totalIndexed += result.indexed;
  totalTyped += result.typed;

  console.log(`  📊 ${root}/: ${result.indexed} index.md created, ${result.typed} type fields added`);
}

// Also generate top-level index.md for the knowledge roots
for (const root of KNOWLEDGE_ROOTS) {
  const indexes = walkAndIndex(path.join(ROOT, root));
  // Already counted above
}

console.log(`\n✅ Phase 34 Stream 2 Complete`);
console.log(`📊 Total: ${totalIndexed} index.md files created`);
console.log(`📊 Total: ${totalTyped} type fields added`);
console.log(`📊 Processed ${KNOWLEDGE_ROOTS.length} knowledge roots`);
