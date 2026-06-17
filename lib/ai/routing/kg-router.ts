/**
 * Phase 24: KG-First Router
 *
 * Routes user intents to playbooks using:
 * 1. library_playbook_usage (similar past intents — text similarity)
 * 2. library_edges (confidence scores on playbook->connector edges)
 * 3. Fallback: inline PLAYBOOK-ROUTER.md keyword matching
 *
 * Returns top 3 playbooks ranked by combined confidence score.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ────────────────────────────────────────────────────────

export interface PlaybookMatch {
  slug: string;
  confidence: number; // 0.0–1.0
  source: "kg_usage" | "kg_edge" | "router_md" | "hybrid";
  evidence: string; // What matched (intent text, edge, etc.)
  similarIntents?: string[]; // Past similar intents
  edgeWeights?: Record<string, number>; // Connector confidence scores
}

export interface RoutingResult {
  matches: PlaybookMatch[];
  primary: PlaybookMatch | null;
  fallbackUsed: boolean;
  queryTimeMs: number;
}

// ── DB Helper ────────────────────────────────────────────────────

function getDb() {
  if (!process.env.POSTGRES_URL) throw new Error("POSTGRES_URL not configured");
  return drizzle(postgres(process.env.POSTGRES_URL, { max: 1 }));
}

// ── Text Similarity (simple token overlap) ────────────────────────

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  const tokensB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  return intersection / Math.max(tokensA.size, tokensB.size);
}

// ── Router MD Fallback Keywords ──────────────────────────────────

const ROUTER_MD_PATH = join(
  process.cwd(),
  "connectors/neptune/skills/custom-skills/playbook-skills",
  "PLAYBOOK-ROUTER.md"
);

const PLAYBOOK_KEYWORDS: Record<string, string[]> = {
  billing: [
    "charge", "payment", "nmi", "subscription", "invoice", "refund",
    "card", "billing", "vault",
  ],
  "customer-support": [
    "ticket", "customer", "support", "help", "issue", "complaint",
  ],
  disputes: [
    "dispute", "credit report", "fcra", "bureau", "equifax", "experian",
    "transunion", "negative item",
  ],
  engineering: [
    "code", "refactor", "pr", "build", "repo", "deploy", "bug", "fix",
    "feature",
  ],
  deploy: [
    "deploy", "vercel", "ship", "release", "preview",
  ],
  planning: [
    "plan", "prd", "roadmap", "phase", "spec", "architecture",
  ],
  reporting: [
    "report", "dashboard", "analytics", "metrics", "data",
  ],
  "agent-orchestration": [
    "dispatch", "multi-agent", "parallel", "orchestrate", "swarm",
  ],
  sales: [
    "deal", "pipeline", "lead", "close", "crm", "sales",
  ],
  marketing: [
    "campaign", "email", "outreach", "blast", "marketing",
  ],
  "vps-ops": [
    "vps", "server", "nginx", "pm2", "hostinger", "ssh",
  ],
  "vercel-discipline": [
    "vercel", "domain", "dns", "preview deployment",
  ],
  "video-generation": [
    "video", "notebooklm", "podcast", "generate video",
  ],
  hr: [
    "hire", "interview", "onboarding", "team", "hr",
  ],
  other: [], // catch-all (always last)
};

/**
 * KG-First Router: Find the best playbook(s) for a user intent.
 */
export async function routeIntent(
  intent: string,
  sessionId?: string
): Promise<RoutingResult> {
  const startTime = Date.now();
  const matches: PlaybookMatch[] = [];

  try {
    const db = getDb();

    // Source 1: Past similar intents from library_playbook_usage
    const pastUsages = await db.execute(sql`
      SELECT playbook_slug, intent_text, success, created_at
      FROM library_playbook_usage
      WHERE intent_text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);

    if (pastUsages.rows.length > 0) {
      const scored: Map<
        string,
        { score: number; count: number; examples: string[] }
      > = new Map();

      for (const row of pastUsages.rows) {
        const slug = row.playbook_slug as string;
        const pastIntent = (row.intent_text as string) || "";
        const overlap = tokenOverlap(intent, pastIntent);

        if (overlap > 0.1) {
          const existing = scored.get(slug) || {
            score: 0,
            count: 0,
            examples: [],
          };
          existing.score += overlap * (row.success ? 1.0 : 0.3);
          existing.count++;
          if (existing.examples.length < 3) {
            existing.examples.push(pastIntent);
          }
          scored.set(slug, existing);
        }
      }

      // Normalize into matches
      const maxScore = Math.max(
        ...Array.from(scored.values()).map((s) => s.score),
        1
      );
      for (const [slug, data] of scored) {
        matches.push({
          slug,
          confidence: Math.min(data.score / maxScore, 1.0),
          source: "kg_usage",
          evidence: `${data.count} similar past intent(s)`,
          similarIntents: data.examples,
        });
      }
    }

    // Source 2: Edge confidence scores from library_edges
    if (matches.length < 3) {
      const edges = await db.execute(sql`
        SELECT e.to_node AS playbook_slug, e.confidence_score, e.edge_type
        FROM library_edges e
        WHERE e.to_type = 'playbook'
          AND e.confidence_score IS NOT NULL
        ORDER BY e.confidence_score DESC
        LIMIT 20
      `);

      for (const row of edges.rows) {
        const slug = row.playbook_slug as string;
        const edgeConfidence = (row.confidence_score as number) || 0.5;
        // Boost if intent keywords match playbook keywords
        const keywords = PLAYBOOK_KEYWORDS[slug] || [];
        const keywordMatch = keywords.filter((k) =>
          intent.toLowerCase().includes(k.toLowerCase())
        ).length;
        const boost =
          keywordMatch > 0
            ? Math.min(keywordMatch / keywords.length, 0.3)
            : 0;

        const existing = matches.find((m) => m.slug === slug);
        if (!existing) {
          matches.push({
            slug,
            confidence: Math.min(edgeConfidence + boost, 1.0),
            source: "kg_edge",
            evidence: `Edge confidence: ${edgeConfidence.toFixed(2)}`,
          });
        } else {
          existing.confidence = Math.max(
            existing.confidence,
            edgeConfidence + boost
          );
          existing.source = "hybrid";
        }
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);
  } catch (err) {
    console.warn(
      "[kg-router] DB query failed, using file fallback:",
      (err as Error).message
    );
  }

  // Fallback: Pattern match against PLAYBOOK_KEYWORDS
  if (matches.length === 0) {
    for (const [slug, keywords] of Object.entries(PLAYBOOK_KEYWORDS)) {
      if (slug === "other") continue; // Skip catch-all during scoring
      const matchedKeywords = keywords.filter((k) =>
        intent.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        matches.push({
          slug,
          confidence: Math.min(matchedKeywords.length / keywords.length, 0.7),
          source: "router_md",
          evidence: `Keyword match: ${matchedKeywords.join(", ")}`,
        });
      }
    }
  }

  // If still nothing, return "other" as catch-all
  if (matches.length === 0) {
    matches.push({
      slug: "other",
      confidence: 0.3,
      source: "router_md",
      evidence: "No specific match — catch-all playbook",
    });
  }

  // Sort final
  matches.sort((a, b) => b.confidence - a.confidence);

  return {
    matches: matches.slice(0, 5),
    primary: matches[0] || null,
    fallbackUsed: matches[0]?.source === "router_md",
    queryTimeMs: Date.now() - startTime,
  };
}

/**
 * Log playbook usage for future KG enrichment.
 */
export async function logPlaybookUsage(
  playbookSlug: string,
  intentText: string,
  sessionId: string,
  success: boolean,
  durationMs: number
): Promise<void> {
  try {
    const db = getDb();
    await db.execute(sql`
      INSERT INTO library_playbook_usage (playbook_slug, intent_text, session_id, success, duration_ms)
      VALUES (${playbookSlug}, ${intentText}, ${sessionId}, ${success}, ${durationMs})
    `);
  } catch (err) {
    console.warn(
      "[kg-router] Failed to log playbook usage:",
      (err as Error).message
    );
  }
}
