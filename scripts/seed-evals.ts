#!/usr/bin/env tsx
/**
 * Phase 15.B — Seed 50 eval queries across 10 domains.
 * Run: npx tsx scripts/seed-evals.ts [--dry-run]
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryEval } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

config({ path: ".env.local" });

const EVALS = [
  // ── BILLING FLOW (6) ──────────────────────────────────────────────────
  { domain: "billing-flow", severity: "critical", evalName: "billing-nmi-recovery-wizard", query: "A customer with vault_id v_abc123 got NMI code 225. Walk through the recovery wizard flow.", expectedSkills: ["billing-recovery-wizard", "nmi-vault-validator"], expectedConnectors: ["nmi-mcp-bridge"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85, requireCortex: true, maxLatencyMs: 8000 } },
  { domain: "billing-flow", severity: "critical", evalName: "billing-smart-retry-schedule", query: "A soft-decline insufficient_funds just came in for customer cust_789. Apply the smart retry engine.", expectedSkills: ["smart-retry-engine", "payment-retry-scheduler"], expectedConnectors: ["nmi-mcp-bridge"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85, requireCortex: true } },
  { domain: "billing-flow", severity: "high", evalName: "billing-golden-vault-pay-now", query: "Process a Pay Now through the Golden Vault for customer cust_456 with a $49 setup fee.", expectedSkills: ["golden-vault-payment", "nmi-customer-vault"], expectedConnectors: ["nmi-mcp-bridge"], successCriteria: { minCorrectness: 80, requireCortex: true } },
  { domain: "billing-flow", severity: "high", evalName: "billing-subscription-create", query: "Create a new $99/month subscription for a customer who just completed enrollment.", expectedSkills: ["subscription-builder", "recurring-payment-setup"], expectedConnectors: ["nmi-mcp-bridge"], successCriteria: { minCorrectness: 80 } },
  { domain: "billing-flow", severity: "normal", evalName: "billing-invoice-query", query: "Show me the last 3 payment logs for customer cust_012 and their NMI transaction statuses.", expectedSkills: ["payment-log-query", "transaction-lookup"], expectedConnectors: ["b44-query"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "billing-flow", severity: "normal", evalName: "billing-mit-cit-rule", query: "Explain the difference between MIT and CIT transactions in NMI and when to use each.", expectedSkills: ["nmi-compliance-knowledge", "payment-auth-guide"], expectedConnectors: [], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 70, requireCortex: false } },

  // ── CREDIT DISPUTES (6) ───────────────────────────────────────────────
  { domain: "credit-disputes", severity: "critical", evalName: "dispute-round-initiation", query: "Customer cust_234 wants to dispute a derogatory mark from TransUnion. Start dispute round 1.", expectedSkills: ["dispute-round-initiator", "credit-bureau-letter-gen"], expectedConnectors: ["b44-create", "b44-update"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 90, requireCortex: true, maxLatencyMs: 10000 } },
  { domain: "credit-disputes", severity: "critical", evalName: "dispute-round-tracking", query: "Check the status of all active dispute rounds for cust_234. Which ones need follow-up?", expectedSkills: ["dispute-round-tracker", "follow-up-scheduler"], expectedConnectors: ["b44-query"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85, requireCortex: true } },
  { domain: "credit-disputes", severity: "high", evalName: "dispute-creditor-direct", query: "A dispute needs to go directly to the creditor (not bureau). Generate the direct dispute letter.", expectedSkills: ["direct-dispute-letter", "creditor-contact-finder"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 80 } },
  { domain: "credit-disputes", severity: "high", evalName: "dispute-bureau-response-parse", query: "Parse this TransUnion response letter and determine if the dispute was successful or needs escalation.", expectedSkills: ["bureau-response-parser", "escalation-checker"], expectedConnectors: [], successCriteria: { minCorrectness: 80 } },
  { domain: "credit-disputes", severity: "normal", evalName: "dispute-multi-bureau-round", query: "I need to dispute the same account across all 3 bureaus. Set up a multi-bureau dispute round.", expectedSkills: ["multi-bureau-dispute", "round-coordinator"], expectedConnectors: [], successCriteria: { minCorrectness: 75 } },
  { domain: "credit-disputes", severity: "normal", evalName: "dispute-fcra-reference", query: "What does the FCRA say about dispute investigation timelines? Give me the relevant sections.", expectedSkills: ["fcra-knowledge-base", "compliance-reference"], expectedConnectors: [], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 70, requireCortex: false } },

  // ── CUSTOMER ENROLLMENT (5) ───────────────────────────────────────────
  { domain: "customer-enrollment", severity: "critical", evalName: "enrollment-full-flow", query: "Enroll a new customer: John Doe, phone 555-0100, email john@example.com, interested in credit repair.", expectedSkills: ["enrollment-wizard", "profile-builder"], expectedConnectors: ["b44-create"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 90, requireCortex: true, maxLatencyMs: 8000 } },
  { domain: "customer-enrollment", severity: "high", evalName: "enrollment-credit-pull", query: "Pull credit reports for newly enrolled customer cust_567 from all 3 bureaus.", expectedSkills: ["credit-report-puller", "multi-bureau-coordinator"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 85 } },
  { domain: "customer-enrollment", severity: "high", evalName: "enrollment-document-upload", query: "Customer uploaded their ID and pay stubs. Verify the documents and attach to their profile.", expectedSkills: ["document-verifier", "profile-attachment"], expectedConnectors: [], successCriteria: { minCorrectness: 80 } },
  { domain: "customer-enrollment", severity: "normal", evalName: "enrollment-status-check", query: "What's the enrollment status for cust_890? Has their credit report been pulled yet?", expectedSkills: ["enrollment-tracker", "status-reporter"], expectedConnectors: ["b44-query"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "customer-enrollment", severity: "normal", evalName: "enrollment-retention-risk", query: "Identify customers who enrolled more than 30 days ago but have no active payment method.", expectedSkills: ["retention-analyzer", "enrollment-auditor"], expectedConnectors: ["b44-query", "b44-aggregate"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },

  // ── COMPLIANCE AUDIT (5) ──────────────────────────────────────────────
  { domain: "compliance-audit", severity: "critical", evalName: "compliance-fdcpa-audit", query: "Audit all outbound communications from the last 30 days for FDCPA compliance violations.", expectedSkills: ["compliance-auditor", "fdcpa-checker"], expectedConnectors: ["b44-query", "b44-aggregate"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 90, requireCortex: true } },
  { domain: "compliance-audit", severity: "critical", evalName: "compliance-consent-verify", query: "Verify that all 200 active customers have signed consent forms on file. Flag any missing.", expectedSkills: ["consent-auditor", "document-verifier"], expectedConnectors: ["b44-query", "b44-stream"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 95, requireCortex: true } },
  { domain: "compliance-audit", severity: "high", evalName: "compliance-data-retention", query: "Check our data retention policy against FCRA requirements. Are we holding data too long?", expectedSkills: ["retention-policy-checker", "fcra-reference"], expectedConnectors: [], successCriteria: { minCorrectness: 80 } },
  { domain: "compliance-audit", severity: "high", evalName: "compliance-cfpb-readiness", query: "If the CFPB audited us tomorrow, would we pass? Run a readiness checklist against all systems.", expectedSkills: ["cfpb-readiness", "compliance-checklist"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 85, requireCortex: true } },
  { domain: "compliance-audit", severity: "normal", evalName: "compliance-tcpa-sms", query: "Audit our SMS templates for TCPA compliance. Do they all have opt-out language?", expectedSkills: ["tcpa-checker", "sms-template-auditor"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 80 } },

  // ── SUPPORT TRIAGE (5) ────────────────────────────────────────────────
  { domain: "support-triage", severity: "critical", evalName: "support-escalation-payment-failed", query: "Customer is on the phone saying their payment failed and they're about to cancel. Triage this.", expectedSkills: ["urgent-triage", "payment-failure-resolver"], expectedConnectors: ["nmi-mcp-bridge", "b44-query"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 90, requireCortex: true, maxLatencyMs: 5000 } },
  { domain: "support-triage", severity: "high", evalName: "support-ticket-categorizer", query: "Categorize these 15 support tickets by domain and urgency. Which need human review?", expectedSkills: ["ticket-categorizer", "urgency-classifier"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 80 } },
  { domain: "support-triage", severity: "high", evalName: "support-callback-queue", query: "Build a callback queue for 5 customers who requested callbacks. Order by priority.", expectedSkills: ["callback-scheduler", "priority-queue-builder"], expectedConnectors: [], successCriteria: { minCorrectness: 80 } },
  { domain: "support-triage", severity: "normal", evalName: "support-faq-answer", query: "A customer asks: 'How long does a credit dispute usually take?' Answer concisely.", expectedSkills: ["faq-responder", "dispute-timeline-kb"], expectedConnectors: [], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75, requireCortex: false } },
  { domain: "support-triage", severity: "normal", evalName: "support-sentiment-analyze", query: "Analyze the sentiment of the last 50 Slack messages from #customer-support.", expectedSkills: ["sentiment-analyzer", "slack-channel-reader"], expectedConnectors: ["slack-mcp-bridge"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 70 } },

  // ── AGENT PAYMENTS (5) ────────────────────────────────────────────────
  { domain: "agent-payments", severity: "high", evalName: "agent-commission-calc", query: "Calculate agent commissions for May 2026 based on enrolled customers and successful payments.", expectedSkills: ["commission-calculator", "payment-aggregator"], expectedConnectors: ["b44-query", "b44-aggregate"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85 } },
  { domain: "agent-payments", severity: "high", evalName: "agent-payout-batch", query: "Generate a payout batch for 10 agents. Each gets their commission minus any chargebacks.", expectedSkills: ["payout-batch-generator", "chargeback-deductor"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 85 } },
  { domain: "agent-payments", severity: "normal", evalName: "agent-performance-rank", query: "Rank all agents by enrollment-to-payment conversion rate for Q2 2026.", expectedSkills: ["performance-ranker", "conversion-calculator"], expectedConnectors: ["b44-query", "b44-aggregate"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "agent-payments", severity: "normal", evalName: "agent-payment-dispute", query: "Agent Alex disputes their commission for cust_345. Investigate and resolve.", expectedSkills: ["dispute-investigator", "commission-auditor"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 75 } },
  { domain: "agent-payments", severity: "low", evalName: "agent-monthly-statement", query: "Generate a monthly earnings statement for agent Sarah for June 2026.", expectedSkills: ["statement-generator", "earnings-summarizer"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 70 } },

  // ── REPORTING (5) ─────────────────────────────────────────────────────
  { domain: "reporting", severity: "high", evalName: "reporting-morning-pulse", query: "Generate the morning pulse report: enrollments, payments, disputes, support tickets from last 24h.", expectedSkills: ["morning-pulse", "cross-domain-aggregator"], expectedConnectors: ["b44-query", "reporting-hub"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85, requireCortex: true } },
  { domain: "reporting", severity: "high", evalName: "reporting-revenue-dashboard", query: "Build a revenue dashboard showing MRR, churn rate, and average revenue per customer for Q2.", expectedSkills: ["revenue-dashboard", "mrr-calculator"], expectedConnectors: ["b44-query", "b44-aggregate"], successCriteria: { minCorrectness: 80 } },
  { domain: "reporting", severity: "normal", evalName: "reporting-weekly-summary", query: "Summarize this week's activity: new enrollments, disputes filed, payments collected, tickets closed.", expectedSkills: ["weekly-summarizer", "activity-aggregator"], expectedConnectors: ["b44-query", "reporting-hub"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "reporting", severity: "normal", evalName: "reporting-slack-digest", query: "Post a daily digest to #jarvis-admin with key metrics: revenue, disputes, support volume.", expectedSkills: ["slack-digest-builder", "metrics-compiler"], expectedConnectors: ["slack-mcp-bridge", "b44-query"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "reporting", severity: "low", evalName: "reporting-export-csv", query: "Export all dispute outcomes from Q2 2026 as a CSV file.", expectedSkills: ["csv-exporter", "dispute-data-extractor"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 70 } },

  // ── CUSTOMER COMMS (5) ────────────────────────────────────────────────
  { domain: "customer-comms", severity: "high", evalName: "comms-payment-reminder", query: "Send payment reminder emails to 3 customers whose payments are due in 2 days.", expectedSkills: ["payment-reminder", "email-template-renderer"], expectedConnectors: ["b44-query"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85 } },
  { domain: "customer-comms", severity: "high", evalName: "comms-dispute-update", query: "Customer cust_678's dispute round 2 completed. Send them an update about the results.", expectedSkills: ["dispute-update-notifier", "customer-messenger"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 80 } },
  { domain: "customer-comms", severity: "normal", evalName: "comms-enrollment-welcome", query: "Draft a welcome SMS sequence for new customers: Day 1, Day 3, Day 7.", expectedSkills: ["welcome-sequence-builder", "sms-composer"], expectedConnectors: [], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "customer-comms", severity: "normal", evalName: "comms-negative-item-alert", query: "A new negative item appeared on cust_901's credit report. Alert them via email.", expectedSkills: ["negative-item-alerter", "credit-alert-composer"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 75 } },
  { domain: "customer-comms", severity: "low", evalName: "comms-birthday-greeting", query: "Send a birthday greeting to customers who have birthdays this week.", expectedSkills: ["birthday-greeter", "batch-messenger"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 65, requireCortex: false } },

  // ── LEAD FLOW (4) ─────────────────────────────────────────────────────
  { domain: "lead-flow", severity: "high", evalName: "lead-qualification", query: "Score these 10 new leads based on credit score range, income, and engagement signals.", expectedSkills: ["lead-scorer", "qualification-engine"], expectedConnectors: ["b44-query"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 80 } },
  { domain: "lead-flow", severity: "normal", evalName: "lead-followup-sequence", query: "Set up a 5-day follow-up sequence for 3 warm leads who haven't enrolled yet.", expectedSkills: ["followup-sequencer", "lead-nurturer"], expectedConnectors: [], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 75 } },
  { domain: "lead-flow", severity: "normal", evalName: "lead-source-attribution", query: "Which lead sources (Google Ads, Facebook, referral) have the highest conversion rate?", expectedSkills: ["attribution-analyzer", "conversion-calculator"], expectedConnectors: ["b44-query", "b44-aggregate"], successCriteria: { minCorrectness: 75 } },
  { domain: "lead-flow", severity: "low", evalName: "lead-list-export", query: "Export all qualified leads from May 2026 with contact info and score.", expectedSkills: ["lead-exporter", "data-extractor"], expectedConnectors: ["b44-query"], successCriteria: { minCorrectness: 70 } },

  // ── MCP EDITS (4) ─────────────────────────────────────────────────────
  { domain: "mcp-edits", severity: "critical", evalName: "mcp-edit-component", query: "Add a new 'PaymentStatusBadge' component to the Base44 dashboard that shows green/yellow/red based on payment status.", expectedSkills: ["component-builder", "base44-editor"], expectedConnectors: ["github-pr", "mcp-edit"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 90, requireCortex: true, maxLatencyMs: 15000 } },
  { domain: "mcp-edits", severity: "high", evalName: "mcp-edit-api-endpoint", query: "Create a new API endpoint /api/customers/summary that returns aggregated customer stats.", expectedSkills: ["api-builder", "endpoint-creator"], expectedConnectors: ["github-pr", "mcp-edit"], expectedModel: "anthropic/claude-sonnet-4-20250514", successCriteria: { minCorrectness: 85 } },
  { domain: "mcp-edits", severity: "normal", evalName: "mcp-edit-bug-fix", query: "Fix the bug in the payment form where the CVV field doesn't validate 4-digit Amex codes.", expectedSkills: ["bug-fixer", "form-validator"], expectedConnectors: ["github-pr", "mcp-edit"], expectedModel: "anthropic/claude-haiku-4-20250514", successCriteria: { minCorrectness: 80 } },
  { domain: "mcp-edits", severity: "normal", evalName: "mcp-edit-docs-update", query: "Update the API documentation to reflect the new v3 endpoint structure.", expectedSkills: ["docs-updater", "markdown-editor"], expectedConnectors: ["github-pr"], successCriteria: { minCorrectness: 75 } },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not set, exiting.");
    process.exit(1);
  }
  const sqlClient = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sqlClient);

  console.log(`Seeding ${EVALS.length} eval queries...`);
  let created = 0;

  for (const e of EVALS) {
    // Skip if already exists
    const existing = await db
      .select({ id: libraryEval.id })
      .from(libraryEval)
      .where(eq(libraryEval.evalName, e.evalName))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  SKIP ${e.evalName} (exists: ${existing[0].id})`);
      continue;
    }

    if (!dryRun) {
      await db.insert(libraryEval).values({
        evalName: e.evalName,
        domain: e.domain,
        query: e.query,
        expectedSkills: e.expectedSkills,
        expectedConnectors: e.expectedConnectors,
        expectedModel: e.expectedModel || null,
        successCriteria: e.successCriteria,
        severity: e.severity,
      });
    }
    created++;
    console.log(`  OK ${e.evalName} [${e.domain}] ${e.severity}`);
  }

  console.log(`\nDone: ${created} created (${dryRun ? "DRY RUN" : "COMMITTED"})`);
  await sqlClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
