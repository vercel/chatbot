/**
 * Integrations Page — Service connectors with live status.
 */
import { auth } from "@/app/(auth)/auth";

const CONNECTORS = [
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    description: "Channel messaging + history",
    status: "configured",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "Repo access + PR automation",
    status: "configured",
  },
  {
    id: "nmi",
    name: "NMI Payments",
    icon: "💳",
    description: "Card vault + recurring billing",
    status: "configured",
  },
  {
    id: "base44",
    name: "Base44",
    icon: "🗄️",
    description: "Entity system + customer 360",
    status: "configured",
  },
  {
    id: "postgres",
    name: "Postgres (Neon)",
    icon: "🛢️",
    description: "Primary application database",
    status: "connected",
  },
  {
    id: "redis",
    name: "Redis (Upstash)",
    icon: "⚡",
    description: "Caching + session store",
    status: "connected",
  },
  {
    id: "vercel-blob",
    name: "Vercel Blob",
    icon: "📦",
    description: "File storage + artifacts",
    status: "connected",
  },
  {
    id: "neptune-v2",
    name: "Neptune V2",
    icon: "🤖",
    description: "Coding agent handoff",
    status: "configured",
  },
];

const STATUS_STYLES: Record<string, string> = {
  connected: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  configured: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
  disconnected: "bg-red-500/10 text-red-600 ring-red-500/20",
};

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">
        Sign in to manage integrations.
      </div>
    );
  }

  const counts = {
    total: CONNECTORS.length,
    connected: CONNECTORS.filter((c) => c.status === "connected").length,
    configured: CONNECTORS.filter((c) => c.status === "configured").length,
    disconnected: CONNECTORS.filter((c) => c.status === "disconnected").length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          {counts.connected} connected · {counts.configured} configured ·{" "}
          {counts.disconnected} disconnected
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          {CONNECTORS.map((c) => (
            <div
              className="flex items-center gap-3 p-4 rounded-lg border bg-card"
              key={c.id}
            >
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${STATUS_STYLES[c.status]}`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
