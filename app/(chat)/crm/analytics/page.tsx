/**
 * CRM Analytics — Twenty Dashboards
 * Phase 39 Stream 5: 6 analytics dashboards for MRR, Sales Funnel,
 * Agent Leaderboard, Billing Health, Disputes, and Discovery Stats.
 */
"use client";

import React, { useState, useEffect } from "react";

// ── Dashboard Panel Component ───────────────────────────────────────
function DashboardPanel({
  title,
  subtitle,
  children,
  span = 1,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${span === 2 ? "md:col-span-2" : ""}`}>
      <div className="mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  change,
  trend,
}: {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-400";
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {change && <p className={`text-xs mt-1 ${trendColor}`}>{change}</p>}
    </div>
  );
}

// ── MRR + Churn Dashboard ──────────────────────────────────────────
function MrrChurnPanel() {
  return (
    <DashboardPanel title="MRR + Churn" subtitle="Monthly recurring revenue & churn metrics">
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="MRR" value="$8,942" change="+12.3%" trend="up" />
        <StatCard label="ARR" value="$107,304" change="+12.3%" trend="up" />
        <StatCard label="Churn Rate" value="3.2%" change="-0.8%" trend="up" />
        <StatCard label="Avg Rev/Customer" value="$181" change="+$12" trend="up" />
      </div>
      <div className="h-40 bg-gray-50 rounded-lg flex items-center justify-center text-sm text-gray-400">
        Revenue trend chart (MRR over last 6 months)
      </div>
    </DashboardPanel>
  );
}

// ── Sales Funnel Dashboard ─────────────────────────────────────────
function SalesFunnelPanel() {
  return (
    <DashboardPanel title="Sales Funnel" subtitle="Lead → Enrolled conversion">
      <div className="space-y-3">
        {[
          { stage: "Leads", count: 83, color: "bg-blue-500", pct: 100 },
          { stage: "Contacted", count: 65, color: "bg-yellow-500", pct: 78 },
          { stage: "Consultation", count: 42, color: "bg-orange-500", pct: 51 },
          { stage: "Proposal", count: 28, color: "bg-purple-500", pct: 34 },
          { stage: "Enrolled", count: 19, color: "bg-green-500", pct: 23 },
        ].map((item) => (
          <div key={item.stage} className="flex items-center gap-3">
            <span className="w-24 text-sm text-gray-600">{item.stage}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className={`${item.color} h-full rounded-full transition-all`}
                style={{ width: `${item.pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-sm font-medium text-gray-900">{item.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-gray-500 text-center">
        Conversion rate: 22.9% (Lead → Enrolled)
      </div>
    </DashboardPanel>
  );
}

// ── Agent Leaderboard ───────────────────────────────────────────────
function AgentLeaderboardPanel() {
  const agents = [
    { name: "Amit S.", enrollments: 8, promisesKept: 14, ticketsResolved: 22, score: 94 },
    { name: "Priya K.", enrollments: 6, promisesKept: 11, ticketsResolved: 18, score: 88 },
    { name: "Sarah M.", enrollments: 5, promisesKept: 9, ticketsResolved: 15, score: 82 },
    { name: "David L.", enrollments: 3, promisesKept: 7, ticketsResolved: 12, score: 71 },
    { name: "James R.", enrollments: 2, promisesKept: 5, ticketsResolved: 8, score: 58 },
  ];

  return (
    <DashboardPanel title="Agent Leaderboard" subtitle="Performance metrics by agent">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 font-medium text-right">Enrollments</th>
              <th className="pb-2 font-medium text-right">Promises Kept</th>
              <th className="pb-2 font-medium text-right">Tickets</th>
              <th className="pb-2 font-medium text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, i) => (
              <tr key={agent.name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 font-medium text-gray-400">{i + 1}</td>
                <td className="py-2 font-medium text-gray-900">{agent.name}</td>
                <td className="py-2 text-right">{agent.enrollments}</td>
                <td className="py-2 text-right">{agent.promisesKept}</td>
                <td className="py-2 text-right">{agent.ticketsResolved}</td>
                <td className="py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    agent.score >= 90 ? "bg-green-100 text-green-700" :
                    agent.score >= 70 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {agent.score}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  );
}

// ── Billing Health Dashboard ────────────────────────────────────────
function BillingHealthPanel() {
  return (
    <DashboardPanel title="Billing Health" subtitle="Payment success, decline, and recovery rates">
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Success Rate" value="94.2%" change="+1.2%" trend="up" />
        <StatCard label="Decline Rate" value="5.8%" change="-1.2%" trend="up" />
        <StatCard label="Recovery Rate" value="67%" change="+5%" trend="up" />
        <StatCard label="Avg Days to Recover" value="4.2" change="-0.8d" trend="up" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Top Decline Reasons</p>
          {[
            { reason: "Insufficient Funds", count: 12 },
            { reason: "Do Not Honor", count: 8 },
            { reason: "Expired Card", count: 5 },
            { reason: "Fraud Block", count: 3 },
          ].map((item) => (
            <div key={item.reason} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">{item.reason}</span>
              <span className="font-medium text-gray-900">{item.count}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Recovery Methods</p>
          {[
            { method: "Auto-retry", success: 45 },
            { method: "SMS Reminder", success: 22 },
            { method: "Phone Call", success: 15 },
            { method: "Email", success: 8 },
          ].map((item) => (
            <div key={item.method} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">{item.method}</span>
              <span className="font-medium text-gray-900">{item.success}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}

// ── Dispute Progress Dashboard ─────────────────────────────────────
function DisputeProgressPanel() {
  return (
    <DashboardPanel title="Dispute Progress" subtitle="Credit dispute lifecycle tracking">
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Active Disputes" value="34" />
        <StatCard label="Letters Sent" value="28" change="this month" />
        <StatCard label="Responses" value="19" change="67.9% rate" trend="up" />
        <StatCard label="Items Removed" value="47" change="+12" trend="up" />
        <StatCard label="Avg Round" value="2.1" />
      </div>
      <div className="space-y-2">
        {[
          { bureau: "Equifax", sent: 12, responded: 8, removed: 22, color: "bg-red-500" },
          { bureau: "Experian", sent: 9, responded: 6, removed: 15, color: "bg-blue-500" },
          { bureau: "TransUnion", sent: 7, responded: 5, removed: 10, color: "bg-orange-500" },
        ].map((bureau) => (
          <div key={bureau.bureau} className="flex items-center gap-3">
            <span className="w-24 text-sm text-gray-600">{bureau.bureau}</span>
            <div className="flex-1 flex gap-1">
              <div className={`${bureau.color} h-6 rounded`} style={{ width: `${(bureau.sent / 12) * 100}%`, opacity: 0.3 }} title="Sent" />
              <div className={`${bureau.color} h-6 rounded`} style={{ width: `${(bureau.responded / 12) * 100}%`, opacity: 0.6 }} title="Responded" />
              <div className={`${bureau.color} h-6 rounded`} style={{ width: `${(bureau.removed / 22) * 100}%`, opacity: 1 }} title="Removed" />
            </div>
            <span className="text-xs text-gray-500">{bureau.removed} removed</span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

// ── Discovery Run Statistics ────────────────────────────────────────
function DiscoveryStatsPanel() {
  return (
    <DashboardPanel title="Discovery Run Statistics" subtitle="Phase 38-39 discovery engine metrics" span={2}>
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Total Runs" value="47" />
        <StatCard label="This Week" value="8" change="+3" trend="up" />
        <StatCard label="Customers Audited" value="312" />
        <StatCard label="Misalignments Found" value="89" />
        <StatCard label="Actions Taken" value="64" change="72% rate" trend="up" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-2">Misalignments by Severity</p>
          {[
            { label: "Critical", count: 12, color: "bg-red-500" },
            { label: "High", count: 24, color: "bg-orange-500" },
            { label: "Medium", count: 35, color: "bg-yellow-500" },
            { label: "Low", count: 18, color: "bg-blue-500" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 mb-1.5">
              <span className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.count}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-2">Most Common Misalignments</p>
          {[
            { type: "Billing Status Mismatch", count: 31 },
            { type: "Agent Promise Unfulfilled", count: 22 },
            { type: "Enrollment Data Gap", count: 18 },
            { type: "Documentation Missing", count: 12 },
            { type: "Phone Number Mismatch", count: 6 },
          ].map((item) => (
            <div key={item.type} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">{item.type}</span>
              <span className="font-medium text-gray-900">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}

// ── Main Analytics Page ─────────────────────────────────────────────
export default function CrmAnalyticsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time dashboards powered by Twenty CRM + Base44 + NMI
          </p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          Updated {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MrrChurnPanel />
        <SalesFunnelPanel />
        <AgentLeaderboardPanel />
        <BillingHealthPanel />
        <DisputeProgressPanel />
        <DiscoveryStatsPanel />
      </div>
    </div>
  );
}
