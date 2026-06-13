/**
 * U7.2: Raw Log Collector — writes immutable turn logs to 2 tiers.
 *
 * HOT: Upstash Redis — last 24h (TTL=86400), keyed by sessionId:turnId
 * COLD: Postgres raw_logs table — permanent, paginated by session
 *
 * Cardinal: Raw logs are IMMUTABLE — never delete, only redact secrets pre-write.
 */

import { createHash } from "crypto";
import postgres from "postgres";
import { createClient } from "redis";
import { redactLogEntry } from "./redactor";
import type { RawLogEntry, RawLogQuery, RawLogStats } from "./types";

// ── Singleton clients ──────────────────────────────────────────────────────

let _pgClient: ReturnType<typeof postgres> | null = null;
let _redisClient: ReturnType<typeof createClient> | null = null;

function getPg(): ReturnType<typeof postgres> {
  if (!_pgClient) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL not set");
    _pgClient = postgres(url, { max: 3, idle_timeout: 30 });
  }
  return _pgClient;
}

function getRedis() {
  if (!_redisClient && process.env.REDIS_URL) {
    _redisClient = createClient({ url: process.env.REDIS_URL });
    _redisClient.on("error", () => {});
    _redisClient.connect().catch(() => {
      _redisClient = null;
    });
  }
  return _redisClient;
}

// ── Hash helpers ───────────────────────────────────────────────────────────

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt.slice(0, 5000)).digest("hex").slice(0, 16);
}

// ── Collect ────────────────────────────────────────────────────────────────

export interface CollectLogInput {
  sessionId: string;
  turnId: string;
  userId: string;
  userMessage: string;
  systemPrompt: string;
  loadedPlaybook?: string;
  loadedRoutine?: string;
  knowledgeQueries?: RawLogEntry["knowledgeQueries"];
  toolCalls?: RawLogEntry["toolCalls"];
  reasoning?: string;
  finalResponse: string;
  outcomes: RawLogEntry["outcomes"];
  annotations?: string[];
  knowledgeUpdates?: RawLogEntry["knowledgeUpdates"];
}

export async function collectRawLog(input: CollectLogInput): Promise<void> {
  // Build the raw entry
  const raw: RawLogEntry = {
    id: input.turnId,
    sessionId: input.sessionId,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    userMessage: input.userMessage.slice(0, 4000),
    systemPromptHash: hashPrompt(input.systemPrompt),
    loadedPlaybook: input.loadedPlaybook,
    loadedRoutine: input.loadedRoutine,
    knowledgeQueries: input.knowledgeQueries ?? [],
    toolCalls: input.toolCalls ?? [],
    reasoning: input.reasoning?.slice(0, 8000) ?? "",
    finalResponse: input.finalResponse.slice(0, 8000),
    outcomes: input.outcomes,
    annotations: input.annotations ?? [],
    knowledgeUpdates: input.knowledgeUpdates ?? [],
  };

  // Redact secrets before any write
  const redacted = redactLogEntry(raw as unknown as Record<string, unknown>);

  // Write to HOT tier (Redis)
  try {
    const redis = getRedis();
    if (redis?.isReady) {
      const key = `rawlog:${raw.sessionId}:${raw.id}`;
      const value = JSON.stringify(redacted);
      await redis.set(key, value, { EX: 86400 }); // 24h TTL
      // Add to session index
      await redis.zAdd(`rawlog:session:${raw.sessionId}`, {
        score: Date.now(),
        value: raw.id,
      });
      await redis.expire(`rawlog:session:${raw.sessionId}`, 86400);
    }
  } catch (err) {
    console.warn("[raw-logs] Redis write failed (non-fatal):", (err as Error).message);
  }

  // Write to COLD tier (Postgres)
  try {
    const pg = getPg();
    const json = JSON.stringify(redacted);
    await pg`
      INSERT INTO raw_logs (
        id, session_id, timestamp, user_id, user_message,
        system_prompt_hash, loaded_playbook, loaded_routine,
        knowledge_queries, tool_calls, reasoning, final_response,
        outcomes, annotations, knowledge_updates, raw_json
      ) VALUES (
        ${raw.id}, ${raw.sessionId}, ${raw.timestamp}, ${raw.userId},
        ${raw.userMessage}, ${raw.systemPromptHash},
        ${raw.loadedPlaybook ?? null}, ${raw.loadedRoutine ?? null},
        ${JSON.stringify(raw.knowledgeQueries)}::jsonb,
        ${JSON.stringify(raw.toolCalls)}::jsonb,
        ${raw.reasoning}, ${raw.finalResponse},
        ${JSON.stringify(raw.outcomes)}::jsonb,
        ${JSON.stringify(raw.annotations)}::jsonb,
        ${JSON.stringify(raw.knowledgeUpdates)}::jsonb,
        ${json}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        outcomes = EXCLUDED.outcomes,
        annotations = EXCLUDED.annotations,
        knowledge_updates = EXCLUDED.knowledge_updates,
        raw_json = EXCLUDED.raw_json
    `;
  } catch (err) {
    console.warn("[raw-logs] Postgres write failed (non-fatal):", (err as Error).message);
  }
}

// ── Query ──────────────────────────────────────────────────────────────────

export async function queryRawLogs(
  params: RawLogQuery
): Promise<{ entries: RawLogEntry[]; total: number }> {
  const pg = getPg();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let where = "WHERE 1=1";
  const vals: any[] = [];

  if (params.sessionId) {
    where += ` AND session_id = $${vals.push(params.sessionId)}`;
  }
  if (params.userId) {
    where += ` AND user_id = $${vals.push(params.userId)}`;
  }
  if (params.startDate) {
    where += ` AND timestamp >= $${vals.push(params.startDate)}`;
  }
  if (params.endDate) {
    where += ` AND timestamp <= $${vals.push(params.endDate)}`;
  }

  const countResult = await pg.unsafe(
    `SELECT COUNT(*)::int AS total FROM raw_logs ${where}`,
    vals
  );
  const total = (countResult[0] as unknown as { total: number }).total;

  const entries = await pg.unsafe(
    `SELECT
      id, session_id, timestamp, user_id, user_message,
      system_prompt_hash, loaded_playbook, loaded_routine,
      knowledge_queries, tool_calls, reasoning, final_response,
      outcomes, annotations, knowledge_updates
    FROM raw_logs ${where}
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}`,
    vals
  );

  return {
    entries: entries.map(mapRow),
    total,
  };
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getRawLogStats(): Promise<RawLogStats> {
  const pg = getPg();

  const [stats] = await pg`
    SELECT
      COUNT(*)::int AS total_entries,
      COUNT(DISTINCT session_id)::int AS total_sessions,
      COALESCE(SUM(
        CASE
          WHEN jsonb_typeof(tool_calls) = 'array' THEN jsonb_array_length(tool_calls)
          ELSE 0
        END
      ), 0)::int AS total_tool_calls,
      COALESCE(AVG(COALESCE((outcomes->>'durationMs')::int, 0)), 0)::float AS avg_duration_ms,
      COALESCE(
        COUNT(*) FILTER (WHERE COALESCE((outcomes->>'success')::boolean, false) = true)::float
          / NULLIF(COUNT(*), 0) * 100,
        0
      )::float AS success_rate
    FROM raw_logs
  `;

  // Count hot entries in Redis
  let hotEntries = 0;
  try {
    const redis = getRedis();
    if (redis?.isReady) {
      const keys = await redis.keys("rawlog:*");
      hotEntries = keys.length;
    }
  } catch {
    // Redis unavailable — not an error
  }

  return {
    totalEntries: stats.total_entries ?? 0,
    totalSessions: stats.total_sessions ?? 0,
    totalToolCalls: stats.total_tool_calls ?? 0,
    avgDurationMs: Math.round(stats.avg_duration_ms ?? 0),
    successRate: Math.round((stats.success_rate ?? 0) * 100) / 100,
    hotEntries,
    coldEntries: stats.total_entries ?? 0,
  };
}

// ── Row mapping ────────────────────────────────────────────────────────────

function parseJsonb<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  if (Array.isArray(val) || (typeof val === "object" && val !== null)) return val as T;
  return fallback;
}

function mapRow(row: Record<string, unknown>): RawLogEntry {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    timestamp: row.timestamp as string,
    userId: row.user_id as string,
    userMessage: row.user_message as string,
    systemPromptHash: row.system_prompt_hash as string,
    loadedPlaybook: row.loaded_playbook as string | undefined,
    loadedRoutine: row.loaded_routine as string | undefined,
    knowledgeQueries: parseJsonb(row.knowledge_queries, []),
    toolCalls: parseJsonb(row.tool_calls, []),
    reasoning: (row.reasoning as string) ?? "",
    finalResponse: row.final_response as string,
    outcomes: parseJsonb(row.outcomes, { success: false, durationMs: 0, errors: [] }),
    annotations: parseJsonb(row.annotations, []),
    knowledgeUpdates: parseJsonb(row.knowledge_updates, []),
  };
}
