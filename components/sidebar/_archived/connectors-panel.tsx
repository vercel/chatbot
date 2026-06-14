"use client";

import {
  CheckCircle2Icon,
  PlugIcon,
  PlugZapIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "configured" | "disconnected";
  details: string;
}

interface ConnectorsData {
  summary: {
    total: number;
    connected: number;
    configured: number;
    disconnected: number;
  };
  connectors: Connector[];
}

// ── Icon Map ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  github: (
    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  ),
  slack: (
    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zM15.165 17.688a2.528 2.528 0 0 1-2.521-2.523 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  ),
  database: <PlugZapIcon className="size-4" />,
  redis: <PlugZapIcon className="size-4" />,
  "hard-drive": <PlugZapIcon className="size-4" />,
  server: <PlugZapIcon className="size-4" />,
  bot: <PlugZapIcon className="size-4" />,
  plug: <PlugIcon className="size-4" />,
};

// ── Component ─────────────────────────────────────────────────────────────

export function ConnectorsPanel() {
  const { state } = useSidebar();
  const [data, setData] = useState<ConnectorsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/connectors");
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>
          <PlugIcon className="size-4" />
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            {data?.summary.connected ?? 0} connected
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const statusIcon = (status: string) => {
    if (status === "connected") {
      return <CheckCircle2Icon className="size-3 text-emerald-500" />;
    }
    if (status === "configured") {
      return <CheckCircle2Icon className="size-3 text-amber-500" />;
    }
    return <XCircleIcon className="size-3 text-muted-foreground" />;
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <PlugIcon className="size-4" />
        Connectors
        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.summary.connected}/{data.summary.total}
          </span>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {loading ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            Loading...
          </div>
        ) : data ? (
          <SidebarMenu>
            {data.connectors.map((connector) => (
              <SidebarMenuItem key={connector.id}>
                <SidebarMenuButton
                  className={cn(
                    "flex items-center gap-2 py-1 h-auto cursor-default"
                  )}
                >
                  <span className="flex-shrink-0">
                    {ICON_MAP[connector.icon] ?? (
                      <PlugIcon className="size-4" />
                    )}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium truncate">
                      {connector.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {connector.details}
                    </span>
                  </div>
                  <span className="ml-auto flex-shrink-0">
                    {statusIcon(connector.status)}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            Unavailable
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
