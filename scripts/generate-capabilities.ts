/**
 * Phase 22.5: Auto-Generated System Capabilities — THE TRUTH FILE
 *
 * Walks the actual filesystem (connectors/, playbooks/, skills/, functions/,
 * workflows/, lib/ai/tools/, app/api/, components/library/, lib/ai/models.ts)
 * and produces lib/system-capabilities.json — the single source of truth for
 * what this system actually IS.
 *
 * Idempotent. Safe to re-run. Called by prebuild hook.
 *
 * Usage: npx tsx scripts/generate-capabilities.ts
 * npm script: pnpm capabilities:regen
 */

import * as fs from "node:fs";
import * as path from "node:path";
// ── Minimal YAML Parser (no external dependency) ───────────────────────────
// The manifests are simple: key: value, shallow nesting, no anchors/aliases.

function parseSimpleYaml(content: string): Record<string, unknown> | null {
  try {
    const lines = content.split("\n");
    const result: Record<string, unknown> = {};
    let currentKey = "";
    let currentList: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s*#.*$/, ""); // strip comments
      if (line.trim() === "") continue;

      const indent = rawLine.length - rawLine.trimStart().length;

      if (indent === 0) {
        // Flush any pending list
        if (currentList.length > 0 && currentKey) {
          result[currentKey] = currentList;
          currentList = [];
        }

        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (val === "") {
          currentKey = key;
        } else {
          result[key] = parseYamlValue(val);
        }
      } else if (indent === 2 && currentKey) {
        // List item
        const item = line.trim().replace(/^-\s*/, "");
        if (line.trim().startsWith("-")) {
          if (item.startsWith("[") && item.endsWith("]")) {
            // Inline list: [a, b, c]
            currentList = item.slice(1, -1).split(",").map((s) => s.trim());
          } else {
            currentList.push(item);
          }
        } else if (line.trim().includes(":")) {
          // Sub-key — handle if we need it (currently unused for manifests)
          const colonIdx2 = line.trim().indexOf(":");
          const subKey = line.trim().slice(0, colonIdx2).trim();
          const subVal = line.trim().slice(colonIdx2 + 1).trim();
          if (!result[currentKey]) {
            result[currentKey] = {};
          }
          (result[currentKey] as Record<string, unknown>)[subKey] = parseYamlValue(subVal);
        }
      }
    }

    // Final flush
    if (currentList.length > 0 && currentKey) {
      result[currentKey] = currentList;
    }

    return result;
  } catch {
    return null;
  }
}

function parseYamlValue(val: string): unknown {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^[+-]?\d+(\.\d+)?$/.test(val)) return Number(val);
  if (val.startsWith("[") && val.endsWith("]")) {
    return val
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim());
  }
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ConnectorCapability {
  name: string;
  slug: string;
  path: string;
  hasMcp: boolean;
  hasCustomClient: boolean;
  hasSchema: boolean;
  toolCount: number;
  toolNames: string[];
  hasPlaybookMd: boolean;
  hasSkillMd: boolean;
  domain?: string;
  playbooksReferencing: string[];
}

interface PlaybookManifest {
  playbook: string;
  organization?: string;
  version?: string;
  description?: string;
  requires: {
    connectors: string[];
    skills: string[];
    functions: string[];
    workflows: string[];
  };
}

interface PlaybookCapability {
  name: string;
  slug: string;
  path: string;
  domain?: string;
  version?: string;
  description?: string;
  hasManifest: boolean;
  hasPlaybookMd: boolean;
  requires: PlaybookManifest["requires"];
  isMeta: boolean;
}

interface SkillCapability {
  name: string;
  type: string;
  path: string;
  description: string;
}

interface FunctionCapability {
  name: string;
  path?: string;
  description: string;
}

interface WorkflowCapability {
  name: string;
  path: string;
  durable: boolean;
  description: string;
}

interface ToolCapability {
  name: string;
  path: string;
  description: string;
}

interface ApiRouteCapability {
  method: string;
  route: string;
  file: string;
}

interface ModelCapability {
  id: string;
  name: string;
  provider: string;
  description: string;
  routeType?: string;
}

interface UiComponentCapability {
  name: string;
  file: string;
}

interface SystemCapabilities {
  generatedAt: string;
  version: string;
  repo: string;
  commitSha: string;
  counts: {
    connectors: number;
    playbooks: number;
    skills: number;
    functions: number;
    workflows: number;
    tools: number;
    apiRoutes: number;
    models: number;
    uiComponents: number;
  };
  connectors: ConnectorCapability[];
  playbooks: PlaybookCapability[];
  skills: SkillCapability[];
  functions: FunctionCapability[];
  workflows: WorkflowCapability[];
  tools: ToolCapability[];
  apiRoutes: ApiRouteCapability[];
  models: ModelCapability[];
  uiComponents: UiComponentCapability[];
  manifestEdges: ManifestEdge[];
  truth_assertion: string;
}

interface ManifestEdge {
  from: string;
  fromType: string;
  to: string;
  toType: string;
  edgeType: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const CONNECTORS_DIR = path.join(ROOT, "connectors");
const PLAYBOOKS_DIR = path.join(
  ROOT,
  "connectors/neptune/skills/custom-skills/playbook-skills/playbooks"
);
const TOOLS_DIR = path.join(ROOT, "lib/ai/tools");
const API_DIR = path.join(ROOT, "app/api");
const MODELS_FILE = path.join(ROOT, "lib/ai/models.ts");
const COMPONENTS_LIBRARY_DIR = path.join(ROOT, "components/library");

function getCommitSha(): string {
  try {
    const { execSync } = require("child_process");
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function parseYamlIfExists(filePath: string): Record<string, unknown> | null {
  const content = readFileIfExists(filePath);
  if (!content) return null;
  return parseSimpleYaml(content);
}

// ── Walkers ────────────────────────────────────────────────────────────────

function walkConnectors(): ConnectorCapability[] {
  const connectors: ConnectorCapability[] = [];
  if (!fs.existsSync(CONNECTORS_DIR)) return connectors;

  const entries = fs.readdirSync(CONNECTORS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const p = path.join(CONNECTORS_DIR, name);

    // Count tools
    const toolsDir = path.join(p, "tools");
    let toolCount = 0;
    const toolNames: string[] = [];
    if (fs.existsSync(toolsDir)) {
      const toolFiles = fs.readdirSync(toolsDir);
      for (const tf of toolFiles) {
        if (tf.endsWith(".ts") && tf !== "index.ts") {
          // Read tool name from file (export const X = tool(...))
          const content = readFileIfExists(path.join(toolsDir, tf));
          if (content) {
            const match = content.match(/export\s+const\s+(\w+)\s*=\s*tool\(/);
            if (match) {
              toolNames.push(match[1]);
              toolCount++;
            }
          }
        }
      }
    }

    const hasMcp = fs.existsSync(path.join(p, "mcp-config.json"));
    const hasCustomClient = fs.existsSync(path.join(p, "client.ts"));
    const hasSchema = fs.existsSync(path.join(p, "schema.ts"));
    const hasPlaybookMd = fs.existsSync(path.join(p, "PLAYBOOK.md"));
    const hasSkillMd = fs.existsSync(path.join(p, "SKILL.md"));

    connectors.push({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      path: `connectors/${name}/`,
      hasMcp,
      hasCustomClient,
      hasSchema,
      toolCount,
      toolNames,
      hasPlaybookMd,
      hasSkillMd,
      playbooksReferencing: [],
    });
  }

  return connectors.sort((a, b) => a.name.localeCompare(b.name));
}

function walkPlaybooks(): { playbooks: PlaybookCapability[]; edges: ManifestEdge[] } {
  const playbooks: PlaybookCapability[] = [];
  const edges: ManifestEdge[] = [];

  if (!fs.existsSync(PLAYBOOKS_DIR)) return { playbooks, edges };

  const entries = fs.readdirSync(PLAYBOOKS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      // Top-level files — meta playbooks (manifest-newleaf.yaml, manifest-index.yaml, playbook-newleaf.md, playbook-index.md)
      if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
        const parsed = parseYamlIfExists(path.join(PLAYBOOKS_DIR, entry.name));
        if (parsed) {
          const manifest = parsed as unknown as PlaybookManifest;
          const name = (manifest.playbook || entry.name.replace(/^manifest-/, "").replace(/\.ya?ml$/, ""));
          const playbookMdFile = `playbook-${name}.md`;
          const hasPlaybookMd = fs.existsSync(path.join(PLAYBOOKS_DIR, playbookMdFile));

          playbooks.push({
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            path: `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/${entry.name}`,
            version: manifest.version,
            description: manifest.description || "",
            hasManifest: true,
            hasPlaybookMd,
            requires: manifest.requires || { connectors: [], skills: [], functions: [], workflows: [] },
            isMeta: name === "newleaf" || name === "index",
          });

          // Generate edges from manifest deps
          for (const conn of manifest.requires?.connectors || []) {
            edges.push({
              from: name,
              fromType: "playbook",
              to: conn,
              toType: "connector",
              edgeType: "requires",
            });
          }
          for (const skill of manifest.requires?.skills || []) {
            edges.push({
              from: name,
              fromType: "playbook",
              to: skill,
              toType: "skill",
              edgeType: "uses",
            });
          }
          for (const func of manifest.requires?.functions || []) {
            edges.push({
              from: name,
              fromType: "playbook",
              to: func,
              toType: "function",
              edgeType: "invokes",
            });
          }
          for (const wf of manifest.requires?.workflows || []) {
            edges.push({
              from: name,
              fromType: "playbook",
              to: wf,
              toType: "workflow",
              edgeType: "runs",
            });
          }
        }
      }
      continue;
    }

    // Subdirectory = domain playbook
    const domainName = entry.name;
    const domainPath = path.join(PLAYBOOKS_DIR, domainName);
    const manifestPath = path.join(domainPath, "manifest.yaml");
    const playbookMdPath = path.join(domainPath, `playbook-${domainName}.md`);

    const parsed = parseYamlIfExists(manifestPath);
    const hasManifest = parsed !== null;
    const hasPlaybookMd = fs.existsSync(playbookMdPath);
    const pbMdContent = hasPlaybookMd ? readFileIfExists(playbookMdPath) : null;

    // Extract title/domain/version from playbook markdown frontmatter
    let pbTitle = domainName;
    let pbVersion: string | undefined;
    let pbDescription: string | undefined;
    if (pbMdContent) {
      const fmMatch = pbMdContent.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fmLines = fmMatch[1].split("\n");
        for (const line of fmLines) {
          const kv = line.match(/^(\w[\w\s]*?):\s*(.+)/);
          if (kv) {
            const key = kv[1].trim().toLowerCase();
            const val = kv[2].trim();
            if (key === "title") pbTitle = val;
            if (key === "version") pbVersion = val;
            if (key === "description") pbDescription = val;
          }
        }
      }
    }

    const manifest = parsed as unknown as PlaybookManifest | null;

    playbooks.push({
      name: domainName,
      slug: domainName.toLowerCase().replace(/\s+/g, "-"),
      path: `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/${domainName}/`,
      domain: domainName,
      version: pbVersion || manifest?.version,
      description: pbDescription || manifest?.description || "",
      hasManifest,
      hasPlaybookMd,
      requires: manifest?.requires || { connectors: [], skills: [], functions: [], workflows: [] },
      isMeta: false,
    });

    // Generate edges from manifest deps
    if (manifest?.requires) {
      for (const conn of manifest.requires.connectors || []) {
        edges.push({
          from: domainName,
          fromType: "playbook",
          to: conn,
          toType: "connector",
          edgeType: "requires",
        });
      }
      for (const skill of manifest.requires.skills || []) {
        edges.push({
          from: domainName,
          fromType: "playbook",
          to: skill,
          toType: "skill",
          edgeType: "uses",
        });
      }
      for (const func of manifest.requires.functions || []) {
        edges.push({
          from: domainName,
          fromType: "playbook",
          to: func,
          toType: "function",
          edgeType: "invokes",
        });
      }
      for (const wf of manifest.requires.workflows || []) {
        edges.push({
          from: domainName,
          fromType: "playbook",
          to: wf,
          toType: "workflow",
          edgeType: "runs",
        });
      }
    }
  }

  return {
    playbooks: playbooks.sort((a, b) => a.name.localeCompare(b.name)),
    edges,
  };
}

function walkSkills(): SkillCapability[] {
  const skills: SkillCapability[] = [];

  // Skill pack: custom-skills/playbook-skills (the meta-skill)
  const playbookSkillsPath = path.join(
    ROOT,
    "connectors/neptune/skills/custom-skills/playbook-skills"
  );
  if (fs.existsSync(playbookSkillsPath)) {
    skills.push({
      name: "playbook-skills",
      type: "custom-skill-pack",
      path: "connectors/neptune/skills/custom-skills/playbook-skills/",
      description: "Meta-skill that loads playbook SOPs and functions",
    });
  }

  // AI Agent SDK skill
  const aiAgentSdkPath = path.join(ROOT, "skills");
  if (fs.existsSync(aiAgentSdkPath)) {
    const readme = readFileIfExists(path.join(aiAgentSdkPath, "README.md"));
    skills.push({
      name: "ai-agent-sdk",
      type: "native-skill",
      path: "skills/",
      description: readme
        ? readme.split("\n")[0].replace(/^#+\s*/, "").slice(0, 120)
        : "Native AI agent SDK skills",
    });
  }

  // Shared skills
  const sharedSkillsPath = path.join(ROOT, "shared-skills");
  if (fs.existsSync(sharedSkillsPath)) {
    const entries = fs.readdirSync(sharedSkillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        skills.push({
          name: entry.name,
          type: "shared-skill",
          path: `shared-skills/${entry.name}/`,
          description: "",
        });
      }
    }
  }

  return skills;
}

function walkFunctions(): FunctionCapability[] {
  const funcs: FunctionCapability[] = [];

  // From playbook-skills functions
  const pbFunctionsPath = path.join(
    ROOT,
    "connectors/neptune/skills/custom-skills/playbook-skills/functions"
  );
  if (fs.existsSync(pbFunctionsPath)) {
    const entries = fs.readdirSync(pbFunctionsPath);
    for (const entry of entries) {
      if (entry.endsWith(".ts")) {
        const name = entry.replace(".ts", "");
        const content = readFileIfExists(path.join(pbFunctionsPath, entry));
        let description = "";
        if (content) {
          const descMatch = content.match(/description:\s*["'`](.+?)["'`]/);
          if (descMatch) description = descMatch[1];
        }
        funcs.push({
          name,
          path: `connectors/neptune/skills/custom-skills/playbook-skills/functions/${entry}`,
          description,
        });
      }
    }
  }

  // From functions/ directory
  const functionsDir = path.join(ROOT, "functions");
  if (fs.existsSync(functionsDir)) {
    const entries = fs.readdirSync(functionsDir);
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        try {
          const content = readFileIfExists(path.join(functionsDir, entry));
          if (content) {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
              for (const item of data) {
                funcs.push({
                  name: item.name || item.function || entry.replace(".json", ""),
                  description: item.description || "",
                });
              }
            } else if (typeof data === "object") {
              for (const [key, val] of Object.entries(data)) {
                if (typeof val === "object" && val !== null) {
                  funcs.push({
                    name: key,
                    description: (val as Record<string, unknown>).description as string || "",
                  });
                }
              }
            }
          }
        } catch {
          // skip
        }
      }
    }
  }

  return funcs;
}

function walkWorkflows(): WorkflowCapability[] {
  const workflows: WorkflowCapability[] = [];
  const workflowsDir = path.join(ROOT, "workflows");

  if (!fs.existsSync(workflowsDir)) return workflows;

  const entries = fs.readdirSync(workflowsDir);
  for (const entry of entries) {
    if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
      const parsed = parseYamlIfExists(path.join(workflowsDir, entry));
      const name = entry.replace(/\.ya?ml$/, "");
      workflows.push({
        name,
        path: `workflows/${entry}`,
        durable: parsed?.durable === true,
        description: (parsed as Record<string, unknown>)?.description as string || "",
      });
    }
  }

  return workflows;
}

function walkTools(): ToolCapability[] {
  const tools: ToolCapability[] = [];
  if (!fs.existsSync(TOOLS_DIR)) return tools;

  const entries = fs.readdirSync(TOOLS_DIR);
  for (const entry of entries) {
    if (!entry.endsWith(".ts")) continue;
    const filePath = path.join(TOOLS_DIR, entry);
    const content = readFileIfExists(filePath);
    if (!content) continue;

    // Extract tool name: export const X = tool({
    const toolMatch = content.match(/export\s+const\s+(\w+)\s*=\s*tool\(/);
    const descMatch = content.match(/description:\s*["'`]([\s\S]*?)["'`](?:\s*,)?/);

    if (toolMatch) {
      tools.push({
        name: toolMatch[1],
        path: `lib/ai/tools/${entry}`,
        description: descMatch ? descMatch[1].replace(/\s+/g, " ").trim().slice(0, 200) : "",
      });
    }
  }

  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function walkApiRoutes(): ApiRouteCapability[] {
  const routes: ApiRouteCapability[] = [];
  if (!fs.existsSync(API_DIR)) return routes;

  function walk(dir: string, baseRoute: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Handle dynamic segments: [param] -> :param
        const segment = entry.name.replace(/^\[(.+)\]$/, ":$1");
        walk(full, `${baseRoute}/${segment}`);
      } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
        const content = readFileIfExists(full);
        if (!content) continue;
        const getMatch = content.match(/export\s+(?:const|async\s+function)\s+GET\b/);
        const postMatch = content.match(/export\s+(?:const|async\s+function)\s+POST\b/);
        const putMatch = content.match(/export\s+(?:const|async\s+function)\s+PUT\b/);
        const delMatch = content.match(/export\s+(?:const|async\s+function)\s+DELETE\b/);

        const methods: string[] = [];
        if (getMatch) methods.push("GET");
        if (postMatch) methods.push("POST");
        if (putMatch) methods.push("PUT");
        if (delMatch) methods.push("DELETE");

        for (const method of methods) {
          routes.push({
            method,
            route: baseRoute || "/api",
            file: full.replace(ROOT + "/", ""),
          });
        }
      }
    }
  }

  walk(API_DIR, "/api");
  return routes.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
}

function parseModels(): ModelCapability[] {
  const content = readFileIfExists(MODELS_FILE);
  if (!content) return [];

  const models: ModelCapability[] = [];
  // Parse chatModels array via regex
  const arrayMatch = content.match(/export\s+const\s+chatModels[:\s]+.*?=\s*\[([\s\S]*?)\];/);
  if (arrayMatch) {
    const arrayContent = arrayMatch[1];
    const entryRegex = /\{\s*id:\s*["'`]([^"'`]+)["'`],\s*name:\s*["'`]([^"'`]+)["'`],\s*provider:\s*["'`]([^"'`]+)["'`],\s*description:\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = entryRegex.exec(arrayContent)) !== null) {
      // Check for routeType
      const entryText = arrayContent.slice(match.index, arrayContent.indexOf("},", match.index) + 1);
      const rtMatch = entryText.match(/routeType:\s*["'`]([^"'`]+)["'`]/);
      models.push({
        id: match[1],
        name: match[2],
        provider: match[3],
        description: match[4],
        routeType: rtMatch?.[1],
      });
    }
  }

  return models;
}

function walkUiComponents(): UiComponentCapability[] {
  const components: UiComponentCapability[] = [];
  if (!fs.existsSync(COMPONENTS_LIBRARY_DIR)) return components;

  const entries = fs.readdirSync(COMPONENTS_LIBRARY_DIR);
  for (const entry of entries) {
    if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      components.push({
        name: entry.replace(/\.(tsx|ts)$/, ""),
        file: `components/library/${entry}`,
      });
    }
  }

  return components.sort((a, b) => a.name.localeCompare(b.name));
}

function detectConnectorPairings(edges: ManifestEdge[]): ManifestEdge[] {
  const pairings: ManifestEdge[] = [];
  const playbookConnectors = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.fromType === "playbook" && edge.toType === "connector" && edge.edgeType === "requires") {
      if (!playbookConnectors.has(edge.from)) {
        playbookConnectors.set(edge.from, new Set());
      }
      playbookConnectors.get(edge.from)!.add(edge.to);
    }
  }

  const allPairs = new Set<string>();
  for (const [, connectors] of playbookConnectors) {
    const arr = Array.from(connectors);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const pairKey = [arr[i], arr[j]].sort().join("||");
        if (!allPairs.has(pairKey)) {
          allPairs.add(pairKey);
          pairings.push({
            from: arr[i],
            fromType: "connector",
            to: arr[j],
            toType: "connector",
            edgeType: "pairs_with",
          });
        }
      }
    }
  }

  return pairings;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("🔍 Scanning system capabilities...\n");

  const connectors = walkConnectors();
  console.log(`   Connectors: ${connectors.length}`);

  const { playbooks, edges: manifestEdges } = walkPlaybooks();
  console.log(`   Playbooks: ${playbooks.length} (${playbooks.filter((p) => p.isMeta).length} meta)`);

  const skills = walkSkills();
  console.log(`   Skills: ${skills.length}`);

  const functions = walkFunctions();
  console.log(`   Functions: ${functions.length}`);

  const workflows = walkWorkflows();
  console.log(`   Workflows: ${workflows.length}`);

  const tools = walkTools();
  console.log(`   Tools: ${tools.length}`);

  const apiRoutes = walkApiRoutes();
  console.log(`   API Routes: ${apiRoutes.length}`);

  const models = parseModels();
  console.log(`   Models: ${models.length}`);

  const uiComponents = walkUiComponents();
  console.log(`   UI Components: ${uiComponents.length}`);

  // Generate connector pairings
  const pairingEdges = detectConnectorPairings(manifestEdges);
  console.log(`   Manifest Edges: ${manifestEdges.length} + ${pairingEdges.length} pairings`);

  // Populate playbooksReferencing on connectors
  const pbRefMap = new Map<string, Set<string>>();
  for (const edge of manifestEdges) {
    if (edge.edgeType === "requires" && edge.toType === "connector") {
      if (!pbRefMap.has(edge.to)) pbRefMap.set(edge.to, new Set());
      pbRefMap.get(edge.to)!.add(edge.from);
    }
  }
  for (const conn of connectors) {
    conn.playbooksReferencing = Array.from(pbRefMap.get(conn.slug) || pbRefMap.get(conn.name) || []);
  }

  const allEdges = [...manifestEdges, ...pairingEdges];

  const caps: SystemCapabilities = {
    generatedAt: new Date().toISOString(),
    version: "1.0",
    repo: "abhiswami2121/neptune-chat",
    commitSha: getCommitSha(),
    counts: {
      connectors: connectors.length,
      playbooks: playbooks.length,
      skills: skills.length,
      functions: functions.length,
      workflows: workflows.length,
      tools: tools.length,
      apiRoutes: apiRoutes.length,
      models: models.length,
      uiComponents: uiComponents.length,
    },
    connectors,
    playbooks,
    skills,
    functions,
    workflows,
    tools,
    apiRoutes,
    models,
    uiComponents,
    manifestEdges: allEdges,
    truth_assertion:
      "This file is THE source of truth for system capabilities. Agent MUST read this when describing itself. NEVER hallucinate capabilities from training data.",
  };

  const outputPath = path.join(ROOT, "lib", "system-capabilities.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(caps, null, 2));

  console.log(`\n✅ Written to lib/system-capabilities.json`);
  console.log(
    `   Summary: ${connectors.length} connectors, ${playbooks.length} playbooks, ` +
    `${tools.length} tools, ${apiRoutes.length} API routes, ` +
    `${models.length} models, ${uiComponents.length} UI components`
  );
  console.log(`   Edges: ${allEdges.length} (${manifestEdges.length} manifest + ${pairingEdges.length} pairings)`);
}

main();
