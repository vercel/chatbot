/**
 * Phase 25 Stream 5: Generative UI Registry
 *
 * Central map: tool name → component + detection logic.
 * message.tsx reads this registry to auto-render the correct generative card.
 * Falls back to ToolResultRenderer for unregistered tools.
 *
 * Adding a new card:
 * 1. Register here with tool name, detection function, component
 * 2. message.tsx auto-renders it
 */
import { type ComponentType } from "react";

export interface RegisteredComponent {
  /** Tool name as it appears in message parts (e.g. "createMission") */
  toolName: string;
  /** Detection function — returns true if the tool output should render this component */
  detect: (output: unknown) => boolean;
  /** Component to render */
  component: ComponentType<{ data: Record<string, unknown> }>;
  /** Description for debugging */
  description: string;
}

// Registry is lazy-populated to avoid circular imports
let _registry: RegisteredComponent[] | null = null;

export function getRegistry(): RegisteredComponent[] {
  if (_registry) return _registry;
  _registry = [];
  return _registry;
}

/**
 * Register a component. Called at module init time by component files.
 */
export function registerComponent(entry: RegisteredComponent): void {
  const registry = getRegistry();
  // Avoid duplicates
  const existing = registry.findIndex((r) => r.toolName === entry.toolName);
  if (existing >= 0) {
    registry[existing] = entry;
  } else {
    registry.push(entry);
  }
}

/**
 * Find the matching registered component for a tool output.
 * Returns the first match, or null if no match.
 */
export function findComponent(
  toolName: string,
  output: unknown
): RegisteredComponent | null {
  const registry = getRegistry();
  for (const entry of registry) {
    if (entry.toolName === toolName && entry.detect(output)) {
      return entry;
    }
  }

  // Also try matching by output shape (connector envelope fallback)
  if (registry.length > 0) {
    for (const entry of registry) {
      if (entry.detect(output)) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Validate at startup that all registered tools have resolvable components.
 * Called from app initialization; logs warnings for broken registrations.
 */
export function validateRegistry(): string[] {
  const errors: string[] = [];
  const registry = getRegistry();

  for (const entry of registry) {
    if (!entry.component) {
      errors.push(`[generative-ui-registry] Missing component for tool "${entry.toolName}"`);
    }
    if (!entry.detect) {
      errors.push(`[generative-ui-registry] Missing detect function for tool "${entry.toolName}"`);
    }
  }

  if (registry.length === 0) {
    errors.push("[generative-ui-registry] Registry is empty — no generative cards will render");
  }

  return errors;
}

// ── Built-in registrations ──────────────────────────────────────────────────
// These are imported lazily when actually used to avoid circular deps

export const BUILT_IN_TOOLS = [
  {
    toolName: "createMission",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null && "missionId" in output,
    description: "MissionCard — multi-step mission tracker with 4 states",
  },
  {
    toolName: "spawnCodingAgent",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null && "handoff" in output,
    description: "HandoffCard — V2 coding agent handoff with sandbox preview",
  },
  // ── M-N4: New generative UI cards ───────────────────────────────────
  {
    toolName: "billingAlignment",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "type" in output && (output as Record<string, unknown>).type === "billing-alignment",
    description: "BillingAlignmentCard — billing drift analysis between Base44 and NMI",
  },
  {
    toolName: "getCustomerProfile",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "customerId" in output,
    description: "CustomerProfileCard — rich customer 360 with subscription, payments, calls, messages",
  },
  {
    toolName: "reportingHub",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      ("action" in output || "report" in output),
    description: "ReportCard — rendered markdown report with export actions",
  },
  {
    toolName: "reportingHubQuery",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      ("action" in output || "report" in output),
    description: "ReportCard — markdown report with export (alias for reportingHub)",
  },
  {
    toolName: "queryKnowledge",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "results" in output,
    description: "SearchResultCard — knowledge graph search results with relevance scores",
  },
  {
    toolName: "graphQuery",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "results" in output,
    description: "SearchResultCard — graph query results with relevance scores",
  },
  {
    toolName: "discoverResource",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "results" in output,
    description: "SearchResultCard — resource discovery results with relevance scores",
  },
  // ── M-N-META: Multi-lane Agent Session Cards ────────────────────────
  {
    toolName: "spawn-coding-agent",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      ("handoff" in output || "sessionId" in output),
    description: "AgentSessionCard — V2 coding agent session with live progress + file diffs + deploy",
  },
  {
    toolName: "hermes-vps",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "dispatchId" in output,
    description: "AgentSessionCard (lane=vps) — VPS dispatch progress with step-by-step todo list + Slack bridge",
  },
  {
    toolName: "v2-handoff",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      ("lane" in output && (output as Record<string, unknown>).lane === "v2"),
    description: "AgentSessionCard (lane=v2) — V2 handoff with PR creation + Vercel deploy",
  },
  {
    toolName: "createAgentSession",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "lane" in output && "sessionId" in output,
    description: "AgentSessionCard — Multi-lane agent session with auto-lane detection",
  },
  // ── Legacy VPS entry (redirected to AgentSessionCard with lane=vps) ──
  {
    toolName: "dispatchToVps",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "dispatchId" in output,
    description: "AgentSessionCard (lane=vps) — Redirected from legacy VpsProgressCard pattern",
  },
  // ── Existing connector cards ────────────────────────────────────────
  {
    toolName: "getWeather",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "weather",
    description: "UniversalConnectorCard (weather) — temperature + condition",
  },
  {
    toolName: "getNmiTransaction",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "nmi",
    description: "UniversalConnectorCard (nmi) — amount + cofIndicator + status",
  },
  {
    toolName: "pullSlackThread",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "slack",
    description: "UniversalConnectorCard (slack) — channel + reactions + replies",
  },
  {
    toolName: "getVapiCall",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "vapi",
    description: "UniversalConnectorCard (vapi) — callSid + sentiment + duration",
  },
  {
    toolName: "getGithubPr",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "github",
    description: "UniversalConnectorCard (github) — repo + branch + checks",
  },
  {
    toolName: "getVercelDeploy",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "vercel",
    description: "UniversalConnectorCard (vercel) — project + deploy URL + build",
  },
  {
    toolName: "executeCrmAction",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "actionName" in output &&
      ("auditId" in output || "requiresConfirmation" in output || "status" in output),
    description: "MissionCard (CRM Action) — generative CRM action with audit trail + confirmation gates",
  },
  // ── M-NEPTUNE-GAPS: view_file tool → ReadFileCard ──────────────────────
  {
    toolName: "viewGithubFile",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      ("content" in output || "error" in output) &&
      ("repo" in output || "html_url" in output || "path" in output),
    description: "ReadFileCard — GitHub file content with syntax highlighting, copy, and GitHub link",
  },
  {
    toolName: "viewFile",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      ("content" in output || "error" in output) &&
      ("path" in output) &&
      !("repo" in output),
    description: "ReadFileCard (local/VPS) — local file content with syntax highlighting",
  },
  // ── M-NEPTUNE-PERFECT Phase 2: Snake_case aliases ──────────────────────────
  {
    toolName: "view_file",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      ("content" in output || "error" in output) &&
      ("path" in output || "repo" in output),
    description: "ReadFileCard — file content with syntax highlighting (snake_case alias for viewGithubFile)",
  },
  {
    toolName: "query_knowledge",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "results" in output,
    description: "SearchResultCard — KG search results (snake_case alias for queryKnowledge)",
  },
  {
    toolName: "load_skill",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      ("skill_name" in output || "content" in output || "frontmatter" in output || "loaded" in output),
    description: "SkillLoadCard — skill/playbook content and execution contract (snake_case alias for loadSkill)",
  },
  {
    toolName: "listPlaybookSkill",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      ("skill_name" in output || "content" in output || "frontmatter" in output || "loaded" in output),
    description: "SkillLoadCard — playbook skill loading (alias for loadSkill/listPlaybookSkill)",
  },
  // ── M-NEPTUNE-PERFECT Phase 5: Enhanced skill + workflow tools ──────────
  {
    toolName: "executeSkillV2",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "steps" in output && Array.isArray((output as Record<string, unknown>).steps),
    description: "SkillExecutionCard — step-by-step execution traces with per-step status and timing (Phase 5a)",
  },
  {
    toolName: "runWorkflowTool",
    detect: (output: unknown) =>
      typeof output === "object" && output !== null &&
      "workflowRunId" in output && "sseUrl" in output,
    description: "WorkflowRunCard — named workflow execution with SSE progress URL and report link (Phase 5b)",
  },
];

export function getBuiltInTools() {
  return BUILT_IN_TOOLS;
}
