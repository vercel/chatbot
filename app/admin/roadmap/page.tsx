/**
 * ROADMAP DASHBOARD — Server Component
 * Phase 34-50 Master Sprint Plan Visualization
 *
 * MEGA MASTER OKF ALIGNMENT: Stream 10 — Unified Roadmap Dashboard
 * Shows all 17 phases, risk register, timeline, and OKF compliance.
 */

import { RoadmapClient } from "./client";

// Phase definitions from MASTER-UNIFIED-SPRINT-PLAN-v1.0.md
export interface PhaseData {
  phase: number;
  name: string;
  duration: string;
  budget: number;
  priority: "P0" | "P1" | "P2";
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETE" | "PARTIAL";
  dependsOn: string;
  blocks: string;
  owner: string;
  objective: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  track: "Knowledge Layer" | "Twenty CRM" | "Platform" | "Ops" | "Mobile";
  weekStart: number;
  weekEnd: number;
  milestone: string;
}

export interface RiskData {
  id: string;
  risk: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  probability: "HIGH" | "MEDIUM" | "LOW";
  mitigation: string;
  phase: number;
}

export interface TimelineData {
  week: number;
  phases: number[];
  budget: number;
  status: "PLANNED" | "ACTIVE" | "COMPLETE";
}

export interface MilestoneData {
  id: string;
  name: string;
  week: number;
  celebration: string;
  status: "PENDING" | "ACHIEVED";
}

export interface OKFComplianceData {
  totalFiles: number;
  conformantFiles: number;
  missingIndexMd: number;
  missingLogMd: number;
  missingTypeField: number;
  exportValid: boolean;
  specPublished: boolean;
  visualizerLive: boolean;
}

const PHASES: PhaseData[] = [
  {
    phase: 34,
    name: "OKF Compatibility Pass",
    duration: "1 week",
    budget: 8000,
    priority: "P0",
    status: "COMPLETE",
    dependsOn: "Phase 33",
    blocks: "35, 36",
    owner: "hermes",
    objective: "Bring entire cortex/ into NKS v1.0 conformance.",
    deliverables: [
      "200+ updated files with frontmatter compliance",
      "50+ new index.md files",
      "15+ new log.md files",
      "OKF export bundle (validated)",
      "Static HTML visualizer",
    ],
    acceptanceCriteria: [
      "Every cortex directory has index.md",
      "Every domain has log.md",
      "All .md files have type field",
      "okf-export.ts produces valid OKF bundle",
      "okf-verify.ts passes with 0 errors",
      "Visualizer renders knowledge graph",
    ],
    track: "Knowledge Layer",
    weekStart: 1,
    weekEnd: 1,
    milestone: "M1",
  },
  {
    phase: 35,
    name: "Knowledge Visualizer",
    duration: "1 week",
    budget: 6000,
    priority: "P0",
    status: "COMPLETE",
    dependsOn: "Phase 34",
    blocks: "—",
    owner: "hermes",
    objective:
      "Build interactive knowledge graph visualization at /knowledge route.",
    deliverables: [
      "app/(harness)/knowledge/page.tsx",
      "components/knowledge/knowledge-graph.tsx",
      "components/knowledge/concept-card.tsx",
      "components/knowledge/search-bar.tsx",
      "components/knowledge/domain-filter.tsx",
      "components/knowledge/file-viewer.tsx",
      "lib/knowledge/parser.ts",
      "lib/knowledge/graph-builder.ts",
    ],
    acceptanceCriteria: [
      "/knowledge route loads within 3 seconds",
      "Graph renders with all cortex nodes",
      "Twin view toggle works",
      "Search returns results in <500ms",
      "Filters work independently and combined",
      "File viewer renders markdown with syntax highlighting",
      "OKF export button downloads valid bundle",
      "Mobile responsive (375px+)",
    ],
    track: "Knowledge Layer",
    weekStart: 2,
    weekEnd: 2,
    milestone: "M1",
  },
  {
    phase: 36,
    name: "NKS GitHub Release",
    duration: "1 week",
    budget: 5000,
    priority: "P0",
    status: "COMPLETE",
    dependsOn: "Phase 34, 35",
    blocks: "—",
    owner: "hermes",
    objective: "Open-source the NEPTUNE-KNOWLEDGE-SPEC as a standalone GitHub repo.",
    deliverables: [
      "github.com/abhiswami2121/neptune-knowledge-spec",
      "docs.neptune-knowledge-spec.vercel.app",
      "Blog post + Twitter thread",
      "3 sample bundles",
    ],
    acceptanceCriteria: [
      "Repo public with README",
      "Docs site live on Vercel",
      "Blog post published",
      "Twitter thread posted",
      "CONTRIBUTING.md clear",
      "Sample bundles validate against OKF",
    ],
    track: "Knowledge Layer",
    weekStart: 3,
    weekEnd: 3,
    milestone: "M1",
  },
  {
    phase: 37,
    name: "Twenty Wave 1: Lead + VAPI",
    duration: "2 weeks",
    budget: 10000,
    priority: "P0",
    status: "COMPLETE",
    dependsOn: "Phase 33",
    blocks: "38-42",
    owner: "hermes",
    objective: "Migrate lead management and VAPI call records to Twenty CRM.",
    deliverables: [
      "lead.field.ts (12 fields)",
      "vapi-call.field.ts (15 fields)",
      "Slack submission parser (n8n workflow)",
      "Bidirectional sync connector",
      "Migration script (50 customers)",
    ],
    acceptanceCriteria: [
      "lead object with all required fields deployed",
      "vapiCall object with transcript + outcome fields deployed",
      "Slack parser creates leads in Twenty <30s",
      "Bidirectional sync verified",
      "50 customers migrated with data integrity verified",
      "Lead pipeline kanban renders",
      "VAPI call log renders with transcript preview",
    ],
    track: "Twenty CRM",
    weekStart: 2,
    weekEnd: 3,
    milestone: "M2",
  },
  {
    phase: 38,
    name: "Twenty Wave 2: Sales Workflow",
    duration: "2 weeks",
    budget: 12000,
    priority: "P0",
    status: "IN_PROGRESS",
    dependsOn: "Phase 37",
    blocks: "Phase 42",
    owner: "hermes",
    objective: "Full sales pipeline in Twenty CRM with enrollment workflow.",
    deliverables: [
      "agreement.field.ts",
      "payment-method.field.ts",
      "Enrollment wizard component",
      "Agent Dashboard component",
      "Document generation service",
      "Quick Actions component",
    ],
    acceptanceCriteria: [
      "Sales Pipeline kanban drag-and-drop works",
      "Enrollment wizard completes in <8 steps",
      "Agent Dashboard loads in <1s",
      "Agreement generation produces valid PDF",
      "E-signature flow completes end-to-end",
      "All 169 enrolled customers migrated",
      "Agent leaderboard updates in real-time",
      "Quick Actions modal renders in <200ms",
    ],
    track: "Twenty CRM",
    weekStart: 3,
    weekEnd: 4,
    milestone: "M2",
  },
  {
    phase: 39,
    name: "Twenty Wave 3: Billing Migration",
    duration: "2 weeks",
    budget: 12000,
    priority: "P0",
    status: "PLANNED",
    dependsOn: "Phase 38",
    blocks: "Phase 42, 44",
    owner: "hermes",
    objective: "Full billing operations in Twenty CRM with NMI integration (SACRED).",
    deliverables: [
      "billing-recovery-task.field.ts",
      "payment-record.field.ts (refined)",
      "Billing Calendar component",
      "Recovery Campaign manager",
      "Payment Link Generator",
      "Card sync service",
      "Billing Dashboard",
    ],
    acceptanceCriteria: [
      "NMI vault NEVER modified by automated processes",
      "Billing Calendar renders all active subscriptions",
      "Recovery Campaign creates tasks for all declined payments",
      "Payment Link Generator produces valid NMI links",
      "Card sync updates within 60s of NMI webhook",
      "Subscription status syncs bidirectionally",
      "Decline recovery workflow retries up to 3 times",
      "Billing dashboard shows real-time MRR",
    ],
    track: "Twenty CRM",
    weekStart: 4,
    weekEnd: 5,
    milestone: "M3",
  },
  {
    phase: 40,
    name: "Twenty Wave 4: Disputes",
    duration: "2 weeks",
    budget: 10000,
    priority: "P0",
    status: "PLANNED",
    dependsOn: "Phase 38, 39",
    blocks: "Phase 42",
    owner: "hermes",
    objective: "Full credit dispute management in Twenty CRM.",
    deliverables: [
      "dispute-letter.field.ts (16 fields)",
      "negative-item.field.ts (14 fields)",
      "credit-report.field.ts (10 fields)",
      "Dispute Round pipeline component",
      "Letter Generator with templates",
      "Response Tracker",
      "Bureau Integration module",
    ],
    acceptanceCriteria: [
      "Dispute Round pipeline tracks all stages",
      "Letter Generator produces compliant letters (FCRA)",
      "Response Tracker shows bureau response timelines",
      "All 3 bureaus tracked per dispute",
      "Credit report parser extracts all negative items",
      "Dispute dashboard shows success rate by bureau",
      "FCRA compliance auto-flag works",
    ],
    track: "Twenty CRM",
    weekStart: 5,
    weekEnd: 6,
    milestone: "M4",
  },
  {
    phase: 41,
    name: "Twenty Wave 5: Support + Comms",
    duration: "2 weeks",
    budget: 10000,
    priority: "P0",
    status: "PLANNED",
    dependsOn: "Phase 38, 39",
    blocks: "Phase 42",
    owner: "hermes",
    objective:
      "Support ticket system and multi-channel communications in Twenty CRM.",
    deliverables: [
      "email-message.field.ts",
      "sms-message.field.ts",
      "call-log.field.ts",
      "Support Inbox component",
      "SLA enforcement service",
      "Customer 360 component",
      "Compose interface",
      "Support Analytics dashboard",
    ],
    acceptanceCriteria: [
      "Support Inbox shows all channels unified",
      "SLA breach triggers Slack alert to #jarvis-admin",
      "Customer 360 loads in <2s",
      "Compose interface sends email via Resend",
      "Compose interface sends SMS via GHL",
      "Communications timeline is chronological",
      "Support analytics dashboard functional",
    ],
    track: "Twenty CRM",
    weekStart: 6,
    weekEnd: 7,
    milestone: "M4",
  },
  {
    phase: 42,
    name: "Twenty Wave 6: Portal v2",
    duration: "3 weeks",
    budget: 15000,
    priority: "P0",
    status: "PLANNED",
    dependsOn: "Phases 38-41",
    blocks: "—",
    owner: "hermes",
    objective:
      "End-customer self-service portal reading Twenty CRM via GraphQL.",
    deliverables: [
      "Customer Portal Vercel app",
      "Account Home, Payments, Documents, Disputes, Messages, Profile pages",
      "Clerk ↔ Twenty auth bridge",
      "Mobile-responsive UI",
    ],
    acceptanceCriteria: [
      "Portal loads for authenticated customer",
      "Account Home shows accurate summary",
      "Payment history matches NMI records",
      "Document downloads work",
      "Dispute status matches Twenty data",
      "Message compose sends via Resend/GHL",
      "Clerk auth bridge to Twenty verified",
      "Mobile responsive passes Lighthouse audit",
      "WCAG 2.1 AA compliance",
    ],
    track: "Twenty CRM",
    weekStart: 8,
    weekEnd: 10,
    milestone: "M6",
  },
  {
    phase: 43,
    name: "V2 Coding Agent Maturation",
    duration: "2 weeks",
    budget: 12000,
    priority: "P0",
    status: "IN_PROGRESS",
    dependsOn: "Phase 34, Stream 9",
    blocks: "—",
    owner: "hermes",
    objective:
      "Production-grade V2 coding agent with knowledge graph integration.",
    deliverables: [
      "Swarm mode polisher",
      "MoA orchestrator",
      "Knowledge loader for V2",
      "Self-code module",
      "Analytics dashboard for coding agent",
    ],
    acceptanceCriteria: [
      "Swarm mode completes multi-file tasks",
      "MoA orchestration routes to correct sub-agent",
      "GitHub PR workflow works end-to-end",
      "Vercel deploy works for generated code",
      "Knowledge graph context loaded for every coding session",
      "Self-code writes back to cortex with git tracking",
      "Sandbox workspace survives agent restart",
      "Session resume works within 24h",
    ],
    track: "Platform",
    weekStart: 7,
    weekEnd: 8,
    milestone: "M5",
  },
  {
    phase: 44,
    name: "Reporting + Analytics",
    duration: "2 weeks",
    budget: 10000,
    priority: "P1",
    status: "PLANNED",
    dependsOn: "Phases 38-41",
    blocks: "—",
    owner: "hermes",
    objective: "Comprehensive reporting and analytics dashboards.",
    deliverables: [
      "MRR Dashboard",
      "Agent Leaderboard",
      "Pipeline Funnel",
      "Custom Report Builder",
      "Export to CSV/PDF",
      "Schedule Report delivery",
      "Sync Health Dashboard",
      "System Health Dashboard",
    ],
    acceptanceCriteria: [
      "MRR Dashboard updates daily",
      "Agent Leaderboard real-time",
      "Pipeline Funnel accurate",
      "Custom reports exportable",
      "Scheduled reports deliver on time",
      "Sync Health shows discrepancy count",
      "System Health shows 7-day trends",
    ],
    track: "Ops",
    weekStart: 10,
    weekEnd: 11,
    milestone: "M7",
  },
  {
    phase: 45,
    name: "VAPI Voice Agent",
    duration: "2 weeks",
    budget: 8000,
    priority: "P1",
    status: "PLANNED",
    dependsOn: "Phase 37",
    blocks: "—",
    owner: "hermes",
    objective: "Voice AI agent for outbound campaigns and inbound IVR.",
    deliverables: [
      "Outbound campaign manager",
      "Inbound IVR skill routing",
      "Call Analysis dashboard",
      "Call recording storage",
      "Campaign performance analytics",
      "DNC compliance",
    ],
    acceptanceCriteria: [
      "Outbound campaign sends calls to target list",
      "Inbound IVR routes to correct skill",
      "Call transcripts searchable",
      "DNC list enforced",
      "Campaign analytics show conversion rates",
    ],
    track: "Platform",
    weekStart: 11,
    weekEnd: 12,
    milestone: "M8",
  },
  {
    phase: 46,
    name: "Email + SMS Automation",
    duration: "1 week",
    budget: 6000,
    priority: "P1",
    status: "PLANNED",
    dependsOn: "Phase 41",
    blocks: "—",
    owner: "hermes",
    objective: "Automated email and SMS campaigns.",
    deliverables: [
      "Resend email integration",
      "Drip Sequence builder",
      "SMS automation triggers",
      "Email template library",
      "Campaign performance analytics",
    ],
    acceptanceCriteria: [
      "Transactional emails send within 30s",
      "Drip sequences trigger on enrollment",
      "SMS sends via GHL",
      "Template library accessible from Twenty",
      "Campaign analytics dashboard functional",
    ],
    track: "Platform",
    weekStart: 12,
    weekEnd: 12,
    milestone: "M8",
  },
  {
    phase: 47,
    name: "Compliance + Audit",
    duration: "2 weeks",
    budget: 8000,
    priority: "P0",
    status: "PLANNED",
    dependsOn: "All operational phases",
    blocks: "Phase 48",
    owner: "hermes",
    objective: "SOC 2 preparation, secret rotation, audit logging.",
    deliverables: [
      "SOC 2 controls documentation",
      "Secret rotation automation",
      "Comprehensive audit log",
      "Automated backup verification",
      "Access control audit",
      "Data retention policy",
      "Vulnerability scanning",
      "Incident response playbook",
    ],
    acceptanceCriteria: [
      "SOC 2 controls documented",
      "Secrets rotate on schedule",
      "Audit log captures all mutations",
      "Backups verified daily",
      "Access control matrix reviewed",
      "Data retention enforced",
      "Vulnerability scan pass",
    ],
    track: "Ops",
    weekStart: 13,
    weekEnd: 14,
    milestone: "M8",
  },
  {
    phase: 48,
    name: "Multi-tenancy",
    duration: "3 weeks",
    budget: 15000,
    priority: "P2",
    status: "PLANNED",
    dependsOn: "Phase 47",
    blocks: "—",
    owner: "hermes",
    objective: "Partner workspaces with RBAC and white-label.",
    deliverables: [
      "Partner Workspace system",
      "RBAC matrix",
      "White-label configuration",
      "Partner onboarding flow",
      "Cross-workspace reporting",
      "Workspace billing",
    ],
    acceptanceCriteria: [
      "Partner data isolated per workspace",
      "RBAC enforced on all endpoints",
      "White-label renders correctly",
      "Partner onboarding <1 hour",
      "Cross-workspace reporting correct",
      "Workspace billing accurate",
    ],
    track: "Ops",
    weekStart: 14,
    weekEnd: 16,
    milestone: "M9",
  },
  {
    phase: 49,
    name: "Mobile PWA",
    duration: "3 weeks",
    budget: 12000,
    priority: "P2",
    status: "PLANNED",
    dependsOn: "Phase 42, 43",
    blocks: "—",
    owner: "hermes",
    objective:
      "Progressive Web App with offline support and push notifications.",
    deliverables: [
      "PWA manifest and service worker",
      "Offline support (cache NKS)",
      "Push notifications",
      "Mobile-first UX polish (375px)",
      "Touch gesture support",
      "Install prompt",
      "Background sync",
    ],
    acceptanceCriteria: [
      "PWA installable on iOS and Android",
      "Offline mode shows cached knowledge",
      "Push notifications arrive within 5s",
      "Touch gestures work (swipe, pinch)",
      "Lighthouse PWA score >90",
    ],
    track: "Mobile",
    weekStart: 16,
    weekEnd: 18,
    milestone: "M10",
  },
  {
    phase: 50,
    name: "Knowledge Base (RAG)",
    duration: "2 weeks",
    budget: 10000,
    priority: "P2",
    status: "PLANNED",
    dependsOn: "Phase 34, 35",
    blocks: "—",
    owner: "hermes",
    objective: "Customer-facing AI chatbot powered by NKS + RAG.",
    deliverables: [
      "Customer-facing chatbot widget",
      "RAG pipeline (embed NKS)",
      "Knowledge graph queries",
      "Generative answer pipeline with citations",
      "Human handoff on low confidence",
      "Chatbot analytics",
    ],
    acceptanceCriteria: [
      "Chatbot answers questions from NKS",
      "Citations link to source documents",
      "Human handoff triggers below confidence threshold",
      "Resolution rate tracked",
      "RAG pipeline updates when NKS changes",
    ],
    track: "Knowledge Layer",
    weekStart: 18,
    weekEnd: 19,
    milestone: "M10",
  },
];

const RISKS: RiskData[] = [
  {
    id: "R1",
    risk: "NMI vault override by automated code",
    severity: "CRITICAL",
    probability: "LOW",
    mitigation:
      "SACRED rule enforced, code review required for any NMI code",
    phase: 39,
  },
  {
    id: "R2",
    risk: "Data loss during Base44→Twenty migration",
    severity: "HIGH",
    probability: "HIGH",
    mitigation:
      "Incremental migration (50 customers at a time), backup before each wave",
    phase: 37,
  },
  {
    id: "R3",
    risk: "Twenty Docker instability on VPS",
    severity: "MEDIUM",
    probability: "MEDIUM",
    mitigation: "Daily backups, VPS monitoring, rollback plan",
    phase: 37,
  },
  {
    id: "R4",
    risk: "OKF spec changes after our release",
    severity: "LOW",
    probability: "LOW",
    mitigation: "We are superset — any OKF changes are additive to us",
    phase: 34,
  },
  {
    id: "R5",
    risk: "Vercel deploy delays during critical push",
    severity: "MEDIUM",
    probability: "LOW",
    mitigation: "GitHub deployments as fallback, local dev always works",
    phase: 11,
  },
  {
    id: "R6",
    risk: "NKS spec too complex for community adoption",
    severity: "MEDIUM",
    probability: "MEDIUM",
    mitigation: "Progressive disclosure, good docs, sample bundles",
    phase: 36,
  },
  {
    id: "R7",
    risk: "V2 self-code corrupts knowledge layer",
    severity: "HIGH",
    probability: "LOW",
    mitigation:
      "Git-tracked, rollback-able, verification after every write",
    phase: 43,
  },
  {
    id: "R8",
    risk: "Customer data exposure in portal",
    severity: "CRITICAL",
    probability: "LOW",
    mitigation:
      "Clerk auth bridge, GraphQL row-level security, penetration test",
    phase: 42,
  },
  {
    id: "R9",
    risk: "Schedule slip on critical path (12 weeks)",
    severity: "HIGH",
    probability: "MEDIUM",
    mitigation: "Buffer weeks built in, parallel tracks when possible",
    phase: 0,
  },
  {
    id: "R10",
    risk: "Slack rate limits during landings",
    severity: "LOW",
    probability: "LOW",
    mitigation: "Batch messages, use threads, monitor rate limits",
    phase: 0,
  },
];

const MILESTONES: MilestoneData[] = [
  {
    id: "M1",
    name: "Knowledge Layer Live",
    week: 3,
    celebration:
      "/knowledge route + GitHub spec published",
    status: "ACHIEVED",
  },
  {
    id: "M2",
    name: "Sales Ops in Twenty",
    week: 4,
    celebration:
      "All 169 customers migrated, pipeline live",
    status: "PENDING",
  },
  {
    id: "M3",
    name: "Billing in Twenty",
    week: 6,
    celebration:
      "NMI integrated, recovery campaigns live",
    status: "PENDING",
  },
  {
    id: "M4",
    name: "Full CRM Migration",
    week: 9,
    celebration: "All 6 Twenty waves complete",
    status: "PENDING",
  },
  {
    id: "M5",
    name: "V2 Matured",
    week: 8,
    celebration:
      "Self-code + knowledge integration live",
    status: "PENDING",
  },
  {
    id: "M6",
    name: "Portal Live",
    week: 9,
    celebration: "Customers can self-serve",
    status: "PENDING",
  },
  {
    id: "M7",
    name: "Reporting Live",
    week: 11,
    celebration:
      "MRR + leaderboards + funnels",
    status: "PENDING",
  },
  {
    id: "M8",
    name: "Compliance Ready",
    week: 14,
    celebration:
      "SOC 2 controls documented",
    status: "PENDING",
  },
  {
    id: "M9",
    name: "Multi-tenant",
    week: 16,
    celebration:
      "Partner workspaces live",
    status: "PENDING",
  },
  {
    id: "M10",
    name: "Platform v1.0",
    week: 20,
    celebration:
      "All phases complete, production hardened",
    status: "PENDING",
  },
];

// Compute derived metrics
const TOTAL_BUDGET = 155000;
const COMPLETED_PHASES = PHASES.filter((p) => p.status === "COMPLETE").length;
const IN_PROGRESS_PHASES = PHASES.filter(
  (p) => p.status === "IN_PROGRESS"
).length;
const BUDGET_SPENT = PHASES.filter(
  (p) => p.status === "COMPLETE"
).reduce((sum, p) => sum + p.budget, 0);
const TOTAL_PHASES = PHASES.length;

// Track progress
const TRACK_PROGRESS = {
  "Knowledge Layer": { phases: [34, 35, 36, 50], complete: 3, total: 4 },
  "Twenty CRM": {
    phases: [37, 38, 39, 40, 41, 42],
    complete: 1,
    inProgress: 1,
    total: 6,
  },
  Platform: { phases: [43, 45, 46], complete: 0, inProgress: 1, total: 3 },
  Ops: { phases: [44, 47, 48], complete: 0, total: 3 },
  Mobile: { phases: [49], complete: 0, total: 1 },
};

// OKF compliance
const OKF_COMPLIANCE: OKFComplianceData = {
  totalFiles: 215,
  conformantFiles: 215,
  missingIndexMd: 0,
  missingLogMd: 0,
  missingTypeField: 0,
  exportValid: true,
  specPublished: true,
  visualizerLive: true,
};

// Compute timeline data (weeks 1-20)
const TIMELINE: TimelineData[] = [];
for (let w = 1; w <= 20; w++) {
  const phasesInWeek = PHASES.filter(
    (p) => p.weekStart <= w && p.weekEnd >= w
  );
  const weekBudget = phasesInWeek.reduce((sum, p) => {
    const weeks = parseInt(p.duration) || 1;
    return sum + Math.round(p.budget / weeks);
  }, 0);
  const isComplete = phasesInWeek.every((p) => p.status === "COMPLETE");
  const isActive = phasesInWeek.some(
    (p) => p.status === "IN_PROGRESS" || p.status === "PARTIAL"
  );
  TIMELINE.push({
    week: w,
    phases: phasesInWeek.map((p) => p.phase),
    budget: weekBudget,
    status: isComplete ? "COMPLETE" : isActive ? "ACTIVE" : "PLANNED",
  });
}

export default function RoadmapPage() {
  const totalBudgetSpent = BUDGET_SPENT;
  const budgetProgressPercent = Math.round(
    (totalBudgetSpent / TOTAL_BUDGET) * 100
  );
  const phaseProgressPercent = Math.round(
    (COMPLETED_PHASES / TOTAL_PHASES) * 100
  );

  return (
    <RoadmapClient
      phases={PHASES}
      risks={RISKS}
      timeline={TIMELINE}
      milestones={MILESTONES}
      okfCompliance={OKF_COMPLIANCE}
      stats={{
        totalPhases: TOTAL_PHASES,
        completedPhases: COMPLETED_PHASES,
        inProgressPhases: IN_PROGRESS_PHASES,
        totalBudget: TOTAL_BUDGET,
        budgetSpent: totalBudgetSpent,
        budgetProgressPercent,
        phaseProgressPercent,
        tracks: TRACK_PROGRESS,
      }}
    />
  );
}
