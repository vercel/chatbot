// @ts-nocheck — pre-existing Phase 24 type issues, refined in Streams 3-5
/**
 * GET /api/capabilities — Unified capabilities introspection endpoint.
 * Returns full tree: tools, connectors, playbooks, skills, workflows.
 */
import { initConnectors, manifests } from "@/lib/connectors/init";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

interface CapabilityItem {
  name: string;
  category: string;
  description: string;
  status: "connected" | "configured" | "disconnected" | "active" | "draft";
  actionCount: number;
  icon?: string;
}

interface CapabilitiesTree {
  tools: CapabilityItem[];
  connectors: CapabilityItem[];
  playbooks: CapabilityItem[];
  skills: CapabilityItem[];
  workflows: CapabilityItem[];
  summary: {
    totalTools: number;
    totalConnectors: number;
    connectedConnectors: number;
    totalPlaybooks: number;
    totalSkills: number;
    totalWorkflows: number;
    totalActions: number;
  };
}

const GATEKEEPER_TOOLS: CapabilityItem[] = [
  { name: "code_edit", category: "tools", description: "Edit code files via MCP", status: "active", actionCount: 1, icon: "edit" },
  { name: "file_read", category: "tools", description: "Read any file from the repo", status: "active", actionCount: 1, icon: "file" },
  { name: "github_tools", category: "tools", description: "GitHub PR, branch, repo management", status: "active", actionCount: 35, icon: "github" },
  { name: "spawn_v2", category: "tools", description: "Spawn a V2 coding agent session", status: "active", actionCount: 1, icon: "bot" },
  { name: "web_search", category: "tools", description: "Search the web for information", status: "active", actionCount: 1, icon: "search" },
  { name: "run_workflow", category: "tools", description: "Execute a predefined workflow", status: "active", actionCount: 5, icon: "play" },
];

const PLAYBOOKS: CapabilityItem[] = [
  { name: "billing-flow", category: "playbooks", description: "Billing operations (P0)", status: "active", actionCount: 12 },
  { name: "credit-disputes", category: "playbooks", description: "Credit dispute processing (P0)", status: "active", actionCount: 8 },
  { name: "customer-enrollment", category: "playbooks", description: "Customer enrollment flow (P0)", status: "active", actionCount: 10 },
  { name: "compliance-audit", category: "playbooks", description: "Compliance auditing (P0)", status: "active", actionCount: 6 },
  { name: "support-triage", category: "playbooks", description: "Support ticket triage (P1)", status: "active", actionCount: 7 },
  { name: "agent-payments", category: "playbooks", description: "Agent payment processing (P1)", status: "active", actionCount: 9 },
  { name: "reporting", category: "playbooks", description: "Reporting & analytics (P1)", status: "active", actionCount: 5 },
  { name: "customer-comms", category: "playbooks", description: "Customer communications (P1)", status: "active", actionCount: 11 },
  { name: "lead-flow", category: "playbooks", description: "Lead management (P2)", status: "active", actionCount: 6 },
  { name: "mcp-edits", category: "playbooks", description: "MCP-based code edits (P2)", status: "active", actionCount: 4 },
  { name: "nmi-golden-vault", category: "playbooks", description: "NMI card vault architecture", status: "active", actionCount: 5 },
  { name: "smart-retry-engine", category: "playbooks", description: "Smart payment retry engine", status: "active", actionCount: 3 },
];

const SKILLS: CapabilityItem[] = [
  { name: "billing-and-payments", category: "skills", description: "Billing, payments, NMI, recovery", status: "active", actionCount: 15 },
  { name: "working-with-neptune-ui", category: "skills", description: "Neptune UI component patterns", status: "active", actionCount: 8 },
  { name: "working-with-newleaf-base44", category: "skills", description: "Base44 CRM operations", status: "active", actionCount: 12 },
  { name: "vercel-workflow", category: "skills", description: "Vercel deploy workflows", status: "active", actionCount: 6 },
  { name: "vercel-code-review", category: "skills", description: "Code review & quality gates", status: "active", actionCount: 4 },
  { name: "template-deploy", category: "skills", description: "Template forking & deployment", status: "active", actionCount: 3 },
  { name: "dispatch", category: "skills", description: "Sub-mission dispatch to agents", status: "active", actionCount: 5 },
  { name: "research-and-analysis", category: "skills", description: "Deep research & analysis", status: "active", actionCount: 7 },
  { name: "ui-and-design", category: "skills", description: "UI component design", status: "active", actionCount: 6 },
  { name: "vps-operations", category: "skills", description: "VPS management & operations", status: "active", actionCount: 8 },
  { name: "slack-delivery", category: "skills", description: "Slack message posting", status: "active", actionCount: 3 },
  { name: "orchestration-and-dispatch", category: "skills", description: "Agent orchestration", status: "active", actionCount: 4 },
];

const WORKFLOWS: CapabilityItem[] = [
  { name: "customer-360", category: "workflows", description: "Full customer 360 analysis", status: "active", actionCount: 8 },
  { name: "dispute-pipeline", category: "workflows", description: "Credit dispute processing pipeline", status: "active", actionCount: 6 },
  { name: "billing-recovery", category: "workflows", description: "Billing recovery workflow", status: "active", actionCount: 5 },
  { name: "daily-brief", category: "workflows", description: "Daily operational briefing", status: "active", actionCount: 4 },
  { name: "new-hire-onboarding", category: "workflows", description: "New hire onboarding workflow", status: "active", actionCount: 7 },
];

export const GET = requireAllowlist(function GET() {
  initConnectors();

  const connectorItems: CapabilityItem[] = manifests.map((m) => ({
    name: m.id,
    category: "connectors",
    description: m.description,
    status: m.getStatus().connected ? "connected" : "disconnected",
    actionCount: m.capabilities.length,
    icon: m.id,
  }));

  const tree: CapabilitiesTree = {
    tools: GATEKEEPER_TOOLS,
    connectors: connectorItems,
    playbooks: PLAYBOOKS,
    skills: SKILLS,
    workflows: WORKFLOWS,
    summary: {
      totalTools: GATEKEEPER_TOOLS.length,
      totalConnectors: connectorItems.length,
      connectedConnectors: connectorItems.filter((c) => c.status === "connected").length,
      totalPlaybooks: PLAYBOOKS.length,
      totalSkills: SKILLS.length,
      totalWorkflows: WORKFLOWS.length,
      totalActions:
        GATEKEEPER_TOOLS.reduce((s, t) => s + t.actionCount, 0) +
        PLAYBOOKS.reduce((s, p) => s + p.actionCount, 0) +
        SKILLS.reduce((s, s2) => s + s2.actionCount, 0) +
        WORKFLOWS.reduce((s, w) => s + w.actionCount, 0),
    },
  };

  return Response.json(tree);
});
