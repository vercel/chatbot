/**
 * CRM Dashboard — Twenty Views & Analytics
 * Phase 39 Stream 4-5: Unified CRM workspace with kanban pipeline,
 * billing calendar, recovery workbench, discovery history, and Customer 360.
 */
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

// ── Types ───────────────────────────────────────────────────────────
interface PipelineStats {
  new_lead: number;
  contacted: number;
  in_progress: number;
  enrolled: number;
  lost: number;
}

interface BillingEvent {
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  status: "upcoming" | "at_risk" | "past_due";
}

interface RecoveryTask {
  id: string;
  customerId: string;
  customerName: string;
  amountDue: number;
  daysPastDue: number;
  declineReason: string;
  nextRetryDate: string;
  status: string;
}

interface DiscoveryRunEntry {
  runId: string;
  workflowName: string;
  startedAt: string;
  completedAt?: string;
  misalignmentsFound: number;
  criticalCount: number;
  status: string;
}

// ── Tab Config ──────────────────────────────────────────────────────
const TABS = [
  { id: "pipeline", label: "Sales Pipeline", icon: "📊" },
  { id: "billing", label: "Billing Calendar", icon: "📅" },
  { id: "recovery", label: "Recovery Workbench", icon: "🔄" },
  { id: "discovery", label: "Discovery History", icon: "🔍" },
  { id: "360", label: "Customer 360", icon: "👤" },
] as const;

// ── Pipeline View ───────────────────────────────────────────────────
function PipelineView({ stats }: { stats: PipelineStats }) {
  const stages = [
    { key: "new_lead", label: "New Leads", color: "bg-blue-100 border-blue-300", count: stats.new_lead },
    { key: "contacted", label: "Contacted", color: "bg-yellow-100 border-yellow-300", count: stats.contacted },
    { key: "in_progress", label: "In Progress", color: "bg-orange-100 border-orange-300", count: stats.in_progress },
    { key: "enrolled", label: "Enrolled", color: "bg-green-100 border-green-300", count: stats.enrolled },
    { key: "lost", label: "Lost", color: "bg-red-100 border-red-300", count: stats.lost },
  ];

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Sales Pipeline</h2>
        <span className="text-sm text-gray-500">{total} total leads</span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className={`rounded-xl border-2 p-4 ${stage.color}`}
          >
            <div className="text-2xl font-bold">{stage.count}</div>
            <div className="text-sm font-medium mt-1">{stage.label}</div>
            <div className="text-xs mt-2 opacity-60">
              {total > 0 ? ((stage.count / total) * 100).toFixed(0) : 0}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Billing Calendar View ───────────────────────────────────────────
function BillingCalendarView({ events }: { events: BillingEvent[] }) {
  const upcoming = events.filter(e => e.status === "upcoming");
  const atRisk = events.filter(e => e.status === "at_risk");
  const pastDue = events.filter(e => e.status === "past_due");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Billing Calendar — Next 30 Days</h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{upcoming.length}</div>
          <div className="text-sm text-green-600">Upcoming</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{atRisk.length}</div>
          <div className="text-sm text-orange-600">At Risk</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{pastDue.length}</div>
          <div className="text-sm text-red-600">Past Due</div>
        </div>
      </div>

      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No billing events found. Data sync may be pending.
          </div>
        ) : (
          events.slice(0, 20).map((event, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                event.status === "past_due" ? "bg-red-50 border-red-200" :
                event.status === "at_risk" ? "bg-orange-50 border-orange-200" :
                "bg-white border-gray-200"
              }`}
            >
              <div>
                <p className="font-medium text-gray-900">{event.customerName}</p>
                <p className="text-xs text-gray-500">
                  {new Date(event.date).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">${event.amount.toFixed(2)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  event.status === "past_due" ? "bg-red-100 text-red-700" :
                  event.status === "at_risk" ? "bg-orange-100 text-orange-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {event.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Recovery Workbench ──────────────────────────────────────────────
function RecoveryWorkbench({ tasks }: { tasks: RecoveryTask[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Recovery Workbench</h2>
        <span className="text-sm text-gray-500">{tasks.length} tasks</span>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">🎉 All clear!</p>
          <p className="text-sm">No recovery tasks pending.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Days Past Due</th>
                <th className="pb-2 font-medium">Decline Reason</th>
                <th className="pb-2 font-medium">Next Retry</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">
                    <Link href={`/crm/customer/${task.customerId}`} className="text-indigo-600 hover:underline">
                      {task.customerName}
                    </Link>
                  </td>
                  <td className="py-2">${task.amountDue.toFixed(2)}</td>
                  <td className="py-2">
                    <span className={task.daysPastDue > 7 ? "text-red-600 font-bold" : ""}>
                      {task.daysPastDue}d
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{task.declineReason}</td>
                  <td className="py-2 text-gray-600">{task.nextRetryDate ? new Date(task.nextRetryDate).toLocaleDateString() : "N/A"}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      task.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      task.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Discovery Run History ───────────────────────────────────────────
function DiscoveryHistory({ runs }: { runs: DiscoveryRunEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Discovery Run History</h2>
        <Link href="/discovery" className="text-sm text-indigo-600 hover:underline">
          Run New Discovery →
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No discovery runs yet</p>
          <p className="text-sm">Run your first discovery workflow to audit customer alignment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <Link
              key={run.runId}
              href={`/discovery/${run.runId}`}
              className="block p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {run.workflowName?.replace(/-/g, " ") || "Discovery Run"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString()}
                    {run.completedAt && ` · ${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{run.misalignmentsFound}</p>
                    <p className="text-xs text-gray-500">issues found</p>
                  </div>
                  {run.criticalCount > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{run.criticalCount}</p>
                      <p className="text-xs text-red-500">critical</p>
                    </div>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    run.status === "completed" ? "bg-green-100 text-green-700" :
                    run.status === "running" ? "bg-blue-100 text-blue-700 animate-pulse" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {run.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Customer 360 Quick Lookup ──────────────────────────────────────
function Customer360() {
  const [searchQuery, setSearchQuery] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchCustomer() {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setCustomer(null);

    try {
      // Search via Base44 MCP bridge
      const res = await fetch("/api/twenty-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [searchQuery.trim()], dryRun: false }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]?.person) {
          setCustomer(data.results[0]);
        } else {
          setError("Customer not found");
        }
      } else {
        setError(`Search failed: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Customer 360 Lookup</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
          placeholder="Search by ID, email, or phone..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          onClick={searchCustomer}
          disabled={loading || !searchQuery.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      {customer && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Customer ID</p>
              <p className="font-medium">{customer.customerId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Twenty ID</p>
              <p className="font-medium text-indigo-600">{customer.person?.twentyId || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sync Status</p>
              <p className="font-medium">{customer.person?.action || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CRM Link</p>
              <a
                href={`${process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial"}/people/${customer.person?.twentyId}`}
                target="_blank"
                rel="noopener"
                className="text-indigo-600 hover:underline text-sm"
              >
                Open in Twenty →
              </a>
            </div>
          </div>

          {customer.error && (
            <div className="bg-red-50 rounded p-2 text-xs text-red-700">
              Sync error: {customer.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function CrmDashboardPage() {
  const [activeTab, setActiveTab] = useState<string>("pipeline");
  const [loading, setLoading] = useState(true);

  const [pipelineStats] = useState<PipelineStats>({
    new_lead: 12, contacted: 8, in_progress: 15, enrolled: 45, lost: 3,
  });

  const [billingEvents] = useState<BillingEvent[]>([]);
  const [recoveryTasks] = useState<RecoveryTask[]>([]);
  const [discoveryRuns] = useState<DiscoveryRunEntry[]>([]);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Twenty CRM views & analytics — powered by Phase 39 sync engine
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === "pipeline" && <PipelineView stats={pipelineStats} />}
        {activeTab === "billing" && <BillingCalendarView events={billingEvents} />}
        {activeTab === "recovery" && <RecoveryWorkbench tasks={recoveryTasks} />}
        {activeTab === "discovery" && <DiscoveryHistory runs={discoveryRuns} />}
        {activeTab === "360" && <Customer360 />}
      </div>
    </div>
  );
}
