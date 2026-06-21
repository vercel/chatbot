/**
 * M3 Agent Name Resolver
 * Maps natural-language agent names to email addresses.
 */

const AGENT_MAP: Record<string, string> = {
  jerry: "jerry.b.yirenkyi@gmail.com",
  jennifer: "jenniferwithvestalink@gmail.com",
  anna: "anna@newleaf-financial.com",
  edgar: "edgar@newleaf-financial.com",
  michael: "michael@newleaf-financial.com",
  kinza: "kinza@newleaf-financial.com",
  chris: "chris@newleaf-financial.com",
  izhan: "izhan@newleaf-financial.com",
  shazam: "shazam@newleaf-financial.com",
  self: "", // Will be resolved from Slack user
};

/**
 * Resolve agent name to email.
 * Returns empty string if unresolved (caller should use Slack user lookup fallback).
 */
export function resolveAgentEmail(agentName: string | null): string {
  if (!agentName) return "";
  const key = agentName.toLowerCase().trim();
  return AGENT_MAP[key] || "";
}

export function getKnownAgentNames(): string[] {
  return Object.keys(AGENT_MAP);
}
