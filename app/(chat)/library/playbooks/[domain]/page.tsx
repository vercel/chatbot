/**
 * /library/playbooks/[domain] — Playbook Detail
 * Phase 22: 5-tab detailed view of a single playbook domain.
 * Tabs: Overview, Dependencies, Workflows, Anti-Patterns, Logs
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DomainDetailClient } from "./client";

// Domain data
const DOMAINS: Record<string, {
  id: string;
  name: string;
  description: string;
  domain: string;
  connectors: { id: string; name: string }[];
  skills: { id: string; name: string }[];
  workflows: { name: string; description: string }[];
  antiPatterns: { name: string; description: string; severity: "critical" | "high" | "medium" }[];
}> = {
  "billing-flow": {
    id: "billing-flow",
    name: "Billing Flow",
    description: "Payment processing, NMI vault management, recurring billing, invoicing. Core P0 domain for financial operations.",
    domain: "billing",
    connectors: [
      { id: "nmi", name: "NMI" },
      { id: "hyperswitch", name: "HyperSwitch" },
      { id: "slack", name: "Slack" },
    ],
    skills: [
      { id: "charge-card", name: "Charge Card" },
      { id: "vault-create", name: "Create Vault" },
      { id: "subscription-create", name: "Create Subscription" },
      { id: "payment-recon", name: "Payment Recon" },
      { id: "refund-process", name: "Process Refund" },
      { id: "billing-report", name: "Generate Report" },
      { id: "smart-retry", name: "Smart Retry" },
      { id: "nmi-health", name: "NMI Health Check" },
    ],
    workflows: [
      { name: "Payment Reminders", description: "Automated reminder sequence for outstanding payments" },
      { name: "Billing Reconciliation", description: "Daily reconciliation between NMI and internal ledger" },
      { name: "Subscription Lifecycle", description: "Create → Charge → Renew → Cancel → Refund" },
    ],
    antiPatterns: [
      { name: "NMI Velocity Guard", description: "Never send more than 10 auth requests per second to NMI", severity: "critical" },
      { name: "Source Transaction ID Usage", description: "source_transaction_id is BANNED — always use customer_vault_id", severity: "critical" },
      { name: "CVV-less Transactions", description: "MIT transactions must NOT include CVV; CIT requires CVV+IP", severity: "high" },
    ],
  },
  "credit-disputes": {
    id: "credit-disputes",
    name: "Credit Disputes",
    description: "Credit report disputes, bureau communications, negative item tracking. Core P0 domain.",
    domain: "disputes",
    connectors: [
      { id: "base44", name: "Base44" },
      { id: "slack", name: "Slack" },
    ],
    skills: [
      { id: "dispute-intake", name: "Dispute Intake" },
      { id: "bureau-submit", name: "Bureau Submit" },
      { id: "dispute-track", name: "Track Dispute" },
      { id: "negative-item-scan", name: "Scan Negative Items" },
      { id: "dispute-letter", name: "Generate Dispute Letter" },
      { id: "eoscar-check", name: "e-OSCAR Check" },
    ],
    workflows: [
      { name: "Dispute Intake Flow", description: "Customer reports item → Document collection → Bureau submission" },
      { name: "30-Day Follow-up", description: "Federal mandate: bureaus must respond within 30 days" },
    ],
    antiPatterns: [
      { name: "Missing Documentation", description: "Never submit disputes without supporting documents", severity: "critical" },
      { name: "Duplicate Disputes", description: "Check for existing disputes before creating new ones", severity: "high" },
    ],
  },
};

// Generate all 15 domains with fallback data
const FALLBACK_DOMAIN = {
  connectors: [{ id: "base44", name: "Base44" }] as { id: string; name: string }[],
  skills: [] as { id: string; name: string }[],
  workflows: [] as { name: string; description: string }[],
  antiPatterns: [] as { name: string; description: string; severity: "medium" }[],
  domain: "general",
};

function getDomain(id: string) {
  const domain = DOMAINS[id];
  if (domain) return domain;
  // Generate synthetic for unlisted domains
  return {
    id,
    name: id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    description: `Agent playbook for ${id} operations.`,
    connectors: FALLBACK_DOMAIN.connectors,
    skills: FALLBACK_DOMAIN.skills,
    workflows: FALLBACK_DOMAIN.workflows,
    antiPatterns: FALLBACK_DOMAIN.antiPatterns,
    domain: id,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params;
  const data = getDomain(domain);
  return {
    title: `${data.name} — Playbook`,
    description: data.description,
  };
}

export default async function DomainDetailPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  cookies();

  const data = getDomain(domain);
  if (!data) notFound();

  return <DomainDetailClient domain={data} />;
}
