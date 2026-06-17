/**
 * DiscoveryCustomerTable — Sortable, filterable table of customer discovery results.
 *
 * Shows one row per customer with: name, phone, Slack mentions, action requested,
 * Base44/NMI status, billing state, alignment summary, and priority.
 */

"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface CustomerRow {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  slackMentions: number;
  slackActionRequested: string;
  base44Status: string;
  nmiStatus: string;
  billingState: string;
  alignmentSummary: string;
  flags: string[];
  recommendedAction: string;
  priority: "critical" | "high" | "medium" | "low";
}

interface DiscoveryCustomerTableProps {
  customers: CustomerRow[];
  className?: string;
  onCustomerClick?: (customer: CustomerRow) => void;
}

type SortField = keyof CustomerRow | "";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_BADGES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function DiscoveryCustomerTable({
  customers,
  className,
  onCustomerClick,
}: DiscoveryCustomerTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let rows = [...customers];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.customerId.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.slackActionRequested.toLowerCase().includes(q)
      );
    }

    // Priority filter
    if (priorityFilter !== "all") {
      rows = rows.filter((r) => r.priority === priorityFilter);
    }

    // Sort
    if (sortField) {
      rows.sort((a, b) => {
        let aVal: number | string = 0;
        let bVal: number | string = 0;

        if (sortField === "priority") {
          aVal = PRIORITY_ORDER[a.priority] ?? 9;
          bVal = PRIORITY_ORDER[b.priority] ?? 9;
        } else {
          aVal = String(a[sortField] || "");
          bVal = String(b[sortField] || "");
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [customers, search, sortField, sortDir, priorityFilter]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 inline-block ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 inline-block ml-1" />
    );
  };

  const ColumnHeader = ({
    field,
    label,
    width,
  }: {
    field: SortField;
    label: string;
    width: string;
  }) => (
    <th
      className={cn(
        "px-2 py-2 text-left text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none",
        width
      )}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} />
    </th>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {["all", "critical", "high", "medium", "low"].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p === priorityFilter ? "all" : p)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                p === "all" && priorityFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : p === priorityFilter
                    ? PRIORITY_BADGES[p] || "bg-muted"
                    : "bg-muted hover:bg-muted/80"
              )}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} of {customers.length}
        </span>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <ColumnHeader field="priority" label="#" width="w-10" />
              <ColumnHeader field="name" label="Customer" width="w-32" />
              <ColumnHeader field="phone" label="Phone" width="w-28" />
              <ColumnHeader field="slackMentions" label="Slack" width="w-14" />
              <ColumnHeader field="slackActionRequested" label="Action" width="w-28" />
              <ColumnHeader field="base44Status" label="Base44" width="w-20" />
              <ColumnHeader field="nmiStatus" label="NMI" width="w-20" />
              <ColumnHeader field="billingState" label="Billing" width="w-40" />
              <ColumnHeader field="alignmentSummary" label="Alignment" width="w-36" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.customerId}
                onClick={() => onCustomerClick?.(row)}
                className={cn(
                  "border-b border-border/50 transition-colors",
                  "hover:bg-muted/30 cursor-pointer",
                  row.priority === "critical" && "bg-red-50/30 dark:bg-red-950/10",
                  row.priority === "high" && "bg-orange-50/20 dark:bg-orange-950/5"
                )}
              >
                <td className="px-2 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                      PRIORITY_BADGES[row.priority] || "bg-muted"
                    )}
                  >
                    {row.priority === "critical" && <AlertTriangle className="h-2.5 w-2.5" />}
                    {row.priority[0].toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <div className="text-xs font-medium truncate max-w-[120px]">{row.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                    {row.customerId}
                  </div>
                </td>
                <td className="px-2 py-2 text-xs font-mono truncate max-w-[100px]">
                  {row.phone || "—"}
                </td>
                <td className="px-2 py-2 text-xs text-center">{row.slackMentions}</td>
                <td className="px-2 py-2 text-xs truncate max-w-[110px]">
                  {row.slackActionRequested || "—"}
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={row.base44Status} />
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={row.nmiStatus} />
                </td>
                <td className="px-2 py-2 text-[11px] truncate max-w-[160px]">
                  {row.billingState || "—"}
                </td>
                <td className="px-2 py-2 text-[11px] truncate max-w-[140px]">
                  {row.alignmentSummary || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No customers match your filters
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const base = "px-1.5 py-0.5 rounded text-[10px] font-medium";
  const s = status?.toLowerCase() || "unknown";

  switch (s) {
    case "active":
      return <span className={cn(base, "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300")}>Active</span>;
    case "cancelled":
      return <span className={cn(base, "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300")}>Cancelled</span>;
    case "declining":
      return <span className={cn(base, "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>Declining</span>;
    case "none":
      return <span className={cn(base, "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>None</span>;
    case "unknown":
      return <span className={cn(base, "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>Unknown</span>;
    default:
      return <span className={cn(base, "bg-muted")}>{status}</span>;
  }
}
