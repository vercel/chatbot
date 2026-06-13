/**
 * PHASE 4: KG Seed — Wiki Content Foundation
 * Mission: KG-SEED-WIKI-CONTENT-2026-06-13
 *
 * Seeds 100+ entities grounded in REAL data (no hallucination):
 *   - 50 Company Knowledge (NewLeaf Financial)
 *   - 30 Product Knowledge (Neptune repos, Vercel, env vars)
 *   - 14 Connector Knowledge (enriched: when to use, anti-patterns, related skills)
 *   -  5 P0 Playbook Knowledge (billing-recovery, support, mcp-edit, vps-dispatch, refactor)
 *
 * Usage: npx tsx scripts/seed-kg-phase4.ts [--dry-run]
 */

import postgres from "postgres";
import type { EntityInsert } from "@/lib/knowledge/types";

// ── Provenance stamp ──────────────────────────────────────────────────────
const SEED_PROVENANCE = {
  sessionId: "phase4-kg-seed-wiki-content",
  turnId: "2026-06-13-2250",
  timestamp: new Date().toISOString(),
  sourceLog: "scripts/seed-kg-phase4.ts | jarvis/cortex/missions/KG-SEED-WIKI-CONTENT-2026-06-13.md",
};

// ── Helper: sanitize for ltree ────────────────────────────────────────────
function toLtreePath(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase())
    .join(".");
}

// ── Direct upsert (avoids Next.js module resolution in script mode) ──────
async function upsertEntityDirect(
  sql: ReturnType<typeof postgres>,
  entity: EntityInsert
): Promise<void> {
  await sql`
    INSERT INTO kg_entities (
      type, name, description, properties, path, confidence, provenance
    ) VALUES (
      ${entity.type},
      ${entity.name},
      ${entity.description ?? null},
      ${sql.json((entity.properties ?? {}) as Record<string, unknown>)},
      ${entity.path ?? null}::ltree,
      ${entity.confidence ?? 1.0},
      ${entity.provenance ? sql.json(entity.provenance as Record<string, unknown>) : null}
    )
    ON CONFLICT (type, name)
    DO UPDATE SET
      description = COALESCE(EXCLUDED.description, kg_entities.description),
      properties = COALESCE(EXCLUDED.properties, kg_entities.properties),
      path = COALESCE(EXCLUDED.path, kg_entities.path),
      confidence = EXCLUDED.confidence,
      provenance = COALESCE(EXCLUDED.provenance, kg_entities.provenance),
      updated_at = now()
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4a: 50 COMPANY KNOWLEDGE ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

const COMPANY_KNOWLEDGE: EntityInsert[] = [
  // ── 5 NewLeaf Product Surfaces ──────────────────────────────────────────
  {
    type: "Concept",
    name: "NL-Product-Portal",
    description: "portal.newleaf.financial — Customer-facing portal for billing self-serve, support, onboarding, and creditor call tools. Built as Base44 native pages (app 692f9a5fce9fd7c889a4b4ac). V3 Liquid Glass design (iOS 26 inspired). Bottom nav: Home/Billing/Docs/Support/Profile.",
    properties: {
      product: "Customer Portal",
      url: "https://portal.newleaf.financial",
      platform: "Base44",
      app_id: "692f9a5fce9fd7c889a4b4ac",
      design: "Liquid Glass (iOS 26 inspired)",
      launched: "2025",
      version: "v3 (June 2026)",
    },
    path: toLtreePath("company", "products", "portal"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "NL-Product-Pay",
    description: "pay.newleaf.financial — Hyperswitch-powered payment page for NMI-backed card collection via Collect.js. Public-facing payment gateway with Hyperswitch routing (merchant newleaf_test_001, profile pro_FcTsudWLf271LHfKBBnG). Supports DPAN tokenization through NMI vault.",
    properties: {
      product: "Payment Gateway",
      url: "https://pay.newleaf.financial",
      gateway: "Hyperswitch + NMI",
      merchant_id: "newleaf_test_001",
      hyperswitch_profile_id: "pro_FcTsudWLf271LHfKBBnG",
      tokenization: "DPAN (NMI Customer Vault)",
    },
    path: toLtreePath("company", "products", "pay"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "NL-Product-Base44",
    description: "Base44 CRM — Internal admin panel at base44.app/apps/692f9a5fce9fd7c889a4b4ac. Manages customer profiles, payment logs, support tickets, credit reports, dispute rounds, agent calls, NMI transactions, and automations. Jarvis agents operate from here via Base44 MCP bridge.",
    properties: {
      product: "Internal CRM / Admin Panel",
      url: "https://base44.app/apps/692f9a5fce9fd7c889a4b4ac",
      platform: "Base44",
      app_id: "692f9a5fce9fd7c889a4b4ac",
      entities: ["CustomerProfile", "PaymentLog", "SupportTicket", "CreditReport", "DisputeRound", "CallLog"],
    },
    path: toLtreePath("company", "products", "base44"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "NL-Product-Hermes",
    description: "Hermes VPS — Master agent runtime at 187.127.250.171 (Hostinger VPS). Runs claude-agent-api (Claude Agent SDK), hosts cortex skills, agent memory, Jarvis File System. 10-domain architecture (V5): billing-flow, credit-disputes, customer-enrollment, compliance-audit, support-triage, agent-payments, reporting, customer-comms, lead-flow, mcp-edits. Self-healing refinement cron at 02:57 UTC daily.",
    properties: {
      product: "AI Agent Runtime",
      ip: "187.127.250.171",
      host: "Hostinger VPS",
      architecture: "V5 Domain-Driven Skill Architecture",
      domains: 10,
      refinement_cron: "02:57 UTC daily",
      self_healing: true,
    },
    path: toLtreePath("company", "products", "hermes"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "NL-Product-Neptune",
    description: "Neptune AI — Two-agent architecture for Abhi's daily operations. Neptune Chat (daily driver, workflow, analysis, plans) + Neptune V2 (long looping code tasks, sandbox SDK, GitHub PRs, Vercel deploys). Both use AI Gateway for multi-model routing (DeepSeek, Anthropic, OpenAI, xAI, Google). Chat runs on Vercel (prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl), V2 runs on Vercel (prj_lEoqz6p4zgdrLlObPl845TI2ApOm).",
    properties: {
      product: "AI Agent Platform",
      agents: ["Neptune Chat (daily driver)", "Neptune V2 (coding agent)"],
      gateway: "AI Gateway (multi-model routing)",
      models: ["deepseek-v4-pro", "deepseek-reasoner", "anthropic/claude-sonnet-4-6", "xai/grok-4.1-fast", "google/gemini-2-flash", "openai/gpt-oss-120b"],
      handoff: "/api/v2-bridge (Chat → V2)",
    },
    path: toLtreePath("company", "products", "neptune"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 8 Customer Journey Stages ───────────────────────────────────────────
  {
    type: "Concept",
    name: "Journey-Lead",
    description: "Stage 1: Lead — Customer has submitted info via Slack, VAPI call, or web form. Profile created in Base44 CRM with status 'lead'. Needs qualification: credit report pulled, negative items counted, eligibility determined.",
    properties: { stage: 1, status: "lead", entry_points: ["Slack submission", "VAPI call transfer", "Web form"], next_stage: "qualified" },
    path: toLtreePath("company", "journey", "lead"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-Qualified",
    description: "Stage 2: Qualified — Credit report analyzed, eligibility confirmed (sufficient negative items, within service scope). Agreement document prepared. Ready for enrollment.",
    properties: { stage: 2, status: "qualified", requirements: ["Credit report pulled", "Eligibility confirmed", "Agreement prepared"], next_stage: "enrolled_pending" },
    path: toLtreePath("company", "journey", "qualified"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-EnrolledPending",
    description: "Stage 3: Enrolled Pending — Agreement signed, first payment scheduled but NOT yet processed. Day-0 CIT (Customer Initiated Transaction) pending for NMI vault creation. Card on file not yet active.",
    properties: { stage: 3, status: "enrolled_pending", requirements: ["Signed agreement", "First payment scheduled", "CIT pending"], next_stage: "enrolled_active" },
    path: toLtreePath("company", "journey", "enrolled_pending"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-EnrolledActive",
    description: "Stage 4: Enrolled Active — Day-0 CIT complete, NMI customer vault created with DPAN token. Recurring billing active. Customer receiving credit repair services. Regular dispute rounds in progress.",
    properties: { stage: 4, status: "enrolled_active", requirements: ["CIT complete", "Vault created", "Recurring billing active"], next_stage: "billing_active" },
    path: toLtreePath("company", "journey", "enrolled_active"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-BillingActive",
    description: "Stage 5: Billing Active — Monthly recurring charges processing via NMI MIT (Merchant Initiated Transaction). Smart Retry Engine active for soft declines (15-min intervals). Payment logs tracking all transactions in Base44.",
    properties: { stage: 5, status: "billing_active", payment_method: "NMI MIT via DPAN", retry_engine: "Smart Retry (15-min intervals)", next_stage: ["declining", "recovered", "cancelled"] },
    path: toLtreePath("company", "journey", "billing_active"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-Declining",
    description: "Stage 6: Declining — Payment failures detected (insufficient funds, card expired, do not honor, velocity limits). Smart Retry Engine attempts recovery. If soft decline: retry with billing link. If hard decline: send payment_update_link, flag for agent intervention.",
    properties: { stage: 6, status: "declining", actions: ["Smart Retry (soft)", "Billing link (recovery wizard)", "Agent intervention (hard decline)"], next_stage: ["recovered", "cancelled"] },
    path: toLtreePath("company", "journey", "declining"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-Recovered",
    description: "Stage 7: Recovered — Previously declining customer successfully paid via smart retry, recovery wizard, or agent-assisted card update. Billing resume. NMI CVV 225 fix (card_auth=1 + dup_seconds=0) applied to prevent recurrence.",
    properties: { stage: 7, status: "recovered", recovery_methods: ["Smart Retry", "Recovery Wizard", "Agent card update"], fix_applied: "CVV 225 fix (card_auth=1 + dup_seconds=0)", next_stage: "billing_active" },
    path: toLtreePath("company", "journey", "recovered"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Journey-Cancelled",
    description: "Stage 8: Cancelled — Customer no longer active. Possible reasons: hard decline unrecoverable, customer requested cancellation, services completed, chargeback. 48-hour cooldown before final CRM status change. Dispute rounds may continue post-cancellation if in progress.",
    properties: { stage: 8, status: "cancelled", reasons: ["Hard decline", "Customer request", "Services complete", "Chargeback"], cooldown: "48h before final status", notes: "Dispute rounds may continue" },
    path: toLtreePath("company", "journey", "cancelled"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 5 Business Model Entities ───────────────────────────────────────────
  {
    type: "Concept",
    name: "BM-RevenueModel",
    description: "NewLeaf Financial revenue: Monthly recurring subscription for credit repair services. Charged via NMI gateway (DPAN token, MIT transactions). Pricing tiers: based on service scope (number of negative items, dispute rounds). Agent commission: percentage of collected payments.",
    properties: {
      model: "Monthly recurring subscription",
      gateway: "NMI (DPAN + MIT)",
      pricing_factors: ["Number of negative items", "Dispute rounds", "Service tier"],
      currency: "USD",
    },
    path: toLtreePath("company", "business_model", "revenue"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "BM-NMIGateway",
    description: "NMI Payment Gateway — Primary payment processor. Architecture: Customer Vault (DPAN network tokens) + CIT (Day-0 consent) + MIT (recurring charges). Collect.js for browser-based card capture. BANNED: source_transaction_id. Card auth requires card_auth=1 + dup_seconds=0 for recovery wizard.",
    properties: {
      provider: "NMI (Network Merchants Inc)",
      features: ["Customer Vault", "DPAN tokenization", "CIT/MIT", "Collect.js", "Subscription API"],
      banned: ["source_transaction_id"],
      card_auth: "card_auth=1 + dup_seconds=0 (CVV 225 fix)",
    },
    path: toLtreePath("company", "business_model", "nmi_gateway"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "BM-HyperswitchRouting",
    description: "Hyperswitch — Payment routing layer in front of NMI. Provides: multi-gateway failover, merchant-specific routing, webhook handling, publishable-key client-side tokens. Currently configured for NewLeaf test merchant (newleaf_test_001). Public base URL: pay.newleaf.financial.",
    properties: {
      provider: "Hyperswitch (Juspay)",
      role: "Payment routing + failover",
      merchant_id: "newleaf_test_001",
      profile_id: "pro_FcTsudWLf271LHfKBBnG",
      public_url: "https://pay.newleaf.financial",
    },
    path: toLtreePath("company", "business_model", "hyperswitch"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "BM-PartnerEcosystem",
    description: "NewLeaf partners: credit bureaus (Experian, TransUnion, Equifax) for dispute submissions; banking partners for payment processing; legal/compliance partners for FCRA adherence. Dispute letters sent via Forth connector to credit bureaus.",
    properties: {
      credit_bureaus: ["Experian", "TransUnion", "Equifax"],
      payment_partners: ["NMI", "Hyperswitch"],
      compliance: "FCRA (Fair Credit Reporting Act)",
      dispute_platform: "Forth connector",
    },
    path: toLtreePath("company", "business_model", "partners"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "BM-AgentCommissions",
    description: "Agent commission structure: percentage of collected payments per enrolled customer. Tracked via Base44 PaymentLog + agent assignment. Commission calculated monthly. Agent performance tracked via engagement scoring (portal v3 feature).",
    properties: {
      model: "Percentage of collected payments",
      tracking: "Base44 PaymentLog + agent assignment",
      cadence: "Monthly",
      scoring: "EngagementScore entity (portal v3)",
    },
    path: toLtreePath("company", "business_model", "agent_commissions"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 20 Cardinal Rules (from memory store, top by relevance) ─────────────
  {
    type: "Cardinal",
    name: "CARDINAL-slack-jarvis-admin-only",
    description: "Slack #jarvis-admin ONLY — NEVER newleaf-admin. All agent communications, notifications, and landing posts go to #jarvis-admin (C0AQDDC3HAB).",
    properties: { rule_id: "hermes-v5-1", source: "Hermes V5 cardinal rules (LOCKED)", domain: "communications" },
    path: toLtreePath("company", "cardinals", "slack_jarvis_admin"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-native-tools-only",
    description: "NATIVE TOOLS ONLY — never hostingerBridge from VPS, never vercel CLI for deploys. Use Bash/Read/Write/Edit for VPS ops. Use Vercel REST API only for deploys.",
    properties: { rule_id: "hermes-v5-2", source: "Hermes V5 cardinal rules (LOCKED)", domain: "tooling" },
    path: toLtreePath("company", "cardinals", "native_tools"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-playbook-canonical-format",
    description: "The 4-section playbook.md is canonical format — never replace structure. Every playbook must have: (1) Domain Definition, (2) Operational Knowledge, (3) Connector Map, (4) Self-Healing Rules.",
    properties: { rule_id: "hermes-v5-3", source: "Hermes V5 cardinal rules (LOCKED)", domain: "playbooks" },
    path: toLtreePath("company", "cardinals", "playbook_format"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-self-healing-mandatory",
    description: "Self-healing mandatory — every error must match against Section 4 (Self-Healing Rules) of the active domain playbook. Agent must NOT improvise fixes. Follow the documented recovery path.",
    properties: { rule_id: "hermes-v5-4", source: "Hermes V5 cardinal rules (LOCKED)", domain: "operations" },
    path: toLtreePath("company", "cardinals", "self_healing"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-ci-must-pass",
    description: "CI must pass after every commit — never skip hooks (--no-verify banned). If a pre-commit hook fails, fix the issue and create a NEW commit, never amend.",
    properties: { rule_id: "hermes-v5-5", source: "Hermes V5 cardinal rules (LOCKED)", domain: "engineering" },
    path: toLtreePath("company", "cardinals", "ci_must_pass"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-source-txn-id-banned",
    description: "source_transaction_id is BANNED — use customer_vault_id + DPAN (network token) for all NMI operations. Day-0 CIT transaction is the consent anchor required before any real charge.",
    properties: { rule_id: "nmi-gv-1", source: "NMI Golden Vault Architecture", domain: "billing" },
    path: toLtreePath("company", "cardinals", "nmi_source_txn_banned"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-day0-cit-required",
    description: "Day-0 CIT (Customer Initiated Transaction) is consent anchor — required before any real charge. MIT (Merchant Initiated Transaction) only valid after a successful CIT establishes the billing relationship.",
    properties: { rule_id: "nmi-gv-2", source: "NMI Golden Vault Architecture", domain: "billing" },
    path: toLtreePath("company", "cardinals", "day0_cit"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-cof-compliance-check",
    description: "cofCompliant check required before every NMI vault operation. Verify card-on-file compliance before create, update, charge, or subscription operations against any customer vault.",
    properties: { rule_id: "nmi-gv-3", source: "NMI Golden Vault Architecture", domain: "billing" },
    path: toLtreePath("company", "cardinals", "cof_compliance"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-vercel-cli-banned",
    description: "vercel CLI is BANNED — silent empty bug corrupts deployments. Use Vercel REST API only for all deploy operations. Use VERCEL_TOKEN from env, never expose to client.",
    properties: { rule_id: "deploy-1", source: "Vercel Discipline Playbook", domain: "deploy" },
    path: toLtreePath("company", "cardinals", "vercel_cli_banned"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-vercel-token-server-only",
    description: "NEVER expose VERCEL_TOKEN to client — server-side only. All Vercel API calls must go through server-side API routes or backend functions. The token grants full project admin access.",
    properties: { rule_id: "deploy-2", source: "Vercel Discipline Playbook", domain: "deploy" },
    path: toLtreePath("company", "cardinals", "vercel_token_secret"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-wiki-read-only",
    description: "Wiki is READ-ONLY for agent in v1 — only humans + extraction pipeline write. Agents query KG via query_knowledge tool; they do NOT directly modify wiki content. Changes come through the annotation loop / self-healing pipeline.",
    properties: { rule_id: "wiki-1", source: "U7.5 /wiki UI cardinal", domain: "knowledge" },
    path: toLtreePath("company", "cardinals", "wiki_read_only"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-provenance-mandatory",
    description: "Provenance MANDATORY — every KG entity must trace back to source session. No entity may be created without provenance (sessionId + turnId + timestamp). This enables audit trail and confidence scoring.",
    properties: { rule_id: "wiki-2", source: "U7.1 KG design cardinal", domain: "knowledge" },
    path: toLtreePath("company", "cardinals", "provenance_mandatory"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-raw-logs-immutable",
    description: "Raw logs immutable — never redact original session logs. Store redacted copy alongside original. Original logs are the source of truth for KG extraction and audit.",
    properties: { rule_id: "kg-1", source: "U7.2 Raw Logs cardinal", domain: "knowledge" },
    path: toLtreePath("company", "cardinals", "raw_logs_immutable"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-auto-modify-banned",
    description: "Agent NEVER auto-modifies playbooks — only propose via self-heal loop. Playbook changes must go through PR-style review. Low-risk patches auto-applied; high-risk queued for human review.",
    properties: { rule_id: "kg-2", source: "U7.4 Pre-Check cardinal", domain: "knowledge" },
    path: toLtreePath("company", "cardinals", "auto_modify_banned"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-cvv-225-fix",
    description: "NMI CVV 225 Recovery Wizard Fix (2026-05-05): Every recovery wizard billing link was failing with NMI code 225 'Invalid CVV'. Root cause: missing card_auth=1 + dup_seconds=0 in NMI validate calls. Fix applied to nmiRecoveryCheckout, payNowGoldenVault, WizardBillingStep.",
    properties: { rule_id: "billing-cvv225", source: "NMI CVV 225 Recovery Wizard Fix playbook", domain: "billing" },
    path: toLtreePath("company", "cardinals", "cvv_225_fix"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-repo-lock-first",
    description: "REPO LOCK first action: cd <repo> && pwd && git remote -v. Verify working directory and git remote before any code changes. Never assume you're in the right repo.",
    properties: { rule_id: "mission-1", source: "Master PRD Phase Execution cardinal", domain: "operations" },
    path: toLtreePath("company", "cardinals", "repo_lock"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-single-atomic-commit",
    description: "Single atomic commit per phase, per repo. Never split phase work across multiple commits. Each commit message must reference the mission name and summarize all changes.",
    properties: { rule_id: "mission-2", source: "Master PRD Phase Execution cardinal", domain: "operations" },
    path: toLtreePath("company", "cardinals", "atomic_commit"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-no-hallucination",
    description: "NO HALLUCINATION — every KG entity, PRD claim, and agent response must reference actual repo, memory, code, or verified data. Never fabricate entities, customer data, or system capabilities.",
    properties: { rule_id: "mission-3", source: "Master PRD Phase Execution cardinal", domain: "knowledge" },
    path: toLtreePath("company", "cardinals", "no_hallucination"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-phase-smoke-test",
    description: "Each phase: smoke test with actual functional verification, not just deploy state. Verify the feature works end-to-end before marking phase complete.",
    properties: { rule_id: "mission-4", source: "Master PRD Phase Execution cardinal", domain: "operations" },
    path: toLtreePath("company", "cardinals", "smoke_test"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Cardinal",
    name: "CARDINAL-sdk7-upgrade-banned",
    description: "NEVER upgrade to AI SDK 7 canary — Strategy C locked. Neptune Chat and V2 stay on AI SDK 6.x with gateway routing. Cherry-pick critical fixes from v7 but do NOT upgrade the SDK version.",
    properties: { rule_id: "mission-5", source: "Master PRD Phase Execution cardinal", domain: "engineering" },
    path: toLtreePath("company", "cardinals", "sdk7_banned"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 12 Misc Business Entities ───────────────────────────────────────────
  {
    type: "Concept",
    name: "Misc-BankingPartners",
    description: "NewLeaf banking relationships: NMI (payment processor), merchant accounts for credit card processing. Hyperswitch for routing layer. All funds flow through NMI → merchant bank → NewLeaf operating account.",
    properties: { category: "banking", entities: ["NMI", "Hyperswitch", "Merchant account"] },
    path: toLtreePath("company", "misc", "banking"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-FCRACompliance",
    description: "FCRA (Fair Credit Reporting Act) compliance: 30-day statutory window for dispute responses from credit bureaus. 45-day window if consumer provides additional information. Must track dispute round timing, responses, and outcomes. Compliance audit trail maintained in Base44 DisputeRound entity.",
    properties: { category: "compliance", statute: "FCRA", windows: ["30-day (standard)", "45-day (with additional info)"], entity: "Base44 DisputeRound" },
    path: toLtreePath("company", "misc", "fcra_compliance"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-CustomerSegments",
    description: "Customer segments: (1) Credit repair — primary, individuals with negative credit items seeking removal; (2) Credit building — secondary, establishing positive credit history; (3) Hybrid — both repair + building. Segments tracked via Base44 CustomerProfile + CreditReport entities.",
    properties: { category: "customers", segments: ["Credit repair (primary)", "Credit building (secondary)", "Hybrid (both)"], entity: "Base44 CustomerProfile" },
    path: toLtreePath("company", "misc", "customer_segments"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-AgentWorkflow",
    description: "Agent daily workflow: Morning pulse report (reportingHub.morning_pulse) → Slack submission review → CRM verification → Payment processing → Support ticket triage → Dispute tracking. Hermes agents handle automated tasks; human agents handle escalations.",
    properties: { category: "operations", daily_tasks: ["Morning pulse", "Slack review", "CRM sync", "Payment processing", "Ticket triage", "Dispute tracking"] },
    path: toLtreePath("company", "misc", "agent_workflow"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-SlackOps",
    description: "Slack operations: #jarvis-admin (C0AQDDC3HAB) for agent comms and landing posts. Slack submissions from sales team create CRM profiles. Slack threads for customer inquiries, payment issues, card updates. Slack MCP bridge for programmatic posting/reading.",
    properties: { category: "communications", channel: "#jarvis-admin (C0AQDDC3HAB)", uses: ["Agent landing posts", "Sales submissions", "Customer inquiries", "Payment alerts"] },
    path: toLtreePath("company", "misc", "slack_ops"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-VAPICalls",
    description: "VAPI (Voice API) — Automated outbound calls for lead qualification and customer follow-up. VAPI call events stored in Base44 VapiCallEvent entity. Transfers to human agents when customer requests. Integrated via VAPI connector in Neptune Chat.",
    properties: { category: "communications", provider: "VAPI", entity: "VapiCallEvent", uses: ["Lead qualification", "Customer follow-up", "Agent transfer"] },
    path: toLtreePath("company", "misc", "vapi_calls"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-EmailSMS",
    description: "Customer communications via Email (EmailTemplate entity, Phase 14/15) and SMS (Twilio/SMS message logs). Educational content seeded from EmailTemplate + LetterTemplate + cortex playbooks for portal v3. Payment reminders sent 3 days before charges.",
    properties: { category: "communications", channels: ["Email (EmailTemplate)", "SMS (Twilio)"], cadence: "Payment reminders: 3 days before charge" },
    path: toLtreePath("company", "misc", "email_sms"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-DataWarehouse",
    description: "newleaf_360.db — SQLite warehouse with 22 tables, 50K+ records. Contains historical: Slack messages, SMS, emails, NMI transactions, payment logs, support tickets, recovery items, agent calls, credit reports. Queryable via query_warehouse tool.",
    properties: { category: "data", database: "newleaf_360.db", tables: 22, records: "50K+", tool: "query_warehouse" },
    path: toLtreePath("company", "misc", "data_warehouse"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-RecoveryOS",
    description: "Customer Portal v3 'Recovery OS' — P0 north star. 3-phase build: Foundation (Weeks 1-3, billing self-serve + agent god mode), Journey Engine (Weeks 4-6, onboarding + lifecycle automations), Intelligence Layer (Weeks 7-10, AI Instant Help + engagement scoring). Addresses top 6 pain patterns from 60-day Slack audit.",
    properties: { category: "product", initiative: "Customer Portal v3 / Recovery OS", phases: 3, timeline: "10 weeks", pain_patterns: ["card-verify failures (25%)", "reschedule requests (30%)", "card-update Slack handoffs", "duplicate charges", "recoverable cancellations", "fragmented comms"] },
    path: toLtreePath("company", "misc", "recovery_os"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-Base44Entities",
    description: "Base44 entity catalog for NewLeaf: CustomerProfile, PaymentLog, SupportTicket, CreditReport, NegativeItem, DisputeRound, AgreementSignature, ChangeLog, CustomerDocument, CallLog, VapiCallEvent, AdminNotification, EmailTemplate, LetterTemplate, NmiTransaction, PaymentLog, RecoveryItem, SlackSubmission, Subscription, BillingQueue, EngagementScore, OnboardingChecklist, HardshipRequest, CreditorCallReport.",
    properties: { category: "data", platform: "Base44", entity_count: 24, primary_entities: ["CustomerProfile", "PaymentLog", "SupportTicket", "DisputeRound"] },
    path: toLtreePath("company", "misc", "base44_entities"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-PlaybookDomains",
    description: "12 playbook domains in Neptune Chat: billing (P0), customer-support (P0), disputes (P0), planning-research (P0), agent-orchestration (P1), deploy-vercel-github (P1), engineering (P1), reporting (P1), vercel-discipline (P1), vps-ops (P1), marketing (P2), HR (P2). Each has playbook-<domain>.md + routines.json + skills.json + workflows/.",
    properties: { category: "knowledge", platform: "Neptune Chat", domain_count: 12, p0_domains: ["billing", "customer-support", "disputes", "planning-research"] },
    path: toLtreePath("company", "misc", "playbook_domains"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Misc-AgentTeam",
    description: "NewLeaf agent team: Jarvis-Base44 (primary operations, Base44 CRM), Jarvis-Hermes (VPS operations, cortex skills), Neptune Chat (daily driver AI), Neptune V2 (coding agent), Base44 agent (portal builder). Each agent specialized per domain with bounded tool access.",
    properties: { category: "people", agents: ["Jarvis-Base44", "Jarvis-Hermes", "Neptune Chat", "Neptune V2", "Base44 agent"], routing: "Domain → Playbook → Agent" },
    path: toLtreePath("company", "misc", "agent_team"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4b: 30 PRODUCT KNOWLEDGE ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

const PRODUCT_KNOWLEDGE: EntityInsert[] = [
  // ── 5 Repos ─────────────────────────────────────────────────────────────
  {
    type: "Concept",
    name: "Repo-NeptuneChat",
    description: "neptune-chat — Daily driver AI agent. Next.js 16.2 + AI SDK 6.0.116 + shadcn/ui. Vercel project prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl. Deployed at neptune-chat-ashy.vercel.app. Repo: github.com/abhiswami2121/neptune-chat. Features: streaming chat, 9 models via Gateway, KG wiki, playbook system, 16 connectors, artifact editing.",
    properties: {
      repo: "github.com/abhiswami2121/neptune-chat",
      path: "/home/neptune/neptune-chat",
      framework: "Next.js 16.2",
      ai_sdk: "6.0.116",
      vercel_project: "prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl",
      url: "https://neptune-chat-ashy.vercel.app",
    },
    path: toLtreePath("product", "repos", "neptune_chat"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Repo-NeptuneV2",
    description: "neptune-v2 — Long-form coding agent. Next.js + AI SDK 6.0.194 + Workflow SDK 5.0.0-beta.5. Vercel project prj_lEoqz6p4zgdrLlObPl845TI2ApOm. Deployed at neptune-v2.vercel.app. Repo: github.com/abhiswami2121/neptune-v2. Features: sandbox SDK, session-first chat, GitHub PR generation, Vercel deploy endpoint, multi-model gateway.",
    properties: {
      repo: "github.com/abhiswami2121/neptune-v2",
      path: "/home/neptune/neptune-v2",
      framework: "Next.js App Router",
      ai_sdk: "6.0.194",
      workflow_sdk: "5.0.0-beta.5",
      vercel_project: "prj_lEoqz6p4zgdrLlObPl845TI2ApOm",
      url: "https://neptune-v2.vercel.app",
    },
    path: toLtreePath("product", "repos", "neptune_v2"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Repo-HermesRuntime",
    description: "claude-agent-api — Hermes V5 master agent runtime on Hostinger VPS (187.127.250.171:8102). Claude Agent SDK based. 10-domain architecture. Cortex skills, agent memory, Jarvis File System. Self-healing refinement cron at 02:57 UTC daily. Serves as brain for Neptune Chat (wiki API, playbook API, agent bridge).",
    properties: {
      repo: "Internal (VPS)",
      path: "/home/hermes/claude-agent-api",
      runtime: "Claude Agent SDK",
      host: "Hostinger VPS (187.127.250.171)",
      port: 8102,
      architecture: "V5 Domain-Driven Skill Architecture",
      domains: 10,
      self_improve_loop: "Active (3x/day)",
    },
    path: toLtreePath("product", "repos", "hermes_runtime"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Repo-JarvisOSClean",
    description: "jarvis-os-clean — SHELVED. Former Next.js Vercel project for Jarvis OS (assistant-ui based: Canvas, Artifact components). Was bootstrapped from hermes-v3-template. ALL features merged into neptune-chat. Do NOT revive without explicit permission.",
    properties: {
      repo: "github.com/abhiswami2121/jarvis-os-clean",
      status: "SHELVED",
      note: "Features merged into neptune-chat. Do not revive.",
    },
    path: toLtreePath("product", "repos", "jarvis_os_clean"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Repo-NeptuneUI",
    description: "neptune-ui — TEST environment. Used for UI experimentation and component testing before promotion to neptune-chat. Has separate Supabase Postgres. DO NOT deploy to production from this repo.",
    properties: {
      repo: "github.com/abhiswami2121/neptune-ui",
      status: "TEST",
      path: "/home/neptune/neptune-ui",
      note: "Test environment only. Do not deploy to production.",
    },
    path: toLtreePath("product", "repos", "neptune_ui"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 5 Vercel Projects ───────────────────────────────────────────────────
  {
    type: "Concept",
    name: "Vercel-NeptuneChat",
    description: "Neptune Chat Vercel project: prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl, team team_NXlYvSlpN5mMinKXi0emQkFT. Next.js 16.2 framework. Domains: neptune-chat.vercel.app, neptune-chat-ashy.vercel.app. Cron: annotations digest weekly (Mon 12:00 UTC), knowledge extract nightly (03:00 UTC).",
    properties: {
      project_id: "prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl",
      team_id: "team_NXlYvSlpN5mMinKXi0emQkFT",
      framework: "nextjs",
      domains: ["neptune-chat.vercel.app", "neptune-chat-ashy.vercel.app"],
      crons: ["annotations digest (Mon 12:00)", "knowledge extract (daily 03:00)"],
    },
    path: toLtreePath("product", "vercel", "neptune_chat"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Vercel-NeptuneV2",
    description: "Neptune V2 Vercel project: prj_lEoqz6p4zgdrLlObPl845TI2ApOm / prj_ToGOYRDOvnljHtaKk0M1p8IBOvKf (dual project IDs from env). Team team_NXlYvSlpN5mMinKXi0emQkFT. Deployed at neptune-v2.vercel.app. Phase A landed (session-first chat). Phase D pending (vibe-code + Ship It).",
    properties: {
      project_ids: ["prj_lEoqz6p4zgdrLlObPl845TI2ApOm", "prj_ToGOYRDOvnljHtaKk0M1p8IBOvKf"],
      team_id: "team_NXlYvSlpN5mMinKXi0emQkFT",
      url: "https://neptune-v2.vercel.app",
      phase: "Phase A complete, Phase D pending",
    },
    path: toLtreePath("product", "vercel", "neptune_v2"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Vercel-JarvisOSClean",
    description: "jarvis-os-clean Vercel project — SHELVED. Was a standalone Next.js assistant-ui app. Decommissioned; features merged into neptune-chat. Do NOT deploy or modify.",
    properties: {
      project_id: "SHELVED",
      status: "Decommissioned",
      note: "Features merged into neptune-chat.",
    },
    path: toLtreePath("product", "vercel", "jarvis_os_clean"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Vercel-NewleafPay",
    description: "newleaf-pay Vercel project — Hyperswitch payment gateway frontend at pay.newleaf.financial. Serves NMI Collect.js integration for card capture. Hyperswitch publishable key for client-side tokenization. Separate from neptune-chat and neptune-v2.",
    properties: {
      url: "https://pay.newleaf.financial",
      gateway: "Hyperswitch + NMI Collect.js",
      tokenization: "Client-side (Hyperswitch publishable key)",
    },
    path: toLtreePath("product", "vercel", "newleaf_pay"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "Vercel-NeptuneUI",
    description: "neptune-ui Vercel project — TEST only. Used for UI component testing. Has separate Supabase Postgres. Do NOT deploy to production.",
    properties: {
      status: "TEST",
      note: "UI component testing only. Separate Supabase.",
    },
    path: toLtreePath("product", "vercel", "neptune_ui"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 4 Production URLs ───────────────────────────────────────────────────
  {
    type: "Concept",
    name: "URL-NeptuneChat",
    description: "https://neptune-chat-ashy.vercel.app — Production URL for Neptune Chat (daily driver AI agent). Primary user-facing chat interface. Accessible to Abhi via Clerk authentication. Connects to Hermes VPS brain via claudeAgentBridge for wiki/playbook/agent operations.",
    properties: { url: "https://neptune-chat-ashy.vercel.app", auth: "Clerk", project: "neptune-chat", purpose: "Daily driver AI agent" },
    path: toLtreePath("product", "urls", "chat"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "URL-NeptuneV2",
    description: "https://neptune-v2.vercel.app — Production URL for Neptune V2 (long-form coding agent). Session-first chat with sandbox SDK, GitHub PR generation, and Vercel deploy capabilities. Phase D will add 'Ship It' button for one-click code-to-deploy.",
    properties: { url: "https://neptune-v2.vercel.app", auth: "Better Auth / Vercel OAuth", project: "neptune-v2", purpose: "Long-form coding agent" },
    path: toLtreePath("product", "urls", "v2"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "URL-PayNewleaf",
    description: "https://pay.newleaf.financial — Production URL for NewLeaf payment gateway. Hyperswitch-powered, NMI-backed. Card capture via Collect.js with DPAN tokenization. Serves both new enrollments (Day-0 CIT) and card updates (recovery wizard).",
    properties: { url: "https://pay.newleaf.financial", platform: "Hyperswitch + NMI", purpose: "Payment gateway / card capture" },
    path: toLtreePath("product", "urls", "pay"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "URL-PortalNewleaf",
    description: "https://portal.newleaf.financial — Production URL for customer-facing portal. Base44 native pages (app 692f9a5fce9fd7c889a4b4ac). V3 Liquid Glass design. Features: billing self-serve, support/docs hub, onboarding, creditor call tools, hardship requests.",
    properties: { url: "https://portal.newleaf.financial", platform: "Base44", version: "v3 (June 2026)", purpose: "Customer self-service portal" },
    path: toLtreePath("product", "urls", "portal"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 4 GitHub Repo IDs + Ownership ───────────────────────────────────────
  {
    type: "Concept",
    name: "GitHub-Org",
    description: "GitHub organization: abhiswami2121. Primary repos: neptune-chat, neptune-v2, newleaf-financial (Base44), jarvis-os-clean (SHELVED), neptune-ui (TEST), playbook-os, neptune-core. GitHub token: classic PAT with repo scope (server-side only, never expose).",
    properties: {
      owner: "abhiswami2121",
      email: "abhiswami2121@gmail.com",
      primary_repos: ["neptune-chat", "neptune-v2", "newleaf-financial", "playbook-os", "neptune-core"],
      token_type: "Classic PAT (repo scope)",
    },
    path: toLtreePath("product", "github", "org"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "GitHub-NeptuneChat",
    description: "Repo: github.com/abhiswami2121/neptune-chat. Primary repo for Neptune Chat (daily driver). Local: /home/neptune/neptune-chat. Branch: main. Commit author: abhiswami2121@gmail.com. Has uncommitted changes staged from U8/U9 work.",
    properties: { repo: "abhiswami2121/neptune-chat", local: "/home/neptune/neptune-chat", branch: "main" },
    path: toLtreePath("product", "github", "neptune_chat"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "GitHub-NeptuneV2",
    description: "Repo: github.com/abhiswami2121/neptune-v2. Primary repo for Neptune V2 (coding agent). Local: /home/neptune/neptune-v2. Branch: main. Clean state (commit 730e70e). Phase A landed.",
    properties: { repo: "abhiswami2121/neptune-v2", local: "/home/neptune/neptune-v2", branch: "main", last_commit: "730e70e" },
    path: toLtreePath("product", "github", "neptune_v2"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "GitHub-NewleafFinancial",
    description: "Repo: github.com/abhiswami2121/newleaf-financial. Base44 backend app. Contains Base44 configurations, entity definitions, functions, and business logic. NOT the same as neptune repos. Managed separately by Base44 platform.",
    properties: { repo: "abhiswami2121/newleaf-financial", type: "Base44 backend", note: "Separate from Neptune repos" },
    path: toLtreePath("product", "github", "newleaf_financial"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },

  // ── 12 Env Var Canonicals ────────────────────────────────────────────────
  {
    type: "Concept",
    name: "ENV-AI-Gateway",
    description: "AI_GATEWAY_API_KEY — Primary API key for AI model routing. Format: vck_*. Routes to OpenAI-compatible gateway for DeepSeek, Anthropic, OpenAI, xAI, Google models. Used by Neptune Chat and V2 for all LLM calls.",
    properties: { env_var: "AI_GATEWAY_API_KEY", format: "vck_*", scope: "Neptune Chat + V2", purpose: "AI model routing gateway" },
    path: toLtreePath("product", "env_vars", "ai_gateway"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-Clerk",
    description: "CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY — Authentication for Neptune Chat. Clerk manages user sessions, sign-in, and access control. NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY exposed to client; CLERK_SECRET_KEY server-only.",
    properties: { env_vars: ["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"], scope: "Neptune Chat", purpose: "Authentication (Clerk)" },
    path: toLtreePath("product", "env_vars", "clerk"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-GitHubToken",
    description: "GITHUB_TOKEN — Classic personal access token with repo scope. Used for GitHub API operations: PRs, commits, repo management, code search. Server-side only. Format: ghp_* (never commit actual token).",
    properties: { env_var: "GITHUB_TOKEN", format: "ghp_*", scope: "Neptune Chat + V2 + Hermes VPS", purpose: "GitHub API operations" },
    path: toLtreePath("product", "env_vars", "github_token"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-NeptuneTestToken",
    description: "NEPTUNE_TEST_TOKEN — Shared handoff secret between Neptune Chat and V2. Used for /api/v2-bridge authentication. Also used as HERMES_KEY for VPS agent bridge calls. Format: 64-char hex.",
    properties: { env_var: "NEPTUNE_TEST_TOKEN", format: "64-char hex", scope: "Neptune Chat + V2 handoff", also_used_as: "HERMES_KEY" },
    path: toLtreePath("product", "env_vars", "neptune_test_token"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-VercelToken",
    description: "VERCEL_TOKEN — Vercel API token with full project admin access. Used for deployments, env var management, project config. Server-side ONLY — NEVER expose to client. Format: vcp_* (never commit actual token).",
    properties: { env_var: "VERCEL_TOKEN", format: "vcp_*", scope: "Neptune Chat + V2 + Hermes VPS", purpose: "Vercel REST API operations", critical: "NEVER expose to client" },
    path: toLtreePath("product", "env_vars", "vercel_token"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-PostgresURL",
    description: "POSTGRES_URL — Supabase Postgres connection string (pooler endpoint at aws-1-us-west-2.pooler.supabase.com:6543). Shared across Neptune Chat + V2. Stores: KG entities, relations, raw logs, sessions, artifacts. Has pgvector + ltree extensions.",
    properties: { env_var: "POSTGRES_URL", provider: "Supabase", endpoint: "aws-1-us-west-2.pooler.supabase.com:6543", extensions: ["pgvector", "ltree"], scope: "Neptune Chat + V2" },
    path: toLtreePath("product", "env_vars", "postgres_url"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-NMISecurityKey",
    description: "NMI_SECURITY_KEY — NMI payment gateway API key. Used for vault operations, charges, refunds, subscription management via nmiMcpBridge. Server-side only. Card auth requires card_auth=1 + dup_seconds=0 parameter.",
    properties: { env_var: "NMI_SECURITY_KEY", scope: "Neptune Chat + Hermes VPS", purpose: "NMI payment gateway operations", parameter: "card_auth=1 + dup_seconds=0" },
    path: toLtreePath("product", "env_vars", "nmi_security_key"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-SlackBotToken",
    description: "SLACK_BOT_TOKEN — Slack bot token (xoxb-*) for #jarvis-admin workspace. Used for posting messages, reading channel history, reactions via slackMcpBridge. Scope: chat:write, channels:history, reactions:write.",
    properties: { env_var: "SLACK_BOT_TOKEN", format: "xoxb-*", scope: "Neptune Chat + Hermes VPS", purpose: "Slack messaging and automation" },
    path: toLtreePath("product", "env_vars", "slack_bot_token"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-HyperswitchAPI",
    description: "HYPERSWITCH_API_KEY + HYPERSWITCH_API_KEY_ID + HYPERSWITCH_MERCHANT_ID + HYPERSWITCH_PROFILE_ID + HYPERSWITCH_PUBLISHABLE_KEY — Hyperswitch payment routing configuration. Admin API key for server-side; publishable key for client-side tokenization. Webhook secret for payment event callbacks.",
    properties: { env_vars: ["HYPERSWITCH_API_KEY", "HYPERSWITCH_API_KEY_ID", "HYPERSWITCH_MERCHANT_ID", "HYPERSWITCH_PROFILE_ID", "HYPERSWITCH_PUBLISHABLE_KEY", "HYPERSWITCH_WEBHOOK_SECRET"], scope: "pay.newleaf.financial", purpose: "Payment routing + tokenization" },
    path: toLtreePath("product", "env_vars", "hyperswitch"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-Base44API",
    description: "BASE44_API_KEY + BASE44_APP_API_KEY + BASE44_API_HOST + BASE44_APP_ID — Base44 CRM connection. Used for entity CRUD, customer queries, function invocations. App ID: 692f9a5fce9fd7c889a4b4ac (NewLeaf Financial). Functions URL for VPS bridge.",
    properties: { env_vars: ["BASE44_API_KEY", "BASE44_APP_API_KEY", "BASE44_API_HOST", "BASE44_APP_ID", "BASE44_FUNCTIONS_URL", "BASE44_VPS_API_URL"], scope: "Neptune Chat + Hermes VPS", purpose: "Base44 CRM operations", app_id: "692f9a5fce9fd7c889a4b4ac" },
    path: toLtreePath("product", "env_vars", "base44"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-LinearAPI",
    description: "LINEAR_API_KEY + LINEAR_MCP_URL — Linear project management integration. API key for GraphQL operations. MCP URL for direct Linear API access. Used for task tracking, issue management, and project planning.",
    properties: { env_vars: ["LINEAR_API_KEY", "LINEAR_MCP_URL"], scope: "Neptune Chat", purpose: "Project management (Linear)" },
    path: toLtreePath("product", "env_vars", "linear"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Concept",
    name: "ENV-N8N",
    description: "N8N_API_KEY + N8N_BASIC_PASS + N8N_ENCRYPTION_KEY + N8N_POSTGRES_PASS + N8N_USER_PASS — n8n workflow automation platform. Used for automated business workflows, webhook triggers, and integration pipelines. Self-hosted on VPS.",
    properties: { env_vars: ["N8N_API_KEY", "N8N_BASIC_PASS", "N8N_ENCRYPTION_KEY", "N8N_POSTGRES_PASS", "N8N_USER_PASS"], scope: "VPS (self-hosted n8n)", purpose: "Workflow automation" },
    path: toLtreePath("product", "env_vars", "n8n"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4c: 14 CONNECTOR KNOWLEDGE ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

const CONNECTOR_KNOWLEDGE: EntityInsert[] = [
  {
    type: "Connector",
    name: "base44",
    description: "Base44 CRM connector — Customer profiles, payment logs, support tickets, dispute rounds, NMI transactions, call logs, entity CRUD. The PRIMARY operational connector. Used for: customer 360 lookups, payment verification, ticket triage, entity queries, function invocations. Anti-patterns: Do NOT use b44_query without b44_count first (pagination awareness). Do NOT use hostingerBridge from VPS — you ARE the VPS.",
    properties: {
      connector_type: "CRM",
      primary_use: "Customer operations, entity CRUD, function execution",
      common_calls: ["b44_customer_360", "b44_query", "b44_get", "b44_create", "b44_update", "b44_invoke", "cross_system_lookup"],
      anti_patterns: ["Using b44_query without b44_count first", "Calling hostingerBridge from VPS (use native tools)"],
      related_skills: ["base44-customer-query", "base44-mcp-edit", "base44-entity-crud"],
      source: "connectors/base44/",
    },
    path: toLtreePath("connectors", "base44"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "hyperswitch",
    description: "Hyperswitch payment routing connector — Multi-gateway payment orchestration layer. Routes payments through NMI and other processors. Used for: creating payment sessions, webhook handling, payment method tokenization, merchant configuration. Anti-patterns: Do NOT use for direct card vaulting (use NMI for that). Do NOT expose API keys to client (use publishable key only).",
    properties: {
      connector_type: "Payment Routing",
      primary_use: "Payment orchestration, gateway routing, webhook processing",
      common_calls: ["Create payment session", "Process webhook", "Tokenize payment method", "Merchant config"],
      anti_patterns: ["Using for direct card vaulting (use NMI)", "Exposing API keys to client"],
      related_skills: ["hyperswitch-payment-routing", "hyperswitch-webhook"],
      source: "connectors/hyperswitch/",
    },
    path: toLtreePath("connectors", "hyperswitch"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "nmi",
    description: "NMI Payment Gateway connector — PRIMARY billing processor. Customer Vault for DPAN tokenization, CIT/MIT transactions, subscription management, Collect.js card capture. Used for: charging customers, vault CRUD, subscription lifecycle, transaction queries, recovery wizard billing links. Anti-patterns: BANNED source_transaction_id. BANNED charging without Day-0 CIT consent. ALWAYS include card_auth=1 + dup_seconds=0 in validate calls.",
    properties: {
      connector_type: "Payment Gateway",
      primary_use: "Card vaulting, recurring charges, subscription management",
      common_calls: ["vault_create", "vault_update", "charge", "refund", "void", "subscription_create", "subscription_cancel", "transaction_query", "customer_vault_query"],
      anti_patterns: ["source_transaction_id (BANNED)", "Charging without CIT consent", "Missing card_auth=1 + dup_seconds=0"],
      related_skills: ["nmi-golden-vault", "nmi-cvv-225-fix", "nmi-smart-retry"],
      source: "connectors/nmi/",
    },
    path: toLtreePath("connectors", "nmi"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "slack",
    description: "Slack API connector — Messaging, channel management, and automation. Primary channel: #jarvis-admin (C0AQDDC3HAB). Used for: posting agent landing notifications, reading channel history, thread management, reactions, user info lookup. Anti-patterns: NEVER post to #newleaf-admin. Do NOT spam — batch notifications. Use slackMcpBridge for all Slack operations.",
    properties: {
      connector_type: "Communications",
      primary_use: "Agent notifications, sales submission processing, customer inquiry routing",
      common_calls: ["post_message", "post_thread", "get_channel_history", "get_user_info", "react"],
      anti_patterns: ["Posting to #newleaf-admin (use #jarvis-admin only)", "Spamming notifications", "Bypassing slackMcpBridge"],
      related_skills: ["slack-delivery", "slack-notifications"],
      primary_channel: "#jarvis-admin (C0AQDDC3HAB)",
      source: "connectors/slack/",
    },
    path: toLtreePath("connectors", "slack"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "github",
    description: "GitHub API connector — Repository management, PRs, code search. Used for: creating PRs, reading repository files, searching code, listing directories, creating commits, managing branches. Anti-patterns: NEVER force push to main. NEVER skip hooks (--no-verify). NEVER amend commits when pre-commit hooks fail — create NEW commit instead.",
    properties: {
      connector_type: "DevTools",
      primary_use: "Repository management, PR creation, code search",
      common_calls: ["github_read", "github_search", "github_list_dir", "github_context", "Create PR", "Create commit"],
      anti_patterns: ["Force pushing to main", "Skipping hooks (--no-verify)", "Amending commits after hook failure"],
      related_skills: ["github-pr-branch", "github-code-review"],
      source: "connectors/github/",
    },
    path: toLtreePath("connectors", "github"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "vercel",
    description: "Vercel Platform connector — Deployments, environment variables, project management, domains. Used for: deploying Next.js apps, managing env vars, checking deploy status, adding domains. Anti-patterns: vercel CLI is BANNED (silent empty bug). Use REST API only. NEVER expose VERCEL_TOKEN to client. ALWAYS verify deploy READY before marking complete.",
    properties: {
      connector_type: "Hosting",
      primary_use: "Application deployments, environment management, domain configuration",
      common_calls: ["Create deployment", "List deployments", "Get project", "Set env vars", "Check deploy status"],
      anti_patterns: ["Using vercel CLI (BANNED — silent empty bug)", "Exposing VERCEL_TOKEN to client", "Not verifying deploy READY"],
      related_skills: ["vercel-deploy", "vercel-discipline"],
      projects: ["prj_bpG5ZHYNZ1wxAm7WDxr3MrBGoOBl (chat)", "prj_lEoqz6p4zgdrLlObPl845TI2ApOm (v2)"],
      source: "connectors/vercel/",
    },
    path: toLtreePath("connectors", "vercel"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "ghl",
    description: "GoHighLevel (GHL) connector — CRM and marketing automation. Used for: lead tracking, pipeline management, email campaigns, SMS automation, funnel building. Anti-patterns: GHL API key and location ID are currently placeholders — verify before use. Do NOT use GHL for payment processing.",
    properties: {
      connector_type: "CRM / Marketing",
      primary_use: "Lead tracking, marketing automation, funnel management",
      common_calls: ["Contact CRUD", "Pipeline stage update", "Email/SMS campaign trigger"],
      anti_patterns: ["Assuming API keys are configured (verify first)", "Using for payment processing"],
      related_skills: ["ghl-lead-tracking", "ghl-campaigns"],
      status: "PLACEHOLDER keys — verify before use",
      source: "connectors/ghl/",
    },
    path: toLtreePath("connectors", "ghl"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "vapi",
    description: "VAPI (Voice API) connector — Automated outbound/inbound phone calls. Used for: lead qualification calls, customer follow-up, payment reminders, agent warm transfers. VapiCallEvent entity in Base44 stores call transcripts and outcomes. Anti-patterns: Do NOT use for sensitive billing information collection over phone. Do NOT make calls outside business hours.",
    properties: {
      connector_type: "Voice / Telephony",
      primary_use: "Automated calls for lead qualification, follow-up, and reminders",
      common_calls: ["Initiate outbound call", "Check call status", "Retrieve transcript", "Transfer to agent"],
      anti_patterns: ["Collecting sensitive billing info via phone", "Calling outside business hours", "Not logging to VapiCallEvent"],
      related_skills: ["vapi-call-management", "vapi-lead-qualification"],
      source: "connectors/vapi/",
    },
    path: toLtreePath("connectors", "vapi"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "freshcaller",
    description: "Freshcaller (Freshworks) connector — Cloud-based call center software. Used for: inbound call routing, IVR, call queuing, agent assignment, call recording, voicemail. Integrates with Base44 for customer profile lookup during calls. Anti-patterns: Do NOT create duplicate tickets for calls already logged in Base44 VapiCallEvent. Sync call logs bidirectionally.",
    properties: {
      connector_type: "Call Center",
      primary_use: "Inbound call management, agent routing, call recording",
      common_calls: ["Create call log", "Retrieve recordings", "Agent assignment", "Queue status"],
      anti_patterns: ["Duplicate logging (already in VapiCallEvent)", "Not syncing with Base44"],
      related_skills: ["freshcaller-routing", "call-center-operations"],
      status: "PLANNED — connector directory not yet created in Neptune Chat",
      source: "lib/connectors/inventory.ts (planned)",
    },
    path: toLtreePath("connectors", "freshcaller"),
    confidence: 0.8,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "twilio",
    description: "Twilio connector — SMS, voice, and messaging APIs. Used for: sending payment reminders (3 days before charge), SMS notifications for customer updates, two-way messaging with customers, phone number management. SMS message logs stored in Base44 and newleaf_360.db warehouse. Anti-patterns: Do NOT send marketing SMS without opt-in. Do NOT use for bulk campaigns (use GHL instead).",
    properties: {
      connector_type: "Communications (SMS/Voice)",
      primary_use: "Transactional SMS, payment reminders, customer messaging",
      common_calls: ["Send SMS", "Send MMS", "Message status check", "Phone number lookup"],
      anti_patterns: ["Sending marketing SMS without opt-in", "Using for bulk campaigns (use GHL)", "Not logging to Base44 SMS records"],
      related_skills: ["twilio-sms", "payment-reminders"],
      status: "PLANNED — connector directory not yet created in Neptune Chat",
      source: "lib/connectors/inventory.ts (planned)",
    },
    path: toLtreePath("connectors", "twilio"),
    confidence: 0.8,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "linear",
    description: "Linear connector — Project management and issue tracking. Used for: creating/updating issues, sprint planning, project views, team workload tracking. GraphQL API at api.linear.app/graphql. Anti-patterns: Do NOT use Linear for customer support tickets (use Base44 SupportTicket). Do NOT expose LINEAR_API_KEY to client.",
    properties: {
      connector_type: "Project Management",
      primary_use: "Issue tracking, sprint planning, project management",
      common_calls: ["Create issue", "Update issue", "Query projects", "Assign team members", "View cycles"],
      anti_patterns: ["Using for customer support tickets (use Base44)", "Exposing API key to client"],
      related_skills: ["linear-project-tracking", "linear-sprint-planning"],
      source: "connectors/linear/",
    },
    path: toLtreePath("connectors", "linear"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "twenty",
    description: "Twenty CRM connector — Open-source CRM platform. Used for: contact management, deal tracking, task management, timeline views. Self-hosted on VPS with separate Postgres and Redis. Anti-patterns: Do NOT duplicate customer data between Twenty and Base44 — Base44 is source of truth. Twenty is supplementary/view layer.",
    properties: {
      connector_type: "CRM (Supplementary)",
      primary_use: "Contact management, deal tracking, visual pipelines",
      common_calls: ["Contact CRUD", "Company CRUD", "Deal tracking", "Task management"],
      anti_patterns: ["Duplicating customer data (Base44 is source of truth)", "Using as primary CRM"],
      related_skills: ["twenty-crm", "twenty-pipeline"],
      status: "PLANNED — connector directory not yet created in Neptune Chat",
      source: "lib/connectors/inventory.ts (planned)",
    },
    path: toLtreePath("connectors", "twenty"),
    confidence: 0.8,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "n8n",
    description: "n8n workflow automation connector — Self-hosted automation platform on VPS. Used for: automated business workflows, webhook triggers, multi-step integrations, scheduled jobs, data transformation pipelines. Connects Base44, Slack, NMI, and other systems. Anti-patterns: Do NOT use for real-time payment processing (latency). Do NOT store secrets in workflow definitions.",
    properties: {
      connector_type: "Workflow Automation",
      primary_use: "Business process automation, webhook handling, multi-system integration",
      common_calls: ["Trigger workflow", "Webhook receive", "Execute node", "Check execution status"],
      anti_patterns: ["Real-time payment processing (too slow)", "Storing secrets in workflow definitions", "Unmonitored long-running workflows"],
      related_skills: ["n8n-automation", "n8n-webhook"],
      status: "PLANNED — connector directory not yet created in Neptune Chat",
      source: "lib/connectors/inventory.ts (planned)",
    },
    path: toLtreePath("connectors", "n8n"),
    confidence: 0.8,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Connector",
    name: "langfuse",
    description: "Langfuse connector — LLM observability and tracing platform. Used for: monitoring AI agent calls, tracing LLM completions, cost tracking, quality evaluation, prompt versioning. Essential for debugging agent behavior and cost optimization. Anti-patterns: Do NOT log customer PII to Langfuse traces. Do NOT use as primary logging (use raw logs + KG instead).",
    properties: {
      connector_type: "Observability / AI Tracing",
      primary_use: "LLM call tracing, cost monitoring, quality evaluation",
      common_calls: ["Create trace", "Log generation", "Score evaluation", "Prompt management"],
      anti_patterns: ["Logging customer PII in traces", "Using as primary logging system"],
      related_skills: ["langfuse-tracing", "ai-cost-monitoring"],
      status: "PLANNED — connector directory not yet created in Neptune Chat",
      source: "lib/connectors/inventory.ts (planned)",
    },
    path: toLtreePath("connectors", "langfuse"),
    confidence: 0.8,
    provenance: SEED_PROVENANCE,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4d: 5 P0 PLAYBOOK ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

const PLAYBOOK_ENTITIES: EntityInsert[] = [
  {
    type: "Skill",
    name: "P0-Playbook-Billing-Recovery",
    description: `BILLING RECOVERY PLAYBOOK — P0 critical path for recovering failed/declined payments.

STEPS:
1. DETECT: Monitor PaymentLog for decline codes (insufficient_funds, do_not_honor, expired_card, velocity_limit, cvv_mismatch_225).
2. CLASSIFY: Soft decline (insufficient_funds, velocity_limit, temp_config_error) → Smart Retry Engine. Hard decline (do_not_honor, stolen_card, pick_up_card) → Agent intervention + payment_update_link.
3. SMART RETRY (soft): 15-minute scheduled job retries with exponential backoff. Max 3 attempts. Between attempts: send billing link via SMS/email.
4. RECOVERY WIZARD (hard): Generate NMI Collect.js billing link. Send to customer via Slack/SMS/email. Apply CVV 225 fix: card_auth=1 + dup_seconds=0 in validate. Single-click rapid-click cooldown (3s) on client.
5. AGENT INTERVENTION: If recovery wizard fails after 48h → create SupportTicket, notify #jarvis-admin, assign to agent.
6. RESOLVE: Payment succeeded → update PaymentLog, reset retry counter, update CRM status to billing_active. Payment failed permanently → mark cancelled, 48h cooldown, final status update.

CARDINALS:
- source_transaction_id BANNED — use customer_vault_id + DPAN
- Day-0 CIT must exist before any MIT charge
- card_auth=1 + dup_seconds=0 REQUIRED for all validate calls
- cofCompliant check before every vault operation
- Smart Retry max 3 attempts per billing cycle

ANTI-PATTERNS:
- Charging without verifying CIT consent
- Retrying hard declines (wasteful, triggers fraud alerts)
- Skipping cofCompliant check
- Using source_transaction_id instead of customer_vault_id`,
    properties: {
      priority: "P0",
      domain: "billing",
      steps: ["Detect decline", "Classify (soft vs hard)", "Smart Retry (soft)", "Recovery Wizard (hard)", "Agent intervention", "Resolve"],
      cardinal_count: 5,
      anti_pattern_count: 4,
      source: "playbooks/billing/playbook-billing.md + NMI Golden Vault Architecture + CVV 225 Fix playbook",
    },
    path: toLtreePath("playbooks", "billing_recovery"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Skill",
    name: "P0-Playbook-Support-Ticket-Handling",
    description: `SUPPORT TICKET HANDLING PLAYBOOK — P0 critical path for customer support operations.

STEPS:
1. INTAKE: Customer inquiry received via Slack, VAPI call, email, or portal. Identify customer via cross_system_lookup (identifier: email, phone, or customer_id).
2. TRIAGE: Classify severity — Critical (billing failure, chargeback risk, service disruption) → 4h SLA. High (dispute status, card update needed) → 12h SLA. Medium (general inquiry, document request) → 24h SLA. Low (information request, feedback) → 48h SLA.
3. CREATE TICKET: SupportTicket entity in Base44 with: customer_id, severity, category, description, assigned_agent, SLA deadline.
4. INVESTIGATE: Pull customer 360 dossier (cross_system_lookup). Check PaymentLog, NMI transactions, dispute rounds, call logs, Slack threads. Identify root cause.
5. RESOLVE: Apply fix (re-run payment, update card, reschedule, send document, clarify policy). Document resolution in ticket. Set status to resolved.
6. FOLLOW-UP: 48h cooldown monitoring. If no recurrence → close ticket. If recurrence → reopen with escalated priority.

CARDINALS:
- NEVER close a ticket without documented resolution
- Escalate chargeback risks to disputes playbook IMMEDIATELY
- 4h SLA for critical tickets is non-negotiable
- Always use cross_system_lookup for full context before responding

ANTI-PATTERNS:
- Responding without full customer context
- Closing tickets without root cause analysis
- Treating chargeback risks as standard billing inquiries
- Duplicate tickets for same issue (check existing first)`,
    properties: {
      priority: "P0",
      domain: "customer-support",
      steps: ["Intake", "Triage", "Create ticket", "Investigate", "Resolve", "Follow-up"],
      cardinal_count: 4,
      anti_pattern_count: 4,
      source: "playbooks/customer-support/playbook-customer-support.md + Base44 SupportTicket entity",
    },
    path: toLtreePath("playbooks", "support_ticket_handling"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Skill",
    name: "P0-Playbook-MCP-Edit-Execution",
    description: `MCP EDIT EXECUTION PLAYBOOK — P0 critical path for code changes via Base44 MCP bridge.

STEPS:
1. SCOPE: Confirm the edit target — which repo, which file, what change. Verify repo lock: cd <repo> && pwd && git remote -v.
2. PATTERN MATCH: Search for existing patterns in the codebase (query_code_graph) before writing new code. Match: function signatures, component patterns, file structure, naming conventions.
3. PLAN: Draft change plan. Verify against cardinal rules: no SDK7 upgrade, no vercel CLI, native tools only, no force push to main.
4. EXECUTE: Make the edit via Edit/Write tools (native). NEVER use mcp_edit as middleman for VPS-local edits. For Base44 entity edits: use entity_create/entity_update via MCP bridge. For GitHub: use github_direct or github_pr façade.
5. VERIFY: Type check (npx tsc --noEmit). Smoke test the change. Verify no regression in related code.
6. COMMIT: Single atomic commit with descriptive message. Author: abhiswami2121@gmail.com. NEVER skip hooks. NEVER amend after hook failure.
7. DEPLOY: If Vercel project: Vercel REST API deploy. Wait for READY state. Verify URL loads.

CARDINALS:
- REPO LOCK first action — verify working directory
- NATIVE TOOLS ONLY for VPS edits — never hostingerBridge from VPS
- Single atomic commit per change
- CI must pass after every commit
- Vercel REST API only — NEVER vercel CLI

ANTI-PATTERNS:
- Editing without repo lock verification
- Using mcp_edit for VPS-local file changes (use native Edit tool)
- Amending commits after hook failure
- Multi-repo changes in single commit
- Deploying without verifying READY state`,
    properties: {
      priority: "P0",
      domain: "mcp-edits",
      steps: ["Scope", "Pattern match", "Plan", "Execute", "Verify", "Commit", "Deploy"],
      cardinal_count: 5,
      anti_pattern_count: 5,
      source: "Hermes V5 mcp-edit-execution skill + Base44 Two-Lane Workflow + Jarvis Operating Rules",
    },
    path: toLtreePath("playbooks", "mcp_edit_execution"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Skill",
    name: "P0-Playbook-VPS-Mission-Dispatch",
    description: `VPS MISSION DISPATCH PLAYBOOK — P0 critical path for executing multi-step missions from the VPS (Hermes runtime).

STEPS:
1. LOAD MISSION: Read mission file from jarvis/cortex/missions/. Parse: budget (max turns), repo lock, allowed/forbidden paths, success criteria, cardinal rules, Slack target.
2. REPO LOCK: cd <target_repo> && pwd && git remote -v. Verify origin matches expected. NEVER proceed if repo mismatch.
3. PHASE BREAKDOWN: Decompose mission into numbered steps. Estimate tool budget per step. Set TodoWrite tracking.
4. EXECUTE: Run steps sequentially. Each step: verify prerequisite, execute actions, verify output. If any step fails cardinal rules → STOP, write findings, Slack to #jarvis-admin.
5. PROOF: Write completion proof JSON to /home/hermes/data/<mission_proof>.json. Include: entity counts, verification evidence, commit SHA, deploy status.
6. COMMIT: Single atomic commit per repo touched. Push to origin main.
7. DEPLOY: Vercel REST API deploy. Poll until READY.
8. LANDING: Post structured summary to Slack #jarvis-admin. Include: phase name, entity counts, verification results, commit SHA, next phase.

CARDINALS:
- Budget awareness: track tool calls, do not exceed budget
- If any step fails: STOP, write findings, Slack to Abhi — do NOT start next phase
- Slack #jarvis-admin ONLY — NEVER newleaf-admin
- Proof JSON mandatory before marking complete
- Single atomic commit per phase

ANTI-PATTERNS:
- Skipping repo lock verification
- Multi-phase dispatches (one mission at a time)
- Hallucinating entity data or system capabilities
- Finishing without proof JSON + Slack landing
- Continuing past failures without STOP protocol`,
    properties: {
      priority: "P0",
      domain: "vps-ops",
      steps: ["Load mission", "Repo lock", "Phase breakdown", "Execute", "Proof", "Commit", "Deploy", "Landing"],
      cardinal_count: 5,
      anti_pattern_count: 5,
      source: "This conversation's Phase execution pattern + Master PRD + Jarvis Operating Rules",
    },
    path: toLtreePath("playbooks", "vps_mission_dispatch"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
  {
    type: "Skill",
    name: "P0-Playbook-Codebase-Refactor",
    description: `CODEBASE REFACTOR PLAYBOOK — P0 critical path for systematic code refactoring across Neptune repos.

STEPS:
1. MAP: Run codebase mapper (query_code_graph) to understand current structure. Identify: duplicated code, dead code, inconsistent patterns, tech debt hotspots.
2. PLAN: Draft refactor plan with: affected files, expected diff size, risk assessment, rollback strategy. Get approval before touching production paths.
3. ISOLATE: Create feature branch from main. Work in isolated worktree if needed. Never refactor on main directly.
4. PATTERN ALIGNMENT: Match new code to closest existing analogs (PATTERNS.md). Follow existing naming conventions, file structure, component patterns. Use query_code_graph to find analogs.
5. INCREMENTAL: Refactor one module at a time. Commit each module separately with descriptive message. Run type check + lint after each.
6. VERIFY: Full type check (npx tsc --noEmit). Run existing tests. Manual smoke test affected flows. Check no regression.
7. REVIEW: Self-review diff. Check: no commented-out code left, no debug logs, no TODO markers without ticket refs, imports clean, no unused variables.
8. MERGE: Create PR. Verify CI passes. Merge to main. Clean up feature branch.
9. DEPLOY: Vercel deploy. Verify READY. Monitor for 15 minutes post-deploy.

CARDINALS:
- Never refactor on main — always feature branch
- One module per commit — traceable rollback
- Match existing patterns — query_code_graph first
- CI must pass after every commit
- Never skip hooks

ANTI-PATTERNS:
- Big-bang refactors touching 20+ files in one commit
- Refactoring without understanding existing patterns
- Leaving dead code or TODO markers
- Skipping smoke tests post-refactor
- Merging without CI green`,
    properties: {
      priority: "P0",
      domain: "engineering",
      steps: ["Map", "Plan", "Isolate", "Pattern align", "Incremental", "Verify", "Review", "Merge", "Deploy"],
      cardinal_count: 5,
      anti_pattern_count: 5,
      source: "Neptune Chat + V2 refactor patterns + Jarvis Operating Rules + Base44 Two-Lane Workflow",
    },
    path: toLtreePath("playbooks", "codebase_refactor"),
    confidence: 1.0,
    provenance: SEED_PROVENANCE,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function seedPhase4(dryRun = false) {
  console.log(`🧠 PHASE 4 KG SEED — Wiki Content Foundation ${dryRun ? "(DRY RUN)" : "(LIVE)"}\n`);
  console.log(`   Mission: KG-SEED-WIKI-CONTENT-2026-06-13`);
  console.log(`   Target: 100+ entities (50 company + 30 product + 14 connector + 5 playbook)\n`);

  const allEntities = [
    ...COMPANY_KNOWLEDGE,
    ...PRODUCT_KNOWLEDGE,
    ...CONNECTOR_KNOWLEDGE,
    ...PLAYBOOK_ENTITIES,
  ];

  const breakdown = {
    company: COMPANY_KNOWLEDGE.length,
    product: PRODUCT_KNOWLEDGE.length,
    connector: CONNECTOR_KNOWLEDGE.length,
    playbook: PLAYBOOK_ENTITIES.length,
  };

  console.log(`   Breakdown: ${breakdown.company} company + ${breakdown.product} product + ${breakdown.connector} connector + ${breakdown.playbook} playbook = ${allEntities.length} total\n`);

  if (dryRun) {
    console.log("── DRY RUN — Entity Summary ──");
    for (const cat of ["Company Knowledge", "Product Knowledge", "Connector Knowledge", "Playbook Knowledge"]) {
      let entities: EntityInsert[];
      if (cat === "Company Knowledge") entities = COMPANY_KNOWLEDGE;
      else if (cat === "Product Knowledge") entities = PRODUCT_KNOWLEDGE;
      else if (cat === "Connector Knowledge") entities = CONNECTOR_KNOWLEDGE;
      else entities = PLAYBOOK_ENTITIES;

      console.log(`\n  ${cat} (${entities.length}):`);
      for (const e of entities) {
        const desc = (e.description ?? "").slice(0, 80);
        console.log(`    📝 [${e.type}] ${e.name}: ${desc}...`);
      }
    }
    console.log(`\n  ✅ Dry run complete. ${allEntities.length} entities would be upserted.`);
    return { dryRun: true, total: allEntities.length, breakdown };
  }

  // ── LIVE MODE ──
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    console.error("❌ POSTGRES_URL not set — cannot seed KG");
    process.exit(1);
  }

  const sql = postgres(postgresUrl, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  console.log("── Schema Health Check ──");
  try {
    const extRows = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('vector', 'ltree')
    `;
    console.log(`  ✅ Extensions: [${extRows.map((r) => r.extname).join(", ")}]`);
  } catch (err) {
    console.error(`  ❌ Schema check failed: ${err}`);
    await sql.end();
    process.exit(1);
  }

  // Pre-count
  const [preCount] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM kg_entities
  `;
  console.log(`  Pre-seed entity count: ${preCount.count}\n`);

  // ── Seed each category ──
  const results = {
    company: { attempted: 0, upserted: 0, failed: 0 },
    product: { attempted: 0, upserted: 0, failed: 0 },
    connector: { attempted: 0, upserted: 0, failed: 0 },
    playbook: { attempted: 0, upserted: 0, failed: 0 },
  };

  for (const [category, entities] of [
    ["company", COMPANY_KNOWLEDGE] as const,
    ["product", PRODUCT_KNOWLEDGE] as const,
    ["connector", CONNECTOR_KNOWLEDGE] as const,
    ["playbook", PLAYBOOK_ENTITIES] as const,
  ]) {
    console.log(`── Seeding ${category} knowledge (${entities.length} entities) ──`);
    for (const entity of entities) {
      results[category].attempted++;
      try {
        await upsertEntityDirect(sql, entity);
        results[category].upserted++;
        console.log(`  ✅ [${entity.type}] ${entity.name}`);
      } catch (err) {
        results[category].failed++;
        console.error(`  ❌ [${entity.type}] ${entity.name}: ${err}`);
      }
    }
    console.log(`  → ${results[category].upserted} upserted, ${results[category].failed} failed\n`);
  }

  // Post-count
  const [postCount] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM kg_entities
  `;

  const typeBreakdown = await sql<{ type: string; count: string }[]>`
    SELECT type, COUNT(*)::text AS count
    FROM kg_entities
    GROUP BY type
    ORDER BY count DESC
  `;

  console.log("── Final KG Stats ──");
  console.log(`  Total entities: ${postCount.count}`);
  console.log("  By type:");
  for (const row of typeBreakdown) {
    console.log(`    ${row.type}: ${row.count}`);
  }

  const totalUpserted = Object.values(results).reduce((s, r) => s + r.upserted, 0);
  const totalFailed = Object.values(results).reduce((s, r) => s + r.failed, 0);
  const target = 99;
  const verdict = totalUpserted >= target ? "✅" : "⚠️";

  console.log(`\n  Phase 4 summary: ${totalUpserted} upserted, ${totalFailed} failed`);
  console.log(`  Target: ${target}+ entities ${verdict} (${totalUpserted})`);

  await sql.end();
  return { dryRun: false, total: totalUpserted, failed: totalFailed, breakdown: results, postCount: postCount.count };
}

seedPhase4(process.argv.includes("--dry-run"))
  .then((result) => {
    if (!result.dryRun && result.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
