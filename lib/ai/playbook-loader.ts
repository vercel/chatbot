/**
 * Inline Playbook Loader — production runtime playbook injection.
 *
 * Problem: @playbook-os/sdk is not installed on Vercel, and VPS-local SDK
 * paths (/home/hermes/core/action-groups/) are inaccessible from serverless.
 *
 * Solution: Bundle playbook content directly in the deployment via static
 * constants. Key domain playbooks are inlined for runtime injection.
 *
 * Architecture:
 *   Chat route → loadPlaybookForIntent(userMessage) → returns context string
 *   → injected into system prompt before model call
 */

// ── Domain Playbook Inlines ─────────────────────────────────────────────────
// These are the critical runtime safeguards extracted from
// /home/neptune/playbook-os/domains/*/playbook.md
// and /home/neptune/neptune-chat/lib/connectors/*/PLAYBOOK.md

const BILLING_PLAYBOOK = `
## Billing Domain — Operational Knowledge

### Core Rules (CRITICAL)
1. CONSENT BEFORE CURRENCY: No charge without verified Day 0 CIT.
2. VAULT BEFORE CHARGE: Verify vault in NMI before every charge. No direct card charges.
3. source_transaction_id is BANNED. Use initial_transaction_id.
4. Hard Decline = STOP. Never auto-retry hard declines (codes: 201, 222, 251, 253).
5. Soft Decline = Smart Retry (codes: 202, 223). Enqueue in smart-retry-engine.
6. Config Decline = Fix ONCE then retry (codes: 225, 300, 400).

### Safeguards
- Refunds over $200 need Jennifer approval (P0 safeguard).
- Refunds under $200: confirm customer identity, verify original transaction, process via NMI.
- Never refund without verifying the original charge exists in PaymentLog.
- Always record refund reason in PaymentLog notes.
- For chargebacks: do NOT refund — route to credit-disputes domain.
- Broken chain (CRM-NMI mismatch): alert #jarvis-admin before any billing action.

### Common Workflows
1. CHARGE: verify vault → execute NMI charge → record PaymentLog → update billing chain
2. REFUND: find original txn → verify amount ≤ $200 or get Jennifer approval → NMI refund → record
3. DECLINE: classify (HARD/SOFT/CONFIG) → smart-retry or agent-gated recovery
`;

const DISPUTES_PLAYBOOK = `
## Credit Disputes Domain — Operational Knowledge

### Core Rules
1. NEVER admit fault in writing. "We are investigating" only.
2. All dispute responses must reference specific FCRA sections.
3. 30-day response window from dispute receipt date.
4. Round tracking: each dispute round must be documented with sent date and response date.

### Safeguards
- Before sending any dispute: verify customer has active enrollment.
- Round 2 disputes require supervisor review before sending.
- Always attach supporting documentation (credit report, dispute letter, proof of delivery).
- Never promise deletion — state "we will request investigation."
- Track all dispute rounds in dispute_rounds table with status tracking.

### Common Workflows
1. ROUND 1: draft dispute letter → attach credit report → send via certified mail → log date
2. ROUND 2: review Round 1 response → draft follow-up → supervisor review → send
3. FOLLOW-UP: check dispute_rounds for overdue responses → send reminder → update status
`;

const ENROLLMENT_PLAYBOOK = `
## Customer Enrollment Domain — Operational Knowledge

### Core Rules
1. Every enrollment needs: signed agreement, credit report pull, payment method on file.
2. Day 0 CIT must be completed before any billing begins.
3. Welcome sequence: agreement signed → credit pulled → payment set up → Day 0 CIT → welcome email.
4. Missing payment method at enrollment: flag for agent follow-up within 24h.

### Safeguards
- Never enroll without signed agreement (digital signature or DocuSign).
- Verify identity before pulling credit (SSN + DOB + address match).
- If credit pull fails: notify agent, do NOT proceed with enrollment.
- Payment method must pass $1 auth before considering enrollment complete.
`;

const SUPPORT_PLAYBOOK = `
## Support Triage Domain — Operational Knowledge

### Core Rules
1. Classify every ticket: billing | disputes | enrollment | technical | general.
2. Billing tickets: route to billing-flow domain.
3. Dispute tickets: route to credit-disputes domain.
4. Response SLA: 4 hours during business hours, 24 hours otherwise.

### Safeguards
- Never promise specific outcomes.
- Never share internal pricing or margins.
- Escalate to #jarvis-admin if ticket involves: refund >$200, legal threat, CFPB complaint.
- Always check customer profile before responding.
`;

// ── Intent Matching ────────────────────────────────────────────────────────

interface PlaybookEntry {
  domain: string;
  triggers: string[];
  content: string;
}

const PLAYBOOK_ENTRIES: PlaybookEntry[] = [
  {
    domain: 'billing-flow',
    triggers: ['refund', 'charge', 'bill', 'payment', 'transaction', 'nmi', 'vault', 'decline', 'subscription', 'recurring', 'invoice', 'fee', 'amount', '$', 'dollar', 'credit card', 'card'],
    content: BILLING_PLAYBOOK,
  },
  {
    domain: 'credit-disputes',
    triggers: ['dispute', 'credit report', 'fcra', 'bureau', 'equifax', 'experian', 'transunion', 'deletion', 'investigation', 'round 2', 'dispute round'],
    content: DISPUTES_PLAYBOOK,
  },
  {
    domain: 'customer-enrollment',
    triggers: ['enroll', 'sign up', 'new customer', 'onboarding', 'welcome', 'agreement', 'docusign', 'credit pull', 'identity'],
    content: ENROLLMENT_PLAYBOOK,
  },
  {
    domain: 'support-triage',
    triggers: ['ticket', 'support', 'help', 'issue', 'problem', 'complaint', 'cfpb', 'legal'],
    content: SUPPORT_PLAYBOOK,
  },
];

// ── Scoring ─────────────────────────────────────────────────────────────────

function scoreMatch(message: string, triggers: string[]): number {
  const lower = message.toLowerCase();
  let score = 0;
  for (const trigger of triggers) {
    if (lower.includes(trigger.toLowerCase())) {
      score += trigger.length; // longer triggers = stronger signal
    }
  }
  return score;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface PlaybookLoadResult {
  domain: string;
  content: string;
  confidence: number; // 0-100
}

/**
 * Load relevant playbook context for a user message.
 * Returns null if no domain matches above threshold.
 */
export function loadPlaybookForIntent(userMessage: string): PlaybookLoadResult | null {
  const scores = PLAYBOOK_ENTRIES.map((entry) => ({
    entry,
    score: scoreMatch(userMessage, entry.triggers),
  }));

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best || best.score === 0) return null;

  // Calculate confidence (normalize: max observed score ~100 for strong matches)
  const confidence = Math.min(100, Math.round((best.score / 80) * 100));

  return {
    domain: best.entry.domain,
    content: best.entry.content,
    confidence,
  };
}

/**
 * Load multiple playbooks if multiple domains match.
 * Returns all matches above minimum threshold.
 */
export function loadPlaybooksForIntent(
  userMessage: string,
  minConfidence = 20
): PlaybookLoadResult[] {
  const scores = PLAYBOOK_ENTRIES.map((entry) => ({
    entry,
    score: scoreMatch(userMessage, entry.triggers),
  }));

  return scores
    .filter((s) => s.score > 0)
    .map((s) => ({
      domain: s.entry.domain,
      content: s.entry.content,
      confidence: Math.min(100, Math.round((s.score / 80) * 100)),
    }))
    .filter((r) => r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Format playbook results for system prompt injection.
 */
export function formatPlaybookContext(results: PlaybookLoadResult[]): string {
  if (results.length === 0) return '';

  const sections = results.map(
    (r) => `[LOADED PLAYBOOK: ${r.domain} (confidence: ${r.confidence}%)]\n${r.content}`
  );

  return `## OPERATIONAL CONTEXT — APPLICABLE PLAYBOOKS\n\nThe following operational safeguards and workflows apply to this task. You MUST follow these rules:\n\n${sections.join('\n\n---\n\n')}\n\nRemember: these rules take precedence over general knowledge.\n`;
}
