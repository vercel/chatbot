/**
 * session-end-handler.ts — Fires at the end of every chat session.
 *
 * Handles post-session tasks:
 * 1. Logs session outcomes to /api/raw-logs
 * 2. Triggers knowledge extraction via /api/knowledge/extract
 * 3. Invokes the refinement loop via /api/cron/refinement-loop
 * 4. Annotates learnings back to the relevant playbook
 *
 * This is THE self-evolution trigger. Without this, the system never learns.
 * Part of the playbook-skills meta-skill.
 */

export interface SessionEndInput {
  sessionId: string;
  userId: string;
  outcomes: {
    success: boolean;
    durationMs: number;
    errors: string[];
  };
  loadedPlaybook: string;
  toolCalls: string[];
  annotations: string[];
  knowledgeUpdates: string[];
}

export interface SessionEndResult {
  success: boolean;
  sessionId: string;
  rawLogWritten: boolean;
  knowledgeExtracted: boolean;
  refinementProposed: boolean;
  wikiEntityCreated: boolean;
  message: string;
  errors: string[];
}

const API_BASE = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";

/**
 * Write a raw log entry for this session turn.
 */
async function writeRawLog(input: SessionEndInput): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/raw-logs/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        type: "session_end",
        sessionId: input.sessionId,
        userId: input.userId,
        outcomes: input.outcomes,
        loadedPlaybook: input.loadedPlaybook,
        toolCalls: input.toolCalls,
        annotations: input.annotations,
        knowledgeUpdates: input.knowledgeUpdates,
        timestamp: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trigger knowledge extraction from the raw log.
 */
async function extractKnowledge(hoursBack = 1): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/api/knowledge/extract?hoursBack=${hoursBack}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": INTERNAL_TOKEN,
        },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trigger the refinement loop to propose playbook improvements.
 */
async function triggerRefinementLoop(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/cron/refinement-loop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": INTERNAL_TOKEN,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Handle session end: log outcomes, extract knowledge, trigger refinement.
 *
 * This function closes the self-evolution loop:
 *   Raw Log → Knowledge Extract → Wiki Entity → Refinement Patch
 */
export async function sessionEndHandler(
  input: SessionEndInput
): Promise<SessionEndResult> {
  const errors: string[] = [];

  // Step 1: Write raw log
  const rawLogWritten = await writeRawLog(input);
  if (!rawLogWritten) errors.push("Failed to write raw log");

  // Step 2: Extract knowledge from the log
  const knowledgeExtracted = await extractKnowledge(1);
  if (!knowledgeExtracted) errors.push("Knowledge extraction failed");

  // Step 3: Trigger refinement loop (only if session was successful)
  let refinementProposed = false;
  if (input.outcomes.success) {
    refinementProposed = await triggerRefinementLoop();
    if (!refinementProposed) errors.push("Refinement loop failed to propose patch");
  }

  // Step 4: Wiki entity creation is handled by the knowledge extractor
  const wikiEntityCreated = knowledgeExtracted;

  const allSuccess = rawLogWritten && knowledgeExtracted && (input.outcomes.success ? refinementProposed : true);

  return {
    success: allSuccess,
    sessionId: input.sessionId,
    rawLogWritten,
    knowledgeExtracted,
    refinementProposed,
    wikiEntityCreated,
    message: allSuccess
      ? `Self-evolution loop complete for session ${input.sessionId}: raw log → knowledge → wiki → refinement`
      : `Self-evolution loop partially complete for session ${input.sessionId}. Errors: ${errors.join("; ")}`,
    errors,
  };
}

export default sessionEndHandler;
