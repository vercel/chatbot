/**
 * lib/chat/intent-classifier.ts — Phase 38.5 Stream 0
 *
 * Hybrid intent classifier for detecting bulk discovery operations.
 * Phase 1: Keyword matching (0 tokens, <1ms)
 * Phase 2: Confidence scoring
 * Phase 3: LLM fallback for low-confidence cases
 *
 * When a bulk intent is detected, the chat router can bypass the LLM swarm
 * and route directly to the Phase 38 Discovery Engine for real data.
 */

// ── Types ───────────────────────────────────────────────────────────────

export type DiscoveryWorkflowId =
  | "audit-slack-tickets-last-7d"
  | "find-misaligned-billing"
  | "recovery-stale-tasks-audit"
  | "customer-360-deep-pull"
  | "agent-promise-tracker"
  | "churn-risk-analysis"
  | "prd-generation"; // M-N-META: PRD Quality auto-inject

export interface ClassificationResult {
  /** Whether this is a bulk/discovery operation */
  isBulkIntent: boolean;
  /** The matched workflow template ID (null if not bulk) */
  workflowId: DiscoveryWorkflowId | null;
  /** Confidence 0.0–1.0 */
  confidence: number;
  /** How the classification was made */
  method: "keyword" | "llm_fallback" | "none";
  /** Matched keywords (for debugging) */
  matchedKeywords: string[];
  /** Extracted config hints from the query */
  extractedConfig: Record<string, unknown>;
  /** Human-readable explanation */
  reasoning: string;
}

// ── Keyword Pattern Map ─────────────────────────────────────────────────

interface KeywordEntry {
  workflowId: DiscoveryWorkflowId;
  keywords: string[];
  weight: number; // 1.0 = exact match, 0.5 = partial
}

const KEYWORD_MAP: KeywordEntry[] = [
  {
    workflowId: "audit-slack-tickets-last-7d",
    keywords: [
      "audit slack", "audit billing", "check alignment",
      "slack audit", "billing alignment", "crm alignment",
      "check vs crm", "cross reference", "cross-reference",
      "slack vs", "vs base44", "align slack", "align billing",
      "massive billing", "billing audit", "audit tickets",
      "ticket audit", "slack review", "review slack",
      "billing check", "verify billing", "verify alignment",
      "billing↔crm", "billing ↔ crm", "slack ↔ crm",
      "compare slack", "compare crm", "reconcile",
      "crm matches", "crm match", "matches what", "billing last",
    ],
    weight: 1.0,
  },
  {
    workflowId: "find-misaligned-billing",
    keywords: [
      "misaligned billing", "billing mismatch", "billing vs",
      "subscription mismatch", "nmi vs base44", "billing discrepancy",
      "billing wrong", "wrong subscription", "subscription status",
      "nmi check", "check subscriptions", "verify subscriptions",
      "subscription audit", "billing state", "payment mismatch",
      "billing not matching", "charge mismatch",
      "misaligned subscriptions", "misaligned subscription",
    ],
    weight: 1.0,
  },
  {
    workflowId: "recovery-stale-tasks-audit",
    keywords: [
      "stale recovery", "recovery audit", "declined payments",
      "failed payments audit", "recovery backlog", "retry audit",
      "stale tasks", "stale tickets", "recovery check",
      "declined audit", "payment recovery", "recovery status",
      "failed charges", "declined charges", "retry status",
    ],
    weight: 1.0,
  },
  {
    workflowId: "customer-360-deep-pull",
    keywords: [
      "customer 360", "deep dive", "full profile", "complete history",
      "everything about", "all data for", "comprehensive",
      "pull everything", "customer deep", "full customer",
      "customer dossier", "360 view", "customer overview",
      "all information", "full details",
    ],
    weight: 1.0,
  },
  {
    workflowId: "agent-promise-tracker",
    keywords: [
      "agent promise", "follow through", "said they would",
      "promised to", "agent follow up", "commitment tracking",
      "agent track", "track promises", "verify promises",
      "promise audit", "did agent", "agent said",
      "follow-up audit", "followup audit", "agent accountability",
    ],
    weight: 1.0,
  },
  {
    workflowId: "churn-risk-analysis",
    keywords: [
      "churn risk", "at risk", "losing customers", "cancellation risk",
      "retention risk", "customers leaving", "churn analysis",
      "risk analysis", "customer risk", "attrition risk",
      "cancel risk", "retention analysis", "who is leaving",
    ],
    weight: 1.0,
  },
  // ── M-N-META: PRD Quality auto-inject keywords ─────────────────
  {
    workflowId: "prd-generation",
    keywords: [
      "write a prd", "write prd", "generate prd", "create prd",
      "plan this feature", "plan this project", "design this feature",
      "design this system", "specs for", "write specs", "spec this out",
      "create a spec", "prd for", "specification for",
      "requirements doc", "product requirements", "feature spec",
      "architecture plan", "technical spec", "build plan",
    ],
    weight: 1.0,
  },
];

// ── Secondary keywords with lower weight ────────────────────────────────

const SECONDARY_KEYWORDS: KeywordEntry[] = [
  {
    workflowId: "audit-slack-tickets-last-7d",
    keywords: [
      "audit", "alignment", "align", "check on", "look into",
      "investigate", "review", "overview", "summary",
    ],
    weight: 0.4,
  },
  {
    workflowId: "find-misaligned-billing",
    keywords: [
      "billing", "payment", "subscription", "charge",
    ],
    weight: 0.3,
  },
  {
    workflowId: "recovery-stale-tasks-audit",
    keywords: [
      "recovery", "declined", "failed", "stale", "retry",
    ],
    weight: 0.3,
  },
  {
    workflowId: "customer-360-deep-pull",
    keywords: [
      "customer", "client", "profile", "history",
    ],
    weight: 0.2,
  },
  {
    workflowId: "agent-promise-tracker",
    keywords: [
      "agent", "promise", "follow", "commit",
    ],
    weight: 0.2,
  },
  {
    workflowId: "churn-risk-analysis",
    keywords: [
      "churn", "risk", "losing", "cancellation", "leaving",
    ],
    weight: 0.3,
  },
];

// ── Explicit non-bulk patterns (never route to discovery) ───────────────

const NON_BULK_PATTERNS = [
  /^what('?s| is) the weather/i,
  /^hello$/i,
  /^hi$/i,
  /^hey$/i,
  /^help$/i,
  /^help me$/i,
  /^can you help$/i,
  // M-N-META: PRD-related patterns should NOT be blocked (they trigger Pocock injection)
  // /^write (a|me)/i,   ← REMOVED: "write a PRD" must pass through
  /^write me/i,           // "write me a poem" still blocked, "write a PRD" passes
  /^create (a|an)/i,      // "create a PRD" → now handled by PRD keyword matching (isNonBulk check happens FIRST)
  /^generate (a|an)/i,    // Same: PRD keyword matching overrides
  /^what (is|are|does|do)/i,
  /^how (do|does|can|to|should|would)/i,
  /^explain/i,
  /^tell me about/i,
  /^who (is|are)/i,
  /^when (is|was|will)/i,
  /^where (is|are)/i,
  /^why (is|are|do|does)/i,
  /^translate/i,
  /^summarize/i,
  /^define/i,
  /^search for/i,
];

// ── Config Extraction ───────────────────────────────────────────────────

/**
 * Extract configuration hints from the user query.
 * e.g., "last 30 days" → { daysBack: 30 }
 * e.g., "customer John" → { customerName: "John" }
 */
function extractConfig(query: string): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // Days back
  const daysMatch = query.match(/last\s+(\d+)\s+days?/i) ||
                    query.match(/past\s+(\d+)\s+days?/i) ||
                    query.match(/(\d+)\s*days?\s*(back|ago)/i);
  if (daysMatch) {
    config.daysBack = Number.parseInt(daysMatch[1], 10);
  }

  // Customer name/ID
  const customerMatch = query.match(/(?:customer|client|for)\s+["']?([\w\s.@-]+?)["']?(?:\s|$)/i);
  if (customerMatch) {
    config.customerHint = customerMatch[1].trim();
  }

  // Specific channels
  const channelMatch = query.match(/#([\w-]+)/g);
  if (channelMatch) {
    config.channels = channelMatch.map((c) => c.replace("#", ""));
  }

  // Max customers
  const maxMatch = query.match(/(\d+)\s+customers?/i);
  if (maxMatch) {
    config.maxCustomers = Number.parseInt(maxMatch[1], 10);
  }

  return config;
}

// ── Phase 1: Keyword Matching ───────────────────────────────────────────

function keywordMatch(query: string): {
  workflowId: DiscoveryWorkflowId | null;
  confidence: number;
  matchedKeywords: string[];
} {
  const lower = query.toLowerCase();
  let bestWorkflowId: DiscoveryWorkflowId | null = null;
  let bestScore = 0;
  const allMatched: string[] = [];

  // Check primary keywords first (weight 1.0)
  for (const entry of KEYWORD_MAP) {
    let entryScore = 0;
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        entryScore += entry.weight;
        allMatched.push(keyword);
      }
    }
    if (entryScore > bestScore) {
      bestScore = entryScore;
      bestWorkflowId = entry.workflowId;
    }
  }

  // If no primary match, check secondary (lower weight)
  if (bestScore === 0) {
    for (const entry of SECONDARY_KEYWORDS) {
      let entryScore = 0;
      for (const keyword of entry.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          entryScore += entry.weight;
          allMatched.push(keyword);
        }
      }
      if (entryScore > bestScore) {
        bestScore = entryScore;
        bestWorkflowId = entry.workflowId;
      }
    }
  }

  // Confidence calculation
  // >2 keyword matches → 0.85+
  // 2 keyword matches → 0.75
  // 1 keyword match → 0.60
  // 1 secondary match → 0.40
  let confidence = 0;
  if (bestScore >= 2.0) confidence = 0.92;
  else if (bestScore >= 1.5) confidence = 0.85;
  else if (bestScore >= 1.0) confidence = 0.75;
  else if (bestScore >= 0.5) confidence = 0.55;
  else if (bestScore > 0) confidence = 0.40;

  return { workflowId: bestWorkflowId, confidence, matchedKeywords: allMatched };
}

// ── Phase 2: Non-Bulk Check ─────────────────────────────────────────────

function isNonBulk(query: string): boolean {
  // M-N-META: PRD intent overrides non-bulk check
  const lower = query.toLowerCase();
  if (
    lower.includes("prd") ||
    lower.includes("spec") ||
    lower.includes("requirements doc") ||
    lower.includes("architecture plan") ||
    lower.includes("build plan")
  ) {
    return false; // Let PRD keywords match
  }
  for (const pattern of NON_BULK_PATTERNS) {
    if (pattern.test(query)) {
      return true;
    }
  }
  return false;
}

// ── Phase 3: LLM Fallback Classification ────────────────────────────────

// Dynamic import to avoid bundling unless needed
async function classifyWithLLM(query: string): Promise<{
  workflowId: DiscoveryWorkflowId | null;
  confidence: number;
}> {
  try {
    // Use the fetch-based approach so we don't depend on AI SDK availability
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `classifier_${Date.now()}`,
        message: {
          id: `msg_${Date.now()}`,
          role: "user",
          parts: [{ type: "text", text: `Classify this query into ONE of these categories (respond with only the category ID):
- audit-slack-tickets-last-7d (auditing Slack tickets, billing alignment, cross-referencing systems)
- find-misaligned-billing (finding billing mismatches between systems)
- recovery-stale-tasks-audit (checking stale recovery tasks and declined payments)
- customer-360-deep-pull (deep dive into a specific customer)
- agent-promise-tracker (tracking agent promises from Slack)
- churn-risk-analysis (analyzing churn risk)
- none (doesn't match any category — general question, coding, writing, etc.)

Query: "${query}"

Category ID:` }],
        },
        selectedChatModel: "deepseek/deepseek-v4-flash",
        selectedVisibilityType: "private",
      }),
    });

    if (!res.ok) return { workflowId: null, confidence: 0 };

    // Read the SSE stream to get the response
    const text = await res.text();
    // Extract the last text delta from the SSE stream
    const matches = text.match(/"data-textDelta","data":"([^"]+)"/g);
    if (!matches) return { workflowId: null, confidence: 0 };

    const response = matches.map((m) => {
      const inner = m.match(/"data":"([^"]+)"/);
      return inner?.[1] ?? "";
    }).join("");

    const clean = response.toLowerCase().trim();
    const validIds: DiscoveryWorkflowId[] = [
      "audit-slack-tickets-last-7d",
      "find-misaligned-billing",
      "recovery-stale-tasks-audit",
      "customer-360-deep-pull",
      "agent-promise-tracker",
      "churn-risk-analysis",
    ];

    for (const id of validIds) {
      if (clean.includes(id)) {
        return { workflowId: id, confidence: 0.65 };
      }
    }

    if (clean.includes("none")) {
      return { workflowId: null, confidence: 0.8 };
    }

    return { workflowId: null, confidence: 0 };
  } catch (err) {
    console.warn("[intent-classifier] LLM fallback failed:", err);
    return { workflowId: null, confidence: 0 };
  }
}

// ── Main Classifier ─────────────────────────────────────────────────────

const FEATURE_DISCOVERY_ROUTING = process.env.FEATURE_DISCOVERY_ROUTING !== "false";
const MIN_CONFIDENCE_THRESHOLD = 0.65;
const LLM_FALLBACK_CONFIDENCE_MAX = 0.55;

/**
 * Classify a user message to determine if it's a bulk discovery operation.
 *
 * @param messageText - The user's message text
 * @param useLLMFallback - Whether to use LLM fallback for low-confidence cases (default: true)
 * @returns ClassificationResult with workflow ID and confidence
 */
export async function classifyIntent(
  messageText: string,
  useLLMFallback = true
): Promise<ClassificationResult> {
  // Feature flag check
  if (!FEATURE_DISCOVERY_ROUTING) {
    return {
      isBulkIntent: false,
      workflowId: null,
      confidence: 0,
      method: "none",
      matchedKeywords: [],
      extractedConfig: {},
      reasoning: "Feature flag FEATURE_DISCOVERY_ROUTING is disabled",
    };
  }

  const query = messageText.trim();

  // Guard: empty or very short queries
  if (query.length < 5) {
    return {
      isBulkIntent: false,
      workflowId: null,
      confidence: 0,
      method: "none",
      matchedKeywords: [],
      extractedConfig: {},
      reasoning: "Query too short",
    };
  }

  // Guard: explicit non-bulk patterns
  if (isNonBulk(query)) {
    return {
      isBulkIntent: false,
      workflowId: null,
      confidence: 0,
      method: "none",
      matchedKeywords: [],
      extractedConfig: {},
      reasoning: "Query matches non-bulk pattern",
    };
  }

  // Phase 1: Keyword matching
  const kwResult = keywordMatch(query);
  const extractedConfig = extractConfig(query);

  // High confidence keyword match → return immediately
  if (kwResult.workflowId && kwResult.confidence >= MIN_CONFIDENCE_THRESHOLD) {
    return {
      isBulkIntent: true,
      workflowId: kwResult.workflowId,
      confidence: kwResult.confidence,
      method: "keyword",
      matchedKeywords: kwResult.matchedKeywords,
      extractedConfig,
      reasoning: `Matched ${kwResult.matchedKeywords.length} keyword(s): ${kwResult.matchedKeywords.join(", ")}`,
    };
  }

  // Medium confidence + keywords matched → still route
  if (kwResult.workflowId && kwResult.confidence >= 0.50 && kwResult.matchedKeywords.length >= 2) {
    return {
      isBulkIntent: true,
      workflowId: kwResult.workflowId,
      confidence: kwResult.confidence,
      method: "keyword",
      matchedKeywords: kwResult.matchedKeywords,
      extractedConfig,
      reasoning: `Medium confidence but multiple keywords matched: ${kwResult.matchedKeywords.join(", ")}`,
    };
  }

  // Low confidence with some match → try LLM fallback
  if (kwResult.workflowId && kwResult.confidence < MIN_CONFIDENCE_THRESHOLD && useLLMFallback) {
    const llmResult = await classifyWithLLM(query);
    if (llmResult.workflowId && llmResult.confidence > 0) {
      return {
        isBulkIntent: true,
        workflowId: llmResult.workflowId,
        confidence: Math.max(kwResult.confidence, llmResult.confidence),
        method: "llm_fallback",
        matchedKeywords: kwResult.matchedKeywords,
        extractedConfig,
        reasoning: `LLM confirmed keyword hint: ${kwResult.matchedKeywords.join(", ")} → ${llmResult.workflowId}`,
      };
    }
  }

  // No keyword match at all → try LLM if query is substantial
  if (!kwResult.workflowId && query.length > 20 && useLLMFallback) {
    const llmResult = await classifyWithLLM(query);
    if (llmResult.workflowId && llmResult.confidence >= LLM_FALLBACK_CONFIDENCE_MAX) {
      return {
        isBulkIntent: true,
        workflowId: llmResult.workflowId,
        confidence: llmResult.confidence,
        method: "llm_fallback",
        matchedKeywords: [],
        extractedConfig,
        reasoning: `LLM-only classification (no keywords matched) → ${llmResult.workflowId}`,
      };
    }
  }

  // Default: not a bulk intent
  return {
    isBulkIntent: false,
    workflowId: null,
    confidence: 0,
    method: kwResult.matchedKeywords.length > 0 ? "keyword" : "none",
    matchedKeywords: kwResult.matchedKeywords,
    extractedConfig: {},
    reasoning: kwResult.matchedKeywords.length > 0
      ? `Keywords found but confidence too low: ${kwResult.matchedKeywords.join(", ")} (${kwResult.confidence.toFixed(2)})`
      : "No keywords or patterns matched",
  };
}

/**
 * Synchronous-only version for use in non-async contexts.
 * Only does keyword matching, no LLM fallback.
 */
export function classifyIntentSync(messageText: string): ClassificationResult {
  if (!FEATURE_DISCOVERY_ROUTING || messageText.trim().length < 5) {
    return {
      isBulkIntent: false,
      workflowId: null,
      confidence: 0,
      method: "none",
      matchedKeywords: [],
      extractedConfig: {},
      reasoning: "Sync classification skipped",
    };
  }

  if (isNonBulk(messageText)) {
    return {
      isBulkIntent: false,
      workflowId: null,
      confidence: 0,
      method: "none",
      matchedKeywords: [],
      extractedConfig: {},
      reasoning: "Non-bulk pattern",
    };
  }

  const kwResult = keywordMatch(messageText);
  const extractedConfig = extractConfig(messageText);

  if (kwResult.workflowId && kwResult.confidence >= MIN_CONFIDENCE_THRESHOLD) {
    return {
      isBulkIntent: true,
      workflowId: kwResult.workflowId,
      confidence: kwResult.confidence,
      method: "keyword",
      matchedKeywords: kwResult.matchedKeywords,
      extractedConfig,
      reasoning: `Keyword match: ${kwResult.matchedKeywords.join(", ")}`,
    };
  }

  return {
    isBulkIntent: false,
    workflowId: null,
    confidence: 0,
    method: kwResult.matchedKeywords.length > 0 ? "keyword" : "none",
    matchedKeywords: kwResult.matchedKeywords,
    extractedConfig: {},
    reasoning: "No high-confidence keyword match",
  };
}

// ── Test Fixtures ───────────────────────────────────────────────────────

export const TEST_FIXTURES: Array<{
  prompt: string;
  expectedWorkflow: DiscoveryWorkflowId | null;
  expectedConfidenceMin: number;
}> = [
  { prompt: "audit Slack billing alignment", expectedWorkflow: "audit-slack-tickets-last-7d", expectedConfidenceMin: 0.85 },
  { prompt: "find misaligned billing between NMI and Base44", expectedWorkflow: "find-misaligned-billing", expectedConfidenceMin: 0.75 },
  { prompt: "check for stale recovery tasks", expectedWorkflow: "recovery-stale-tasks-audit", expectedConfidenceMin: 0.75 },
  { prompt: "deep dive into customer John Doe", expectedWorkflow: "customer-360-deep-pull", expectedConfidenceMin: 0.55 },
  { prompt: "did our agents follow through on promises?", expectedWorkflow: "agent-promise-tracker", expectedConfidenceMin: 0.40 },
  { prompt: "which customers are at risk of churning?", expectedWorkflow: "churn-risk-analysis", expectedConfidenceMin: 0.55 },
  { prompt: "what's the weather?", expectedWorkflow: null, expectedConfidenceMin: 0 },
  { prompt: "write me a poem", expectedWorkflow: null, expectedConfidenceMin: 0 },
  { prompt: "help me with billing audit for last 7 days", expectedWorkflow: "audit-slack-tickets-last-7d", expectedConfidenceMin: 0.75 },
  { prompt: "check if our CRM matches what's in Slack", expectedWorkflow: "audit-slack-tickets-last-7d", expectedConfidenceMin: 0.40 },
  { prompt: "massive billing↔CRM alignment check", expectedWorkflow: "audit-slack-tickets-last-7d", expectedConfidenceMin: 0.55 },
  { prompt: "run a recovery audit on declined payments", expectedWorkflow: "recovery-stale-tasks-audit", expectedConfidenceMin: 0.75 },
  { prompt: "show me full customer 360 for Jane Smith", expectedWorkflow: "customer-360-deep-pull", expectedConfidenceMin: 0.55 },
  { prompt: "track agent promises from last 2 weeks", expectedWorkflow: "agent-promise-tracker", expectedConfidenceMin: 0.40 },
  { prompt: "churn risk analysis for our customer base", expectedWorkflow: "churn-risk-analysis", expectedConfidenceMin: 0.75 },
  { prompt: "audit billing last 30 days", expectedWorkflow: "audit-slack-tickets-last-7d", expectedConfidenceMin: 0.85 },
  { prompt: "find all misaligned subscriptions", expectedWorkflow: "find-misaligned-billing", expectedConfidenceMin: 0.55 },
  { prompt: "hello", expectedWorkflow: null, expectedConfidenceMin: 0 },
  { prompt: "what is a playbook?", expectedWorkflow: null, expectedConfidenceMin: 0 },
  { prompt: "check alignment between slack and billing systems", expectedWorkflow: "audit-slack-tickets-last-7d", expectedConfidenceMin: 0.55 },
];

/**
 * Run the test fixtures and return pass/fail results.
 * Only tests keyword matching (no LLM fallback).
 */
export function runTests(): Array<{
  prompt: string;
  expected: DiscoveryWorkflowId | null;
  actual: DiscoveryWorkflowId | null;
  confidence: number;
  passed: boolean;
}> {
  return TEST_FIXTURES.map((fixture) => {
    const result = classifyIntentSync(fixture.prompt);
    const passed = result.workflowId === fixture.expectedWorkflow &&
      result.confidence >= fixture.expectedConfidenceMin;
    return {
      prompt: fixture.prompt,
      expected: fixture.expectedWorkflow,
      actual: result.workflowId,
      confidence: result.confidence,
      passed,
    };
  });
}

export default classifyIntent;
