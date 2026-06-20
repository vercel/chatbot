/**
 * Neptune Connector — Action Router
 *
 * Resolves skill and function calls for all neptune-authored capabilities.
 * Skills live under skills/<connector>/SKILL.md
 * Functions live under functions/<name>.ts
 *
 * Phase 8: 200+ actions across 8 connectors (github, ghl, linear, vercel, forth, wiki, mcp-hub, affy)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SKILLS_ROOT = join(process.cwd(), "connectors", "neptune", "skills");
const FUNCTIONS_ROOT = join(process.cwd(), "connectors", "neptune", "functions");

// ── Types ──────────────────────────────────────────────────────────────────

export interface SkillAction {
  name: string;
  description: string;
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  returns: string;
}

export interface SkillManifest {
  name: string;
  version: string;
  connector: string;
  actions: SkillAction[];
  totalActions: number;
}

// ── Skill Registry ──────────────────────────────────────────────────────────

const SKILL_REGISTRY: Record<string, { path: string; actions: number }> = {
  github:  { path: "github/SKILL.md",  actions: 35 },
  ghl:     { path: "ghl/SKILL.md",     actions: 35 },
  linear:  { path: "linear/SKILL.md",  actions: 25 },
  vercel:  { path: "vercel/SKILL.md",  actions: 25 },
  forth:   { path: "forth/SKILL.md",   actions: 30 },
  wiki:    { path: "wiki/SKILL.md",    actions: 20 },
  "mcp-hub": { path: "mcp-hub/SKILL.md", actions: 15 },
  affy:    { path: "affy/SKILL.md",    actions: 15 },
  base44:  { path: "base44/SKILL.md",  actions: 6 },
  nmi:     { path: "nmi/SKILL.md",     actions: 5 },
  slack:   { path: "slack/SKILL.md",   actions: 6 },
  vapi:    { path: "vapi/SKILL.md",    actions: 3 },
  hyperswitch: { path: "hyperswitch/SKILL.md", actions: 4 },
  "youtube-research": { path: "youtube-research/SKILL.md", actions: 5 },
  "pocock-engineering": { path: "pocock-engineering/SKILL.md", actions: 10 },
};

// ── Function Registry ──────────────────────────────────────────────────────

const FUNCTION_REGISTRY: Record<string, string> = {
  "parse-decline-reason": "parse-decline-reason.ts",
  "compute-mrr": "compute-mrr.ts",
  "annotation-collector": "annotation-collector.ts",
  "usage-telemetry": "usage-telemetry.ts",
};

// ── Router ──────────────────────────────────────────────────────────────────

export async function routeNeptuneAction(
  action: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Check if it's a skill action
  const [connector, ...actionParts] = action.split(".");
  const actionName = actionParts.join(".");

  if (SKILL_REGISTRY[connector]) {
    return resolveSkillAction(connector, actionName, payload);
  }

  // Check if it's a function call
  if (FUNCTION_REGISTRY[action]) {
    return resolveFunctionCall(action, payload);
  }

  return { success: false, error: `Unknown action: ${action}. Available connectors: ${Object.keys(SKILL_REGISTRY).join(", ")}` };
}

async function resolveSkillAction(
  connector: string,
  actionName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const skillPath = join(SKILLS_ROOT, SKILL_REGISTRY[connector].path);

  if (!existsSync(skillPath)) {
    return { success: false, error: `Skill file not found: ${skillPath}` };
  }

  // In production, this would parse the SKILL.md and execute the requested action.
  // For Phase 8, we return the skill metadata confirming the action exists.
  return {
    success: true,
    data: {
      connector,
      action: actionName,
      skillPath,
      totalActions: SKILL_REGISTRY[connector].actions,
      message: `Skill '${connector}.${actionName}' resolved. See ${skillPath} for full documentation.`,
    },
  };
}

async function resolveFunctionCall(
  functionName: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const funcPath = join(FUNCTIONS_ROOT, FUNCTION_REGISTRY[functionName]);

  if (!existsSync(funcPath)) {
    return { success: false, error: `Function file not found: ${funcPath}` };
  }

  return {
    success: true,
    data: {
      function: functionName,
      funcPath,
      message: `Function '${functionName}' resolved.`,
    },
  };
}

export function listNeptuneSkills(): { connector: string; actions: number }[] {
  return Object.entries(SKILL_REGISTRY).map(([connector, info]) => ({
    connector,
    actions: info.actions,
  }));
}

export function listNeptuneFunctions(): string[] {
  return Object.keys(FUNCTION_REGISTRY);
}

export function getTotalActions(): number {
  return Object.values(SKILL_REGISTRY).reduce((sum, s) => sum + s.actions, 0);
}

// ── Available Actions Registry (for master-registry.json scanner) ────────────────

/**
 * Build flat action list for master-registry.json auto-discovery.
 * Format: connector.skill.action — e.g. "github.repo.list"
 */
function buildNeptuneActionList(): string[] {
  const actions: string[] = [];

  // Skill actions: connector.actionCategory.verb
  const skillCategories: Record<string, string[]> = {
    github: [
      "repo.list", "repo.get", "repo.create", "repo.delete", "repo.branches",
      "branch.get", "branch.create", "branch.delete", "branch.protect",
      "commit.list", "commit.get", "commit.compare", "commit.files",
      "pr.list", "pr.get", "pr.create", "pr.merge", "pr.close", "pr.review",
      "search.code", "search.repos", "search.commits", "search.issues", "search.users",
      "issue.list", "issue.get", "issue.create", "issue.update", "issue.comment",
      "workflow.list", "workflow.run", "workflow.status",
      "release.list", "release.get", "release.create",
    ],
    ghl: [
      "contact.list", "contact.get", "contact.create", "contact.update", "contact.delete", "contact.search",
      "sms.send", "sms.list", "sms.bulk", "sms.template", "sms.opt_in",
      "email.send", "email.list", "email.template", "email.campaign", "email.bulk",
      "pipeline.stages", "pipeline.opportunity", "pipeline.move", "pipeline.status", "pipeline.metrics", "pipeline.deal",
      "campaign.create", "campaign.list", "campaign.status", "campaign.analytics", "campaign.edit",
      "calendar.events", "calendar.schedule", "calendar.availability", "calendar.book",
      "analytics.pipeline", "analytics.campaign", "analytics.contacts", "analytics.sms",
    ],
    linear: [
      "issue.list", "issue.get", "issue.create", "issue.update", "issue.delete", "issue.search", "issue.assign",
      "project.list", "project.get", "project.create", "project.update",
      "team.list", "team.get", "team.members",
      "cycle.list", "cycle.get", "cycle.create", "cycle.update",
      "view.list", "view.get", "view.create", "view.update",
      "workflow.list", "workflow.get", "workflow.transition",
    ],
    vercel: [
      "deployment.list", "deployment.get", "deployment.create", "deployment.cancel", "deployment.promote", "deployment.rollback",
      "build.list", "build.get", "build.logs",
      "project.list", "project.get", "project.create", "project.update",
      "domain.list", "domain.get", "domain.add", "domain.verify",
      "env.list", "env.get", "env.update",
      "analytics.visits", "analytics.bandwidth", "analytics.errors",
      "security.headers", "security.firewall",
    ],
    forth: [
      "report.fetch", "report.parse", "report.audit", "report.summary", "report.history", "report.export",
      "contact.get", "contact.create", "contact.update", "contact.verify",
      "enrollment.create", "enrollment.status", "enrollment.update", "enrollment.cancel", "enrollment.audit",
      "dispute.create", "dispute.get", "dispute.status", "dispute.evidence", "dispute.submit", "dispute.track", "dispute.result", "dispute.appeal",
      "resolution.get", "resolution.update", "resolution.verify", "resolution.audit",
      "compliance.check", "compliance.audit", "compliance.report",
    ],
    wiki: [
      "page.list", "page.get", "page.create", "page.update", "page.delete",
      "search.fulltext", "search.tag", "search.related", "search.recent",
      "ingest.url", "ingest.file", "ingest.text",
      "index.rebuild", "index.status", "index.optimize",
      "lint.spelling", "lint.links", "lint.format",
      "category.list", "category.assign",
    ],
    "mcp-hub": [
      "server.list", "server.get", "server.start", "server.stop", "server.restart",
      "tool.list", "tool.get", "tool.invoke",
      "health.check", "health.status", "health.metrics",
      "resource.list", "resource.get",
      "protocol.version", "protocol.capabilities",
    ],
    affy: [
      "chargeback.list", "chargeback.get", "chargeback.alert",
      "evidence.prepare", "evidence.submit", "evidence.status", "evidence.requirements",
      "affidavit.generate", "affidavit.review", "affidavit.template",
      "dispute.track", "dispute.outcome", "dispute.timeline",
      "analytics.by_reason", "analytics.win_rate",
    ],
  };

  for (const [connector, skillActions] of Object.entries(skillCategories)) {
    for (const sa of skillActions) {
      actions.push(`${connector}.${sa}`);
    }
  }

  // Function actions
  for (const fn of Object.keys(FUNCTION_REGISTRY)) {
    actions.push(`neptune.function.${fn}`);
  }

  return actions;
}

export const availableActions: string[] = buildNeptuneActionList();

export { SKILL_REGISTRY, FUNCTION_REGISTRY };
