/**
 * lib/agent-session-store.ts — Agent Session Persistence Layer
 *
 * Drizzle ORM queries for the agent_sessions + agent_session_events tables.
 * Single source of truth for all CRUD operations on agent sessions.
 *
 * Part of M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { agentSessions, agentSessionEvents } from "@/lib/db/schema";
import type { AgentSession, AgentSessionEvent } from "@/lib/db/schema";
import type { InferInsertModel } from "drizzle-orm";

export type { AgentSession, AgentSessionEvent };

export type AgentSessionInsert = InferInsertModel<typeof agentSessions>;
export type AgentSessionEventInsert = InferInsertModel<typeof agentSessionEvents>;

export type SessionStatus =
  | "routing"
  | "spawning"
  | "running"
  | "building"
  | "deploying"
  | "complete"
  | "failed";

export type SessionLane = "v2" | "vps" | "mcp";

// ── Connection Pool ────────────────────────────────────────────────────────

function getDb() {
  const client = postgres(process.env.POSTGRES_URL ?? "", {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client);
}

// ── Session CRUD ───────────────────────────────────────────────────────────

export async function createSession(
  data: AgentSessionInsert
): Promise<AgentSession> {
  const db = getDb();
  const [session] = await db
    .insert(agentSessions)
    .values(data)
    .returning();
  return session;
}

export async function getSession(
  sessionId: string
): Promise<AgentSession | undefined> {
  const db = getDb();
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.sessionId, sessionId))
    .limit(1);
  return session;
}

export async function updateSession(
  sessionId: string,
  data: Partial<AgentSessionInsert>
): Promise<AgentSession | undefined> {
  const db = getDb();
  const [session] = await db
    .update(agentSessions)
    .set(data)
    .where(eq(agentSessions.sessionId, sessionId))
    .returning();
  return session;
}

export async function listSessions(filters: {
  chatId?: string;
  lane?: SessionLane;
  status?: SessionStatus;
  limit?: number;
}): Promise<AgentSession[]> {
  const db = getDb();
  const conditions = [];
  if (filters.chatId) conditions.push(eq(agentSessions.chatId, filters.chatId));
  if (filters.lane) conditions.push(eq(agentSessions.lane, filters.lane));
  if (filters.status) conditions.push(eq(agentSessions.status, filters.status));

  return db
    .select()
    .from(agentSessions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentSessions.createdAt))
    .limit(filters.limit ?? 50);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(agentSessions)
    .where(eq(agentSessions.sessionId, sessionId));
}

// ── Event Log ──────────────────────────────────────────────────────────────

export async function createEvent(
  data: AgentSessionEventInsert
): Promise<AgentSessionEvent> {
  const db = getDb();
  const [event] = await db
    .insert(agentSessionEvents)
    .values(data)
    .returning();
  return event;
}

export async function getEvents(
  sessionId: string,
  options: { afterId?: string; limit?: number } = {}
): Promise<AgentSessionEvent[]> {
  const db = getDb();
  const conditions = [eq(agentSessionEvents.sessionId, sessionId)];

  let query = db
    .select()
    .from(agentSessionEvents)
    .where(and(...conditions))
    .orderBy(agentSessionEvents.createdAt)
    .limit(options.limit ?? 200);

  return query;
}

export async function getLatestEventId(
  sessionId: string
): Promise<string | null> {
  const db = getDb();
  const [event] = await db
    .select({ id: agentSessionEvents.id })
    .from(agentSessionEvents)
    .where(eq(agentSessionEvents.sessionId, sessionId))
    .orderBy(desc(agentSessionEvents.createdAt))
    .limit(1);
  return event?.id ?? null;
}

// ── Aggregation ────────────────────────────────────────────────────────────

export async function getSessionStats(options: {
  chatId?: string;
}): Promise<{
  total: number;
  running: number;
  completed: number;
  failed: number;
}> {
  const db = getDb();
  const condition = options.chatId
    ? eq(agentSessions.chatId, options.chatId)
    : undefined;

  const all = await db
    .select({ status: agentSessions.status })
    .from(agentSessions)
    .where(condition);

  return {
    total: all.length,
    running: all.filter((s) => !["complete", "failed"].includes(s.status ?? "")).length,
    completed: all.filter((s) => s.status === "complete").length,
    failed: all.filter((s) => s.status === "failed").length,
  };
}
