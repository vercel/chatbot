/**
 * Phase 31: Natural Language CRM Intent Detection
 *
 * Auto-detects CRM action intent from chat messages.
 * Used by the LLM tool-calling layer to route user requests to the correct action.
 *
 * Examples:
 *   "update Mike's status to Paused" → updatePersonStatus
 *   "send Mike a payment link for $99" → sendPaymentLink
 *   "add note: customer called about billing" → addNote
 */

import { CRM_ACTIONS, detectAction, type CrmActionDefinition } from "./registry";

export interface DetectedIntent {
  /** Matched action definition */
  action: CrmActionDefinition;
  /** Confidence score 0-1 */
  confidence: number;
  /** Extracted parameters from the phrase */
  extractedParams: Record<string, string | number>;
  /** The original phrase */
  phrase: string;
}

/**
 * Structured extraction patterns for common CRM intents.
 * Each pattern has a regex and a parameter extraction function.
 */
interface ExtractionPattern {
  actionName: string;
  regex: RegExp;
  extract: (match: RegExpMatchArray, phrase: string) => Record<string, string | number>;
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // "update X's status to Y"
  {
    actionName: "updatePersonStatus",
    regex: /(?:update|change|set)\s+(\w+(?:\s+\w+)?)(?:'s)?\s+status\s+(?:to\s+)?(\w+)/i,
    extract: (m) => ({ personName: m[1]?.trim(), status: m[2]?.trim().toLowerCase() }),
  },
  // "send X a payment link for $N"
  {
    actionName: "sendPaymentLink",
    regex: /send\s+(\w+(?:\s+\w+)?)\s+(?:a\s+)?payment\s+(?:link|request)\s+(?:for\s+)?\$?(\d+(?:\.\d{2})?)/i,
    extract: (m) => ({ personName: m[1]?.trim(), amount: parseFloat(m[2] || "0") }),
  },
  // "add note: ..." / "add a note: ..."
  {
    actionName: "addNote",
    regex: /(?:add|write)\s+(?:a\s+)?note\s*[:]\s*(.+)/i,
    extract: (m) => ({ note: m[1]?.trim() }),
  },
  // "cancel subscription for X because Y"
  {
    actionName: "cancelSubscription",
    regex: /(?:cancel|stop|terminate)\s+subscription\s+(?:for\s+)?(\w+(?:\s+\w+)?)(?:\s+(?:because|reason|due to)\s+(.+))?/i,
    extract: (m) => ({ personName: m[1]?.trim(), reason: m[2]?.trim() || "No reason provided" }),
  },
  // "pause subscription until DATE"
  {
    actionName: "pauseSubscription",
    regex: /(?:pause|suspend|hold)\s+subscription\s+(?:until\s+)?(.+)/i,
    extract: (m) => ({ until: m[1]?.trim() }),
  },
  // "create a ticket for X: TITLE"
  {
    actionName: "createSupportTicket",
    regex: /(?:create|open|file)\s+(?:a\s+)?(?:support\s+)?ticket\s+(?:for\s+)?(\w+(?:\s+\w+)?)(?:\s*[:]\s*(.+))?/i,
    extract: (m) => ({ personName: m[1]?.trim(), title: m[2]?.trim() || "Support request" }),
  },
  // "assign X to Y"
  {
    actionName: "assignToAgent",
    regex: /(?:assign|reassign|transfer)\s+(\w+(?:\s+\w+)?)\s+(?:to\s+)?(\S+@\S+)/i,
    extract: (m) => ({ personName: m[1]?.trim(), agentEmail: m[2]?.trim() }),
  },
  // "send SMS to X: MESSAGE"
  {
    actionName: "sendSMS",
    regex: /(?:send|text)\s+(?:sms|text|message)\s+(?:to\s+)?(\w+(?:\s+\w+)?)(?:\s*[:]\s*(.+))?/i,
    extract: (m) => ({ personName: m[1]?.trim(), message: m[2]?.trim() || "" }),
  },
  // "log a call/meeting with X"
  {
    actionName: "createActivity",
    regex: /log\s+(?:a\s+)?(call|meeting|email)\s+(?:with\s+)?(\w+(?:\s+\w+)?)(?:\s*[:]\s*(.+))?/i,
    extract: (m) => ({ activityType: m[1]?.trim().toLowerCase(), personName: m[2]?.trim(), content: m[3]?.trim() || "" }),
  },
  // "file a dispute for X with BUREAU"
  {
    actionName: "createDispute",
    regex: /(?:file|create|start)\s+(?:a\s+)?dispute\s+(?:for\s+)?(\w+(?:\s+\w+)?)(?:\s+(?:with|at)\s+(experian|equifax|transunion))?/i,
    extract: (m) => ({ personName: m[1]?.trim(), bureau: m[2]?.trim().toLowerCase() || "experian" }),
  },
  // "schedule a follow-up with X on DATE"
  {
    actionName: "scheduleFollowUp",
    regex: /(?:schedule|set)\s+(?:a\s+)?(?:follow[- ]up|reminder)\s+(?:with\s+)?(\w+(?:\s+\w+)?)(?:\s+(?:on|for)\s+(.+))?/i,
    extract: (m) => ({ personName: m[1]?.trim(), scheduledDate: m[2]?.trim() || "tomorrow" }),
  },
  // "tag X as Y"
  {
    actionName: "tagPerson",
    regex: /(?:tag|label|mark)\s+(\w+(?:\s+\w+)?)\s+(?:as\s+)?(\w+)/i,
    extract: (m) => ({ personName: m[1]?.trim(), tag: m[2]?.trim() }),
  },
];

/**
 * Multi-layered detection: structured extraction first, then fuzzy matching.
 * Returns the best detected intent with confidence score.
 */
export function detectIntent(
  phrase: string,
  minConfidence = 0.3
): DetectedIntent | null {
  // ── Layer 1: Structured extraction patterns ──────────────────────────
  for (const pattern of EXTRACTION_PATTERNS) {
    const match = phrase.match(pattern.regex);
    if (match) {
      const action = CRM_ACTIONS.find((a) => a.name === pattern.actionName);
      if (action) {
        return {
          action,
          confidence: 0.85, // High confidence for structured match
          extractedParams: pattern.extract(match, phrase),
          phrase,
        };
      }
    }
  }

  // ── Layer 2: Fuzzy trigger phrase matching ───────────────────────────
  let bestAction: CrmActionDefinition | null = null;
  let bestScore = 0;

  for (const action of CRM_ACTIONS) {
    const score = scoreActionFuzzy(action, phrase);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  if (bestAction && bestScore >= minConfidence) {
    return {
      action: bestAction,
      confidence: bestScore,
      extractedParams: extractCommonParams(phrase),
      phrase,
    };
  }

  return null;
}

/**
 * Fuzzy scoring that considers trigger phrases + semantic similarity.
 */
function scoreActionFuzzy(action: CrmActionDefinition, phrase: string): number {
  const lower = phrase.toLowerCase();
  let maxScore = 0;

  for (const trigger of action.triggerPhrases) {
    const triggerLower = trigger.toLowerCase();

    // Exact phrase match
    if (lower === triggerLower) return 1.0;

    // Substring match — score by length ratio
    if (lower.includes(triggerLower)) {
      const score = 0.4 + (triggerLower.length / lower.length) * 0.3;
      if (score > maxScore) maxScore = score;
    }

    // Word-level overlap (Jaccard-like)
    const phraseWords = new Set(lower.split(/\s+/));
    const triggerWords = triggerLower.split(/\s+/);
    const overlap = triggerWords.filter((w) => phraseWords.has(w)).length;
    if (overlap > 0 && triggerWords.length > 0) {
      const wordScore = (overlap / triggerWords.length) * 0.5;
      if (wordScore > maxScore) maxScore = wordScore;
    }
  }

  return maxScore;
}

/**
 * Extract common parameters (person names, amounts) from unstructured phrases.
 */
function extractCommonParams(phrase: string): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  // Try to extract dollar amounts
  const amountMatch = phrase.match(/\$(\d+(?:\.\d{2})?)/);
  if (amountMatch) {
    params.amount = parseFloat(amountMatch[1] || "0");
  }

  // Try to extract email addresses
  const emailMatch = phrase.match(/(\S+@\S+\.\S+)/);
  if (emailMatch) {
    params.agentEmail = emailMatch[1];
  }

  return params;
}

/**
 * Batch-detect multiple intents from a longer message.
 */
export function detectAllIntents(
  phrase: string,
  minConfidence = 0.3
): DetectedIntent[] {
  // Split on common separators and try each sentence
  const sentences = phrase
    .split(/[.;!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const intents: DetectedIntent[] = [];
  for (const sentence of sentences) {
    const intent = detectIntent(sentence, minConfidence);
    if (intent) intents.push(intent);
  }

  return intents;
}
