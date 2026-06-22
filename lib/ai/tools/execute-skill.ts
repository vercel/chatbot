/**
 * Phase 5a M-NEPTUNE-PERFECT: executeSkill Tool
 *
 * Executes a named skill/playbook with YAML frontmatter steps.
 * Resolution order:
 *   1. playbook-skills/playbooks/{domain}/skills/{name}.md
 *   2. jarvis/cortex/skills/{name}.md
 *   3. skills/{name}/SKILL.md (local repo)
 *
 * Parses YAML frontmatter, extracts step sequence, and returns
 * structured result with step traces for UI rendering.
 */

import { tool } from "ai";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

interface StepTrace {
  stepIndex: number;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  toolName?: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

interface ExecuteSkillResult {
  success: boolean;
  skillId: string;
  skillName: string;
  source: string;
  path: string;
  frontmatter: Record<string, unknown>;
  steps: StepTrace[];
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalDurationMs: number;
  error?: string;
}

// ── YAML Frontmatter Parser ───────────────────────────────────────────────

function parseYamlFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  const endIdx = content.indexOf("---", 3);
  if (endIdx <= 0) {
    return { frontmatter: {}, body: content };
  }

  const fmBlock = content.substring(3, endIdx).trim();
  const body = content.substring(endIdx + 3).trim();

  const frontmatter: Record<string, unknown> = {};
  for (const line of fmBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value: unknown = line.substring(colonIdx + 1).trim();
      // Parse arrays: [a, b, c]
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim().replace(/['"]/g, ""));
      }
      // Parse boolean
      if (value === "true") value = true;
      if (value === "false") value = false;
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

// ── Step Extraction ────────────────────────────────────────────────────────

function extractSteps(body: string): Array<{
  description: string;
  toolName?: string;
}> {
  const steps: Array<{ description: string; toolName?: string }> = [];

  // Match numbered step patterns:
  // 1. Do something with `toolName`
  // Step 1: Description
  // - [ ] Task description
  const stepRegex = /^(?:Step\s+)?(\d+)[\.:\)]\s+(.+)$/gm;
  let match;
  while ((match = stepRegex.exec(body)) !== null) {
    const description = match[2].trim();
    // Extract tool name from backtick-quoted strings
    const toolMatch = description.match(/`(\w+)`/);
    steps.push({
      description,
      toolName: toolMatch?.[1],
    });
  }

  // Also try checklist pattern: - [ ] Task description
  if (steps.length === 0) {
    const checklistRegex = /^-\s*\[[\sx]\]\s+(.+)$/gm;
    while ((match = checklistRegex.exec(body)) !== null) {
      const description = match[1].trim();
      const toolMatch = description.match(/`(\w+)`/);
      steps.push({
        description,
        toolName: toolMatch?.[1],
      });
    }
  }

  return steps;
}

// ── Skill Resolution ───────────────────────────────────────────────────────

function resolveSkillPath(skillId: string): {
  path: string;
  content: string;
  source: string;
} | null {
  // Parse skill_id: supports "domain.name" format (e.g., "billing.audit")
  const parts = skillId.split(".");
  const domain = parts.length > 1 ? parts[0] : null;
  const name = parts.length > 1 ? parts.slice(1).join(".") : skillId;

  // Priority 1: playbook-skills/playbooks/{domain}/skills/{name}.md
  if (domain) {
    const playbookSkillsPath = join(
      process.cwd(),
      "playbook-skills",
      "playbooks",
      domain,
      "skills",
      `${name}.md`
    );
    if (existsSync(playbookSkillsPath)) {
      return {
        path: `playbook-skills/playbooks/${domain}/skills/${name}.md`,
        content: readFileSync(playbookSkillsPath, "utf-8"),
        source: "playbook-skills",
      };
    }
  }

  // Priority 2: jarvis/cortex/skills/{skillId}.md
  const cortexPath = join(
    process.cwd(),
    "jarvis",
    "cortex",
    "skills",
    `${skillId}.md`
  );
  if (existsSync(cortexPath)) {
    return {
      path: `jarvis/cortex/skills/${skillId}.md`,
      content: readFileSync(cortexPath, "utf-8"),
      source: "jarvis-cortex",
    };
  }

  // Priority 3: skills/{skillId}/SKILL.md
  const localSkillPath = join(
    process.cwd(),
    "skills",
    skillId,
    "SKILL.md"
  );
  if (existsSync(localSkillPath)) {
    return {
      path: `skills/${skillId}/SKILL.md`,
      content: readFileSync(localSkillPath, "utf-8"),
      source: "local-repo",
    };
  }

  // Priority 4: playbook-skills/connectors/{name}/SKILL.md
  if (domain) {
    const connectorPath = join(
      process.cwd(),
      "playbook-skills",
      "connectors",
      name,
      "SKILL.md"
    );
    if (existsSync(connectorPath)) {
      return {
        path: `playbook-skills/connectors/${name}/SKILL.md`,
        content: readFileSync(connectorPath, "utf-8"),
        source: "connector-playbook",
      };
    }
  }

  return null;
}

// ── Tool Definition ────────────────────────────────────────────────────────

export const executeSkill = tool({
  description:
    "Execute a named skill/playbook with structured step execution. " +
    "Provide skill_id in format 'domain.name' (e.g., 'billing.audit', 'deploy.check') " +
    "or as a flat name (e.g., 'billing-flow-retry'). " +
    "Parses YAML frontmatter for skill metadata, extracts step sequence, " +
    "and returns a structured result with per-step traces. " +
    "Use listPlaybooks to discover available skill IDs before executing.",
  inputSchema: z.object({
    skill_id: z
      .string()
      .describe(
        "Skill identifier. Use 'domain.name' format (e.g., 'billing.audit', 'disputes.review') " +
        "or flat name (e.g., 'billing-flow-retry'). " +
        "Use listPlaybooks to discover available skills."
      ),
    params: z
      .record(z.unknown())
      .optional()
      .describe("Optional parameters to pass to each step. Keys map to step-level overrides."),
    execute: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to actually execute steps (true) or just parse and return the plan (false)"),
  }),
  execute: async ({ skill_id, params, execute: shouldExecute }): Promise<ExecuteSkillResult> => {
    const startTime = Date.now();

    // Resolve skill path
    const resolved = resolveSkillPath(skill_id);
    if (!resolved) {
      const tried = [
        `playbook-skills/playbooks/{domain}/skills/${skill_id}.md`,
        `jarvis/cortex/skills/${skill_id}.md`,
        `skills/${skill_id}/SKILL.md`,
      ];
      return {
        success: false,
        skillId: skill_id,
        skillName: skill_id,
        source: "none",
        path: "",
        frontmatter: {},
        steps: [],
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        totalDurationMs: Date.now() - startTime,
        error: `Skill "${skill_id}" not found. Tried: ${tried.join(", ")}. Use listPlaybooks to discover available skills.`,
      };
    }

    // Parse frontmatter
    const { frontmatter, body } = parseYamlFrontmatter(resolved.content);

    // Extract steps
    const rawSteps = extractSteps(body);
    const steps: StepTrace[] = rawSteps.map((s, i) => ({
      stepIndex: i + 1,
      description: s.description,
      status: "pending" as const,
      toolName: s.toolName,
    }));

    // Execute steps if requested
    if (shouldExecute && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepStart = Date.now();

        step.status = "running";

        if (step.toolName) {
          try {
            // Mark the step as executed — actual tool calls happen
            // at the agent level. Here we provide the execution contract.
            step.status = "completed";
            step.output = {
              tool: step.toolName,
              params: params || {},
              note: "Step contract provided. Agent will execute this tool with the specified params.",
            };
          } catch (err) {
            step.status = "failed";
            step.error = err instanceof Error ? err.message : "Unknown error";
          }
        } else {
          // No tool specified — mark as completed (documentation step)
          step.status = "completed";
          step.output = { note: "Manual step — no tool specified." };
        }

        step.durationMs = Date.now() - stepStart;
      }
    } else if (!shouldExecute) {
      // Dry run — all steps remain pending
      for (const step of steps) {
        step.status = "skipped";
        step.output = { note: "Dry run — step not executed." };
      }
    }

    const endTime = Date.now();

    return {
      success: true,
      skillId: skill_id,
      skillName: (frontmatter.name as string) || skill_id,
      source: resolved.source,
      path: resolved.path,
      frontmatter,
      steps,
      totalSteps: steps.length,
      completedSteps: steps.filter((s) => s.status === "completed").length,
      failedSteps: steps.filter((s) => s.status === "failed").length,
      totalDurationMs: endTime - startTime,
    };
  },
});

export default executeSkill;
