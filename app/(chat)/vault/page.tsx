/**
 * Vault Page — Secret key status dashboard.
 * Lists keys by NAME ONLY (never values). Status checked via API.
 */
import { auth } from "@/app/(auth)/auth";

const VAULT_KEYS = [
  {
    name: "SLACK_BOT_TOKEN",
    category: "Communication",
    description: "Slack bot integration",
  },
  {
    name: "NMI_SECURITY_KEY",
    category: "Payments",
    description: "NMI payment gateway",
  },
  {
    name: "BASE44_API_KEY",
    category: "Data",
    description: "Base44 entity system",
  },
  {
    name: "OPENAI_API_KEY",
    category: "AI Models",
    description: "OpenAI models via AI Gateway",
  },
  {
    name: "ANTHROPIC_API_KEY",
    category: "AI Models",
    description: "Anthropic Claude models",
  },
  {
    name: "GOOGLE_API_KEY",
    category: "AI Models",
    description: "Google Gemini models",
  },
  {
    name: "GROQ_API_KEY",
    category: "AI Models",
    description: "Groq fast inference",
  },
  {
    name: "XAI_API_KEY",
    category: "AI Models",
    description: "xAI Grok models",
  },
  {
    name: "DEEPSEEK_API_KEY",
    category: "AI Models",
    description: "DeepSeek V4 Pro (direct)",
  },
  {
    name: "POSTGRES_URL",
    category: "Database",
    description: "Neon Postgres connection",
  },
  {
    name: "REDIS_URL",
    category: "Database",
    description: "Upstash Redis connection",
  },
  {
    name: "BLOB_READ_WRITE_TOKEN",
    category: "Storage",
    description: "Vercel Blob storage",
  },
  {
    name: "AUTH_SECRET",
    category: "Security",
    description: "Better Auth signing secret",
  },
  {
    name: "AI_GATEWAY_API_KEY",
    category: "AI Models",
    description: "Vercel AI Gateway routing",
  },
  {
    name: "NEPTUNE_INTERNAL_TOKEN",
    category: "Infrastructure",
    description: "VPS bridge auth token",
  },
  {
    name: "VERCEL_TOKEN",
    category: "Infrastructure",
    description: "Vercel API deploy token",
  },
  {
    name: "LINEAR_API_KEY",
    category: "Productivity",
    description: "Linear project management",
  },
  {
    name: "MCP_SERVER_URL",
    category: "Infrastructure",
    description: "MCP server endpoint",
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  "AI Models": "🤖",
  Communication: "💬",
  Payments: "💳",
  Data: "🗄️",
  Database: "🛢️",
  Storage: "📦",
  Security: "🔐",
  Infrastructure: "⚙️",
  Productivity: "📋",
};

function StatusBadge({ name }: { name: string }) {
  const value = process.env[name];
  if (!value || value.startsWith("PENDING")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-600">
        pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-600">
      configured
    </span>
  );
}

export default async function VaultPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">
        Sign in to access the vault.
      </div>
    );
  }

  const categories = [...new Set(VAULT_KEYS.map((k) => k.category))];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Vault</h1>
        <p className="text-sm text-muted-foreground">
          Secret keys — names only. Values are never displayed or transmitted.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span>{CATEGORY_ICONS[cat] || "📌"}</span>
                {cat}
              </h2>
              <div className="grid gap-2">
                {VAULT_KEYS.filter((k) => k.category === cat).map((key) => (
                  <div
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    key={key.name}
                  >
                    <div>
                      <div className="font-mono text-sm">{key.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {key.description}
                      </div>
                    </div>
                    <StatusBadge name={key.name} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
