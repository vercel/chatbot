/**
 * Phase 28: Handoff Health — shared module for recording handoff events.
 *
 * Used by spawnCodingAgent and v2-webhooks to track handoff success/failure.
 * The /api/handoff-health endpoint reads from this module's state.
 */

// Deferred import to avoid circular dependencies
let healthModule: typeof import("@/app/api/handoff-health/route") | null = null;

async function getHealthModule() {
  if (!healthModule) {
    // Dynamic import to break potential circular dep
    healthModule = await import("@/app/api/handoff-health/route").catch(() => null);
  }
  return healthModule;
}

export async function recordHandoffSuccess(sessionId: string, durationMs?: number): Promise<void> {
  const mod = await getHealthModule();
  if (mod?.recordHandoffSuccess) {
    mod.recordHandoffSuccess(sessionId, durationMs);
  } else {
    console.log(`[handoff-health] ✅ Success: ${sessionId} (${durationMs}ms)`);
  }
}

export async function recordHandoffFailure(error: string, sessionId?: string): Promise<void> {
  const mod = await getHealthModule();
  if (mod?.recordHandoffFailure) {
    mod.recordHandoffFailure(error, sessionId);
  } else {
    console.error(`[handoff-health] ❌ Failure: ${error}`);
  }
}
