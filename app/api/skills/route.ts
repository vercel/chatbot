/**
 * GET /api/skills — List all skills from shared registry.
 * Reads from /home/neptune/_shared-skills/registry.json
 */
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SHARED_SKILLS_ROOT = "/home/neptune/_shared-skills";
const REGISTRY_PATH = join(SHARED_SKILLS_ROOT, "registry.json");

interface SkillEntry {
  name: string;
  version: string;
  path: string;
  primary_domain: string;
  also_in?: string[];
  tools?: number;
  dependencies?: string[];
}

interface Registry {
  connectors: SkillEntry[];
  functions: SkillEntry[];
  capabilities: SkillEntry[];
  summary: {
    totalConnectors: number;
    totalFunctions: number;
    totalCapabilities: number;
    totalSkills: number;
  };
}

function loadRegistry(): Registry | null {
  try {
    if (!existsSync(REGISTRY_PATH)) return null;
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch {
    return null;
  }
}

// Inline fallback when VPS filesystem is unavailable (e.g., on Vercel serverless)
const INLINE_REGISTRY: Registry = {
  connectors: [
    { name: "nmi-connector", version: "1.0.0", path: "connectors/nmi", tools: 5, primary_domain: "billing-flow", also_in: ["agent-payments", "customer-enrollment"], dependencies: ["hyperswitch-connector"] },
    { name: "slack-connector", version: "1.0.0", path: "connectors/slack", tools: 6, primary_domain: "comms", also_in: ["support-triage", "reporting", "agent-payments"], dependencies: [] },
    { name: "github-connector", version: "1.0.0", path: "connectors/github", tools: 7, primary_domain: "coding", also_in: ["mcp-edits"], dependencies: ["vercel-connector"] },
    { name: "linear-connector", version: "1.0.0", path: "connectors/linear", tools: 5, primary_domain: "support-triage", also_in: ["reporting", "mcp-edits"], dependencies: [] },
    { name: "base44-connector", version: "1.0.0", path: "connectors/base44", tools: 7, primary_domain: "customer-enrollment", also_in: ["billing-flow", "credit-disputes", "support-triage", "reporting", "agent-payments", "comms"], dependencies: [] },
    { name: "ghl-connector", version: "1.0.0", path: "connectors/ghl", tools: 5, primary_domain: "customer-comms", also_in: ["lead-flow", "customer-enrollment"], dependencies: ["base44-connector"] },
    { name: "hyperswitch-connector", version: "1.0.0", path: "connectors/hyperswitch", tools: 4, primary_domain: "billing-flow", also_in: ["agent-payments"], dependencies: ["nmi-connector"] },
    { name: "forth-connector", version: "1.0.0", path: "connectors/forth", tools: 5, primary_domain: "credit-disputes", also_in: ["customer-enrollment"], dependencies: ["base44-connector"] },
    { name: "vapi-connector", version: "1.0.0", path: "connectors/vapi", tools: 5, primary_domain: "support-triage", also_in: ["customer-comms"], dependencies: [] },
    { name: "vercel-connector", version: "1.0.0", path: "connectors/vercel", tools: 6, primary_domain: "coding", also_in: ["mcp-edits"], dependencies: ["github-connector"] },
    { name: "mcp-hub-connector", version: "1.0.0", path: "connectors/mcp-hub", tools: 4, primary_domain: "mcp-edits", also_in: ["coding"], dependencies: [] },
    { name: "wiki-connector", version: "1.0.0", path: "connectors/wiki", tools: 4, primary_domain: "reporting", also_in: ["mcp-edits"], dependencies: [] },
    { name: "affy-connector", version: "1.0.0", path: "connectors/affy", tools: 3, primary_domain: "customer-comms", also_in: ["lead-flow"], dependencies: [] },
  ],
  functions: [
    { name: "calculate-refund-eligibility", version: "1.0.0", path: "functions/calculate-refund-eligibility", primary_domain: "billing-flow", also_in: ["agent-payments"], dependencies: ["nmi-connector"] },
    { name: "billing-event-logger", version: "1.0.0", path: "functions/billing-event-logger", primary_domain: "billing-flow", also_in: ["reporting", "compliance-audit"], dependencies: ["base44-connector"] },
    { name: "cof-health-audit", version: "1.0.0", path: "functions/cof-health-audit", primary_domain: "billing-flow", also_in: ["compliance-audit", "reporting"], dependencies: ["nmi-connector", "base44-connector"] },
    { name: "validate-action", version: "1.0.0", path: "functions/validate-action", primary_domain: "compliance-audit", also_in: ["billing-flow", "credit-disputes", "customer-enrollment"], dependencies: [] },
    { name: "resolve-customer-identity", version: "1.0.0", path: "functions/resolve-customer-identity", primary_domain: "customer-enrollment", also_in: ["support-triage", "billing-flow"], dependencies: ["base44-connector"] },
    { name: "generate-ai-email", version: "1.0.0", path: "functions/generate-ai-email", primary_domain: "customer-comms", also_in: ["support-triage", "billing-flow", "credit-disputes"], dependencies: [] },
    { name: "parse-fcra-credit-report", version: "1.0.0", path: "functions/parse-fcra-credit-report", primary_domain: "credit-disputes", also_in: [], dependencies: ["forth-connector"] },
    { name: "extract-customer-pii", version: "1.0.0", path: "functions/extract-customer-pii", primary_domain: "compliance-audit", also_in: [], dependencies: [] },
    { name: "build-customer-vde", version: "1.0.0", path: "functions/build-customer-vde", primary_domain: "customer-enrollment", also_in: [], dependencies: ["base44-connector"] },
    { name: "execute-with-post-verify", version: "1.0.0", path: "functions/execute-with-post-verify", primary_domain: "compliance-audit", also_in: [], dependencies: ["validate-action"] },
  ],
  capabilities: [
    { name: "code-review", version: "1.0.0", path: "capabilities/code-review", primary_domain: "coding", also_in: [], dependencies: [] },
    { name: "response-formatting", version: "1.0.0", path: "capabilities/response-formatting", primary_domain: "support-triage", also_in: [], dependencies: [] },
    { name: "research", version: "1.0.0", path: "capabilities/research", primary_domain: "reporting", also_in: [], dependencies: [] },
    { name: "playbook-refiner", version: "1.0.0", path: "capabilities/playbook-refiner", primary_domain: "agent-orchestration", also_in: [], dependencies: [] },
    { name: "artifact-response-pattern", version: "1.0.0", path: "capabilities/artifact-response-pattern", primary_domain: "coding", also_in: [], dependencies: [] },
  ],
  summary: { totalConnectors: 13, totalFunctions: 10, totalCapabilities: 5, totalSkills: 28 },
};

export async function GET() {
  const registry = loadRegistry() || INLINE_REGISTRY;

  return NextResponse.json({
    connectors: registry.connectors.map((s) => ({
      name: s.name,
      version: s.version,
      path: s.path,
      tools: s.tools,
      primary_domain: s.primary_domain,
      also_in: s.also_in ?? [],
      dependencies: s.dependencies ?? [],
      kind: "connector",
    })),
    functions: registry.functions.map((s) => ({
      name: s.name,
      version: s.version,
      path: s.path,
      primary_domain: s.primary_domain,
      also_in: s.also_in ?? [],
      dependencies: s.dependencies ?? [],
      kind: "function",
    })),
    capabilities: registry.capabilities.map((s) => ({
      name: s.name,
      version: s.version,
      path: s.path,
      primary_domain: s.primary_domain,
      also_in: s.also_in ?? [],
      dependencies: s.dependencies ?? [],
      kind: "capability",
    })),
    summary: registry.summary,
  });
}
