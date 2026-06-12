/**
 * Hierarchical Playbook Loader — reads organization/domain playbooks from filesystem.
 *
 * Architecture (Vercel-compatible):
 *   1. Primary: Read markdown playbooks from organizations/ directory (filesystem)
 *   2. Fallback: Inline bundled content for critical domains (billing, disputes, etc.)
 *
 * Routine support: Each playbook's ## Routines section is parsed into structured
 * steps with trigger words and parallelization hints.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RoutineStep {
  stepNumber: number;
  description: string;
  parallel?: boolean;
}

export interface Routine {
  name: string;
  triggerWords: string[];
  steps: RoutineStep[];
  safeguards?: string[];
}

export interface PlaybookDocument {
  path: string;
  domain: string;
  title: string;
  frontmatter: Record<string, unknown>;
  operationalKnowledge: string;
  businessContext: string;
  antiPatterns: string[];
  safeguards: string[];
  routines: Routine[];
  refinementNotes: string;
  rawContent: string;
}

export interface PlaybookLoadResult {
  domain: string;
  playbook: PlaybookDocument;
  matchedRoutine?: Routine;
  confidence: number; // 0-100
}

// ── Inline Fallback Content ──────────────────────────────────────────────────

const BILLING_FALLBACK = `
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
`;

const DISPUTES_FALLBACK = `
## Credit Disputes Domain — Operational Knowledge

### Core Rules
1. NEVER admit fault in writing. "We are investigating" only.
2. All dispute responses must reference specific FCRA sections.
3. 30-day response window from dispute receipt date.
4. Round tracking: each dispute round must be documented.

### Safeguards
- Before sending any dispute: verify customer has active enrollment.
- Round 2 disputes require supervisor review before sending.
- Always attach supporting documentation (credit report, dispute letter).
`;

const SUPPORT_FALLBACK = `
## Support Triage Domain — Operational Knowledge

### Core Rules
1. Classify every ticket: billing | disputes | enrollment | technical | general.
2. Billing tickets: route to billing-flow domain.
3. Dispute tickets: route to credit-disputes domain.
4. Response SLA: 4 hours during business hours, 24 hours otherwise.

### Safeguards
- Never promise specific outcomes.
- Never share internal pricing or margins.
- Always check customer profile before responding.
`;

const ENROLLMENT_FALLBACK = `
## Customer Enrollment Domain — Operational Knowledge

### Core Rules
1. Every enrollment needs: signed agreement, credit report pull, payment method on file.
2. Day 0 CIT must be completed before any billing begins.
3. Welcome sequence: agreement signed → credit pulled → payment set up → Day 0 CIT → welcome email.

### Safeguards
- Never enroll without signed agreement.
- Verify identity before pulling credit.
- Payment method must pass $1 auth before considering enrollment complete.
`;

// ── File System Playbook Loader ─────────────────────────────────────────────

const PLAYBOOKS_ROOT = join(process.cwd(), "playbooks");
const ORGS_LEGACY_ROOT = join(process.cwd(), "organizations");
const SKILLS_ROOT = join(process.cwd(), "skills");

/**
 * Parse a playbook markdown file into structured sections.
 */
function parsePlaybookMarkdown(content: string, filePath: string): PlaybookDocument {
  const lines = content.split("\n");
  const sections: Record<string, string[]> = { _current: [] };
  let currentSection = "_preamble";
  sections[currentSection] = [];

  for (const line of lines) {
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    if (h1 && !h2) {
      currentSection = "title";
      sections[currentSection] = [h1[1]];
    } else if (h2) {
      const name = h2[1].toLowerCase().replace(/\s+/g, "_");
      currentSection = name;
      sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }

  // Extract title
  const title = (sections.title || sections._preamble || [""])[0] || filePath;

  // Parse frontmatter
  const frontmatter: Record<string, unknown> = {};
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end > 0) {
      const fm = content.substring(3, end).trim();
      for (const line of fm.split("\n")) {
        const [key, ...rest] = line.split(":");
        if (key && rest.length > 0) {
          frontmatter[key.trim()] = rest.join(":").trim();
        }
      }
    }
  }

  // Parse anti-patterns
  const antiPatterns = (sections.anti_patterns || sections["anti-patterns"] || [])
    .filter((l) => l.match(/^\d+\.|^-\s|DON'T/))
    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^-\s+/, "").trim())
    .filter(Boolean);

  // Parse safeguards
  const safeguards = (sections.safeguards || [])
    .filter((l) => l.match(/^\d+\.|^-\s/))
    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^-\s+/, "").trim())
    .filter(Boolean);

  // Parse routines
  const routines = parseRoutines(sections.routines || sections.routines_ || []);

  return {
    path: filePath,
    domain: filePath.split("/").slice(-2, -1)[0] || "root",
    title,
    frontmatter,
    operationalKnowledge: (sections.operational_knowledge || []).join("\n").trim(),
    businessContext: (sections.business_context || []).join("\n").trim(),
    antiPatterns,
    safeguards,
    routines,
    refinementNotes: (sections.refinement_notes || []).join("\n").trim(),
    rawContent: content,
  };
}

/**
 * Parse routines section into structured Routine objects.
 * Handles multi-line trigger word definitions (indented continuation lines).
 */
function parseRoutines(lines: string[]): Routine[] {
  const routines: Routine[] = [];
  let currentRoutine: Routine | null = null;
  let currentSteps: string[] = [];
  let inSteps = false;
  let collectingTriggers = false;
  let triggerAccumulator = "";

  for (const line of lines) {
    // Match "### Routine: Name"
    const routineHeader = line.match(/^###\s*Routine:\s*(.+)/i);
    if (routineHeader) {
      if (currentRoutine) {
        currentRoutine.steps = parseSteps(currentSteps);
        routines.push(currentRoutine);
      }
      currentRoutine = { name: routineHeader[1].trim(), triggerWords: [], steps: [], safeguards: [] };
      currentSteps = [];
      inSteps = false;
      collectingTriggers = false;
      triggerAccumulator = "";
      continue;
    }

    if (!currentRoutine) continue;

    // Collect continuation lines for multi-line trigger definitions
    if (collectingTriggers) {
      // Continuation lines are indented and contain trigger content (quotes, commas, or names)
      if (/^\s{6,}/.test(line) && /['"\[,\]]/.test(line)) {
        triggerAccumulator += " " + line.trim();
        continue;
      }
      // Done collecting — parse accumulated triggers
      currentRoutine.triggerWords = triggerAccumulator
        .split(/[,;]/)
        .map((w) => w.trim().replace(/['"]/g, ""))
        .filter(Boolean);
      collectingTriggers = false;
      triggerAccumulator = "";
    }

    // Trigger words (primary line)
    const triggerMatch = line.match(/Trigger\s*words?:?\s*(.+)/i);
    if (triggerMatch) {
      triggerAccumulator = triggerMatch[1];
      collectingTriggers = true;
      continue;
    }

    // Step detection
    if (line.match(/Mandatory\s*steps?/i) || line.match(/^\d+\.\s/)) {
      inSteps = true;
    }

    if (inSteps && line.match(/^\d+\.\s/)) {
      currentSteps.push(line.replace(/^\d+\.\s*/, "").trim());
    }

    // Parallel hint
    if (line.toLowerCase().includes("parallel") && currentSteps.length > 0) {
      currentSteps[currentSteps.length - 1] += " [PARALLEL]";
    }
  }

  // Flush any remaining trigger accumulator
  if (currentRoutine && collectingTriggers && triggerAccumulator) {
    currentRoutine.triggerWords = triggerAccumulator
      .split(/[,;]/)
      .map((w) => w.trim().replace(/['"]/g, ""))
      .filter(Boolean);
  }

  if (currentRoutine) {
    currentRoutine.steps = parseSteps(currentSteps);
    routines.push(currentRoutine);
  }

  return routines;
}

function parseSteps(rawSteps: string[]): RoutineStep[] {
  return rawSteps.map((s, i) => ({
    stepNumber: i + 1,
    description: s.replace(" [PARALLEL]", "").trim(),
    parallel: s.includes("[PARALLEL]"),
  }));
}

/**
 * Try to load a playbook from the filesystem.
 * First tries new flat playbooks/<domain>/ layout,
 * then legacy organizations/<org>/<domain>/ layout.
 */
function loadPlaybookFile(orgPath: string, domain: string): PlaybookDocument | null {
  // New paths: flat playbooks/<domain>/ layout
  const newPaths = [
    join(PLAYBOOKS_ROOT, domain, `playbook-${domain}.md`),
    join(PLAYBOOKS_ROOT, domain, "PLAYBOOK.md"),
    join(PLAYBOOKS_ROOT, domain, "playbook.md"),
  ];

  for (const p of newPaths) {
    if (existsSync(p)) {
      return parsePlaybookMarkdown(readFileSync(p, "utf-8"), p);
    }
  }

  // Legacy paths: organizations/<org>/<domain>/ layout
  const legacyPaths = [
    join(orgPath, domain, `playbook-${domain}.md`),
    join(orgPath, domain, "PLAYBOOK.md"),
    join(orgPath, domain, "playbook.md"),
  ];

  for (const p of legacyPaths) {
    if (existsSync(p)) {
      return parsePlaybookMarkdown(readFileSync(p, "utf-8"), p);
    }
  }
  return null;
}

/**
 * Scan playbooks/ and organizations/ directories for available playbooks.
 */
export function listAvailablePlaybooks(): string[] {
  const results: string[] = [];

  // 1. New flat playbooks/ layout (U2.2+)
  if (existsSync(PLAYBOOKS_ROOT)) {
    const domains = readdirSync(PLAYBOOKS_ROOT).filter((d) =>
      statSync(join(PLAYBOOKS_ROOT, d)).isDirectory()
    );
    for (const domain of domains) {
      const pb = loadPlaybookFile("", domain); // orgPath unused in flat layout
      if (pb) results.push(`playbooks/${domain}`);
    }
  }

  // 2. Legacy organizations/<org>/<domain>/ layout
  if (existsSync(ORGS_LEGACY_ROOT)) {
    const orgs = readdirSync(ORGS_LEGACY_ROOT);
    for (const org of orgs) {
      const orgPath = join(ORGS_LEGACY_ROOT, org);
      if (!statSync(orgPath).isDirectory()) continue;
      const domains = readdirSync(orgPath).filter((d) =>
        statSync(join(orgPath, d)).isDirectory()
      );
      for (const domain of domains) {
        const pb = loadPlaybookFile(orgPath, domain);
        if (pb) results.push(`${org}/${domain}`);
      }
    }
  }

  return results;
}

// ── Intent Matching ─────────────────────────────────────────────────────────

interface TriggerEntry {
  domain: string;
  triggers: string[];
  fallbackContent: string;
}

const TRIGGER_ENTRIES: TriggerEntry[] = [
  {
    domain: "billing",
    triggers: ["refund", "charge", "bill", "payment", "transaction", "nmi", "vault", "decline", "subscription", "recurring", "invoice", "fee", "amount", "$", "dollar", "credit card", "card"],
    fallbackContent: BILLING_FALLBACK,
  },
  {
    domain: "disputes",
    triggers: ["dispute", "credit report", "fcra", "bureau", "equifax", "experian", "transunion", "deletion", "investigation", "round 2", "dispute round"],
    fallbackContent: DISPUTES_FALLBACK,
  },
  {
    domain: "customer-support",
    triggers: ["ticket", "support", "help", "issue", "problem", "complaint", "cfpb", "legal", "look up", "who is", "customer", "check on", "pull up", "status", "find"],
    fallbackContent: SUPPORT_FALLBACK,
  },
  {
    domain: "customer-enrollment",
    triggers: ["enroll", "sign up", "new customer", "onboarding", "welcome", "agreement", "docusign", "credit pull", "identity"],
    fallbackContent: ENROLLMENT_FALLBACK,
  },
];

function scoreMatch(message: string, triggers: string[]): number {
  const lower = message.toLowerCase();
  let score = 0;
  for (const trigger of triggers) {
    if (lower.includes(trigger.toLowerCase())) {
      score += trigger.length;
    }
  }
  return score;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load relevant playbook for a user message.
 * Tries filesystem first, falls back to inline content.
 */
export function loadPlaybookForIntent(
  userMessage: string,
  org = "newleaf-financial"
): PlaybookLoadResult | null {
  const orgPath = join(ORGS_LEGACY_ROOT, org);
  const scores = TRIGGER_ENTRIES.map((entry) => ({
    entry,
    score: scoreMatch(userMessage, entry.triggers),
  }));

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score === 0) return null;

  // Try filesystem first
  let playbook = loadPlaybookFile(orgPath, best.entry.domain);
  let domain = best.entry.domain;

  // Map domain names
  if (!playbook && best.entry.domain === "customer-support") {
    playbook = loadPlaybookFile(orgPath, "customer-support");
  }

  // Build playbook from fallback if filesystem unavailable
  if (!playbook) {
    playbook = {
      path: "inline",
      domain: best.entry.domain,
      title: `${best.entry.domain} Playbook`,
      frontmatter: {},
      operationalKnowledge: best.entry.fallbackContent,
      businessContext: "",
      antiPatterns: [],
      safeguards: [],
      routines: [],
      refinementNotes: "",
      rawContent: best.entry.fallbackContent,
    };
  }

  const confidence = Math.min(100, Math.round((best.score / 80) * 100));

  // Match routine
  let matchedRoutine: Routine | undefined;
  for (const routine of playbook.routines) {
    for (const trigger of routine.triggerWords) {
      const normalizedTrigger = trigger.toLowerCase().replace(/\[name\]/g, "");
      if (userMessage.toLowerCase().includes(normalizedTrigger)) {
        matchedRoutine = routine;
        break;
      }
    }
    if (matchedRoutine) break;
  }

  return {
    domain,
    playbook,
    matchedRoutine,
    confidence,
  };
}

/**
 * Load multiple playbooks matching intent above minimum threshold.
 */
export function loadPlaybooksForIntent(
  userMessage: string,
  minConfidence = 10,
  org = "newleaf-financial"
): PlaybookLoadResult[] {
  const orgPath = join(ORGS_LEGACY_ROOT, org);
  const allScores = TRIGGER_ENTRIES.map((entry) => ({
    entry,
    score: scoreMatch(userMessage, entry.triggers),
  }));

  return allScores
    .filter((s) => s.score > 0)
    .map((s) => {
      const playbook = loadPlaybookFile(orgPath, s.entry.domain) || {
        path: "inline",
        domain: s.entry.domain,
        title: `${s.entry.domain} Playbook`,
        frontmatter: {},
        operationalKnowledge: s.entry.fallbackContent,
        businessContext: "",
        antiPatterns: [],
        safeguards: [],
        routines: [],
        refinementNotes: "",
        rawContent: s.entry.fallbackContent,
      };
      const confidence = Math.min(100, Math.round((s.score / 80) * 100));

      let matchedRoutine: Routine | undefined;
      for (const routine of playbook.routines || []) {
        for (const trigger of routine.triggerWords) {
          const normalizedTrigger = trigger.toLowerCase().replace(/\[name\]/g, "");
          if (userMessage.toLowerCase().includes(normalizedTrigger)) {
            matchedRoutine = routine;
            break;
          }
        }
        if (matchedRoutine) break;
      }

      return { domain: s.entry.domain, playbook, matchedRoutine, confidence };
    })
    .filter((r) => r.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Format playbook results for system prompt injection.
 */
export function formatPlaybookContext(results: PlaybookLoadResult[]): string {
  if (results.length === 0) return "";

  const sections = results.map((r) => {
    let section = `[LOADED: ${r.domain} (confidence: ${r.confidence}%)]`;
    if (r.playbook.operationalKnowledge)
      section += `\n${r.playbook.operationalKnowledge}`;
    if (r.playbook.safeguards.length > 0)
      section += `\nSafeguards:\n${r.playbook.safeguards.map((s) => `  - ${s}`).join("\n")}`;
    if (r.matchedRoutine) {
      section += `\n\n▶ MATCHED ROUTINE: ${r.matchedRoutine.name}`;
      section += `\n${r.matchedRoutine.steps
        .map((s) => `  ${s.stepNumber}. ${s.description}${s.parallel ? " [PARALLEL]" : ""}`)
        .join("\n")}`;
    }
    return section;
  });

  return `## OPERATIONAL CONTEXT\n\nThe following playbooks and routines apply. Follow them exactly:\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Get the full assembled system prompt for debugging (/memory page).
 */
export function getSystemPromptContext(): {
  neptuneMd: string;
  playbooks: string[];
  skillsInScope: string[];
} {
  const neptuneMdPath = join(process.cwd(), "NEPTUNE.md");
  const neptuneMd = existsSync(neptuneMdPath)
    ? readFileSync(neptuneMdPath, "utf-8")
    : "NEPTUNE.md not found";

  const playbooks = listAvailablePlaybooks();
  const skillsInScope: string[] = [];

  if (existsSync(SKILLS_ROOT)) {
    for (const dir of ["connectors", "functions", "capabilities"]) {
      const dirPath = join(SKILLS_ROOT, dir);
      if (existsSync(dirPath))
        for (const skill of readdirSync(dirPath))
          if (statSync(join(dirPath, skill)).isDirectory())
            skillsInScope.push(`${dir}/${skill}`);
    }
  }

  return { neptuneMd, playbooks, skillsInScope };
}
