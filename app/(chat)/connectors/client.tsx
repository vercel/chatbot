"use client";
/**
 * ConnectorsClient — world-class connector management page.
 *
 * Layout: Search + Filter bar → Responsive grid → Detail sheet
 * Features: Search, status filter, animated cards, expanded detail sheet
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
}

interface Props {
  connectors: ConnectorInfo[];
  counts: { total: number; connected: number; notConfigured: number };
}

export function ConnectorsClient({ connectors, counts }: Props) {
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
              <ConnectorCard
                index={i}
                isSelected={selectedId === c.id}
                key={c.id}
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
            playbookPath: selected.playbookPath || `lib/connectors/${selected.id}/playbook.mdx`,
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
