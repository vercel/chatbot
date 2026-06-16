/**
 * /library/connectors — Connector Browser
 * Phase 22: Grid of all 17 connectors with filter and search.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ConnectorsClient } from "./client";

export const metadata: Metadata = {
  title: "Connectors — Agent Library",
  description: "Browse all 17 connectors — API integrations and MCP bridges",
};

// Connector data from registry
const CONNECTORS = [
  { id: "nmi", name: "NMI", description: "Payment gateway — vault management, charges, refunds, subscriptions", brandColor: "#06b6d4", functionCount: 41, tags: ["payments", "billing", "vault", "subscriptions"], status: "connected" as const },
  { id: "base44", name: "Base44", description: "Core data engine — entity CRUD, customer profiles, reporting hub, knowledge graph", brandColor: "#8b5cf6", functionCount: 63, tags: ["data", "entities", "reporting", "kg"], status: "connected" as const },
  { id: "slack", name: "Slack", description: "Communication bridge — post messages, threads, reactions, channel archives", brandColor: "#10b981", functionCount: 27, tags: ["comms", "notifications", "messages"], status: "connected" as const },
  { id: "hyperswitch", name: "HyperSwitch", description: "Payment orchestration — multi-processor routing, fallback, smart retry", brandColor: "#f59e0b", functionCount: 22, tags: ["payments", "routing", "fallback"], status: "connected" as const },
  { id: "vapi", name: "Vapi", description: "Voice AI — automated calls, transcripts, sentiment analysis", brandColor: "#ec4899", functionCount: 16, tags: ["voice", "calls", "ai"], status: "connected" as const },
  { id: "github", name: "GitHub", description: "Source control — PRs, commits, code search, repo management", brandColor: "#6b7280", functionCount: 6, tags: ["code", "prs", "repos"], status: "connected" as const },
  { id: "vercel", name: "Vercel", description: "Deployment platform — deploy projects, manage domains, check builds", brandColor: "#000000", functionCount: 5, tags: ["deploy", "hosting", "builds"], status: "connected" as const },
  { id: "ghl", name: "GoHighLevel", description: "CRM and marketing automation — leads, pipelines, campaigns", brandColor: "#3b82f6", functionCount: 5, tags: ["crm", "leads", "marketing"], status: "connected" as const },
  { id: "notebooklm", name: "NotebookLM", description: "AI research — create notebooks, source docs, generate podcasts and reports", brandColor: "#ef4444", functionCount: 12, tags: ["research", "ai", "docs"], status: "connected" as const },
  { id: "forth", name: "Forth", description: "Customer engagement — surveys, feedback, NPS tracking", brandColor: "#14b8a6", functionCount: 5, tags: ["engagement", "feedback", "surveys"], status: "available" as const },
  { id: "affy", name: "Affy", description: "Affiliate management — tracking, payouts, partner portal", brandColor: "#f97316", functionCount: 4, tags: ["affiliates", "tracking", "payouts"], status: "available" as const },
  { id: "linear", name: "Linear", description: "Issue tracking — create, update, and query issues", brandColor: "#5b5bd6", functionCount: 4, tags: ["issues", "tickets", "tracking"], status: "available" as const },
  { id: "wiki", name: "Wiki", description: "Knowledge base — create, search, and manage articles", brandColor: "#0891b2", functionCount: 5, tags: ["knowledge", "docs", "search"], status: "connected" as const },
  { id: "mcp-hub", name: "MCP Hub", description: "MCP server registry — discover and connect to MCP servers", brandColor: "#a855f7", functionCount: 3, tags: ["mcp", "servers", "discovery"], status: "available" as const },
  { id: "vps", name: "VPS Functions", description: "Server management — hostingerBridge, claude-agent-api, pm2 restart", brandColor: "#6366f1", functionCount: 18, tags: ["server", "infra", "deploy"], status: "connected" as const },
  { id: "context7", name: "Context7", description: "Documentation lookup — query latest library docs for any framework", brandColor: "#0ea5e9", functionCount: 2, tags: ["docs", "libraries", "reference"], status: "available" as const },
  { id: "exa", name: "Exa", description: "Semantic web search — AI-powered search and content retrieval", brandColor: "#d946ef", functionCount: 3, tags: ["search", "web", "ai"], status: "available" as const },
];

export default async function ConnectorsPage() {
  cookies(); // Force dynamic rendering

  return <ConnectorsClient connectors={CONNECTORS} />;
}
