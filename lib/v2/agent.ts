/**
 * lib/v2/agent.ts — V2 Agent Definition (Eve Pattern)
 *
 * Eve-compatible agent definition for Neptune V2.
 * Follows defineAgent({ model, tools, skills, system }) pattern.
 *
 * Non-breaking: sits alongside existing V2 bridge/handoff.
 * Can be used by ToolLoopAgent or Eve runtime.
 *
 * Pattern: defineAgent from Eve
 * Phase 38: Autonomous Coding Platform
 */

import type { McpClientConnection } from "@/connections/github";
import { githubConnection } from "@/connections/github";

// ─── V2 Agent Definition ──────────────────────────────────────────────────────

export interface V2AgentDefinition {
  name: string;
  description: string;
  model: string;
  tools: string[];
  skills: string[];
  connections: McpClientConnection[];
  instructions: string[];
  sandbox: {
    backend: "vercel" | "e2b" | "local";
    timeoutMs: number;
  };
}

/**
 * Neptune V2 Agent — coding specialist.
 * Handles complex multi-step coding tasks via E2B sandboxes.
 */
export const v2Agent: V2AgentDefinition = {
  name: "neptune-v2",
  description:
    "Autonomous coding agent — handles PRD execution, code generation, testing, deploy",
  model: "deepseek/deepseek-v4-pro",
  tools: [
    "create_file",
    "edit_file",
    "delete_file",
    "run_build",
    "run_test",
    "git_commit",
    "git_push",
    "deploy_vercel",
    "query_code_graph",
  ],
  skills: [
    "autonomous-mission-execution",
    "prd-to-plan-parsing",
    "sandbox-code-execution",
    "git-ops",
    "vercel-deploy",
  ],
  connections: [
    githubConnection,
  ],
  instructions: [
    "You are Neptune V2, an autonomous coding agent.",
    "Execute PRDs as structured streams with checkpoint-based rollback.",
    "Never push to main — always use feature branches.",
    "Build must pass before deploy.",
    "Post progress to Slack #jarvis-admin at stream boundaries.",
    "Respect cardinal rules: no force.push to main, no secret exposure.",
    "Use knowledge graph (Graphiti + Graphify) for context before coding.",
  ],
  sandbox: {
    backend: process.env.E2B_API_KEY ? "e2b" : "local",
    timeoutMs: 600_000, // 10 minutes
  },
};

/**
 * V2 Agent factory — creates agent config from PRD plan.
 * Used by MissionRunner when dispatching to V2.
 */
export function createV2AgentConfig(prdName: string, streams: number): {
  agent: V2AgentDefinition;
  sessionConfig: {
    maxStreams: number;
    maxStepsPerStream: number;
    checkpointInterval: number;
    slackChannel: string;
  };
} {
  return {
    agent: {
      ...v2Agent,
      instructions: [
        ...v2Agent.instructions,
        `Current mission: ${prdName} (${streams} streams)`,
      ],
    },
    sessionConfig: {
      maxStreams: streams,
      maxStepsPerStream: 20,
      checkpointInterval: 3, // Save checkpoint every 3 steps
      slackChannel: "jarvis-admin",
    },
  };
}

export default v2Agent;
