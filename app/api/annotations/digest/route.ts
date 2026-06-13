/**
 * app/api/annotations/digest/route.ts
 * PB-D — Weekly annotation digest generator.
 * GET: produces a structured digest of the past week's annotations.
 * Used by: weekly digest cron, /capabilities UI, playbook refinement.
 */
import { NextResponse } from "next/server";
import { getAnnotations, getAnnotationSummary } from "@/connectors/neptune/functions/annotation-collector";

interface DigestSection {
  domain: string;
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  topErrors: Array<{ error: string; count: number }>;
  topLearnings: string[];
  trend: "improving" | "stable" | "declining" | "new";
}

interface WeeklyDigest {
  title: string;
  period: { start: string; end: string };
  generated: string;
  overall: {
    totalExecutions: number;
    overallSuccessRate: number;
    domainsActive: number;
    totalErrors: number;
  };
  byDomain: DigestSection[];
  topLearnings: string[];
  recommendations: string[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const daysBack = parseInt(searchParams.get("days") || "7", 10);

  const now = new Date();
  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const annotations = getAnnotations({ since });
  const summaries = getAnnotationSummary();

  // Build domain-level digest sections
  const byDomain: DigestSection[] = summaries.map((s) => {
    const domainAnnotations = annotations.filter((a) => a.domain === s.domain);
    const recentSuccessRate =
      domainAnnotations.length > 0
        ? Math.round(
            (domainAnnotations.filter((a) => a.outcome === "success").length /
              domainAnnotations.length) *
              100
          )
        : s.successRate;

    let trend: DigestSection["trend"] = "stable";
    if (recentSuccessRate > s.successRate + 5) trend = "improving";
    else if (recentSuccessRate < s.successRate - 5) trend = "declining";
    if (domainAnnotations.length === 0) trend = "new";

    return {
      domain: s.domain,
      totalExecutions: domainAnnotations.length || s.totalExecutions,
      successRate: recentSuccessRate || s.successRate,
      avgDurationMs: s.avgDurationMs,
      topErrors: s.topErrors,
      topLearnings: domainAnnotations
        .filter((a) => a.learning)
        .slice(0, 3)
        .map((a) => a.learning!),
      trend,
    };
  });

  // Aggregate overall stats
  const overallTotal = annotations.length || summaries.reduce((s, v) => s + v.totalExecutions, 0);
  const overallSuccess =
    annotations.length > 0
      ? Math.round(
          (annotations.filter((a) => a.outcome === "success").length / annotations.length) * 100
        )
      : 0;

  // Extract top learnings across all domains
  const allLearnings = annotations
    .filter((a) => a.learning)
    .map((a) => `[${a.domain}] ${a.learning}`)
    .slice(0, 10);

  // Generate recommendations
  const recommendations: string[] = [];
  for (const section of byDomain) {
    if (section.trend === "declining") {
      recommendations.push(
        `${section.domain}: Success rate declining to ${section.successRate}%. Review recent failures.`
      );
    }
    if (section.topErrors.length > 3) {
      recommendations.push(
        `${section.domain}: High error diversity (${section.topErrors.length} unique errors). Consider error categorization.`
      );
    }
  }
  if (recommendations.length === 0) {
    recommendations.push("All domains stable. Continue monitoring.");
  }

  const digest: WeeklyDigest = {
    title: `${daysBack}-Day Annotation Digest`,
    period: { start: since, end: now.toISOString() },
    generated: now.toISOString(),
    overall: {
      totalExecutions: overallTotal,
      overallSuccessRate: overallSuccess,
      domainsActive: byDomain.filter((d) => d.totalExecutions > 0).length,
      totalErrors: annotations.filter((a) => a.outcome === "failure").length,
    },
    byDomain,
    topLearnings: allLearnings,
    recommendations,
  };

  return NextResponse.json(digest);
}
