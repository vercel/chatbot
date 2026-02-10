import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  readPendingCommands,
  publishResult,
  publishStatus,
  type CommandMessage,
} from './message-queue';
import { getOrCreateBrowser, recordAgentActivity } from './browser';

const execFileAsync = promisify(execFile);

// =============================================================================
// Constants
// =============================================================================

const WORKER_POLL_INTERVAL_MS = 250;
const COMMAND_TIMEOUT_MS = 120_000; // 2 minutes per command

/**
 * Track active workers per session so we never run two loops concurrently.
 * Key: `${userId}:${sessionId}`
 */
const activeWorkers = new Map<string, { stop: () => void }>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Ensure a worker is running for the given session.
 *
 * The worker polls the command stream and executes commands sequentially.
 * If a worker already exists for this session it is a no-op.
 *
 * Returns a `stop()` handle so the caller can tear it down (e.g. on abort).
 */
export function ensureWorker(
  userId: string,
  sessionId: string,
): { stop: () => void } {
  const workerKey = `${userId}:${sessionId}`;
  const existing = activeWorkers.get(workerKey);
  if (existing) return existing;

  let running = true;
  const stop = () => {
    running = false;
    activeWorkers.delete(workerKey);
  };

  const handle = { stop };
  activeWorkers.set(workerKey, handle);

  // Fire-and-forget — the loop runs in the background
  void workerLoop(userId, sessionId, () => running);

  return handle;
}

/**
 * Stop the worker for a session if one is running.
 */
export function stopWorker(userId: string, sessionId: string): void {
  const workerKey = `${userId}:${sessionId}`;
  activeWorkers.get(workerKey)?.stop();
}

// =============================================================================
// Worker loop
// =============================================================================

async function workerLoop(
  userId: string,
  sessionId: string,
  isRunning: () => boolean,
): Promise<void> {
  let cursor = '0-0';
  // Track which correlation IDs we've already processed so we don't re-execute
  // after the cursor advances past them.
  const processedIds = new Set<string>();

  console.log(`[Worker] Started for ${sessionId}`);

  while (isRunning()) {
    try {
      const { commands, cursor: newCursor } = await readPendingCommands(
        userId,
        sessionId,
        cursor,
      );

      if (commands.length > 0) {
        cursor = newCursor;

        for (const cmd of commands) {
          if (!isRunning()) break;
          if (processedIds.has(cmd.correlationId)) continue;

          processedIds.add(cmd.correlationId);
          await executeCommand(cmd);

          // Prevent unbounded growth — keep last 500 IDs
          if (processedIds.size > 500) {
            const iter = processedIds.values();
            for (let i = 0; i < 100; i++) iter.next();
            // Delete the oldest 100
            const toDelete: string[] = [];
            const allIds = [...processedIds];
            for (let i = 0; i < 100 && i < allIds.length; i++) {
              toDelete.push(allIds[i]);
            }
            for (const id of toDelete) processedIds.delete(id);
          }
        }
      } else {
        await sleep(WORKER_POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.error('[Worker] Poll error:', err);
      await sleep(WORKER_POLL_INTERVAL_MS * 4);
    }
  }

  console.log(`[Worker] Stopped for ${sessionId}`);
}

// =============================================================================
// Command execution — mirrors the logic from tools/browser.ts
// =============================================================================

async function executeCommand(cmd: CommandMessage): Promise<void> {
  const startTime = Date.now();

  // Publish "started" status
  await publishStatus(cmd.userId, cmd.sessionId, {
    type: 'command_started',
    correlationId: cmd.correlationId,
    command: cmd.command,
    details: '',
    timestamp: String(Date.now()),
  });

  try {
    // Ensure we have a live browser and record activity
    const browser = await getOrCreateBrowser(cmd.sessionId, cmd.userId);
    await recordAgentActivity(cmd.sessionId, cmd.userId);
    const cdpUrl = browser.cdpWsUrl;

    const args = [
      'agent-browser',
      '--cdp',
      cdpUrl,
      ...parseCommand(cmd.command),
    ];

    console.log(`[Worker] Executing: npx ${args.join(' ')}`);

    const { stdout, stderr } = await execFileAsync('npx', args, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    });

    const durationMs = Date.now() - startTime;

    if (stderr) console.log('[Worker] stderr:', stderr);

    await publishResult(cmd.userId, cmd.sessionId, {
      correlationId: cmd.correlationId,
      success: 'true',
      output: stdout || 'Command completed successfully',
      error: '',
      durationMs: String(durationMs),
      timestamp: String(Date.now()),
    });

    await publishStatus(cmd.userId, cmd.sessionId, {
      type: 'command_completed',
      correlationId: cmd.correlationId,
      command: cmd.command,
      details: `${durationMs}ms`,
      timestamp: String(Date.now()),
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const execError = error as {
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    console.error('[Worker] Command failed:', {
      command: cmd.command,
      killed: execError.killed,
      message: execError.message,
    });

    const errorMessage = execError.killed
      ? 'Command timed out after 2 minutes'
      : execError.stderr || execError.message || 'Command failed';

    await publishResult(cmd.userId, cmd.sessionId, {
      correlationId: cmd.correlationId,
      success: 'false',
      output: execError.stdout || '',
      error: errorMessage,
      durationMs: String(durationMs),
      timestamp: String(Date.now()),
    });

    await publishStatus(cmd.userId, cmd.sessionId, {
      type: 'command_failed',
      correlationId: cmd.correlationId,
      command: cmd.command,
      details: errorMessage,
      timestamp: String(Date.now()),
    });
  }
}

// =============================================================================
// Helpers (same parser as tools/browser.ts)
// =============================================================================

function parseCommand(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (inQuote) {
      if (ch === '\\' && i + 1 < command.length) {
        current += command[++i];
      } else if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
