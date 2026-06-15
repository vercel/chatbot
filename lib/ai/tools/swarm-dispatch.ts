/**
 * swarm-dispatch.ts — Phase 21 V3: Parallel Agent Swarm Dispatch
 *
 * Orchestrates 2–8 AI agents running in parallel via Promise.allSettled,
 * with a synthesizer that merges all results after completion.
 *
 * Pattern from vercel-labs/open-agents: each agent gets its own generateText
 * call with independent context. The synthesizer runs AFTER all agents complete.
 *
 * Usage:
 *   swarmDispatch({
 *     goal: "Catalog all playbooks in the system",
 *     swarmType: "catalog",
 *     agents: [
 *       { role: "connector_cataloger", model: "moonshotai/kimi-k2.7-code", prompt: "..." },
 *       { role: "skill_cataloger", model: "deepseek/deepseek-v4-pro", prompt: "..." },
 *     ],
 *     synthesizer: { model: "anthropic/claude-sonnet-4-6", prompt: "..." }
 *   })
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";

// ── Types ───────────────────────────────────────────────────────────────

export type SwarmType = "research" | "coding" | "audit" | "catalog" | "analysis";

export interface SwarmAgent {
  /** Human-readable role name (e.g., "connector_cataloger") */
  role: string;
  /** Model ID to use for this agent */
  model: string;
  /** The individual prompt for this agent */
  prompt: string;
  /** Optional tool names this agent can use */
  tools?: string[];
  /** Max tokens for this agent's response */
  maxTokens?: number;
  /** Temperature override */
  temperature?: number;
}

export interface SwarmSynthesizer {
  /** Model ID for the synthesizer */
  model: string;
  /** Synthesis prompt (receives all agent results) */
  prompt: string;
  /** Max tokens for synthesis */
  maxTokens?: number;
}

export interface SwarmDispatchInput {
  /** High-level goal of the swarm */
  goal: string;
  /** Type of swarm (affects tool availability) */
  swarmType: SwarmType;
  /** 2-8 parallel agents */
  agents: SwarmAgent[];
  /** Synthesizer that merges results */
  synthesizer: SwarmSynthesizer;
  /** Optional: max time in ms for the entire swarm (default: 5min) */
  timeoutMs?: number;
}

export interface AgentResult {
  role: string;
  model: string;
  success: boolean;
  text: string;
  durationMs: number;
  tokensUsed: number;
  error?: string;
}

export interface SwarmDispatchResult {
  swarmId: string;
  goal: string;
  swarmType: SwarmType;
  agentsDispatched: number;
  agentsSucceeded: number;
  agentsFailed: number;
  agentResults: AgentResult[];
  synthesis: string | null;
  synthesisModel: string;
  totalDurationMs: number;
  totalTokensUsed: number;
  success: boolean;
  error?: string;
}

// ── Agent Execution ─────────────────────────────────────────────────────

async function runAgent(
  agent: SwarmAgent,
  index: number,
  goal: string
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    const model = getLanguageModel(agent.model);

    const result = await generateText({
      model,
      prompt: `[SWARM AGENT #${index + 1}: ${agent.role}]\n\n` +
        `Swarm Goal: ${goal}\n\n` +
        `Your Role: ${agent.role}\n\n` +
        `Task:\n${agent.prompt}\n\n` +
        `Return your findings as structured markdown. Be thorough and specific.`,
      maxOutputTokens: agent.maxTokens ?? 4096,
      temperature: agent.temperature ?? 0.3,
    });

    return {
      role: agent.role,
      model: agent.model,
      success: true,
      text: result.text,
      durationMs: Date.now() - startTime,
      tokensUsed: result.usage?.totalTokens ?? 0,
    };
  } catch (err) {
    return {
      role: agent.role,
      model: agent.model,
      success: false,
      text: "",
      durationMs: Date.now() - startTime,
      tokensUsed: 0,
      error: err instanceof Error ? err.message : "Unknown agent error",
    };
  }
}

// ── Synthesis ───────────────────────────────────────────────────────────

async function runSynthesizer(
  synth: SwarmSynthesizer,
  agentResults: AgentResult[],
  goal: string
): Promise<string | null> {
  try {
    const model = getLanguageModel(synth.model);

    // Build synthesis prompt with all agent results
    const resultsText = agentResults
      .map((r, i) =>
        `## Agent ${i + 1}: ${r.role} (${r.success ? "✅" : "❌"})\n` +
        `Model: ${r.model}\nDuration: ${r.durationMs}ms\n\n${r.text || `ERROR: ${r.error}`}`
      )
      .join("\n\n---\n\n");

    const result = await generateText({
      model,
      prompt: `${synth.prompt}\n\n---\n\n## Individual Agent Results\n\n${resultsText}\n\n---\n\nSynthesize the above into a cohesive final output.`,
      maxOutputTokens: synth.maxTokens ?? 8192,
      temperature: 0.2,
    });

    return result.text;
  } catch (err) {
    console.error("[swarm-dispatch] Synthesis failed:", err);
    return null;
  }
}

// ── Main Dispatch ───────────────────────────────────────────────────────

/**
 * Dispatch a swarm of AI agents in parallel, then synthesize results.
 *
 * Uses Promise.allSettled so one agent failure doesn't block others.
 * The synthesis step runs AFTER all agents complete.
 */
export async function swarmDispatch(
  input: SwarmDispatchInput
): Promise<SwarmDispatchResult> {
  const { goal, swarmType, agents, synthesizer, timeoutMs = 300_000 } = input;
  const swarmId = `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // Validate agent count
  if (agents.length < 2) {
    return {
      swarmId,
      goal,
      swarmType,
      agentsDispatched: 0,
      agentsSucceeded: 0,
      agentsFailed: 0,
      agentResults: [],
      synthesis: null,
      synthesisModel: synthesizer.model,
      totalDurationMs: 0,
      totalTokensUsed: 0,
      success: false,
      error: "Minimum 2 agents required for swarm dispatch",
    };
  }

  if (agents.length > 8) {
    return {
      swarmId,
      goal,
      swarmType,
      agentsDispatched: 0,
      agentsSucceeded: 0,
      agentsFailed: 0,
      agentResults: [],
      synthesis: null,
      synthesisModel: synthesizer.model,
      totalDurationMs: 0,
      totalTokensUsed: 0,
      success: false,
      error: "Maximum 8 agents allowed per swarm",
    };
  }

  // Dispatch all agents in parallel
  const agentPromises = agents.map((agent, i) =>
    runAgent(agent, i, goal)
  );

  // Timeout protection
  const timeoutPromise = new Promise<AgentResult[]>((_, reject) =>
    setTimeout(() => reject(new Error("Swarm timeout exceeded")), timeoutMs)
  );

  let agentResults: AgentResult[];
  try {
    agentResults = await Promise.race([
      Promise.all(agentPromises),
      timeoutPromise,
    ]);
  } catch (err) {
    // On timeout, collect whatever results are available
    const settled = await Promise.allSettled(agentPromises);
    agentResults = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            role: agents[i].role,
            model: agents[i].model,
            success: false,
            text: "",
            durationMs: Date.now() - startTime,
            tokensUsed: 0,
            error: r.reason?.message ?? "Agent timed out or failed",
          }
    );
  }

  const agentsSucceeded = agentResults.filter((r) => r.success).length;
  const agentsFailed = agentResults.filter((r) => !r.success).length;

  // Run synthesizer (only if at least 1 agent succeeded)
  let synthesis: string | null = null;
  if (agentsSucceeded > 0) {
    synthesis = await runSynthesizer(synthesizer, agentResults, goal);
  }

  const totalDurationMs = Date.now() - startTime;
  const totalTokensUsed = agentResults.reduce((sum, r) => sum + r.tokensUsed, 0);

  return {
    swarmId,
    goal,
    swarmType,
    agentsDispatched: agents.length,
    agentsSucceeded,
    agentsFailed,
    agentResults,
    synthesis,
    synthesisModel: synthesizer.model,
    totalDurationMs,
    totalTokensUsed,
    success: agentsSucceeded > 0 && synthesis !== null,
  };
}

// ── AI SDK Tool Wrapper ────────────────────────────────────────────────

export const swarmDispatchTool = tool({
  description:
    "Dispatch a swarm of 2-8 parallel AI agents to research, code, audit, or catalog. " +
    "Each agent runs independently with its own model and prompt. " +
    "A synthesizer merges all results after all agents complete. " +
    "Use for complex multi-perspective tasks. Swarm types: research, coding, audit, catalog, analysis.",
  inputSchema: z.object({
    goal: z.string().describe("High-level goal of the swarm"),
    swarmType: z.enum(["research", "coding", "audit", "catalog", "analysis"]).describe("Type of swarm operation"),
    agents: z.array(z.object({
      role: z.string().describe("Agent role name (e.g., 'connector_cataloger')"),
      model: z.string().describe("Model ID to use"),
      prompt: z.string().describe("Individual prompt for this agent"),
      maxTokens: z.number().optional().describe("Max tokens (default 4096)"),
    })).min(2).max(8).describe("2-8 parallel agents"),
    synthesizer: z.object({
      model: z.string().describe("Synthesizer model ID"),
      prompt: z.string().describe("Synthesis prompt"),
      maxTokens: z.number().optional().describe("Max tokens (default 8192)"),
    }).describe("Synthesizer configuration"),
  }),
  execute: async (input) => {
    return swarmDispatch({
      goal: input.goal,
      swarmType: input.swarmType,
      agents: input.agents.map(a => ({
        role: a.role,
        model: a.model,
        prompt: a.prompt,
        maxTokens: a.maxTokens,
      })),
      synthesizer: input.synthesizer,
    });
  },
});

export default swarmDispatch;
