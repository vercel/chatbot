export const DEFAULT_CHAT_MODEL = "moonshotai/kimi-k2.5";

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
};

export const chatModels: ChatModel[] = [
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    description: "Fast and capable model with tool use",
    gatewayOrder: ["bedrock", "deepinfra"],
  },
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
    description: "Moonshot AI flagship model",
    gatewayOrder: ["fireworks", "bedrock"],
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "openai",
    description: "Compact reasoning model",
    gatewayOrder: ["groq", "bedrock"],
    reasoningEffort: "low",
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "Open-source 120B parameter model",
    gatewayOrder: ["fireworks", "bedrock"],
    reasoningEffort: "low",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
    description: "Fast non-reasoning model with tool use",
    gatewayOrder: ["xai"],
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const results = await Promise.all(
    chatModels.map(async (model) => {
      try {
        const res = await fetch(
          `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
          { next: { revalidate: 86_400 } }
        );
        if (!res.ok) {
          return [model.id, { tools: false, vision: false, reasoning: false }];
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
        ];
      } catch {
        return [model.id, { tools: false, vision: false, reasoning: false }];
      }
    })
  );

  return Object.fromEntries(results);
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

export type ModelHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type ModelProviderHealth = {
  provider: string;
  status: ModelHealthStatus;
  uptimeLast15m?: number;
  uptimeLast1h?: number;
  latencyP50Ms?: number;
  latencyP95Ms?: number;
};

export type ModelHealth = {
  status: ModelHealthStatus;
  summary: string;
  checkedAt: string;
  providers: ModelProviderHealth[];
};

type GatewayEndpoint = {
  provider_name?: string;
  status?: number;
  uptime_last_15m?: number;
  uptime_last_1h?: number;
  latency_last_1h?: {
    p50?: number;
    p95?: number;
  };
};

const PROVIDER_DOWN_UPTIME_THRESHOLD = 1;
const PROVIDER_DEGRADED_UPTIME_THRESHOLD = 99;
const PROVIDER_DEGRADED_P50_MS = 10_000;
const PROVIDER_DEGRADED_P95_MS = 30_000;

function getRelevantProviders(model: ChatModel) {
  return model.gatewayOrder;
}

function getProviderHealth(endpoint: GatewayEndpoint): ModelProviderHealth {
  const uptimeLast15m = endpoint.uptime_last_15m;
  const uptimeLast1h = endpoint.uptime_last_1h;
  const latencyP50Ms = endpoint.latency_last_1h?.p50;
  const latencyP95Ms = endpoint.latency_last_1h?.p95;

  let status: ModelHealthStatus = "healthy";

  if (
    (endpoint.status !== undefined && endpoint.status !== 0) ||
    (uptimeLast15m !== undefined &&
      uptimeLast15m < PROVIDER_DOWN_UPTIME_THRESHOLD) ||
    (uptimeLast1h !== undefined &&
      uptimeLast1h < PROVIDER_DOWN_UPTIME_THRESHOLD)
  ) {
    status = "down";
  } else if (
    (uptimeLast15m !== undefined &&
      uptimeLast15m < PROVIDER_DEGRADED_UPTIME_THRESHOLD) ||
    (uptimeLast1h !== undefined &&
      uptimeLast1h < PROVIDER_DEGRADED_UPTIME_THRESHOLD) ||
    (latencyP50Ms !== undefined && latencyP50Ms > PROVIDER_DEGRADED_P50_MS) ||
    (latencyP95Ms !== undefined && latencyP95Ms > PROVIDER_DEGRADED_P95_MS)
  ) {
    status = "degraded";
  }

  return {
    provider: endpoint.provider_name ?? "unknown",
    status,
    uptimeLast15m,
    uptimeLast1h,
    latencyP50Ms,
    latencyP95Ms,
  };
}

function summarizeModelHealth(
  model: ChatModel,
  endpoints: GatewayEndpoint[]
): ModelHealth {
  const relevantProviders = getRelevantProviders(model);
  const providerSet = relevantProviders ? new Set(relevantProviders) : null;
  const providers = endpoints
    .filter((endpoint) => {
      if (!providerSet) {
        return true;
      }
      return endpoint.provider_name
        ? providerSet.has(endpoint.provider_name)
        : false;
    })
    .map(getProviderHealth);

  if (providers.length === 0) {
    return {
      status: "unknown",
      summary: "Health unavailable",
      checkedAt: new Date().toISOString(),
      providers,
    };
  }

  const hasHealthy = providers.some(
    (provider) => provider.status === "healthy"
  );
  const hasDegraded = providers.some(
    (provider) => provider.status === "degraded"
  );
  const hasDown = providers.some((provider) => provider.status === "down");

  let status: ModelHealthStatus = "healthy";
  if (!(hasHealthy || hasDegraded)) {
    status = "down";
  } else if (hasDegraded || hasDown) {
    status = "degraded";
  }

  const scope = relevantProviders ? "configured providers" : "providers";
  const summary =
    status === "healthy"
      ? "Operational"
      : status === "degraded"
        ? `Likely impacted: one or more ${scope} are slow or unavailable`
        : status === "down"
          ? `Likely down: no ${scope} are currently healthy`
          : "Health unavailable";

  return {
    status,
    summary,
    checkedAt: new Date().toISOString(),
    providers,
  };
}

function unknownModelHealth(): ModelHealth {
  return {
    status: "unknown",
    summary: "Health unavailable",
    checkedAt: new Date().toISOString(),
    providers: [],
  };
}

export async function getModelHealth(
  modelId: string
): Promise<ModelHealth | null> {
  const model = chatModels.find((item) => item.id === modelId);

  if (!model) {
    return null;
  }

  try {
    const res = await fetch(
      `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) {
      return unknownModelHealth();
    }

    const json = await res.json();
    return summarizeModelHealth(model, json.data?.endpoints ?? []);
  } catch {
    return unknownModelHealth();
  }
}
