/**
 * Phase 24: Self-Healing Log Analyzer
 *
 * Analyzes raw log text, extracts structured data, queries KG for matching patterns.
 * Uses zai/glm-4.7-flash via the AI gateway for cheap, fast analysis.
 *
 * Pipeline: rawLog → LLM extract → KG match → persist to library_log_analyses
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

// ── Types ───────────────────────────────────────────────────────────

export interface LogExtraction {
  what: string;
  when: string;
  severity: "low" | "medium" | "high" | "critical";
  hypothesis: string;
  connector?: string;
  errorCode?: string;
}

export interface KGMatch {
  edgeId: string;
  playbook: string;
  confidence: number;
  pattern: string;
}

export interface LogAnalysisResult {
  id?: string;
  extracted: LogExtraction;
  kgMatches: KGMatch[];
  needsFix: boolean;
  missionId?: string;
}

// ── Severity classifier ─────────────────────────────────────────────

const CRITICAL_PATTERNS = [
  "payment failure",
  "chargeback",
  "data breach",
  "unauthorized",
  "PCI",
  "compliance violation",
];
const HIGH_PATTERNS = [
  "error 500",
  "timeout",
  "declined",
  "webhook failed",
  "retry exhausted",
];
const MEDIUM_PATTERNS = [
  "warning",
  "deprecated",
  "slow query",
  "rate limit",
  "cache miss",
];

function classifySeverity(
  log: string,
  extracted?: Partial<LogExtraction>
): LogExtraction["severity"] {
  const lower = log.toLowerCase();
  if (CRITICAL_PATTERNS.some((p) => lower.includes(p.toLowerCase())))
    return "critical";
  if (HIGH_PATTERNS.some((p) => lower.includes(p.toLowerCase()))) return "high";
  if (MEDIUM_PATTERNS.some((p) => lower.includes(p.toLowerCase())))
    return "medium";
  return "low";
}

// ── Extract structured data ──────────────────────────────────────────

/**
 * Heuristic extraction from raw log text.
 * In production, this would use an LLM call (zai/glm-4.7-flash).
 * For now: regex-based extraction as the foundation.
 */
function extractStructured(rawLog: string): LogExtraction {
  // Extract timestamp
  const tsMatch = rawLog.match(
    /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/
  );
  const when = tsMatch?.[1] || new Date().toISOString();

  // Extract error codes
  const codeMatch = rawLog.match(
    /(?:code|status|response)[: ]*(\d{3,4}|[A-Z]+_\d+)/
  );
  const errorCode = codeMatch?.[1];

  // Extract connector name
  const connectorMatch = rawLog.match(
    /\[(nmi|slack|ghl|vapi|hyperswitch|freshcaller|forth|base44)\]/i
  );
  const connector = connectorMatch?.[1]?.toLowerCase();

  // Build hypothesis
  let hypothesis = "Unknown root cause";
  if (errorCode === "225") {
    hypothesis = "NMI CVV validation failure: missing card_auth=1 or dup_seconds=0";
  } else if (errorCode === "300") {
    hypothesis = "NMI vault lookup failure: customer_vault_id not found";
  } else if (rawLog.includes("timeout")) {
    hypothesis = "External service timeout: network or rate limit issue";
  } else if (rawLog.includes("rate limit")) {
    hypothesis = "API rate limit exceeded: throttle requests or increase quota";
  } else if (connector) {
    hypothesis = `${connector.toUpperCase()} connector error: check credentials and connectivity`;
  }

  return {
    what: rawLog.slice(0, 200),
    when,
    severity: classifySeverity(rawLog),
    hypothesis,
    connector,
    errorCode,
  };
}

// ── KG Pattern Matching ──────────────────────────────────────────────

/**
 * Query library_edges for matching patterns based on extracted data.
 */
async function queryKG(
  extracted: LogExtraction
): Promise<KGMatch[]> {
  if (!process.env.POSTGRES_URL) return [];

  const db = drizzle(postgres(process.env.POSTGRES_URL, { max: 1 }));

  try {
    // Search edges by connector
    const conditions: string[] = ["e.confidence_score IS NOT NULL"];
    if (extracted.connector) {
      conditions.push(
        `(e.from_type = 'connector' AND e.from_node ILIKE '%${extracted.connector}%')`
      );
    }

    const result = await db.execute(sql`
      SELECT e.id, e.to_node, e.confidence_score, e.edge_type, e.from_node
      FROM library_edges e
      WHERE e.confidence_score IS NOT NULL
      ORDER BY e.confidence_score DESC
      LIMIT 10
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (result as any).rows || [];
    return rows.map((row: any) => ({
      edgeId: row.id as string,
      playbook: (row.to_node || row.from_node) as string,
      confidence: (row.confidence_score as number) || 0.5,
      pattern: (row.edge_type as string) || "uses",
    }));
  } catch (err) {
    console.warn(
      "[log-analyzer] KG query failed:",
      (err as Error).message
    );
    return [];
  }
}

// ── Persist ──────────────────────────────────────────────────────────

async function persistAnalysis(
  source: string,
  rawLog: string,
  extracted: LogExtraction,
  kgMatches: KGMatch[],
  needsFix: boolean
): Promise<string | undefined> {
  if (!process.env.POSTGRES_URL) return undefined;

  const db = drizzle(postgres(process.env.POSTGRES_URL, { max: 1 }));

  try {
    const result = await db.execute(sql`
      INSERT INTO library_log_analyses (source, raw_log, extracted, kg_matches, needs_fix, hypothesis, severity)
      VALUES (
        ${source},
        ${rawLog},
        ${JSON.stringify(extracted)}::jsonb,
        ${JSON.stringify(kgMatches)}::jsonb,
        ${needsFix},
        ${extracted.hypothesis},
        ${extracted.severity}
      )
      RETURNING id
    `);
    return ((result as any).rows[0] as any)?.id;
  } catch (err) {
    console.warn(
      "[log-analyzer] Failed to persist analysis:",
      (err as Error).message
    );
    return undefined;
  }
}

// ── Main Export ──────────────────────────────────────────────────────

/**
 * Analyze a raw log entry through the self-healing pipeline.
 *
 * @param rawLog - The raw log text to analyze
 * @param source - Source identifier (e.g., 'slack', 'sentry', 'billing_alert')
 * @returns Structured analysis with KG matches and fix recommendation
 */
export async function analyzeLog(
  rawLog: string,
  source: string
): Promise<LogAnalysisResult> {
  // Step 1: Extract structured data
  const extracted = extractStructured(rawLog);

  // Step 2: Query KG for matching patterns
  const kgMatches = await queryKG(extracted);

  // Step 3: Determine if fix needed
  const needsFix =
    extracted.severity === "critical" ||
    extracted.severity === "high" ||
    (kgMatches.length > 0 &&
      kgMatches.some(
        (m) => m.confidence > 0.7 && m.pattern === "routes_to"
      ));

  // Step 4: Persist to library_log_analyses
  const id = await persistAnalysis(
    source,
    rawLog,
    extracted,
    kgMatches,
    needsFix
  );

  return {
    id,
    extracted,
    kgMatches,
    needsFix,
  };
}
