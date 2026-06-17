"use client";

/**
 * Domain Filter — Filter knowledge graph by domain
 *
 * Multi-select domain filter with color-coded pills.
 */

import { getTypeColor } from "@/lib/knowledge/graph-builder";

interface DomainFilterProps {
  domains: { name: string; count: number }[];
  selectedDomains: string[];
  onToggleDomain: (domain: string) => void;
  onClearAll: () => void;
}

const DOMAIN_COLORS: Record<string, string> = {
  "billing-flow": "#14B8A6",
  "credit-disputes": "#8B5CF6",
  "customer-enrollment": "#3B82F6",
  "compliance-audit": "#F59E0B",
  "support-triage": "#06B6D4",
  "agent-payments": "#22C55E",
  reporting: "#EC4899",
  "customer-comms": "#F97316",
  "lead-flow": "#84CC16",
  "mcp-edits": "#EAB308",
};

export function DomainFilter({
  domains,
  selectedDomains,
  onToggleDomain,
  onClearAll,
}: DomainFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedDomains.length > 0 && (
        <button
          onClick={onClearAll}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
        >
          ✕ Clear
        </button>
      )}
      {domains.map((domain) => {
        const isSelected = selectedDomains.includes(domain.name);
        const color =
          DOMAIN_COLORS[domain.name] || getTypeColor("concept");
        return (
          <button
            key={domain.name}
            onClick={() => onToggleDomain(domain.name)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: isSelected ? `${color}20` : "transparent",
              border: `1px solid ${isSelected ? color : "#334155"}`,
              color: isSelected ? color : "#94A3B8",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
            />
            {domain.name}
            <span className="text-[10px] opacity-60">{domain.count}</span>
          </button>
        );
      })}
    </div>
  );
}
