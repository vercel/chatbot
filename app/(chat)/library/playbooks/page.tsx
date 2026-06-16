/**
 * /library/playbooks — Domain Browser
 * Phase 22: Grid of playbook domains with filter and search.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { PlaybooksClient } from "./client";

export const metadata: Metadata = {
  title: "Playbooks — Agent Library",
  description: "Browse all 15 playbook domains",
};

// Domain data (mirrors the actual file system structure)
const DOMAINS = [
  { id: "billing-flow", name: "Billing Flow", description: "Payment processing, NMI vault management, recurring billing, invoicing", domain: "billing", connectorCount: 3, skillCount: 8 },
  { id: "credit-disputes", name: "Credit Disputes", description: "Credit report disputes, bureau communications, negative item tracking", domain: "disputes", connectorCount: 2, skillCount: 6 },
  { id: "customer-enrollment", name: "Customer Enrollment", description: "Client onboarding, document collection, credit report pulls", domain: "enrollment", connectorCount: 3, skillCount: 7 },
  { id: "compliance-audit", name: "Compliance Audit", description: "FCRA/FDCPA compliance, audit trails, regulatory reporting", domain: "compliance", connectorCount: 2, skillCount: 5 },
  { id: "support-triage", name: "Support Triage", description: "Customer support workflows, ticket routing, issue classification", domain: "support", connectorCount: 3, skillCount: 9 },
  { id: "agent-payments", name: "Agent Payments", description: "Agent commission tracking, payout processing, payment reconciliation", domain: "payments", connectorCount: 2, skillCount: 4 },
  { id: "reporting", name: "Reporting", description: "Business intelligence, operational reports, KPI dashboards", domain: "reporting", connectorCount: 2, skillCount: 6 },
  { id: "customer-comms", name: "Customer Comms", description: "SMS, email, Slack notifications, drip campaigns", domain: "comms", connectorCount: 4, skillCount: 7 },
  { id: "lead-flow", name: "Lead Flow", description: "Lead intake, qualification, nurturing, conversion pipelines", domain: "leads", connectorCount: 2, skillCount: 5 },
  { id: "mcp-edits", name: "MCP Edits", description: "Code editing workflows, PR management, deployment automation", domain: "engineering", connectorCount: 3, skillCount: 8 },
  { id: "data-sync", name: "Data Sync", description: "Cross-system data synchronization, warehouse ETL, cache invalidation", domain: "data", connectorCount: 2, skillCount: 4 },
  { id: "security-monitoring", name: "Security Monitoring", description: "Threat detection, access audit, vulnerability scanning", domain: "security", connectorCount: 2, skillCount: 3 },
  { id: "ai-orchestration", name: "AI Orchestration", description: "Multi-agent coordination, model routing, prompt management", domain: "ai", connectorCount: 2, skillCount: 6 },
  { id: "knowledge-management", name: "Knowledge Management", description: "Wiki, PRDs, skills library, memory graph", domain: "knowledge", connectorCount: 1, skillCount: 5 },
  { id: "system-health", name: "System Health", description: "Monitoring, alerting, incident response, uptime tracking", domain: "ops", connectorCount: 2, skillCount: 4 },
];

export default async function PlaybooksPage() {
  cookies(); // Force dynamic rendering

  return <PlaybooksClient domains={DOMAINS} />;
}
