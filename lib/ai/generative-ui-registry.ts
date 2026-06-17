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
    toolName: "getCustomerProfile",
    detect: (output: unknown) =>
      typeof output === "object" &&
      output !== null &&
      "connectorType" in output &&
      (output as Record<string, unknown>).connectorType === "base44",
    description: "UniversalConnectorCard (base44) — entity type + records",
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
];

export function getBuiltInTools() {
  return BUILT_IN_TOOLS;
}
