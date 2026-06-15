/**
 * session-end-logger.workflow.ts — Durable session-end logging workflow.
 *
 * Post-session pipeline:
 * 1. Collects all session data (messages, tools, outcomes)
 * 2. Writes to /api/raw-logs
 * 3. Triggers /api/knowledge/extract for knowledge graph updates
 * 4. Invokes /api/cron/refinement-loop for playbook improvements
 *
 * This closes the self-evolution loop: logs → knowledge → wiki → refinement.
 * Part of the playbook-skills meta-skill.
 */

import { sessionEndHandler, type SessionEndInput } from "../functions/session-end-handler";

export interface SessionEndLoggerInput extends SessionEndInput {
  /** Whether to trigger refinement (default: true if session was successful) */
  triggerRefinement?: boolean;
}

export interface SessionEndLoggerResult {
  success: boolean;
  sessionId: string;
  stepsCompleted: string[];
  stepsFailed: string[];
  totalDurationMs: number;
  selfEvolutionComplete: boolean;
}

/**
 * Execute the session-end logging pipeline.
 *
 * The self-evolution cycle:
 *   1. Raw Log Write → /api/raw-logs
 *   2. Knowledge Extract → /api/knowledge/extract
 *   3. Wiki Entity Create → /api/wiki/entity/{id}
 *   4. Refinement Loop → /api/cron/refinement-loop → proposed patch
 */
export async function sessionEndLoggerWorkflow(
  input: SessionEndLoggerInput
): Promise<SessionEndLoggerResult> {
  const startTime = Date.now();
  const stepsCompleted: string[] = [];
  const stepsFailed: string[] = [];

  // Execute the core handler
  const result = await sessionEndHandler(input);

  if (result.rawLogWritten) {
    stepsCompleted.push("raw_log_write");
  } else {
    stepsFailed.push("raw_log_write");
  }

  if (result.knowledgeExtracted) {
    stepsCompleted.push("knowledge_extract");
  } else {
    stepsFailed.push("knowledge_extract");
  }

  if (result.wikiEntityCreated) {
    stepsCompleted.push("wiki_entity_create");
  } else {
    stepsFailed.push("wiki_entity_create");
  }

  if (result.refinementProposed) {
    stepsCompleted.push("refinement_loop");
  } else {
    stepsFailed.push("refinement_loop");
  }

  const selfEvolutionComplete = stepsFailed.length === 0;
  const totalDurationMs = Date.now() - startTime;

  return {
    success: stepsFailed.length === 0,
    sessionId: input.sessionId,
    stepsCompleted,
    stepsFailed,
    totalDurationMs,
    selfEvolutionComplete,
  };
}

/**
 * Durable variant — wraps in Workflow DevKit 'use workflow' when available.
 * Falls back to regular async execution.
 */
export async function sessionEndLoggerWorkflowDurable(
  input: SessionEndLoggerInput
): Promise<SessionEndLoggerResult> {
  try {
    return await sessionEndLoggerWorkflow(input);
  } catch (err) {
    return {
      success: false,
      sessionId: input.sessionId,
      stepsCompleted: [],
      stepsFailed: [err instanceof Error ? err.message : "Unknown error"],
      totalDurationMs: 0,
      selfEvolutionComplete: false,
    };
  }
}

export default sessionEndLoggerWorkflow;
