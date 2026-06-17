// @ts-nocheck — pre-existing Phase 24 type issues, refined in Streams 3-5
"use client";
/**
 * ConnectorsClient — world-class connector management page.
 *
 * Layout: Search + Filter bar → Coverage banner → Responsive grid → Detail sheet
 * U1.3: Includes per-connector wrap progress bars + overall coverage banner.
 */
import { useState } from "react";
import { ConnectorCard } from "@/components/connectors/ConnectorCard";
import { ConnectorDetailSheet } from "@/components/connectors/ConnectorDetailSheet";
import {
  type ConnectorStatusFilter,
  ConnectorFilterBar,
} from "@/components/connectors/ConnectorFilterBar";
import { ConnectorGrid } from "@/components/connectors/ConnectorGrid";
import { initConnectors } from "@/lib/connectors/init";
import type { ConnectorManifest } from "@/lib/connectors/types";

interface ConnectorInfo {
  id: string;
  name: string;
  description: string;
  brandColor: string;
  capabilities: { id: string; label: string; description: string; icon?: string }[];
  toolCount: number;
  envKeys: string[];
  status: { connected: boolean; message?: string };
  docs?: { official: string; ourGuide?: string };
  playbookPath?: string;
  /** U1.3: Wrap progress data */
  wrapped?: number;
  total?: number;
  priority?: string;
  surface?: string;
}

interface InventorySummary {
  totalWrapped: number;
  totalAvailable: number;
  coveragePercent: number;
  byPriority: Record<string, { wrapped: number; total: number; count: number }>;
}

interface Props {
  connectors: ConnectorInfo[];
  counts: { total: number; connected: number; notConfigured: number };
  /** U1.3: Inventory coverage summary */
  inventory: InventorySummary;
}

function CoverageBanner({ inventory }: { inventory: InventorySummary }) {
  const pct = inventory.coveragePercent;
  const barColor =
    pct >= 50 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-lg border bg-card p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Function Wrap Coverage</h3>
        <span className="text-sm font-mono tabular-nums">
          {inventory.totalWrapped} / {inventory.totalAvailable}
          {" "}
          <span className="text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        {Object.entries(inventory.byPriority)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([priority, stats]) => (
            <span key={priority}>
              <span className="font-medium">{priority}</span>:{" "}
              {stats.wrapped}/{stats.total} ({stats.count} connectors)
            </span>
          ))}
      </div>
    </div>
  );
}

function WrapProgressBar({
  wrapped,
  total,
  priority,
}: {
  wrapped: number;
  total: number;
  priority?: string;
}) {
  const pct = total > 0 ? Math.round((wrapped / total) * 100) : 0;
  const barColor =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 30
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>Wrap coverage</span>
        <span className="font-mono tabular-nums">
          {wrapped}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function ConnectorsClient({ connectors, counts, inventory }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ConnectorStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Init connector registry on client side
  initConnectors();

  const filtered = connectors.filter((c) => {
    // Search filter
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (statusFilter === "connected") matchesStatus = c.status.connected;
    else if (statusFilter === "configured")
      matchesStatus = !c.status.connected && c.envKeys.length > 0;
    else if (statusFilter === "disconnected")
      matchesStatus = !c.status.connected;

    return matchesSearch && matchesStatus;
  });

  const selected = connectors.find((c) => c.id === selectedId);

  const mapStatus = (
    status: { connected: boolean; message?: string }
  ): "connected" | "configured" | "disconnected" | "available" => {
    if (status.connected) return "connected";
    if (status.message?.includes("Missing")) return "configured";
    return "disconnected";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Connectors</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {counts.connected} connected · {counts.notConfigured} not configured ·{" "}
          {counts.total} total
        </p>
        {/* U1.3: Overall coverage indicator */}
        <p className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
          Wrap coverage: {inventory.totalWrapped}/{inventory.totalAvailable} ({inventory.coveragePercent}%)
        </p>
      </div>

      {/* Filter bar */}
      <div className="px-6 pt-3 pb-2">
        <ConnectorFilterBar
          filteredCount={filtered.length}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          search={search}
          statusFilter={statusFilter}
          totalCount={connectors.length}
        />
      </div>

      {/* Coverage Banner — U1.3 */}
      <div className="px-6 pb-2">
        <CoverageBanner inventory={inventory} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <span className="text-2xl">🔌</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              No connectors found
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {search
                ? `No results for "${search}"`
                : "Try changing the filter or check back later"}
            </p>
          </div>
        ) : (
          <ConnectorGrid>
            {filtered.map((c, i) => (
              <div key={c.id} className="flex flex-col gap-1">
                <ConnectorCard
                  index={i}
                  isSelected={selectedId === c.id}
                  manifest={{
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    icon: (() => (
                      <span />
                    )) as unknown as ConnectorManifest["icon"],
                    brandColor: c.brandColor,
                    envKeys: c.envKeys,
                    capabilities: c.capabilities,
                    toolModule: () => Promise.resolve({}),
                    resultRenderers: {},
                    playbookPath: c.playbookPath || "",
                    getStatus: () => c.status,
                  }}
                  onClick={() =>
                    setSelectedId(selectedId === c.id ? null : c.id)
                  }
                  status={mapStatus(c.status)}
                  statusMessage={c.status.message}
                  toolCount={c.toolCount}
                />
                {/* U2.3: Comprehensive action count badge */}
                {(c as any).u23Actions > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 -mt-1">
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {(c as any).u23Actions} actions
                    </span>
                    <span className="text-[10px] text-muted-foreground">via execute_skill</span>
                  </div>
                )}
                {/* U1.3: Per-connector wrap progress bar */}
                {c.wrapped !== undefined && c.total !== undefined && (
                  <WrapProgressBar
                    wrapped={c.wrapped}
                    total={c.total}
                    priority={c.priority}
                  />
                )}
              </div>
            ))}
          </ConnectorGrid>
        )}
      </div>

      {/* Detail Sheet */}
      {selected && (
        <ConnectorDetailSheet
          manifest={{
            ...selected,
            icon: (() => <span />) as unknown as ConnectorManifest["icon"],
            capabilities: selected.capabilities,
            toolModule: () => Promise.resolve({}),
            resultRenderers: {},
            playbookPath: selected.playbookPath || `connectors/${selected.id}/playbook.mdx`,
            getStatus: () => selected.status,
          }}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          open={!!selectedId}
          status={selected.status}
        />
      )}
    </div>
  );
}
