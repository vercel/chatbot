/**
 * A2A v1.0 AgentCard endpoint — /.well-known/agent.json
 *
 * Serves dynamic AgentCard with skills from SKILL_REGISTRY,
 * capabilities from connector manifests, and auth schemes.
 *
 * Spec: https://a2a-protocol.org/specification/v1.0
 */
import { NextResponse } from "next/server";
import { SKILL_REGISTRY } from "@/connectors/neptune/client";

// Dynamic import to avoid client-side bundling issues
let cachedManifests: Record<string, unknown>[] | null = null;

async function getManifests(): Promise<Record<string, unknown>[]> {
  if (cachedManifests) return cachedManifests;
  try {
    const { manifests } = await import("@/lib/connectors/init");
    cachedManifests = manifests.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      capabilities: m.capabilities || [],
      envKeys: m.envKeys || [],
      status: m.status || "unknown",
    }));
    return cachedManifests || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const skills = Object.entries(SKILL_REGISTRY).map(([connector, info]) => ({
    id: connector,
    name: `${connector}-skills`,
    description: `${info.actions} actions for ${connector}`,
    tags: [connector, "neptune", "connector"],
    actionCount: info.actions,
  }));

  const manifests = await getManifests();

  // Build capabilities list from manifests
  const capabilities = manifests.flatMap(
    (m) => (m.capabilities as string[]) || []
  );

  const agentCard = {
    // ── A2A v1.0 Required Fields ──
    protocolVersion: "1.0",
    name: "Neptune Chat",
    description:
      "Neptune is an AI-powered operations agent for NewLeaf Financial. It manages connectors, workflows, knowledge graphs, and agent orchestration across billing, CRM, payments, communications, and credit repair domains.",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://neptune-chat-ashy.vercel.app",
    provider: {
      name: "NewLeaf Financial",
      url: "https://newleaffinancial.com",
    },
    version: "3.1.0",

    // ── Capabilities ──
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },

    // ── Authentication ──
    authentication: {
      schemes: [
        {
          type: "bearer",
          description: "API key authentication for Neptune endpoints",
        },
        {
          type: "oauth2",
          description: "OAuth2 via Better Auth for chat interface",
        },
      ],
    },

    // ── Skills ──
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      tags: s.tags,
      inputModes: ["text", "text/plain"],
      outputModes: ["text", "text/plain", "application/json"],
    })),

    // ── Default Input/Output ──
    defaultInputModes: ["text", "text/plain"],
    defaultOutputModes: ["text", "text/plain", "application/json"],

    // ── Connectors ──
    connectors: manifests.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      status: m.status,
    })),

    // ── Neptune-Specific Extensions ──
    extensions: {
      neptune: {
        totalSkills: skills.length,
        totalActions: skills.reduce((sum, s) => sum + s.actionCount, 0),
        totalConnectors: manifests.length,
        capabilities: [...new Set(capabilities)],
        skillRegistryVersion: "2.0",
        workflowAgent: "@ai-sdk/workflow 1.0.0-beta.101",
      },
    },

    // ── Endpoints ──
    endpoints: {
      chat: "/api/chat",
      diagnostics: "/api/diagnostics",
      workflows: "/api/workflows",
      smokeTest: "/api/workflows/smoke-test",
      knowledge: "/api/knowledge",
      health: "/api/health",
      agentCard: "/.well-known/agent.json",
    },
  };

  return NextResponse.json(agentCard, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
