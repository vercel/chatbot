export const DEFAULT_CHAT_MODEL = "deepseek/deepseek-v4-pro";

export const titleModel = {
  id: "moonshotai/kimi-k2.5",
  name: "Kimi K2.5",
  provider: "moonshotai",
  description: "Fast model for title generation",
  gatewayOrder: ["fireworks", "bedrock"],
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  routeType?: "direct" | "gateway";
  /** Context window in tokens (estimated) */
  contextWindow?: number;
  /** Cost per 1K input tokens (USD, approximate) */
  costPer1kInput?: number;
  /** Cost per 1K output tokens (USD, approximate) */
  costPer1kOutput?: number;
};

/**
 * Phase 23B: Full Chinese Model Catalog (50+ models from 282 Gateway models)
 *
 * Grouped by provider with cost and context window metadata.
 * Primary model IDs use vercel-ai-gateway format: provider/model-name
 */
export const chatModels: ChatModel[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // DIRECT — user's own API keys
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro (Direct)",
    provider: "deepseek",
    description: "Your own DeepSeek API key — bypasses Gateway",
    routeType: "direct",
    contextWindow: 128000,
    costPer1kInput: 0.00055,
    costPer1kOutput: 0.00219,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1 (Direct)",
    provider: "deepseek",
    description: "Deep reasoning model via direct key",
    routeType: "direct",
    contextWindow: 128000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.004,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DEEPSEEK — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
    description: "Latest DeepSeek flagship — best general-purpose Chinese model",
    gatewayOrder: ["deepseek"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.00055,
    costPer1kOutput: 0.00219,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "deepseek",
    description: "Fast V4 variant — speed over depth, good for quick tasks",
    gatewayOrder: ["deepseek"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    description: "Reasoning leader — chain-of-thought, math, logic",
    gatewayOrder: ["deepseek"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.004,
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    description: "Fast and capable with tool use",
    gatewayOrder: ["bedrock", "deepinfra"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.002,
  },
  {
    id: "deepseek/deepseek-v3.2-thinking",
    name: "DeepSeek V3.2 Thinking",
    provider: "deepseek",
    description: "V3.2 with chain-of-thought reasoning",
    gatewayOrder: ["deepseek"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.004,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MOONSHOT / KIMI — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "moonshotai/kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    provider: "moonshotai",
    description: "Purpose-built code generation specialist — technical tasks, refactoring",
    gatewayOrder: ["moonshotai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.00035,
    costPer1kOutput: 0.00105,
  },
  {
    id: "moonshotai/kimi-k2.7-code-highspeed",
    name: "Kimi K2.7 Code Highspeed",
    provider: "moonshotai",
    description: "Faster coding variant — lower latency for quick edits",
    gatewayOrder: ["moonshotai"],
    routeType: "gateway",
    contextWindow: 64000,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0006,
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "moonshotai",
    description: "Kimi with chain-of-thought — deep reasoning tasks",
    gatewayOrder: ["moonshotai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0007,
    costPer1kOutput: 0.0021,
  },
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
    description: "Previous Kimi flagship — still solid for general tasks",
    gatewayOrder: ["fireworks", "bedrock"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0009,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Z.AI / GLM (Zhipu AI) — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "zai/glm-5.2",
    name: "GLM 5.2",
    provider: "zai",
    description: "⭐ 1M context window — best coder, high/max thinking levels. Lead model in Code Specialist.",
    gatewayOrder: ["zai"],
    routeType: "gateway",
    contextWindow: 1_000_000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0005,
  },
  {
    id: "zai/glm-5.1",
    name: "GLM 5.1",
    provider: "zai",
    description: "200K context, vision, long-horizon autonomous tasks (8h+), file input, MIT licensed",
    gatewayOrder: ["zai"],
    routeType: "gateway",
    contextWindow: 200000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  {
    id: "zai/glm-5",
    name: "GLM 5",
    provider: "zai",
    description: "GLM-5 flagship, 202K context, agentic engineering",
    gatewayOrder: ["zai"],
    routeType: "gateway",
    contextWindow: 202000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  {
    id: "zai/glm-4.7-flash",
    name: "GLM 4.7 Flash",
    provider: "zai",
    description: "Fast flash variant — budget-friendly speed option",
    gatewayOrder: ["zai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.00005,
    costPer1kOutput: 0.00015,
  },
  {
    id: "zai/glm-5v-turbo",
    name: "GLM 5V Turbo",
    provider: "zai",
    description: "Vision model — multimodal image understanding, charts, diagrams",
    gatewayOrder: ["zai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0008,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ALIBABA / QWEN — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "alibaba/qwen3-max",
    name: "Qwen3 Max",
    provider: "alibaba",
    description: "Alibaba's latest flagship — strong reasoning, multilingual (100+ languages)",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.002,
  },
  {
    id: "alibaba/qwen3-max-thinking",
    name: "Qwen3 Max Thinking",
    provider: "alibaba",
    description: "Qwen3 Max with chain-of-thought — deep reasoning variant",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.004,
  },
  {
    id: "alibaba/qwen3-coder-next",
    name: "Qwen3 Coder Next",
    provider: "alibaba",
    description: "Newest coding specialist from Alibaba — strong on generation + debugging",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0009,
  },
  {
    id: "alibaba/qwen3-coder-plus",
    name: "Qwen3 Coder Plus",
    provider: "alibaba",
    description: "Proven coding model — reliable for code generation and review",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0009,
  },
  {
    id: "alibaba/qwen3-vl-235b-a22b-instruct",
    name: "Qwen3 VL 235B",
    provider: "alibaba",
    description: "Vision-language model — 235B parameters, multimodal understanding",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.002,
  },
  {
    id: "alibaba/qwen-3-235b",
    name: "Qwen 3 235B",
    provider: "alibaba",
    description: "235B parameters — complex reasoning, analysis",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0009,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MINIMAX — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "minimax/minimax-m3",
    name: "MiniMax M3",
    provider: "minimax",
    description: "Latest MiniMax flagship — strong reasoning, diverse perspective",
    gatewayOrder: ["minimax"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0009,
  },
  {
    id: "minimax/minimax-m2.7",
    name: "MiniMax M2.7",
    provider: "minimax",
    description: "Proven MiniMax model — reliable generalist",
    gatewayOrder: ["minimax"],
    routeType: "gateway",
    contextWindow: 131072,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00075,
  },
  {
    id: "minimax/minimax-m2.5-highspeed",
    name: "MiniMax M2.5 Highspeed",
    provider: "minimax",
    description: "Fastest MiniMax variant — budget speed",
    gatewayOrder: ["minimax"],
    routeType: "gateway",
    contextWindow: 64000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0003,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // STEPFUN — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "stepfun/step-3.7-flash",
    name: "StepFun Step 3.7 Flash",
    provider: "stepfun",
    description: "Ultra-fast — lowest latency, ideal for speed trio preset",
    gatewayOrder: ["stepfun"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0003,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ANTHROPIC (SYNTHESIS / JUDGE ONLY) — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Balanced Western judge — code review, synthesis, polish",
    gatewayOrder: ["anthropic"],
    routeType: "gateway",
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  {
    id: "anthropic/claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    description: "💎 Premium judge — ONLY in Deep Reasoning preset. Highest quality synthesis.",
    gatewayOrder: ["anthropic"],
    routeType: "gateway",
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  {
    id: "anthropic/claude-haiku-4.0",
    name: "Claude Haiku 4.0",
    provider: "anthropic",
    description: "Cheap Western option — quick tasks, lightweight synthesis",
    gatewayOrder: ["anthropic"],
    routeType: "gateway",
    contextWindow: 200000,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GOOGLE — Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Google's premium model — web/search synthesis, vision",
    gatewayOrder: ["google"],
    routeType: "gateway",
    contextWindow: 1_000_000,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast Google model — cheap synth option",
    gatewayOrder: ["google"],
    routeType: "gateway",
    contextWindow: 1_000_000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OPENAI (FALLBACK)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description: "OpenAI latest — general fallback",
    gatewayOrder: ["openai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Cheap OpenAI — budget fallback option",
    gatewayOrder: ["openai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
  },
  {
    id: "openai/o3-mini",
    name: "O3 Mini",
    provider: "openai",
    description: "OpenAI reasoning model — STEM, math, logic",
    gatewayOrder: ["openai"],
    routeType: "gateway",
    contextWindow: 200000,
    costPer1kInput: 0.0011,
    costPer1kOutput: 0.0044,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // XAI / GROK
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
    description: "Fast non-reasoning model with tool use",
    gatewayOrder: ["xai"],
    routeType: "gateway",
    contextWindow: 128000,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.002,
  },
];

// ── Capabilities ────────────────────────────────────────────────────

const DIRECT_CAPABILITIES: Record<string, ModelCapabilities> = {
  "deepseek-v4-pro": { tools: true, vision: false, reasoning: false },
  "deepseek-reasoner": { tools: false, vision: false, reasoning: true },
};

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const directEntries = Object.entries(DIRECT_CAPABILITIES);

  const gatewayModels = chatModels.filter((m) => m.routeType !== "direct");
  if (gatewayModels.length === 0) {
    return Object.fromEntries(directEntries);
  }

  const results = await Promise.all(
    gatewayModels.map(async (model) => {
      try {
        const res = await fetch(
          `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
          { next: { revalidate: 86_400 } }
        );
        if (!res.ok) {
          return [
            model.id,
            { tools: false, vision: false, reasoning: false },
          ] as const;
        }

        const json = await res.json();
        const endpoints = json.data?.endpoints ?? [];
        const params = new Set(
          endpoints.flatMap(
            (e: { supported_parameters?: string[] }) =>
              e.supported_parameters ?? []
          )
        );
        const inputModalities = new Set(
          json.data?.architecture?.input_modalities ?? []
        );

        return [
          model.id,
          {
            tools: params.has("tools"),
            vision: inputModalities.has("image"),
            reasoning: params.has("reasoning"),
          },
        ] as const;
      } catch {
        return [
          model.id,
          { tools: false, vision: false, reasoning: false },
        ] as const;
      }
    })
  );

  const gatewayEntries = results.map(([id, caps]) => [id, caps] as const);
  return Object.fromEntries([...directEntries, ...gatewayEntries]);
}

// ── Gateway Discovery ────────────────────────────────────────────────

export const isDemo = process.env.IS_DEMO === "1";

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return (json.data ?? [])
      .filter((m: GatewayModel) => m.type === "language")
      .map((m: GatewayModel) => ({
        id: m.id,
        name: m.name,
        provider: m.id.split("/")[0],
        description: "",
        routeType: "gateway" as const,
        capabilities: {
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
          reasoning: m.tags?.includes("reasoning") ?? false,
        },
      }));
  } catch {
    return [];
  }
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
