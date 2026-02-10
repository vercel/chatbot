import {
  redis,
  cmdStreamKey,
  resStreamKey,
  statusStreamKey,
  STREAM_TTL_SECONDS,
} from './browser';

// =============================================================================
// Types
// =============================================================================

export interface CommandMessage {
  correlationId: string;
  command: string;
  sessionId: string;
  userId: string;
  timestamp: number;
}

export interface ResultMessage {
  correlationId: string;
  success: string; // "true" / "false" — Redis streams store strings
  output: string;
  error: string;
  durationMs: string;
  timestamp: string;
}

export type StatusEventType =
  | 'command_queued'
  | 'command_started'
  | 'command_completed'
  | 'command_failed'
  | 'session_expired';

export interface StatusEvent {
  type: StatusEventType;
  correlationId: string;
  command: string;
  details: string;
  timestamp: string;
}

// =============================================================================
// Constants
// =============================================================================

const RESULT_POLL_INTERVAL_MS = 200;
const RESULT_POLL_TIMEOUT_MS = 130_000; // slightly above the 2-min command timeout
const MAX_STREAM_LEN = 200; // auto-trim streams to cap memory

// =============================================================================
// Producer — called by the browser tool
// =============================================================================

/**
 * Enqueue a browser command for execution.
 *
 * Adds the command to the per-session command stream and publishes a
 * `command_queued` status event so the client can show it immediately.
 *
 * Returns the stream entry ID assigned by Redis.
 */
export async function enqueueCommand(
  msg: CommandMessage,
): Promise<string> {
  const key = cmdStreamKey(msg.userId, msg.sessionId);

  const entryId = await redis.xadd(key, '*', {
    correlationId: msg.correlationId,
    command: msg.command,
    sessionId: msg.sessionId,
    userId: msg.userId,
    timestamp: String(msg.timestamp),
  }, {
    trim: { type: 'MAXLEN', threshold: MAX_STREAM_LEN, comparison: '~' },
  });

  await redis.expire(key, STREAM_TTL_SECONDS);

  // Publish status event
  await publishStatus(msg.userId, msg.sessionId, {
    type: 'command_queued',
    correlationId: msg.correlationId,
    command: msg.command,
    details: '',
    timestamp: String(Date.now()),
  });

  return entryId;
}

/**
 * Wait for a result matching the given correlationId.
 *
 * Polls the result stream using XRANGE until the matching result appears or
 * the timeout expires. Supports early cancellation via AbortSignal.
 */
export async function awaitResult(
  userId: string,
  sessionId: string,
  correlationId: string,
  abortSignal?: AbortSignal,
): Promise<{ success: boolean; output: string | null; error: string | null }> {
  const key = resStreamKey(userId, sessionId);
  const deadline = Date.now() + RESULT_POLL_TIMEOUT_MS;
  let lastId = '0-0';

  while (Date.now() < deadline) {
    if (abortSignal?.aborted) {
      return { success: false, output: null, error: 'Command aborted by user' };
    }

    const entries = await redis.xrange(key, lastId, '+', 50);

    if (entries && typeof entries === 'object') {
      // xrange returns Record<id, fields> or array depending on version
      const entryList = Array.isArray(entries)
        ? entries
        : Object.entries(entries);

      for (const entry of entryList) {
        let id: string;
        let fields: Record<string, string>;

        if (Array.isArray(entry)) {
          // [id, fieldsObject]
          id = entry[0] as string;
          fields = entry[1] as Record<string, string>;
        } else {
          // Object form — shouldn't happen with xrange but handle gracefully
          continue;
        }

        // Advance cursor past this entry (exclusive start for next poll)
        lastId = incrementStreamId(id);

        if (fields.correlationId === correlationId) {
          return {
            success: fields.success === 'true',
            output: fields.output || null,
            error: fields.error || null,
          };
        }
      }
    }

    await sleep(RESULT_POLL_INTERVAL_MS);
  }

  return { success: false, output: null, error: 'Timed out waiting for command result' };
}

// =============================================================================
// Worker → result stream
// =============================================================================

/**
 * Publish a command result to the result stream.
 *
 * Called by the command worker after executing a browser command.
 */
export async function publishResult(
  userId: string,
  sessionId: string,
  result: ResultMessage,
): Promise<void> {
  const key = resStreamKey(userId, sessionId);

  await redis.xadd(key, '*', {
    correlationId: result.correlationId,
    success: result.success,
    output: result.output,
    error: result.error,
    durationMs: result.durationMs,
    timestamp: result.timestamp,
  }, {
    trim: { type: 'MAXLEN', threshold: MAX_STREAM_LEN, comparison: '~' },
  });

  await redis.expire(key, STREAM_TTL_SECONDS);
}

// =============================================================================
// Status stream — worker publishes, SSE endpoint reads
// =============================================================================

/**
 * Publish a status event visible to the client via SSE.
 */
export async function publishStatus(
  userId: string,
  sessionId: string,
  event: StatusEvent,
): Promise<void> {
  const key = statusStreamKey(userId, sessionId);

  await redis.xadd(key, '*', {
    type: event.type,
    correlationId: event.correlationId,
    command: event.command,
    details: event.details,
    timestamp: event.timestamp,
  }, {
    trim: { type: 'MAXLEN', threshold: MAX_STREAM_LEN, comparison: '~' },
  });

  await redis.expire(key, STREAM_TTL_SECONDS);
}

/**
 * Read status events from a given cursor position.
 *
 * Returns new events and the updated cursor (last seen ID) so the caller
 * can poll incrementally.
 */
export async function readStatusEvents(
  userId: string,
  sessionId: string,
  lastId: string = '0-0',
  count: number = 50,
): Promise<{ events: StatusEvent[]; cursor: string }> {
  const key = statusStreamKey(userId, sessionId);
  const entries = await redis.xrange(key, lastId, '+', count);

  const events: StatusEvent[] = [];
  let cursor = lastId;

  if (entries && typeof entries === 'object') {
    const entryList = Array.isArray(entries)
      ? entries
      : Object.entries(entries);

    for (const entry of entryList) {
      if (!Array.isArray(entry)) continue;
      const id = entry[0] as string;
      const fields = entry[1] as Record<string, string>;

      cursor = incrementStreamId(id);
      events.push({
        type: fields.type as StatusEventType,
        correlationId: fields.correlationId ?? '',
        command: fields.command ?? '',
        details: fields.details ?? '',
        timestamp: fields.timestamp ?? String(Date.now()),
      });
    }
  }

  return { events, cursor };
}

// =============================================================================
// Worker — pending command reader
// =============================================================================

/**
 * Read pending commands from the command stream.
 *
 * The worker calls this in a poll loop to pick up new commands.
 */
export async function readPendingCommands(
  userId: string,
  sessionId: string,
  lastId: string = '0-0',
  count: number = 10,
): Promise<{ commands: (CommandMessage & { entryId: string })[]; cursor: string }> {
  const key = cmdStreamKey(userId, sessionId);
  const entries = await redis.xrange(key, lastId, '+', count);

  const commands: (CommandMessage & { entryId: string })[] = [];
  let cursor = lastId;

  if (entries && typeof entries === 'object') {
    const entryList = Array.isArray(entries)
      ? entries
      : Object.entries(entries);

    for (const entry of entryList) {
      if (!Array.isArray(entry)) continue;
      const id = entry[0] as string;
      const fields = entry[1] as Record<string, string>;

      cursor = incrementStreamId(id);
      commands.push({
        entryId: id,
        correlationId: fields.correlationId,
        command: fields.command,
        sessionId: fields.sessionId,
        userId: fields.userId,
        timestamp: Number(fields.timestamp),
      });
    }
  }

  return { commands, cursor };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Increment a Redis stream ID so it becomes an exclusive lower bound.
 * e.g. "1707200000000-0" → "1707200000000-1"
 */
function incrementStreamId(id: string): string {
  const [ms, seq] = id.split('-');
  return `${ms}-${Number(seq) + 1}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
