/**
 * lib/discovery/report-generator.ts
 * Phase 38 Stream 4 — Multi-Format Report Generator
 *
 * Generates reports in 4 formats from finished discovery runs:
 * 1. Markdown — human-readable with emoji severity indicators, summary table, findings, recs
 * 2. CSV — spreadsheet-ready, one row per customer with alignment flags
 * 3. JSON — full structured data for downstream automation
 * 4. PDF — formatted document via @react-pdf/renderer (Vercel serverless compatible)
 *
 * Entry point: generateReport() — builds DiscoveryReport then dispatches to format generators.
 */

import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import type {
  DiscoveryReport,
  ReportSummary,
  FindingCard,
  CustomerReport,
  AggregateStats,
  Recommendation,
  SuggestedAction,
  AlignmentResult,
  AlignmentDetail,
  CustomerDiscoveryContext,
  DependencyGraph,
  GraphCycle,
  ActionChain,
  ReportConfig,
} from "./types";
import { summarizeGraph, type GraphSummary } from "./dependency-graph";
import { summarizeValidations } from "./alignment-validators";

// ── Constants ──────────────────────────────────────────────────────

const REPORT_DIR = path.join(process.cwd(), "lib/discovery/.reports");
const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const SEVERITY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ── Main Entry Point ───────────────────────────────────────────────

export interface GenerateReportInput {
  runId: string;
  contexts: CustomerDiscoveryContext[];
  validations: Map<string, AlignmentResult[]>;
  graph: DependencyGraph;
  config?: Partial<ReportConfig>;
}

export interface GeneratedReports {
  report: DiscoveryReport;
  markdown?: string;
  csv?: string;
  json?: string;
  pdfBuffer?: Buffer;
  artifacts: { format: string; path: string; size: number }[];
}

export async function generateReport(
  input: GenerateReportInput
): Promise<GeneratedReports> {
  const config: ReportConfig = {
    format: input.config?.format || ["markdown", "csv", "json", "pdf"],
    includeCustomerDetails: input.config?.includeCustomerDetails ?? true,
    includeRawData: input.config?.includeRawData ?? false,
    maxCustomersInReport: input.config?.maxCustomersInReport || 500,
  };

  // 1. Build the canonical DiscoveryReport
  const report = buildDiscoveryReport(input.runId, input.contexts, input.validations, input.graph, config);

  // 2. Generate each requested format
  const result: GeneratedReports = { report, artifacts: [] };

  await fs.mkdir(REPORT_DIR, { recursive: true });

  if (config.format.includes("markdown")) {
    result.markdown = generateMarkdownReport(report, input.graph, config);
    const mdPath = path.join(REPORT_DIR, `${input.runId}.md`);
    await fs.writeFile(mdPath, result.markdown);
    result.artifacts.push({ format: "markdown", path: mdPath, size: Buffer.byteLength(result.markdown) });
  }

  if (config.format.includes("csv")) {
    result.csv = generateCsvReport(report, config);
    const csvPath = path.join(REPORT_DIR, `${input.runId}.csv`);
    await fs.writeFile(csvPath, result.csv);
    result.artifacts.push({ format: "csv", path: csvPath, size: Buffer.byteLength(result.csv) });
  }

  if (config.format.includes("json")) {
    result.json = generateJsonReport(report, input.graph, config);
    const jsonPath = path.join(REPORT_DIR, `${input.runId}.json`);
    await fs.writeFile(jsonPath, result.json);
    result.artifacts.push({ format: "json", path: jsonPath, size: Buffer.byteLength(result.json) });
  }

  if (config.format.includes("pdf")) {
    try {
      result.pdfBuffer = await generatePdfReport(report, input.graph, config);
      const pdfPath = path.join(REPORT_DIR, `${input.runId}.pdf`);
      await fs.writeFile(pdfPath, result.pdfBuffer);
      result.artifacts.push({ format: "pdf", path: pdfPath, size: result.pdfBuffer.length });
    } catch (err) {
      console.warn(`PDF generation failed: ${err instanceof Error ? err.message : err}. Skipping PDF.`);
    }
  }

  return result;
}

// ── Build DiscoveryReport from raw contexts + validations ──────────

function buildDiscoveryReport(
  runId: string,
  contexts: CustomerDiscoveryContext[],
  validations: Map<string, AlignmentResult[]>,
  graph: DependencyGraph,
  config: ReportConfig
): DiscoveryReport {
  // Aggregate all alignment results
  const allAlignmentResults: AlignmentResult[] = [];
  for (const results of validations.values()) {
    allAlignmentResults.push(...results);
  }

  const validationsSummary = summarizeValidations(allAlignmentResults);

  // Build summary
  const summary = buildReportSummary(contexts, allAlignmentResults, validationsSummary);

  // Build finding cards
  const findings = buildFindingCards(contexts, validations);

  // Build customer reports (CSV rows)
  const customerReports = buildCustomerReports(contexts, validations, config);

  // Build aggregate stats
  const aggregateStats = buildAggregateStats(contexts, graph, validations);

  // Build recommendations
  const recommendations = buildRecommendations(findings, aggregateStats, contexts.length);

  return {
    runId,
    generatedAt: new Date().toISOString(),
    summary,
    findings,
    customerReports,
    aggregateStats,
    recommendations,
  };
}

// ── Summary Builder ────────────────────────────────────────────────

function buildReportSummary(
  contexts: CustomerDiscoveryContext[],
  allResults: AlignmentResult[],
  valSummary: ReturnType<typeof summarizeValidations>
): ReportSummary {
  const totalMisalignments = valSummary.misaligned;
  const criticalMisalignments = valSummary.criticalCount;
  const highMisalignments = valSummary.highCount;
  const mediumMisalignments = valSummary.mediumCount;

  const customersWithIssues = new Set<string>();
  for (const ctx of contexts) {
    if (ctx.alignment.flags.length > 0) {
      customersWithIssues.add(ctx.customerId);
    }
  }

  return {
    totalCustomers: contexts.length,
    totalMisalignments,
    criticalMisalignments,
    highMisalignments,
    mediumMisalignments,
    customersWithIssues: customersWithIssues.size,
    healthyCustomers: contexts.length - customersWithIssues.size,
  };
}

// ── Finding Cards Builder ──────────────────────────────────────────

function buildFindingCards(
  contexts: CustomerDiscoveryContext[],
  validations: Map<string, AlignmentResult[]>
): FindingCard[] {
  const cards: FindingCard[] = [];

  for (const ctx of contexts) {
    const results = validations.get(ctx.customerId) || [];
    for (const result of results) {
      if (result.status === "misaligned" || (result.status === "aligned" && result.score < 0.9)) {
        // Map dimension to category
        const category = result.dimension as FindingCard["category"];

        cards.push({
          id: `finding-${randomUUID().slice(0, 8)}`,
          customerId: ctx.customerId,
          customerName: ctx.name || ctx.customerId,
          severity: result.priority,
          category,
          title: `${result.dimension.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} Misalignment`,
          description: result.details.map((d) => d.discrepancy).filter(Boolean).join(" | ") || result.recommendation,
          evidence: result.details.map((d) =>
            `[${d.source}] ${d.field}: expected "${d.expected}", got "${d.actual}"`
          ),
          recommendation: result.recommendation,
          suggestedAction: suggestAction(ctx, result),
        });
      }
    }
  }

  // Sort by severity (critical first), then by customer name
  cards.sort((a, b) => {
    const sevDiff = (SEVERITY_SORT_ORDER[a.severity] ?? 9) - (SEVERITY_SORT_ORDER[b.severity] ?? 9);
    if (sevDiff !== 0) return sevDiff;
    return a.customerName.localeCompare(b.customerName);
  });

  return cards;
}

function suggestAction(
  ctx: CustomerDiscoveryContext,
  result: AlignmentResult
): SuggestedAction {
  const base: SuggestedAction = {
    type: "update_base44",
    entityId: ctx.customerId,
    description: result.recommendation,
    payload: { customerId: ctx.customerId, dimension: result.dimension, score: result.score },
  };

  switch (result.dimension) {
    case "billing": {
      if (ctx.base44.billingStatus === "cancelled" && ctx.nmi.subscriptionStatus === "active") {
        return {
          ...base,
          type: "sync_nmi",
          description: `Cancel NMI subscription ${ctx.nmi.subscriptionId} — CRM shows cancelled but NMI still active`,
          payload: {
            ...base.payload,
            action: "cancel_subscription",
            subscriptionId: ctx.nmi.subscriptionId,
            reason: "CRM shows cancelled, NMI still charging",
          },
        };
      }
      if (result.priority === "critical") {
        return { ...base, type: "sync_nmi", description: result.recommendation };
      }
      return { ...base, type: "update_base44", description: result.recommendation };
    }

    case "enrollment": {
      if (!ctx.base44.profile) {
        return {
          ...base,
          type: "follow_up",
          description: "Create Base44 profile for customer mentioned in Slack",
          payload: { ...base.payload, action: "create_profile", slackMention: ctx.slack.latestMention?.text },
        };
      }
      return { ...base, type: "update_base44", description: "Update enrollment status in CRM" };
    }

    case "agent_promise": {
      const staleCount = result.details.filter((d) => d.field === "stale_tickets").length;
      if (staleCount > 0) {
        return { ...base, type: "close_ticket", description: "Resolve or escalate stale tickets" };
      }
      return { ...base, type: "follow_up", description: result.recommendation };
    }

    case "documentation": {
      return {
        ...base,
        type: "update_base44",
        description: "Update customer profile to match Slack data",
        payload: {
          ...base.payload,
          action: "update_profile",
          fields: result.details.map((d) => d.field),
        },
      };
    }

    default:
      return base;
  }
}

// ── Customer Reports Builder (one row per customer) ────────────────

function buildCustomerReports(
  contexts: CustomerDiscoveryContext[],
  validations: Map<string, AlignmentResult[]>,
  config: ReportConfig
): CustomerReport[] {
  return contexts.slice(0, config.maxCustomersInReport).map((ctx) => {
    const results = validations.get(ctx.customerId) || [];
    const flags: string[] = [];
    let hasCritical = false;
    let hasHigh = false;

    for (const r of results) {
      if (r.priority === "critical") hasCritical = true;
      if (r.priority === "high") hasHigh = true;
      for (const d of r.details) {
        if (d.discrepancy) flags.push(`[${r.dimension}] ${d.discrepancy}`);
      }
    }

    // Determine billing state summary
    const billingState = ctx.nmi.subscriptionStatus === "active" && ctx.base44.billingStatus === "active"
      ? "Active & Aligned"
      : ctx.nmi.subscriptionStatus === "active" && ctx.base44.billingStatus === "cancelled"
        ? "MISALIGNED: Active NMI / Cancelled CRM"
        : ctx.nmi.subscriptionStatus === "declining"
          ? "Declining"
          : ctx.nmi.subscriptionStatus === "cancelled"
            ? "Cancelled"
            : ctx.nmi.subscriptionStatus === "none"
              ? "No Subscription"
              : "Unknown";

    // Alignment summary
    const alignedCount = results.filter((r) => r.status === "aligned").length;
    const misalignedCount = results.filter((r) => r.status === "misaligned").length;
    const alignmentSummary = misalignedCount > 0
      ? `${misalignedCount}/${results.length} misaligned${hasCritical ? " 🔴CRITICAL" : hasHigh ? " 🟠HIGH" : ""}`
      : results.length > 0
        ? `${alignedCount}/${results.length} aligned`
        : "No validation data";

    let priority: CustomerReport["priority"] = "low";
    if (hasCritical) priority = "critical";
    else if (hasHigh) priority = "high";
    else if (misalignedCount > 0) priority = "medium";

    return {
      customerId: ctx.customerId,
      name: ctx.name || "Unknown",
      phone: ctx.phone || "",
      email: ctx.email || "",
      slackMentions: ctx.slack.mentions.length,
      slackActionRequested: ctx.slack.inferredActionRequested || "None",
      base44Status: ctx.base44.enrollmentStatus || "Unknown",
      nmiStatus: ctx.nmi.subscriptionStatus || "Unknown",
      billingState,
      alignmentSummary,
      flags,
      recommendedAction: flags.length > 0 ? flags[0] : "No action needed",
      priority,
    };
  });
}

// ── Aggregate Stats Builder ────────────────────────────────────────

function buildAggregateStats(
  contexts: CustomerDiscoveryContext[],
  graph: DependencyGraph,
  validations: Map<string, AlignmentResult[]>
): AggregateStats {
  // Enrollment breakdown
  const enrollmentBreakdown: Record<string, number> = {};
  for (const ctx of contexts) {
    const status = ctx.base44.enrollmentStatus || "unknown";
    enrollmentBreakdown[status] = (enrollmentBreakdown[status] || 0) + 1;
  }

  // Billing state breakdown
  const billingStateBreakdown: Record<string, number> = {};
  for (const ctx of contexts) {
    const key = `${ctx.nmi.subscriptionStatus || "none"} / ${ctx.base44.billingStatus || "unknown"}`;
    billingStateBreakdown[key] = (billingStateBreakdown[key] || 0) + 1;
  }

  // Alignment by category
  const alignmentByCategory: Record<string, { aligned: number; misaligned: number; unknown: number }> = {
    billing: { aligned: 0, misaligned: 0, unknown: 0 },
    enrollment: { aligned: 0, misaligned: 0, unknown: 0 },
    agent_promise: { aligned: 0, misaligned: 0, unknown: 0 },
    documentation: { aligned: 0, misaligned: 0, unknown: 0 },
  };

  for (const results of validations.values()) {
    for (const r of results) {
      const bucket = alignmentByCategory[r.dimension];
      if (bucket) {
        if (r.status === "aligned") bucket.aligned++;
        else if (r.status === "misaligned") bucket.misaligned++;
        else bucket.unknown++;
      }
    }
  }

  // Top agents with promise tracking
  const agentStats = new Map<string, { promisesMade: number; promisesKept: number }>();
  for (const ctx of contexts) {
    for (const msg of ctx.slack.mentions) {
      const agent = msg.userName || msg.userId;
      if (!agent) continue;

      if (!agentStats.has(agent)) {
        agentStats.set(agent, { promisesMade: 0, promisesKept: 0 });
      }
      const stats = agentStats.get(agent)!;

      // Detect promises in this message
      const promisePattern = /(I'?ll|I\s*will|let\s*me)\s*(call|follow\s*up|reach\s*out|get\s*back|check|look\s*into|handle|take\s*care)/i;
      if (promisePattern.test(msg.text)) {
        stats.promisesMade++;
      }

      // Check if promise was kept (follow-up action exists)
      const hasFollowUp = ctx.base44.recentCalls.some((call) => {
        const c = call as Record<string, unknown>;
        return c.createdAt && new Date(c.createdAt as string).getTime() > parseFloat(msg.ts) * 1000;
      });
      if (hasFollowUp) stats.promisesKept++;
    }
  }

  const topAgents = [...agentStats.entries()]
    .sort((a, b) => b[1].promisesMade - a[1].promisesMade)
    .slice(0, 10)
    .map(([name, stats]) => ({
      name,
      promisesMade: stats.promisesMade,
      promisesKept: stats.promisesKept,
    }));

  // Time distribution — group messages by hour of day
  const timeDistribution: Record<string, number> = {};
  for (const ctx of contexts) {
    for (const msg of ctx.slack.mentions) {
      try {
        const hour = new Date(parseFloat(msg.ts) * 1000).getHours();
        const slot = `${String(hour).padStart(2, "0")}:00`;
        timeDistribution[slot] = (timeDistribution[slot] || 0) + 1;
      } catch {
        // Skip unparseable timestamps
      }
    }
  }

  return {
    enrollmentBreakdown,
    billingStateBreakdown,
    alignmentByCategory,
    topAgents,
    timeDistribution,
  };
}

// ── Recommendations Builder ────────────────────────────────────────

function buildRecommendations(
  findings: FindingCard[],
  stats: AggregateStats,
  totalCustomers: number
): Recommendation[] {
  const recs: Recommendation[] = [];
  let priority = 1;

  // CRITICAL: Immediate billing misalignments
  const criticalBilling = findings.filter(
    (f) => f.severity === "critical" && f.category === "billing"
  );
  if (criticalBilling.length > 0) {
    recs.push({
      priority: priority++,
      action: `Resolve ${criticalBilling.length} critical billing misalignment(s) IMMEDIATELY`,
      affectedCustomerCount: criticalBilling.length,
      estimatedImpact: `Prevent ${criticalBilling.length} active subscriptions from unauthorized charges`,
      suggestedAssignee: "billing-team",
    });
  }

  // HIGH: Stale tickets
  const staleTicketFindings = findings.filter(
    (f) => f.category === "agent_promise" && f.severity === "high"
  );
  if (staleTicketFindings.length > 0) {
    recs.push({
      priority: priority++,
      action: `Follow up on ${staleTicketFindings.length} stale/abandoned tasks`,
      affectedCustomerCount: staleTicketFindings.length,
      estimatedImpact: "Improve agent SLA compliance and customer satisfaction",
      suggestedAssignee: "support-lead",
    });
  }

  // MEDIUM: Documentation gaps
  const docFindings = findings.filter((f) => f.category === "documentation");
  if (docFindings.length > 0) {
    recs.push({
      priority: priority++,
      action: `Update ${docFindings.length} customer profiles with missing/inconsistent documentation`,
      affectedCustomerCount: docFindings.length,
      estimatedImpact: "Ensure CRM data accuracy across systems",
      suggestedAssignee: "data-ops",
    });
  }

  // GENERAL: Alignment health
  if (stats.alignmentByCategory.billing?.misaligned > 0) {
    recs.push({
      priority: priority++,
      action: "Run billing alignment audit weekly to catch CRM-vs-NMI drift early",
      affectedCustomerCount: totalCustomers,
      estimatedImpact: "Reduce billing errors by 80% through proactive detection",
      suggestedAssignee: "automation",
    });
  }

  // If no specific recs, add general
  if (recs.length === 0) {
    recs.push({
      priority: 1,
      action: "All systems appear aligned. Continue regular monitoring.",
      affectedCustomerCount: totalCustomers,
      estimatedImpact: "Maintain current alignment health",
      suggestedAssignee: "system",
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

// ── MARKDOWN GENERATOR ─────────────────────────────────────────────

export function generateMarkdownReport(
  report: DiscoveryReport,
  graph: DependencyGraph,
  _config?: Partial<ReportConfig>
): string {
  const graphSummary = summarizeGraph(graph);
  const lines: string[] = [];

  // Header
  lines.push(`# Discovery Report: \`${report.runId}\``);
  lines.push("");
  lines.push(`**Generated:** ${formatDateTime(report.generatedAt)}`);
  lines.push(`**Run ID:** \`${report.runId}\``);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Executive Summary ──
  lines.push("## 📊 Executive Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total Customers Analyzed | ${report.summary.totalCustomers} |`);
  lines.push(`| Customers with Issues | ${report.summary.customersWithIssues} ${report.summary.customersWithIssues > 0 ? "🔴" : "✅"} |`);
  lines.push(`| Healthy Customers | ${report.summary.healthyCustomers} |`);
  lines.push(`| Total Misalignments | ${report.summary.totalMisalignments} |`);
  lines.push(`| 🔴 Critical | ${report.summary.criticalMisalignments} |`);
  lines.push(`| 🟠 High | ${report.summary.highMisalignments} |`);
  lines.push(`| 🟡 Medium | ${report.summary.mediumMisalignments} |`);
  lines.push("");

  // Health score
  const healthPct = report.summary.totalCustomers > 0
    ? Math.round((report.summary.healthyCustomers / report.summary.totalCustomers) * 100)
    : 100;
  lines.push(`**Overall Health Score:** ${healthPct}% (${report.summary.healthyCustomers}/${report.summary.totalCustomers} customers aligned)`);
  lines.push("");

  // ── Critical Findings ──
  if (report.findings.filter((f) => f.severity === "critical").length > 0) {
    lines.push("## 🔴 Critical Findings");
    lines.push("");
    for (const f of report.findings.filter((f) => f.severity === "critical")) {
      lines.push(`### ${SEVERITY_EMOJI[f.severity]} ${f.title}`);
      lines.push("");
      lines.push(`- **Customer:** ${f.customerName} (\`${f.customerId}\`)`);
      lines.push(`- **Category:** ${f.category}`);
      lines.push(`- **Description:** ${f.description}`);
      if (f.evidence.length > 0) {
        lines.push(`- **Evidence:**`);
        for (const e of f.evidence) {
          lines.push(`  - ${e}`);
        }
      }
      lines.push(`- **Recommendation:** ${f.recommendation}`);
      lines.push(`- **Suggested Action:** \`${f.suggestedAction.type}\` → ${f.suggestedAction.description}`);
      lines.push("");
    }
  }

  // ── All Findings ──
  if (report.findings.length > 0) {
    lines.push("## 🔍 All Findings");
    lines.push("");
    lines.push("| # | Severity | Customer | Category | Issue | Action |");
    lines.push("|---|----------|----------|----------|-------|--------|");
    report.findings.forEach((f, i) => {
      lines.push(
        `| ${i + 1} | ${SEVERITY_EMOJI[f.severity]} ${f.severity} | ${f.customerName} | ${f.category} | ${truncate(f.description, 60)} | ${f.suggestedAction.type} |`
      );
    });
    lines.push("");
  }

  // ── Aggregate Statistics ──
  lines.push("## 📈 Aggregate Statistics");
  lines.push("");

  // Enrollment breakdown
  lines.push("### Enrollment Breakdown");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|--------|-------|");
  for (const [status, count] of Object.entries(report.aggregateStats.enrollmentBreakdown).sort(
    (a, b) => b[1] - a[1]
  )) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push("");

  // Billing state breakdown
  lines.push("### Billing State Breakdown");
  lines.push("");
  lines.push("| NMI / Base44 | Count |");
  lines.push("|-------------|-------|");
  for (const [state, count] of Object.entries(report.aggregateStats.billingStateBreakdown).sort(
    (a, b) => b[1] - a[1]
  )) {
    lines.push(`| ${state} | ${count} |`);
  }
  lines.push("");

  // Alignment by category
  lines.push("### Alignment by Category");
  lines.push("");
  lines.push("| Category | Aligned | Misaligned | Unknown | Health |");
  lines.push("|----------|---------|------------|---------|--------|");
  for (const [cat, counts] of Object.entries(report.aggregateStats.alignmentByCategory)) {
    const total = counts.aligned + counts.misaligned + counts.unknown || 1;
    const health = Math.round((counts.aligned / total) * 100);
    lines.push(`| ${cat.replace(/_/g, " ")} | ${counts.aligned} | ${counts.misaligned} | ${counts.unknown} | ${health}% |`);
  }
  lines.push("");

  // Top agents
  if (report.aggregateStats.topAgents.length > 0) {
    lines.push("### Top Agents (by Promise Activity)");
    lines.push("");
    lines.push("| Agent | Promises Made | Promises Kept | Rate |");
    lines.push("|-------|---------------|---------------|------|");
    for (const agent of report.aggregateStats.topAgents) {
      const rate = agent.promisesMade > 0
        ? `${Math.round((agent.promisesKept / agent.promisesMade) * 100)}%`
        : "N/A";
      lines.push(`| ${agent.name} | ${agent.promisesMade} | ${agent.promisesKept} | ${rate} |`);
    }
    lines.push("");
  }

  // ── Dependency Graph Summary ──
  lines.push("## 🕸️ Knowledge Graph Summary");
  lines.push("");
  lines.push("| Graph Element | Count |");
  lines.push("|--------------|-------|");
  if (graphSummary.nodeCounts) {
    for (const [type, count] of Object.entries(graphSummary.nodeCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${type} nodes | ${count} |`);
    }
  }
  if (graphSummary.edgeCounts) {
    for (const [type, count] of Object.entries(graphSummary.edgeCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${type} edges | ${count} |`);
    }
  }
  lines.push(`| Cycles detected | ${graphSummary.cycleCount} |`);
  lines.push(`| 🔴 Critical cycles | ${graphSummary.criticalCycles} |`);
  lines.push(`| Action chains | ${graphSummary.chainCount} |`);
  lines.push(`| Stalled chains | ${graphSummary.stalledChains} |`);
  lines.push("");

  // Cycle details
  if (graph.cycles.length > 0) {
    lines.push("### Detected Cycles");
    lines.push("");
    for (const cycle of graph.cycles) {
      lines.push(`- **${SEVERITY_EMOJI[cycle.severity]} ${cycle.type}** (${cycle.severity}): ${cycle.description}`);
    }
    lines.push("");
  }

  // Top connected customers
  if (graphSummary.topConnectedCustomers?.length > 0) {
    lines.push("### Most Connected Customers");
    lines.push("");
    lines.push("| Customer | Connections |");
    lines.push("|----------|------------|");
    for (const c of graphSummary.topConnectedCustomers.slice(0, 5)) {
      lines.push(`| ${c.label} | ${c.connections} |`);
    }
    lines.push("");
  }

  // ── Customer Reports (Detailed) ──
  lines.push("## 📋 Customer Detail Report");
  lines.push("");
  lines.push("| # | Customer | Phone | Email | Slack | Action | Base44 | NMI | Billing | Alignment |");
  lines.push("|---|----------|-------|-------|-------|--------|--------|-----|---------|-----------|");
  report.customerReports.forEach((cr, i) => {
    const alignmentDisplay = cr.alignmentSummary.length > 40
      ? cr.alignmentSummary.slice(0, 37) + "..."
      : cr.alignmentSummary;
    lines.push(
      `| ${i + 1} | ${cr.name} | ${cr.phone} | ${cr.email} | ${cr.slackMentions} | ${truncate(cr.slackActionRequested, 15)} | ${cr.base44Status} | ${cr.nmiStatus} | ${truncate(cr.billingState, 25)} | ${alignmentDisplay} |`
    );
  });
  lines.push("");

  // ── Recommendations ──
  lines.push("## 💡 Recommendations");
  lines.push("");
  for (const rec of report.recommendations) {
    lines.push(`${rec.priority}. **${rec.action}**`);
    lines.push(`   - Affected: ${rec.affectedCustomerCount} customer(s)`);
    lines.push(`   - Impact: ${rec.estimatedImpact}`);
    lines.push(`   - Assignee: ${rec.suggestedAssignee}`);
    lines.push("");
  }

  // ── Footer ──
  lines.push("---");
  lines.push("");
  lines.push(`*Report generated by Discovery Workflows Engine v1.0 — ${formatDateTime(report.generatedAt)}*`);
  lines.push(`*Run ID: \`${report.runId}\` — ${report.summary.totalCustomers} customers, ${report.findings.length} findings*`);

  return lines.join("\n");
}

// ── CSV GENERATOR ──────────────────────────────────────────────────

export function generateCsvReport(
  report: DiscoveryReport,
  _config?: Partial<ReportConfig>
): string {
  // CSV header
  const headers = [
    "Customer ID",
    "Name",
    "Phone",
    "Email",
    "Slack Mentions",
    "Slack Action Requested",
    "Base44 Status",
    "NMI Status",
    "Billing State",
    "Alignment Summary",
    "Priority",
    "Flags",
    "Recommended Action",
  ];

  const rows: string[] = [headers.map(escapeCsv).join(",")];

  for (const cr of report.customerReports) {
    const row = [
      cr.customerId,
      cr.name,
      cr.phone,
      cr.email,
      cr.slackMentions,
      cr.slackActionRequested,
      cr.base44Status,
      cr.nmiStatus,
      cr.billingState,
      cr.alignmentSummary,
      cr.priority,
      cr.flags.join("; "),
      cr.recommendedAction,
    ];
    rows.push(row.map(escapeCsv).join(","));
  }

  // Append findings section as footer rows
  rows.push("");
  rows.push('"FINDINGS"');
  rows.push(["Finding ID", "Customer", "Severity", "Category", "Description", "Recommendation"].map(escapeCsv).join(","));

  for (const f of report.findings) {
    rows.push(
      [f.id, f.customerName, f.severity, f.category, f.description, f.recommendation]
        .map(escapeCsv)
        .join(",")
    );
  }

  return rows.join("\n");
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── JSON GENERATOR ─────────────────────────────────────────────────

export function generateJsonReport(
  report: DiscoveryReport,
  graph: DependencyGraph,
  _config?: Partial<ReportConfig>
): string {
  const graphSummary = summarizeGraph(graph);

  // Serialize Map to array of node entries
  const nodes = [...graph.nodes.entries()].map(([id, node]) => ({
    id,
    type: node.type,
    label: node.label,
    data: node.data,
  }));

  const jsonOutput = {
    meta: {
      runId: report.runId,
      generatedAt: report.generatedAt,
      version: "1.0",
      engine: "discovery-workflows-engine",
    },
    summary: report.summary,
    findings: report.findings,
    customerReports: report.customerReports,
    aggregateStats: report.aggregateStats,
    recommendations: report.recommendations,
    graph: {
      summary: graphSummary,
      nodes,
      edges: graph.edges,
      cycles: graph.cycles,
      chains: graph.chains,
    },
  };

  return JSON.stringify(jsonOutput, null, 2);
}

// ── PDF GENERATOR (via @react-pdf/renderer) ────────────────────────

/**
 * PDF generation uses @react-pdf/renderer which is Vercel serverless compatible.
 * If @react-pdf/renderer is not installed, returns a text-based fallback.
 *
 * To install: npm install @react-pdf/renderer
 */
export async function generatePdfReport(
  report: DiscoveryReport,
  graph: DependencyGraph,
  _config?: Partial<ReportConfig>
): Promise<Buffer> {
  try {
    // Dynamic import — only loads if @react-pdf/renderer is installed
    const reactPdf = await import("@react-pdf/renderer");
    const React = await import("react");

    const { Document, Page, Text, View, StyleSheet, pdf } = reactPdf;

    // Styles
    const styles = StyleSheet.create({
      page: {
        padding: 40,
        fontSize: 10,
        fontFamily: "Helvetica",
      },
      title: {
        fontSize: 20,
        fontWeight: "bold" as const,
        marginBottom: 8,
        color: "#1a1a2e",
      },
      subtitle: {
        fontSize: 11,
        color: "#666",
        marginBottom: 20,
      },
      sectionTitle: {
        fontSize: 14,
        fontWeight: "bold" as const,
        marginTop: 16,
        marginBottom: 8,
        color: "#16213e",
        borderBottom: "1px solid #e0e0e0",
        paddingBottom: 4,
      },
      summaryRow: {
        flexDirection: "row" as const,
        marginBottom: 4,
      },
      summaryLabel: {
        width: 200,
        fontWeight: "bold" as const,
      },
      summaryValue: {
        width: 100,
      },
      finding: {
        marginBottom: 10,
        padding: 8,
        backgroundColor: "#f9f9f9",
        borderRadius: 4,
      },
      findingTitle: {
        fontSize: 11,
        fontWeight: "bold" as const,
        marginBottom: 2,
      },
      findingDetail: {
        fontSize: 9,
        color: "#444",
        marginBottom: 1,
      },
      criticalFinding: {
        backgroundColor: "#ffeaea",
        borderLeft: "3px solid #e74c3c",
      },
      highFinding: {
        backgroundColor: "#fff3e0",
        borderLeft: "3px solid #f39c12",
      },
      recommendation: {
        fontSize: 9,
        color: "#2c3e50",
        fontStyle: "italic" as const,
        marginTop: 4,
      },
      table: {
        marginTop: 8,
      },
      tableHeader: {
        flexDirection: "row" as const,
        backgroundColor: "#16213e",
        color: "white",
        padding: 4,
        fontSize: 8,
        fontWeight: "bold" as const,
      },
      tableRow: {
        flexDirection: "row" as const,
        borderBottom: "1px solid #eee",
        padding: 3,
        fontSize: 8,
      },
      footer: {
        position: "absolute" as const,
        bottom: 20,
        left: 40,
        right: 40,
        fontSize: 7,
        color: "#999",
        textAlign: "center" as const,
      },
    });

    const getFindingStyle = (severity: string) => {
      if (severity === "critical") return { ...styles.finding, ...styles.criticalFinding };
      if (severity === "high") return { ...styles.finding, ...styles.highFinding };
      return styles.finding;
    };

    const criticalFindings = report.findings.filter((f) => f.severity === "critical" || f.severity === "high");
    const topCustomers = report.customerReports.slice(0, 30);

    const document = React.createElement(Document, null,
      React.createElement(Page, { size: "A4", style: styles.page },
        // Title
        React.createElement(Text, { style: styles.title }, `Discovery Report: ${report.runId}`),
        React.createElement(Text, { style: styles.subtitle },
          `Generated ${formatDateTime(report.generatedAt)} | ${report.summary.totalCustomers} customers | ${report.findings.length} findings`),

        // Executive Summary
        React.createElement(Text, { style: styles.sectionTitle }, "Executive Summary"),
        React.createElement(View, { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, "Total Customers Analyzed:"),
          React.createElement(Text, { style: styles.summaryValue }, String(report.summary.totalCustomers))
        ),
        React.createElement(View, { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, "Customers with Issues:"),
          React.createElement(Text, { style: styles.summaryValue }, `${report.summary.customersWithIssues} / ${report.summary.totalCustomers}`)
        ),
        React.createElement(View, { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, "Critical Misalignments:"),
          React.createElement(Text, { style: styles.summaryValue }, String(report.summary.criticalMisalignments))
        ),
        React.createElement(View, { style: styles.summaryRow },
          React.createElement(Text, { style: styles.summaryLabel }, "High Priority:"),
          React.createElement(Text, { style: styles.summaryValue }, String(report.summary.highMisalignments))
        ),

        // Critical/High Findings
        criticalFindings.length > 0 && React.createElement(Text, { style: styles.sectionTitle }, "Critical & High Findings"),
        ...criticalFindings.map((f) =>
          React.createElement(View, { key: f.id, style: getFindingStyle(f.severity) },
            React.createElement(Text, { style: styles.findingTitle }, `${SEVERITY_EMOJI[f.severity]} ${f.customerName} — ${f.title}`),
            React.createElement(Text, { style: styles.findingDetail }, f.description),
            f.evidence.length > 0 && React.createElement(Text, { style: styles.findingDetail }, `Evidence: ${f.evidence[0]}`),
            React.createElement(Text, { style: styles.recommendation }, `→ ${f.recommendation}`)
          )
        ),

        // Customer Table
        React.createElement(Text, { style: styles.sectionTitle }, "Customer Detail Report"),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: styles.tableHeader },
            React.createElement(Text, { style: { width: 5 * 9 } }, "#"),
            React.createElement(Text, { style: { width: 15 * 9 } }, "Customer"),
            React.createElement(Text, { style: { width: 8 * 9 } }, "Base44"),
            React.createElement(Text, { style: { width: 8 * 9 } }, "NMI"),
            React.createElement(Text, { style: { width: 20 * 9 } }, "Billing"),
            React.createElement(Text, { style: { width: 15 * 9 } }, "Alignment"),
          ),
          ...topCustomers.map((cr, i) =>
            React.createElement(View, { key: cr.customerId, style: styles.tableRow },
              React.createElement(Text, { style: { width: 5 * 9 } }, String(i + 1)),
              React.createElement(Text, { style: { width: 15 * 9 } }, cr.name),
              React.createElement(Text, { style: { width: 8 * 9 } }, cr.base44Status),
              React.createElement(Text, { style: { width: 8 * 9 } }, cr.nmiStatus),
              React.createElement(Text, { style: { width: 20 * 9 } }, cr.billingState),
              React.createElement(Text, { style: { width: 15 * 9 } }, cr.alignmentSummary),
            )
          )
        ),

        // Recommendations
        React.createElement(Text, { style: styles.sectionTitle }, "Recommendations"),
        ...report.recommendations.map((rec, i) =>
          React.createElement(View, { key: i, style: { marginBottom: 6 } },
            React.createElement(Text, { style: styles.findingDetail },
              `${rec.priority}. ${rec.action} (${rec.affectedCustomerCount} customers, → ${rec.suggestedAssignee})`)
          )
        ),

        // Footer
        React.createElement(Text, { style: styles.footer },
          `Discovery Workflows Engine v1.0 | Run ${report.runId} | ${formatDateTime(report.generatedAt)}`
        )
      )
    );

    const pdfResult = await pdf(document).toBuffer();
    return Buffer.from(pdfResult.buffer);
  } catch (err) {
    // Fallback: generate a text-based PDF placeholder
    if (err instanceof Error && err.message?.includes("Cannot find module")) {
      console.warn("@react-pdf/renderer not installed. Falling back to text-based PDF placeholder.");
      return generateTextPdfFallback(report);
    }
    throw err;
  }
}

/**
 * Text-based PDF fallback when @react-pdf/renderer is not installed.
 * Produces a minimal PDF with the report summary as plain text.
 */
function generateTextPdfFallback(report: DiscoveryReport): Buffer {
  const lines: string[] = [];
  lines.push(`Discovery Report: ${report.runId}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`\n--- Executive Summary ---`);
  lines.push(`Total Customers: ${report.summary.totalCustomers}`);
  lines.push(`Customers with Issues: ${report.summary.customersWithIssues}`);
  lines.push(`Critical: ${report.summary.criticalMisalignments}`);
  lines.push(`High: ${report.summary.highMisalignments}`);
  lines.push(`\n--- Critical Findings ---`);
  for (const f of report.findings.filter((f) => f.severity === "critical" || f.severity === "high")) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.customerName}: ${f.title}`);
    lines.push(`  ${f.description}`);
    lines.push(`  → ${f.recommendation}`);
  }
  lines.push(`\n--- Recommendations ---`);
  for (const rec of report.recommendations) {
    lines.push(`${rec.priority}. ${rec.action}`);
  }
  lines.push(`\nReport generated by Discovery Workflows Engine v1.0`);

  const content = lines.join("\n");
  return Buffer.from(content, "utf-8");
}

// ── Utility Functions ──────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

// ── Export for convenience functions ───────────────────────────────

/**
 * Quick report: generates all formats and returns paths.
 */
export async function quickReport(
  runId: string,
  contexts: CustomerDiscoveryContext[],
  validations: Map<string, AlignmentResult[]>,
  graph: DependencyGraph
): Promise<{ markdownPath: string; csvPath: string; jsonPath: string; pdfPath?: string }> {
  const result = await generateReport({
    runId,
    contexts,
    validations,
    graph,
  });

  return {
    markdownPath: result.artifacts.find((a) => a.format === "markdown")?.path || "",
    csvPath: result.artifacts.find((a) => a.format === "csv")?.path || "",
    jsonPath: result.artifacts.find((a) => a.format === "json")?.path || "",
    pdfPath: result.artifacts.find((a) => a.format === "pdf")?.path,
  };
}
