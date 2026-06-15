/**
 * load-skill.ts — On-demand skill loading tool (U2 Progressive Disclosure foundation).
 *
 * Pattern A architecture: instead of stuffing 400+ tools in the tools array,
 * use ~5 gatekeeper tools. load_skill is one of them — it reads detailed
 * skill/playbook content from the file system on demand.
 *
 * This keeps the agent context efficient: only load what's needed, when needed.
 *
 * Supported paths:
 *   connectors/<name>     → reads connector playbook and tool docs
 *   capabilities/<name>   → reads capability playbook
 *   playbooks/<domain>         → reads domain-specific playbook
 *   skills/<name>         → reads general skill file
 */
import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const VPS_FS_URL = secrets.vps.fsBridgeUrl || "https://187.127.250.171:8102/api/fs";

// ── FS Bridge Helpers ────────────────────────────────────────────────────────

interface FsReadResult {
  success: boolean;
  content?: string;
  path?: string;
  error?: string;
}

interface FsListResult {
  success: boolean;
  files?: Array<{ name: string; path: string; size: number }>;
  error?: string;
}

async function vpsFsRead(fsPath: string): Promise<FsReadResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${VPS_FS_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fsPath }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Bridge returned ${res.status}` };
    }

    const data = await res.json();
    return { success: true, content: data.content, path: data.path };
  } catch (err) {
    return {
      success: false,
      error: `VPS bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

async function vpsFsList(parentPath: string): Promise<FsListResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${VPS_FS_URL}/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentPath }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Bridge returned ${res.status}` };
    }

    const data = await res.json();
    return { success: true, files: data.files ?? data };
  } catch (err) {
    return {
      success: false,
      error: `VPS bridge unavailable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ── Local File System Fallback ────────────────────────────────────────────────

const CWD = process.cwd();

function localFsRead(fsPath: string): FsReadResult {
  try {
    const fullPath = join(CWD, fsPath);
    if (!existsSync(fullPath)) {
      return { success: false, error: `File not found: ${fsPath}` };
    }
    const content = readFileSync(fullPath, "utf-8");
    return { success: true, content, path: fsPath };
  } catch (err) {
    return {
      success: false,
      error: `Local read failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// ── Skill Path Resolution ────────────────────────────────────────────────────

interface SkillContent {
  name: string;
  description: string;
  content: string;
  tools_available: string[];
  sources: string[];
}

function parseSkillMarkdown(content: string): { description: string } {
  // Extract first paragraph or heading as description
  const lines = content.split("\n");
  let description = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      description = trimmed.replace(/^#+\s*/, "");
      break;
    }
    if (trimmed && !trimmed.startsWith("---")) {
      description = trimmed.slice(0, 200);
      break;
    }
  }
  return { description: description || "No description available" };
}

function extractToolsAvailable(content: string): string[] {
  // Look for function/tool names in the skill content
  const tools: string[] = [];
  const toolMatch = content.match(/## Tools[\s\S]*?(?=## |$)/i);
  if (toolMatch) {
    const toolSection = toolMatch[0];
    const funcMatches = toolSection.matchAll(/[`'](\w+)[`']/g);
    for (const m of funcMatches) {
      if (!tools.includes(m[1])) tools.push(m[1]);
    }
  }
  return tools.slice(0, 20);
}

/**
 * Resolve a skill_path into one or more file system paths to read.
 *
 * Path conventions:
 *   connectors/<name>        → jarvis/cortex/skills/<name>-connector*.md + connectors/<name>/SKILL.md
 *   capabilities/<name>      → jarvis/cortex/skills/<name>*.md
 *   playbooks/<domain>        → playbooks/<domain>/playbook-<domain>.md
 *   skills/<name>            → jarvis/cortex/skills/<name>.md
 *   <bare name>              → tries jarvis/cortex/skills/<name>.md
 */
function resolveSkillPaths(skillPath: string): string[] {
  const normalized = skillPath.replace(/^\/+|\/+$/g, "");

  if (normalized.startsWith("connectors/")) {
    const name = normalized.replace("connectors/", "");
    return [
      // New U2.2 paths (local repo)
      `connectors/${name}/SKILL.md`,
      `connectors/${name}/PLAYBOOK.md`,
      `connectors/${name}/playbook.mdx`,
      // Legacy JFS paths
      `jarvis/cortex/connectors/${name}/SKILL.md`,
      `jarvis/cortex/connectors/${name}/playbook.md`,
      `jarvis/cortex/skills/${name}-connector.md`,
      `jarvis/cortex/skills/${name}.md`,
    ];
  }

  if (normalized.startsWith("playbooks/")) {
    const domain = normalized.replace("playbooks/", "");
    return [
      // Phase 21 V3: Fractal library canonical paths (playbook-skills meta-skill)
      `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/playbook-${domain}.md`,
      `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/playbook-${domain.replace(/-/g, "")}.md`,
      // Legacy paths (adapter pattern — backward compat)
      `playbooks/${domain}/playbook-${domain}.md`,
      `playbooks/${domain}/PLAYBOOK.md`,
      `playbooks/${domain}/playbook.md`,
      `playbooks/${domain}/SKILL.md`,
    ];
  }

  if (normalized.startsWith("organizations/")) {
    const parts = normalized.split("/");
    const org = parts[1];
    const domain = parts.slice(2).join("/");
    return [
      // New U2.2 paths first for legacy org lookups
      `playbooks/${domain}/playbook-${domain}.md`,
      `playbooks/${domain}/PLAYBOOK.md`,
      // Legacy JFS paths
      `jarvis/cortex/organizations/${org}/${domain}/SKILL.md`,
      `jarvis/cortex/organizations/${org}/${domain}/playbook.md`,
      `jarvis/cortex/organizations/${org}/${domain}/README.md`,
    ];
  }

  if (normalized.startsWith("capabilities/")) {
    const name = normalized.replace("capabilities/", "");
    return [
      // New U2.2 local paths
      `skills/capabilities/${name}/SKILL.md`,
      // Legacy JFS paths
      `jarvis/cortex/skills/${name}.md`,
      `jarvis/cortex/capabilities/${name}/SKILL.md`,
    ];
  }

  if (normalized.startsWith("playbook-skills")) {
    const rest = normalized.replace("playbook-skills/", "").replace("playbook-skills", "");
    // Phase 21 V3: Fractal paths within the meta-skill
    if (rest.startsWith("playbooks/") || rest.match(/^playbook-/)) {
      const domain = rest.replace("playbooks/", "").replace(/^playbook-/, "").replace(/\.md$/, "");
      return [
        `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/playbook-${domain}.md`,
        `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/${rest}`,
      ];
    }
    if (rest.startsWith("functions/")) {
      const fn = rest.replace("functions/", "").replace(/\.ts$/, "");
      return [
        `connectors/neptune/skills/custom-skills/playbook-skills/functions/${fn}.ts`,
      ];
    }
    if (rest.startsWith("workflows/")) {
      const wf = rest.replace("workflows/", "").replace(/\.ts$/, "");
      return [
        `connectors/neptune/skills/custom-skills/playbook-skills/workflows/${wf}.ts`,
      ];
    }
    // Default: treat as playbook-skills direct reference (e.g., "playbook-skills" → router)
    return [
      `connectors/neptune/skills/custom-skills/playbook-skills/PLAYBOOK-ROUTER.md`,
      `connectors/neptune/skills/custom-skills/playbook-skills/${rest}`,
    ];
  }

  if (normalized.startsWith("shared-skills/")) {
    const name = normalized.replace("shared-skills/", "");
    return [
      `shared-skills/${name}/SKILL.md`,
      `shared-skills/${name}/PLAYBOOK.md`,
    ];
  }

  if (normalized.startsWith("skills/")) {
    const name = normalized.replace("skills/", "");
    return [
      `shared-skills/${name}/SKILL.md`,
      `jarvis/cortex/skills/${name}.md`,
      `skills/${name}/SKILL.md`,
    ];
  }

  // Bare name — try shared-skills/ first, then skills, playbooks, prd
  return [
    `shared-skills/${normalized}/SKILL.md`,
    `jarvis/cortex/skills/${normalized}.md`,
    `jarvis/cortex/skills/${normalized}-skill.md`,
    `skills/capabilities/${normalized}/SKILL.md`,
    `skills/functions/${normalized}/SKILL.md`,
    `playbooks/${normalized}/playbook-${normalized}.md`,
    `jarvis/prd/${normalized}.md`,
  ];
}

// ── Phase 13.B: Usage logging helper ──────────────────────────────────────

const API_BASE = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function logUsageToLib(skillLoaded: string, skillType: string, success: boolean, tokens?: number, latencyMs?: number) {
  try {
    await fetch(`${API_BASE}/api/library/log-usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": process.env.NEPTUNE_INTERNAL_TOKEN || "",
      },
      body: JSON.stringify({
        session_id: "load-skill-legacy",
        skill_loaded: skillLoaded,
        skill_type: skillType,
        success_marker: success,
        tokens_actual: tokens || null,
        latency_actual_ms: latencyMs || null,
      }),
    }).catch(() => {});
  } catch { /* silent */ }
}

// ── Main Tool ────────────────────────────────────────────────────────────────

export const loadSkill = tool({
  description:
    "Load detailed skill content on-demand from the knowledge base. " +
    "Use when you need specific connector, playbook, or capability details. " +
    "Categories: connectors/ (NMI, Slack, GitHub, Vercel, etc.), " +
    "playbooks/ (billing, disputes, customer-support, etc.), " +
    "capabilities/ (self-coding, sandbox, etc.). " +
    "Keeps context efficient — only load what you need, when you need it.",
  inputSchema: z.object({
    skill_path: z
      .string()
      .describe(
        "Skill path to load. Examples: 'connectors/slack', 'capabilities/self-coding', " +
        "'skills/billing-flow-retry', 'connectors/nmi', 'playbooks/customer-support'. " +
        "Bare names like 'slack' are resolved to the best matching skill file."
      ),
  }),
  execute: async ({ skill_path }) => {
    const startTime = Date.now();
    const paths = resolveSkillPaths(skill_path);

    const results: SkillContent = {
      name: skill_path,
      description: "",
      content: "",
      tools_available: [],
      sources: [],
    };

    let foundAny = false;

    for (const fsPath of paths) {
      // Try VPS bridge first, then local filesystem
      let result = await vpsFsRead(fsPath);
      if (!result.success || !result.content) {
        result = localFsRead(fsPath);
      }
      if (result.success && result.content) {
        foundAny = true;
        const { description } = parseSkillMarkdown(result.content);
        const tools = extractToolsAvailable(result.content);

        if (!results.description && description) {
          results.description = description;
        }
        results.content += (results.content ? "\n\n---\n\n" : "") + result.content;
        results.tools_available = [
          ...new Set([...results.tools_available, ...tools]),
        ];
        results.sources.push(fsPath);
      }
    }

    const latency = Date.now() - startTime;
    const tokens = results.content ? Math.ceil(results.content.length / 2.5) : 0;

    // Phase 13.B: Log usage
    logUsageToLib(skill_path, "skill", foundAny, tokens, latency);

    if (!foundAny) {
      // Try listing the local skills directory to give the user context on what's available
      const availableSkills: string[] = [];
      // Try VPS bridge skill listing
      const skillsList = await vpsFsList("jarvis/cortex/skills");
      if (skillsList.success && skillsList.files) {
        availableSkills.push(...skillsList.files.slice(0, 30).map((f) => f.name.replace(".md", "")));
      }
      // Also try local playbooks + skills dirs
      try {
        const fullSkillsDir = join(CWD, "skills");
        if (existsSync(fullSkillsDir)) {
          const { readdirSync } = await import("fs");
          for (const dir of ["capabilities", "connectors", "functions"]) {
            const d = join(fullSkillsDir, dir);
            if (existsSync(d)) {
              availableSkills.push(...readdirSync(d).map((f: string) => `${dir}/${f.replace(".md", "")}`));
            }
          }
        }
      } catch { /* local fs unavailable — not an error */ }

      return {
        skill_path,
        loaded: false,
        error: `Skill "${skill_path}" not found. Tried paths: ${paths.join(", ")}. `,
        available_skills_sample: availableSkills.slice(0, 30),
        hint: "Use listSkills to browse all available skills, or try a different path format. Available prefixes: playbooks/<domain>, connectors/<name>, skills/<name>.",
      };
    }

    return {
      skill_path,
      loaded: true,
      name: results.name,
      description: results.description,
      content: results.content.slice(0, 15000), // Cap at 15KB to avoid context bloat
      content_truncated: results.content.length > 15000,
      content_length: results.content.length,
      tools_available: results.tools_available.slice(0, 30),
      sources: results.sources,
      hint: "Use the tools_available list to know what operations this skill supports. The content includes playbook instructions for proper usage.",
    };
  },
});

export default loadSkill;
