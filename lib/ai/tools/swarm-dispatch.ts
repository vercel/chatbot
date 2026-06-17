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

import { generateText, streamText, tool } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { SYSTEM_PRESETS, getPresetByName } from "@/lib/ai/fusion/presets";
import type { PanelEvent } from "@/lib/ai/fusion/types";

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
  /** Optional tool implementations (pass real tools to agents!) */
  toolImplementations?: Record<string, unknown>;
  /** Max tokens for this agent's response */
  maxTokens?: number;
  /** Temperature override */
  temperature?: number;
  /** Whether to use streaming (enables tool call visibility + SSE) */
  streaming?: boolean;
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
  /**
   * PRESET ENFORCEMENT (Phase 23B fix):
   * When provided, OVERRIDES agents[] and synthesizer with the preset's locked configuration.
   * Preferred over freeform agents[] when a domain matches a known preset.
   * Supported values: "Chinese Frontier" | "Speed Trio" | "Sonnet Synth" | "Deep Reasoning" |
   *   "Code Specialist" | "Research Specialist" | "Dual Frontier" | "Vision Council" |
   *   "MiniMax Ensemble" | "Long Context Master" | "Custom"
   */
  presetId?: string;
  /** Optional event emitter for SSE streaming (Phase 38.5) */
  onSwarmEvent?: (event: SwarmSseEvent) => void;
}

// ── Phase 38.5: Swarm SSE Event Types ─────────────────────────────────

export type SwarmSseEvent =
  | { type: "swarm_start"; swarmId: string; agentCount: number }
  | { type: "agent_start"; agentId: string; model: string; role: string }
  | { type: "tool_call_start"; agentId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; agentId: string; tool: string; result: unknown; durationMs: number }
  | { type: "agent_thinking"; agentId: string; preview: string }
  | { type: "agent_done"; agentId: string; success: boolean; finalText: string; tokens: number; durationMs: number; error?: string }
  | { type: "swarm_synthesis_start"; judgeModel: string }
  | { type: "swarm_synthesis_end"; synthesis: string; totalTokens: number; totalDurationMs: number }
  | { type: "swarm_error"; error: string };

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
  goal: string,
  onEvent?: (event: SwarmSseEvent) => void,
): Promise<AgentResult> {
  const agentId = `agent_${index}_${agent.role.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const startTime = Date.now();

  onEvent?.({
    type: "agent_start",
    agentId,
    model: agent.model,
    role: agent.role,
  });

  try {
    const model = getLanguageModel(agent.model);
    const systemPrompt = `[SWARM AGENT #${index + 1}: ${agent.role}]\n\n` +
      `Swarm Goal: ${goal}\n\n` +
      `Your Role: ${agent.role}\n\n` +
      `Task:\n${agent.prompt}\n\n` +
      `Return your findings as structured markdown. Be thorough and specific.`;

    // Use streaming if agent has tools or streaming enabled
    if (agent.streaming || agent.toolImplementations) {
      let fullText = "";
      const toolCallLogs: Array<{ tool: string; args: unknown; result: unknown; startTime: number }> = [];

      const streamResult = await streamText({
        model,
        system: systemPrompt,
        prompt: systemPrompt,
        maxOutputTokens: agent.maxTokens ?? 4096,
        temperature: agent.temperature ?? 0.3,
        tools: (agent.toolImplementations as Record<string, unknown>) || {},
        onStepFinish: (step) => {
          // Emit tool call events
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              const tcStart = Date.now();
              toolCallLogs.push({
                tool: tc.toolName,
                args: tc.args,
                result: null,
                startTime: tcStart,
              });

              onEvent?.({
                type: "tool_call_start",
                agentId,
                tool: tc.toolName,
                args: (tc.args as Record<string, unknown>) || {},
              });
            }
          }

          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const log = toolCallLogs.find(
                (l) => l.tool === tr.toolName && l.result === null
              );
              if (log) {
                log.result = tr.result;
                onEvent?.({
                  type: "tool_call_end",
                  agentId,
                  tool: tr.toolName,
                  result: tr.result,
                  durationMs: Date.now() - log.startTime,
                });
              }
            }
          }
        },
      });

      // Consume the stream to get full text
      for await (const chunk of streamResult.textStream) {
        fullText += chunk;
        // Emit thinking preview periodically
        if (fullText.length % 200 < (chunk?.length || 0)) {
          onEvent?.({
            type: "agent_thinking",
            agentId,
            preview: fullText.slice(-200),
          });
        }
      }

      const tokensUsed = (await streamResult.usage)?.totalTokens ?? fullText.length / 4;
      const durationMs = Date.now() - startTime;

      onEvent?.({
        type: "agent_done",
        agentId,
        success: true,
        finalText: fullText,
        tokens: Math.round(tokensUsed),
        durationMs,
      });

      return {
        role: agent.role,
        model: agent.model,
        success: true,
        text: fullText,
        durationMs,
        tokensUsed: Math.round(tokensUsed),
      };
    }

    // Non-streaming: use generateText (original behavior, no tools)
    const result = await generateText({
      model,
      prompt: systemPrompt,
      maxOutputTokens: agent.maxTokens ?? 4096,
      temperature: agent.temperature ?? 0.3,
    });

    const durationMs = Date.now() - startTime;
    const tokensUsed = result.usage?.totalTokens ?? 0;

    onEvent?.({
      type: "agent_done",
      agentId,
      success: true,
      finalText: result.text,
      tokens: tokensUsed,
      durationMs,
    });

    return {
      role: agent.role,
      model: agent.model,
      success: true,
      text: result.text,
      durationMs,
      tokensUsed,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown agent error";
    const durationMs = Date.now() - startTime;

    onEvent?.({
      type: "agent_done",
      agentId,
      success: false,
      finalText: "",
      tokens: 0,
      durationMs,
      error: errorMsg,
    });

    return {
      role: agent.role,
      model: agent.model,
      success: false,
      text: "",
      durationMs,
      tokensUsed: 0,
      error: errorMsg,
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
  // ── PRESET ENFORCEMENT (Phase 23B fix) ───────────────────────────────────
  // If presetId is provided, OVERRIDE agents[] and synthesizer with the
  // preset's locked configuration. This prevents the LLM from freely picking
  // models (e.g., Claude Sonnet) when the user selected a Chinese model preset.
  let effectiveAgents = input.agents;
  let effectiveSynthesizer = input.synthesizer;

  if (input.presetId) {
    const preset = getPresetByName(input.presetId);
    if (!preset) {
      return {
        swarmId: `swarm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        goal: input.goal,
        swarmType: input.swarmType,
        agentsDispatched: 0,
        agentsSucceeded: 0,
        agentsFailed: 0,
        agentResults: [],
        synthesis: null,
        synthesisModel: input.synthesizer.model,
        totalDurationMs: 0,
        totalTokensUsed: 0,
        success: false,
        error: `Preset "${input.presetId}" not found. Available: ${SYSTEM_PRESETS.map(p => `"${p.name}"`).join(", ")}`,
      };
    }

    // Validate: Long Context Master must use Chinese frontier models (NO Claude)
    // Preset #10: GLM 5.2 + Kimi K2.7 Code + DeepSeek V4 Pro — GLM 5.2 judges
    const FORBIDDEN_PROVIDERS: Record<string, string[]> = {
      // "Long Context Master" requires Chinese models only; Claude is forbidden
      "Long Context Master": ["anthropic"],
      // "Deep Reasoning" uses Opus 4.8 as judge but never as an agent
      "Deep Reasoning": [],
      // "Sonnet Synth" uses Claude Sonnet as judge only, never as agent
      // (agents are ALL Chinese: DeepSeek, Kimi, GLM, Qwen, MiniMax)
    };

    if (input.presetId in FORBIDDEN_PROVIDERS) {
      const forbiddenList = FORBIDDEN_PROVIDERS[input.presetId];
      for (const agent of input.agents) {
        const provider = agent.model.toLowerCase();
        for (const forbidden of forbiddenList) {
          if (provider.includes(forbidden)) {
            console.error(
              `[swarm-dispatch] REJECTED: Preset "${input.presetId}" forbids ${forbidden} models. ` +
              `Agent "${agent.role}" requested ${agent.model}. Using preset agents instead.`
            );
            break;
          }
        }
      }
      // Also check the synthesizer
      for (const forbidden of forbiddenList) {
        if (input.synthesizer.model.toLowerCase().includes(forbidden)) {
          console.warn(
            `[swarm-dispatch] OVERRIDE: Preset "${input.presetId}" synthesizer should use ` +
            `preset's judge "${preset.judge.name}" (${preset.judge.modelId}), not ${input.synthesizer.model}`
          );
        }
      }
    }

    // OVERRIDE agents[] with preset's locked agents
    effectiveAgents = preset.agents.map((agent, i) => ({
      role: agent.role ?? `agent_${i + 1}`,
      model: agent.modelId,
      prompt: input.agents[i]?.prompt ?? `Analyze the goal: ${input.goal}`,
      maxTokens: input.agents[i]?.maxTokens,
      temperature: input.agents[i]?.temperature,
    }));

    // OVERRIDE synthesizer with preset's locked judge
    effectiveSynthesizer = {
      model: preset.judge.modelId,
      prompt: input.synthesizer.prompt,
      maxTokens: input.synthesizer.maxTokens,
    };

    console.log(
      `[swarm-dispatch] 🔒 Preset "${input.presetId}" applied — ` +
      `agents: [${effectiveAgents.map(a => `${a.role} (${a.model})`).join(", ")}] · ` +
      `synthesizer: ${preset.judge.name} (${preset.judge.modelId})`
    );
  }

  const { goal, swarmType, timeoutMs = 300_000, onSwarmEvent } = input;
  const agents = effectiveAgents;
  const synthesizer = effectiveSynthesizer;
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

  // Phase 38.5: Emit swarm_start
  onSwarmEvent?.({ type: "swarm_start", swarmId, agentCount: agents.length });

  // Dispatch all agents in parallel
  const agentPromises = agents.map((agent, i) =>
    runAgent(agent, i, goal, onSwarmEvent)
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
    onSwarmEvent?.({ type: "swarm_synthesis_start", judgeModel: synthesizer.model });
    synthesis = await runSynthesizer(synthesizer, agentResults, goal);
  }

  const totalDurationMs = Date.now() - startTime;
  const totalTokensUsed = agentResults.reduce((sum, r) => sum + r.tokensUsed, 0);

  // Phase 38.5: Emit final event
  if (synthesis) {
    onSwarmEvent?.({
      type: "swarm_synthesis_end",
      synthesis,
      totalTokens: totalTokensUsed,
      totalDurationMs,
    });
  } else if (agentsFailed === agents.length) {
    onSwarmEvent?.({ type: "swarm_error", error: "All agents failed" });
  }

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
    "Use for complex multi-perspective tasks. Swarm types: research, coding, audit, catalog, analysis.\n\n" +
    "🔒 PRESET ROUTING (Phase 23B): When a panel preset is active (user selected a preset), " +
    "ALWAYS use presetId instead of freeform agents[]. The presetId LOCKS the model selection to " +
    "the preset's configured models. Available presets:\n" +
    "- \"Long Context Master\": GLM 5.2 + DeepSeek V4 Pro + Kimi K2.7 Code (NO Claude)\n" +
    "- \"Chinese Frontier\": DeepSeek V4 Pro + Kimi K2.7 Code + GLM 5.2\n" +
    "- \"Deep Reasoning\": DeepSeek R1 + V3.2 Thinking + Kimi K2 Thinking + GLM 5.2 + Qwen3 Max Thinking\n" +
    "- \"Code Specialist\": GLM 5.2 lead + Kimi K2.7 Code + Qwen3 Coder Next + DeepSeek V4 Pro\n" +
    "- \"Research Specialist\": GLM 5.2 + Gemini 2.5 Pro + Kimi K2.7 Code + DeepSeek R1\n" +
    "- \"Speed Trio\": DeepSeek V4 Flash + Kimi K2.7 Code HS + Step 3.7 Flash\n" +
    "- \"Sonnet Synth\": 5 Chinese agents + Claude Sonnet judge\n" +
    "- \"Dual Frontier\": DeepSeek V4 Pro + Kimi K2.7 Code\n" +
    "- \"Vision Council\": GLM 5V Turbo + Qwen3 VL 235B + Gemini 2.5 Pro\n" +
    "- \"MiniMax Ensemble\": MiniMax M3 + M2.7 + DeepSeek V4 Pro\n\n" +
    "RULE: When the user's domain matches a known preset, use presetId. " +
    "When BOTH presetId and agents[] are provided, presetId WINS and agents[] is overridden.",
  inputSchema: z.object({
    goal: z.string().describe("High-level goal of the swarm"),
    swarmType: z.enum(["research", "coding", "audit", "catalog", "analysis"]).describe("Type of swarm operation"),
    presetId: z.string().describe(
      "Panel preset name to enforce model selection. PREFERRED over agents[] when provided. " +
      "Use when a panel preset is active (user selected one). " +
      "Available: \"Chinese Frontier\" | \"Speed Trio\" | \"Sonnet Synth\" | \"Deep Reasoning\" | " +
      "\"Code Specialist\" | \"Research Specialist\" | \"Dual Frontier\" | \"Vision Council\" | " +
      "\"MiniMax Ensemble\" | \"Long Context Master\" | \"Custom\""
    ).optional(),
    agents: z.array(z.object({
      role: z.string().describe("Agent role name (e.g., 'connector_cataloger')"),
      model: z.string().describe("Model ID to use (OVERRIDDEN by presetId when provided)"),
      prompt: z.string().describe("Individual prompt for this agent"),
      maxTokens: z.number().optional().describe("Max tokens (default 4096)"),
    })).min(2).max(8).describe("2-8 parallel agents (overridden by presetId when provided)"),
    synthesizer: z.object({
      model: z.string().describe("Synthesizer model ID (overridden by presetId when provided)"),
      prompt: z.string().describe("Synthesis prompt"),
      maxTokens: z.number().optional().describe("Max tokens (default 8192)"),
    }).describe("Synthesizer configuration"),
  }),
  execute: async (input) => {
    return swarmDispatch({
      goal: input.goal,
      swarmType: input.swarmType,
      presetId: input.presetId,
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
