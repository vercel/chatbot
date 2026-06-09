"use client";
import { SearchIcon } from "lucide-react";
/**
 * ConnectorsClient — renders connector grid with search and detail sheet.
 */
import { useState } from "react";
import { ConnectorCard } from "@/components/connectors/ConnectorCard";
import { ConnectorDetailSheet } from "@/components/connectors/ConnectorDetailSheet";
import { initConnectors } from "@/lib/connectors/init";
import type { ConnectorManifest } from "@/lib/connectors/types";

interface ConnectorInfo {
  id: string;
  name: string;
  description: string;
  iconName: string;
  brandColor: string;
  capabilities: number;
  envKeys: string[];
  status: { connected: boolean; message?: string };
}

interface Props {
  connectors: ConnectorInfo[];
  counts: { total: number; connected: number; notConfigured: number };
}

export function ConnectorsClient({ connectors, counts }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Init on client side too for tool lookups
  initConnectors();

  const filtered = connectors.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const selected = connectors.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Connectors</h1>
        <p className="text-sm text-muted-foreground">
          {counts.connected} connected · {counts.notConfigured} not configured ·{" "}
          {counts.total} total
        </p>
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connectors..."
            type="text"
            value={search}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No connectors match &quot;{search}&quot;
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((c, i) => (
              <ConnectorCard
                index={i}
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
                  capabilities: [],
                  toolModule: () => Promise.resolve({}),
                  resultRenderers: {},
                  playbookPath: "",
                  getStatus: () => c.status,
                }}
                onClick={() => setSelectedId(c.id)}
                status={c.status}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      {selected && (
        <ConnectorDetailSheet
          manifest={{
            ...selected,
            icon: (() => <span />) as unknown as ConnectorManifest["icon"],
            capabilities: [],
            toolModule: () => Promise.resolve({}),
            resultRenderers: {},
            playbookPath: `lib/connectors/${selected.id}/playbook.mdx`,
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
