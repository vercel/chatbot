/**
 * Phase 24: Playbook Architecture Validator
 *
 * Scans all playbook folders, validates manifest.yaml schema,
 * verifies referenced connectors/skills exist, reports missing files.
 *
 * Exit code 0 on pass, 1 on fail (for prebuild chain).
 *
 * Usage: npx tsx scripts/validate-playbooks.ts
 * npm script: pnpm playbooks:validate
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Terminal colors ──────────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const CHECK = `${GREEN}✓${RESET}`;
const CROSS = `${RED}✗${RESET}`;
const WARN = `${YELLOW}⚠${RESET}`;

// ── Paths ────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, "..");
const PLAYBOOKS_DIR = path.join(
  REPO_ROOT,
  "connectors/neptune/skills/custom-skills/playbook-skills/playbooks"
);
const CONNECTORS_DIR = path.join(REPO_ROOT, "connectors");
const SKILLS_DIR = path.join(REPO_ROOT, "connectors/neptune/skills");

// ── Simple YAML Parser (shared with generate-capabilities.ts) ─────────────────

function parseYamlValue(val: string): unknown {
  const trimmed = val.trim();
  // Handle inline arrays: [a, b, c]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    if (inner.trim() === "") return [];
    return inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
  }
  if (/^-?\d+\.?\d*$/.test(trimmed)) return Number(trimmed);
  const str = trimmed.replace(/^["']|["']$/g, "");
  if (str === "true") return true;
  if (str === "false") return false;
  if (str === "null" || str === "") return null;
  return str;
}

interface ManifestData {
  playbook?: string;
  organization?: string;
  version?: string;
  description?: string;
  requires?: {
    connectors?: string[];
    skills?: string[];
    functions?: string[];
    workflows?: string[];
  };
  [key: string]: unknown;
}

function parseYaml(content: string): ManifestData | null {
  try {
    const lines = content.split("\n");
    const result: Record<string, unknown> = {};
    let currentKey = "";
    let currentList: string[] = [];
    let currentParent: Record<string, unknown> = result;
    const stack: Array<{ key: string; list: string[]; parent: Record<string, unknown> }> = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s*#.*$/, ""); // strip inline comments
      if (line.trim() === "") continue;

      const indent = rawLine.length - rawLine.trimStart().length;

      if (indent === 0) {
        // Flush any pending list at current level
        if (currentList.length > 0 && currentKey) {
          currentParent[currentKey] = currentList;
          currentList = [];
        }
        // Pop back up to root
        currentParent = result;
        stack.length = 0;

        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (val === "") {
          currentKey = key;
          currentParent = result;
          currentParent[key] = {};
        } else {
          result[key] = parseYamlValue(val);
        }
      } else if (indent === 2) {
        // Could be a list item or a sub-key
        const trimmed = line.trim();
        if (trimmed.startsWith("- ")) {
          // List item
          currentList.push(trimmed.slice(2).trim());
        } else {
          // Flush any pending list
          if (currentList.length > 0 && currentKey) {
            currentParent[currentKey] = currentList;
            currentList = [];
          }

          const colonIdx = trimmed.indexOf(":");
          if (colonIdx === -1) continue;
          const key = trimmed.slice(0, colonIdx).trim();
          const val = trimmed.slice(colonIdx + 1).trim();

          // The parent for these keys should be the object at currentKey
          const parentObj = currentParent[currentKey] as Record<string, unknown>;
          if (parentObj && typeof parentObj === "object" && !Array.isArray(parentObj)) {
            if (val === "") {
              // New nested object — push current context
              stack.push({ key: currentKey, list: currentList, parent: currentParent });
              currentParent = parentObj as Record<string, unknown>;
              currentKey = key;
              (currentParent as Record<string, unknown>)[key] = {};
            } else {
              parentObj[key] = parseYamlValue(val);
            }
          }
        }
      }
    }

    // Flush any remaining list
    if (currentList.length > 0 && currentKey) {
      currentParent[currentKey] = currentList;
    }

    return result as ManifestData;
  } catch {
    return null;
  }
}

// ── Required Manifest Fields ─────────────────────────────────────────────────

const REQUIRED_TOP_FIELDS = ["playbook", "version", "description"];
const REQUIRED_REQUIRES_FIELDS = ["connectors", "skills", "functions", "workflows"];
const EXPECTED_ARTIFACTS = ["patterns.md", "custom-knowledge.md", "telemetry.md"] as const;

// ── Validation Functions ─────────────────────────────────────────────────────

interface ValidationError {
  folder: string;
  type: "missing_file" | "invalid_manifest" | "missing_field" | "orphaned_reference" | "warning";
  message: string;
}

interface PlaybookInfo {
  folder: string;
  playbookFile: string | null;
  playbookLines: number;
  manifestFile: string | null;
  manifest: ManifestData | null;
  patternsExists: boolean;
  customKnowledgeExists: boolean;
  telemetryExists: boolean;
  examplesExists: boolean;
}

function scanPlaybookFolder(folderPath: string, folderName: string): PlaybookInfo {
  const files = fs.readdirSync(folderPath);

  const playbookFile = files.find((f) => f.startsWith("playbook-") && f.endsWith(".md"));
  const manifestFile = files.find((f) => f === "manifest.yaml" || f === "manifest.yml");

  let playbookLines = 0;
  if (playbookFile) {
    const content = fs.readFileSync(path.join(folderPath, playbookFile), "utf-8");
    playbookLines = content.split("\n").length;
  }

  let manifest: ManifestData | null = null;
  if (manifestFile) {
    const content = fs.readFileSync(path.join(folderPath, manifestFile), "utf-8");
    manifest = parseYaml(content);
  }

  return {
    folder: folderName,
    playbookFile: playbookFile ?? null,
    playbookLines,
    manifestFile: manifestFile ?? null,
    manifest,
    patternsExists: files.includes("patterns.md"),
    customKnowledgeExists: files.includes("custom-knowledge.md"),
    telemetryExists: files.includes("telemetry.md"),
    examplesExists: fs.existsSync(path.join(folderPath, "examples")),
  };
}

function validatePlaybook(info: PlaybookInfo): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Check playbook file exists
  if (!info.playbookFile) {
    errors.push({
      folder: info.folder,
      type: "missing_file",
      message: `No playbook-*.md file found`,
    });
  }

  // 2. Check manifest file exists
  if (!info.manifestFile) {
    errors.push({
      folder: info.folder,
      type: "missing_file",
      message: `No manifest.yaml file found`,
    });
    return errors; // Can't validate manifest further
  }

  const m = info.manifest;
  if (!m) {
    errors.push({
      folder: info.folder,
      type: "invalid_manifest",
      message: `manifest.yaml could not be parsed as YAML`,
    });
    return errors;
  }

  // 3. Check required top-level fields
  for (const field of REQUIRED_TOP_FIELDS) {
    if (!(field in m) || m[field] === undefined || m[field] === null || m[field] === "") {
      errors.push({
        folder: info.folder,
        type: "missing_field",
        message: `manifest.yaml missing required field: "${field}"`,
      });
    }
  }

  // 4. Check requires section
  if (!m.requires) {
    errors.push({
      folder: info.folder,
      type: "missing_field",
      message: `manifest.yaml missing required section: "requires"`,
    });
  } else {
    for (const field of REQUIRED_REQUIRES_FIELDS) {
      if (!(field in m.requires)) {
        errors.push({
          folder: info.folder,
          type: "missing_field",
          message: `manifest.yaml requires section missing field: "${field}"`,
        });
      }
    }
  }

  return errors;
}

function getAvailableConnectors(): Set<string> {
  const connectors = new Set<string>();
  try {
    const entries = fs.readdirSync(CONNECTORS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith(".")) {
        connectors.add(entry.name);
      }
    }
  } catch {
    // If connectors dir doesn't exist, return empty set
  }
  return connectors;
}

function getAvailableSkills(): Set<string> {
  const skills = new Set<string>();
  try {
    // Scan connectors/neptune/skills/
    const neptuneSkills = path.join(SKILLS_DIR);
    if (fs.existsSync(neptuneSkills)) {
      const entries = fs.readdirSync(neptuneSkills, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith(".")) {
          const dirName = entry.name;
          // Add the directory name as a skill
          skills.add(dirName);
          // Also check for sub-directories that might be individual skills
          try {
            const subEntries = fs.readdirSync(path.join(neptuneSkills, dirName), {
              withFileTypes: true,
            });
            for (const sub of subEntries) {
              if (sub.isDirectory() && !sub.name.startsWith("_") && !sub.name.startsWith(".")) {
                skills.add(sub.name);
              }
            }
          } catch {
            // Skip sub-directories that can't be read
          }
        }
      }
    }
  } catch {
    // If skills dir doesn't exist, return empty set
  }
  return skills;
}

function checkOrphanedReferences(infos: PlaybookInfo[], availableConnectors: Set<string>, availableSkills: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const info of infos) {
    if (!info.manifest || !info.manifest.requires) continue;

    // Check connectors
    if (info.manifest.requires.connectors) {
      for (const connector of info.manifest.requires.connectors) {
        if (!availableConnectors.has(connector)) {
          errors.push({
            folder: info.folder,
            type: "orphaned_reference",
            message: `Connector "${connector}" referenced in manifest but not found in connectors/`,
          });
        }
      }
    }

    // Check skills
    if (info.manifest.requires.skills) {
      for (const skill of info.manifest.requires.skills) {
        if (!availableSkills.has(skill)) {
          errors.push({
            folder: info.folder,
            type: "warning",
            message: `Skill "${skill}" referenced in manifest but not found as a directory in connectors/neptune/skills/`,
          });
        }
      }
    }
  }

  return errors;
}

function checkExpectedArtifacts(infos: PlaybookInfo[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const info of infos) {
    for (const artifact of EXPECTED_ARTIFACTS) {
      if (artifact === "patterns.md" && !info.patternsExists) {
        errors.push({
          folder: info.folder,
          type: "warning",
          message: `patterns.md not found (recommended for all playbooks)`,
        });
      }
      if (artifact === "custom-knowledge.md" && !info.customKnowledgeExists) {
        // Only warn for P0 playbooks
        if (["billing", "customer-support", "disputes", "planning"].includes(info.folder)) {
          errors.push({
            folder: info.folder,
            type: "warning",
            message: `custom-knowledge.md not found (required for P0 playbooks)`,
          });
        }
      }
    }
  }

  return errors;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║  Phase 24: Playbook Architecture Validator  ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════╝${RESET}\n`);

  if (!fs.existsSync(PLAYBOOKS_DIR)) {
    console.log(`${CROSS} Playbooks directory not found: ${PLAYBOOKS_DIR}`);
    process.exit(1);
  }

  // ── Step 1: Scan all playbook folders ──────────────────────────────────────
  const folderEntries = fs
    .readdirSync(PLAYBOOKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory());

  const infos: PlaybookInfo[] = [];
  for (const entry of folderEntries) {
    const folderPath = path.join(PLAYBOOKS_DIR, entry.name);
    const info = scanPlaybookFolder(folderPath, entry.name);
    infos.push(info);
  }

  console.log(`${BOLD}Scanning ${infos.length} playbook folders...${RESET}\n`);

  // ── Step 2: Validate each playbook ─────────────────────────────────────────
  const allErrors: ValidationError[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const info of infos.sort((a, b) => a.folder.localeCompare(b.folder))) {
    const errors = validatePlaybook(info);
    allErrors.push(...errors);

    const hasErrors = errors.filter((e) => e.type !== "warning").length > 0;
    const hasWarnings = errors.some((e) => e.type === "warning");

    if (hasErrors) {
      console.log(`  ${CROSS} ${info.folder}`);
      failedCount++;
    } else if (hasWarnings) {
      console.log(`  ${WARN} ${info.folder}`);
      passedCount++;
    } else {
      console.log(`  ${CHECK} ${info.folder}`);
      passedCount++;
    }

    // Print details
    const playbookStatus = info.playbookFile
      ? `${GREEN}playbook-*.md (${info.playbookLines} lines)${RESET}`
      : `${RED}MISSING playbook-*.md${RESET}`;
    const manifestStatus = info.manifestFile
      ? `${GREEN}manifest.yaml${RESET}`
      : `${RED}MISSING manifest.yaml${RESET}`;
    console.log(`     Playbook: ${playbookStatus}`);
    console.log(`     Manifest: ${manifestStatus}`);

    if (info.manifest) {
      const m = info.manifest;
      if (m.playbook) console.log(`     Name: ${m.playbook}`);
      if (m.version) console.log(`     Version: ${m.version}`);
      if (m.description) console.log(`     Description: ${m.description}`);
      else console.log(`     ${WARN} Missing description field`);

      if (m.requires) {
        const r = m.requires;
        console.log(
          `     Requires: connectors=[${(r.connectors || []).join(", ")}] skills=[${(r.skills || []).join(", ")}] functions=[${(r.functions || []).join(", ")}] workflows=[${(r.workflows || []).join(", ")}]`
        );
      }
    }

    // Print errors
    for (const err of errors) {
      const prefix =
        err.type === "warning" ? `     ${WARN}` : `     ${CROSS}`;
      console.log(`${prefix} ${err.message}`);
    }

    console.log();
  }

  // ── Step 3: Cross-reference checks ─────────────────────────────────────────
  console.log(`${BOLD}Cross-Reference Checks${RESET}\n`);

  const availableConnectors = getAvailableConnectors();
  const availableSkills = getAvailableSkills();

  console.log(`  Available connectors: ${availableConnectors.size}`);
  console.log(`  Available skills: ${availableSkills.size}`);
  console.log();

  const orphanedErrors = checkOrphanedReferences(infos, availableConnectors, availableSkills);
  allErrors.push(...orphanedErrors);

  if (orphanedErrors.length > 0) {
    for (const err of orphanedErrors) {
      const prefix = err.type === "warning" ? `  ${WARN}` : `  ${CROSS}`;
      console.log(`${prefix} [${err.folder}] ${err.message}`);
    }
  } else {
    console.log(`  ${CHECK} No orphaned connector references`);
  }
  console.log();

  // ── Step 4: Expected artifacts check ───────────────────────────────────────
  console.log(`${BOLD}Artifact Completeness${RESET}\n`);

  const artifactErrors = checkExpectedArtifacts(infos);
  allErrors.push(...artifactErrors);

  // Group by type
  const missingPatterns = infos.filter((i) => !i.patternsExists);
  const missingKnowledge = infos.filter(
    (i) => !i.customKnowledgeExists && ["billing", "customer-support", "disputes", "planning"].includes(i.folder)
  );

  if (missingPatterns.length > 0) {
    console.log(`  ${WARN} patterns.md missing in ${missingPatterns.length} folder(s): ${missingPatterns.map((i) => i.folder).join(", ")}`);
  }
  if (missingKnowledge.length > 0) {
    console.log(`  ${WARN} custom-knowledge.md missing in ${missingKnowledge.length} P0 folder(s): ${missingKnowledge.map((i) => i.folder).join(", ")}`);
  }
  console.log();

  // ── Step 5: Summary ────────────────────────────────────────────────────────
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  Summary${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════${RESET}\n`);

  const criticalErrors = allErrors.filter((e) => e.type !== "warning");
  const warnings = allErrors.filter((e) => e.type === "warning");

  console.log(`  Folders scanned: ${infos.length}`);
  console.log(`  Passed: ${GREEN}${passedCount}${RESET}`);
  console.log(`  Failed: ${RED}${failedCount}${RESET}`);
  console.log(`  Critical errors: ${criticalErrors.length > 0 ? RED : GREEN}${criticalErrors.length}${RESET}`);
  console.log(`  Warnings: ${YELLOW}${warnings.length}${RESET}`);
  console.log();

  if (criticalErrors.length > 0) {
    console.log(`${BOLD}${RED}VALIDATION FAILED${RESET} — ${criticalErrors.length} critical error(s)\n`);
    process.exit(1);
  }

  console.log(`${BOLD}${GREEN}VALIDATION PASSED${RESET} — all playbooks have required files and valid manifests\n`);
  process.exit(0);
}

main();
