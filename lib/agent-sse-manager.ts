/**
 * lib/agent-sse-manager.ts — SSE Connection Pool & Event Manager
 *
 * Manages up to 50 concurrent SSE connections with:
 *   - Exponential backoff reconnection
 *   - Heartbeat keep-alive (every 15s)
 *   - Last-Event-ID recovery
 *   - Graceful shutdown
 *
 * Part of M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { getEvents, createEvent, getLatestEventId } from "./agent-session-store";
import type { AgentSessionEvent } from "./agent-session-store";

// ── Types ──────────────────────────────────────────────────────────────────

export type SSEClient = {
  id: string;
  sessionId: string;
  controller: ReadableStreamDefaultController;
  lastEventId: string | null;
  connectedAt: number;
};

export type SSEEventType =
  | "session:created"
  | "session:updated"
  | "lane:assigned"
  | "status:change"
  | "progress:update"
  | "tool:start"
  | "tool:complete"
  | "tool:error"
  | "file:changed"
  | "build:log"
  | "deploy:status"
  | "pr:created"
  | "enhancement:finding"
  | "cost:update"
  | "pocock:phase"
  | "error"
  | "complete"
  | "cancelled"
  | "heartbeat";

export interface SSEMessage {
  event: SSEEventType;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// ── Connection Pool ────────────────────────────────────────────────────────

const MAX_CONNECTIONS = 50;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

class AgentSSEManager {
  private clients: Map<string, Set<SSEClient>> = new Map(); // sessionId → clients
  private totalClients = 0;

  /**
   * Register a new SSE client for a session.
   * @returns The client object, or null if pool is full.
   */
  registerClient(
    sessionId: string,
    controller: ReadableStreamDefaultController,
    lastEventId: string | null
  ): SSEClient | null {
    if (this.totalClients >= MAX_CONNECTIONS) {
      console.warn(
        `[AgentSSEManager] Connection pool full (${MAX_CONNECTIONS}). Rejecting new client for ${sessionId}`
      );
      return null;
    }

    const client: SSEClient = {
      id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      controller,
      lastEventId,
      connectedAt: Date.now(),
    };

    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId)!.add(client);
    this.totalClients++;

    console.log(
      `[AgentSSEManager] Client ${client.id} registered for session ${sessionId}. Pool: ${this.totalClients}/${MAX_CONNECTIONS}`
    );

    // Start heartbeat for this client
    this.startHeartbeat(client);

    return client;
  }

  /**
   * Remove a client from the pool.
   */
  unregisterClient(client: SSEClient): void {
    const sessionClients = this.clients.get(client.sessionId);
    if (sessionClients) {
      sessionClients.delete(client);
      this.totalClients--;
      if (sessionClients.size === 0) {
        this.clients.delete(client.sessionId);
      }
    }
    console.log(
      `[AgentSSEManager] Client ${client.id} removed. Pool: ${this.totalClients}/${MAX_CONNECTIONS}`
    );
  }

  /**
   * Broadcast an SSE message to ALL clients subscribed to a session.
   */
  broadcast(sessionId: string, message: SSEMessage): number {
    const sessionClients = this.clients.get(sessionId);
    if (!sessionClients || sessionClients.size === 0) return 0;

    const encoder = new TextEncoder();
    const data = `id: ${Date.now()}\nevent: ${message.event}\ndata: ${JSON.stringify(message)}\n\n`;

    let sent = 0;
    for (const client of sessionClients) {
      try {
        client.controller.enqueue(encoder.encode(data));
        sent++;
      } catch (err) {
        console.error(
          `[AgentSSEManager] Failed to send to client ${client.id}:`,
          err
        );
        this.unregisterClient(client);
      }
    }
    return sent;
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(client: SSEClient, message: SSEMessage): boolean {
    try {
      const encoder = new TextEncoder();
      const data = `id: ${Date.now()}\nevent: ${message.event}\ndata: ${JSON.stringify(message)}\n\n`;
      client.controller.enqueue(encoder.encode(data));
      return true;
    } catch (err) {
      console.error(
        `[AgentSSEManager] Failed to send to client ${client.id}:`,
        err
      );
      this.unregisterClient(client);
      return false;
    }
  }

  /**
   * Replay missed events since lastEventId.
   */
  async replayEvents(client: SSEClient): Promise<void> {
    if (!client.lastEventId) return;

    try {
      const events = await getEvents(client.sessionId, { limit: 100 });
      const lastIdx = events.findIndex((e) => e.id === client.lastEventId);

      // Send events after the last known event
      const missedEvents = lastIdx >= 0 ? events.slice(lastIdx + 1) : events;

      for (const event of missedEvents) {
        const message: SSEMessage = {
          event: event.eventType as SSEEventType,
          sessionId: event.sessionId,
          timestamp: new Date(event.createdAt!).getTime(),
          data: event.payload as Record<string, unknown>,
        };
        this.sendToClient(client, message);
      }

      if (missedEvents.length > 0) {
        console.log(
          `[AgentSSEManager] Replayed ${missedEvents.length} missed events for client ${client.id}`
        );
      }
    } catch (err) {
      console.error(
        `[AgentSSEManager] Failed to replay events for client ${client.id}:`,
        err
      );
    }
  }

  /**
   * Get pool stats.
   */
  getStats() {
    return {
      totalClients: this.totalClients,
      maxConnections: MAX_CONNECTIONS,
      activeSessions: this.clients.size,
      sessions: Array.from(this.clients.entries()).map(([sid, clients]) => ({
        sessionId: sid,
        clientCount: clients.size,
      })),
    };
  }

  /**
   * Shutdown all connections gracefully.
   */
  shutdown(): void {
    for (const [, clients] of this.clients) {
      for (const client of clients) {
        try {
          const encoder = new TextEncoder();
          client.controller.enqueue(
            encoder.encode(
              `event: shutdown\ndata: ${JSON.stringify({ reason: "server_shutdown" })}\n\n`
            )
          );
          client.controller.close();
        } catch {
          // Client already closed
        }
      }
    }
    this.clients.clear();
    this.totalClients = 0;
    console.log("[AgentSSEManager] All connections shut down");
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────

  private startHeartbeat(client: SSEClient): void {
    const interval = setInterval(() => {
      const message: SSEMessage = {
        event: "heartbeat" as SSEEventType,
        sessionId: client.sessionId,
        timestamp: Date.now(),
        data: { poolSize: this.totalClients },
      };
      const sent = this.sendToClient(client, message);
      if (!sent) {
        clearInterval(interval);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _manager: AgentSSEManager | null = null;

export function getSSEManager(): AgentSSEManager {
  if (!_manager) {
    _manager = new AgentSSEManager();
  }
  return _manager;
}

/**
 * Calculate exponential backoff delay for reconnection.
 */
export function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    BASE_BACKOFF_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Emit an SSE event to all session subscribers AND persist to DB.
 */
export async function emitSessionEvent(
  sessionId: string,
  eventType: SSEEventType,
  data: Record<string, unknown> = {}
): Promise<void> {
  // Persist to DB
  await createEvent({
    sessionId,
    eventType,
    payload: data,
  });

  // Broadcast to live SSE clients
  const manager = getSSEManager();
  const message: SSEMessage = {
    event: eventType,
    sessionId,
    timestamp: Date.now(),
    data,
  };
  const sent = manager.broadcast(sessionId, message);

  if (sent === 0) {
    // No live clients — that's fine, events are persisted for later replay
  }
}
