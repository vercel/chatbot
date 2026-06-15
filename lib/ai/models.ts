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
  /** How this model is routed: "direct" = user's own API key, "gateway" = Vercel AI Gateway */
  routeType?: "direct" | "gateway";
};

export const chatModels: ChatModel[] = [
  // ═══════════════════════════════════════════════════════════════════
  // DIRECT — user's own API keys, NO Vercel AI Gateway dependency
  // Falls back gracefully to Gateway if DEEPSEEK_API_KEY is not set.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro (Direct)",
    provider: "deepseek",
    description: "Your own DeepSeek API key — bypasses Gateway",
    routeType: "direct",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1 (Direct)",
    provider: "deepseek",
    description: "Deep reasoning model via direct key",
    routeType: "direct",
  },

  // ═══════════════════════════════════════════════════════════════════
  // GATEWAY — routed through Vercel AI Gateway (needs AI_GATEWAY_API_KEY)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
    description: "Default — latest DeepSeek flagship through Vercel AI Gateway",
    gatewayOrder: ["deepseek"],
    routeType: "gateway",
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    description: "Fast and capable with tool use",
    gatewayOrder: ["bedrock", "deepinfra"],
    routeType: "gateway",
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "deepseek",
    description: "Faster V4 variant with reasoning + vision",
    gatewayOrder: ["deepseek"],
    routeType: "gateway",
  },
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
    description: "Moonshot AI flagship model",
    gatewayOrder: ["fireworks", "bedrock"],
    routeType: "gateway",
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "openai",
    description: "Compact reasoning model",
    gatewayOrder: ["groq", "bedrock"],
    reasoningEffort: "low",
    routeType: "gateway",
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "Open-source 120B parameter model",
    gatewayOrder: ["fireworks", "bedrock"],
    reasoningEffort: "low",
    routeType: "gateway",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
    description: "Fast non-reasoning model with tool use",
    gatewayOrder: ["xai"],
    routeType: "gateway",
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Anthropic's balanced model",
    gatewayOrder: ["anthropic"],
    routeType: "gateway",
  },
  {
    id: "google/gemini-2-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Google's fast multimodal model",
    gatewayOrder: ["google"],
    routeType: "gateway",
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 20 — New Vercel AI Gateway Pro Models
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "zai/glm-5",
    name: "GLM 5",
    provider: "zai",
    description: "Zhipu AI (via Z.ai) — latest GLM flagship, 200K context, strong long-document reasoning",
    gatewayOrder: ["zai"],
    routeType: "gateway",
  },
  {
    id: "moonshotai/kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    provider: "moonshotai",
    description: "Moonshot AI — purpose-built code generation specialist, technical tasks, refactoring",
    gatewayOrder: ["moonshotai"],
    routeType: "gateway",
  },
  {
    id: "alibaba/qwen-3-235b",
    name: "Qwen 3 235B",
    provider: "alibaba",
    description: "Alibaba Cloud — 235B parameters, multilingual (100+ languages), complex reasoning",
    gatewayOrder: ["alibaba"],
    routeType: "gateway",
  },
];

// ── Capabilities ────────────────────────────────────────────────────
// Hardcoded for direct models (no gateway endpoint to query).
// Fetched from gateway API for gateway models.

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
