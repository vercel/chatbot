/**
 * Handoff Engine — Compresses session context for V2 or new agent sessions.
 *
 * Matt Pocock's /handoff skill, enhanced for Neptune's V2 coding sandbox.
 * Generates structured handoff documents that new sessions can execute
 * immediately without back-and-forth clarification.
 *
 * Key features:
 *   - Auto-detects V2 vs Chat target based on task type
 *   - Generates V2-ready prompts with repo context and test expectations
 *   - Compresses context to essential minimum (300-800 word target)
 *   - Uses pointers to artifacts instead of duplicating content
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, relative } from "path";
import { execSync } from "child_process";

// ── Types ──────────────────────────────────────────────────────────────────

export type HandoffTarget = "NEPTUNE_V2" | "NEPTUNE_CHAT" | "HUMAN";

export interface HandoffContext {
  /** What are we trying to achieve? (1 sentence) */
  purpose: string;

  /** What has been done so far? */
  currentState: string;

  /** Key decisions made with rationale */
  decisions: HandoffDecision[];

  /** Questions that remain unresolved */
  openQuestions: HandoffQuestion[];

  /** Pointers to relevant files, docs, PRs, issues */
  artifacts: HandoffArtifact[];

  /** Source session info */
  sourceSession: {
    turnsUsed: number;
    tokensUsed: number;
    agentName: string;
  };
}

export interface HandoffDecision {
  decision: string;
  rationale: string;
  alternativeConsidered?: string;
}

export interface HandoffQuestion {
  question: string;
  whatWeChecked: string;
  whyUnresolved: string;
}

export interface HandoffArtifact {
  path: string;
  type: "file" | "doc" | "pr" | "issue" | "research" | "grill-output" | "prd";
  summary: string; // one-line summary
}

export interface HandoffDocument {
  title: string;
  target: HandoffTarget;
  fromSession: string;
  toSession: string;
  generatedAt: string;
  context: HandoffContext;
  suggestedSkills: string[];
  workingBranch?: string;
  contextBudget: {
    turnsUsed: number;
    tokensEstimated: number;
  };
  v2Prompt?: V2Prompt; // only if target is NEPTUNE_V2
}

export interface V2Prompt {
  tickets: {
    id: string;
    title: string;
    acceptanceCriteria: string[];
  }[];
  repoContext: {
    repo: string;
    branch: string;
    keyFiles: string[];
    patterns: string[];
  };
  testExpectations: {
    integrationTests: string[];
    componentTests?: string[];
    e2eFlow?: string;
  };
  architectureHints?: string;
  knownPitfalls?: string[];
}

// ── Target Detection ───────────────────────────────────────────────────────

/**
 * Auto-detects whether a task should go to V2 (coding) or stay in Chat.
 */
export function detectHandoffTarget(
  purpose: string,
  artifacts: HandoffArtifact[]
): HandoffTarget {
  const codingKeywords = [
    "implement",
    "build",
    "code",
    "fix",
    "bug",
    "refactor",
    "migrate",
    "add endpoint",
    "create component",
    "write tests",
    "debug",
  ];

  const planningKeywords = [
    "plan",
    "design",
    "spec",
    "research",
    "investigate",
    "decide",
    "evaluate",
    "review",
    "approve",
  ];

  const isCoding = codingKeywords.some((kw) => purpose.toLowerCase().includes(kw));
  const isPlanning = planningKeywords.some((kw) => purpose.toLowerCase().includes(kw));

  if (isCoding && !isPlanning) return "NEPTUNE_V2";
  if (isPlanning && !isCoding) return "NEPTUNE_CHAT";
  if (isCoding && isPlanning) {
    // Mixed — check artifacts for implementation files
    const hasCodeArtifacts = artifacts.some(
      (a) => a.type === "file" && /\.(ts|tsx|js|jsx)$/.test(a.path)
    );
    return hasCodeArtifacts ? "NEPTUNE_V2" : "NEPTUNE_CHAT";
  }
  return "NEPTUNE_CHAT"; // default safe choice
}

// ── Handoff Generator ──────────────────────────────────────────────────────

/**
 * Generates a handoff document from session context.
 */
export function generateHandoff(
  context: HandoffContext,
  repoRoot: string,
  targetBranch?: string
): HandoffDocument {
  const target = detectHandoffTarget(
    context.purpose,
    context.artifacts
  );

  // Suggest skills based on target and context
  const suggestedSkills = suggestSkills(target, context);

  // Detect working branch
  let workingBranch = targetBranch;
  if (!workingBranch) {
    try {
      workingBranch = execSync("cd " + repoRoot + " && git branch --show-current", {
        encoding: "utf-8",
        timeout: 3000,
      }).trim();
    } catch {
      workingBranch = "main";
    }
  }

  const doc: HandoffDocument = {
    title: `Handoff: ${context.purpose.slice(0, 80)}`,
    target,
    fromSession: `Neptune Chat — ${context.sourceSession.agentName}`,
    toSession:
      target === "NEPTUNE_V2"
        ? "Neptune V2 Coding Sandbox"
        : target === "NEPTUNE_CHAT"
          ? "Neptune Chat (new session)"
          : "Human Review",
    generatedAt: new Date().toISOString(),
    context,
    suggestedSkills,
    workingBranch,
    contextBudget: {
      turnsUsed: context.sourceSession.turnsUsed,
      tokensEstimated: context.sourceSession.tokensUsed,
    },
  };

  // Generate V2-specific prompt if needed
  if (target === "NEPTUNE_V2") {
    doc.v2Prompt = generateV2Prompt(context, repoRoot, workingBranch);
  }

  return doc;
}

/**
 * Generates a V2-ready prompt with everything V2 needs to start coding.
 */
function generateV2Prompt(
  context: HandoffContext,
  repoRoot: string,
  branch: string
): V2Prompt {
  // Extract tickets from artifacts/context
  const tickets = context.artifacts
    .filter((a) => a.type === "issue")
    .map((a) => ({
      id: a.path,
      title: a.summary,
      acceptanceCriteria: [a.summary],
    }));

  // Detect key files from artifacts
  const keyFiles = context.artifacts
    .filter((a) => a.type === "file")
    .map((a) => a.path);

  // Detect patterns from artifacts
  const patterns = context.artifacts
    .filter((a) => a.type === "file" && a.summary.includes("pattern"))
    .map((a) => a.summary);

  // Build test expectations from open questions and artifacts
  const testQuestions = context.openQuestions.filter(
    (q) =>
      q.question.toLowerCase().includes("test") ||
      q.question.toLowerCase().includes("verify") ||
      q.question.toLowerCase().includes("edge case")
  );

  const testExpectations = {
    integrationTests: testQuestions.map((q) => q.question),
    e2eFlow: context.purpose,
  };

  // Derive architecture hints from decisions
  const archDecisions = context.decisions
    .filter(
      (d) =>
        d.decision.toLowerCase().includes("pattern") ||
        d.decision.toLowerCase().includes("architecture")
    )
    .map((d) => `${d.decision}: ${d.rationale}`)
    .join("; ");

  return {
    tickets,
    repoContext: {
      repo: "abhiswami2121/neptune-chat",
      branch,
      keyFiles,
      patterns: patterns.length > 0 ? patterns : ["Follow existing patterns in lib/connectors/"],
    },
    testExpectations,
    architectureHints: archDecisions || undefined,
    knownPitfalls: extractCommonPitfalls(context),
  };
}

// ── Skill Suggester ────────────────────────────────────────────────────────

/**
 * Suggests skills for the receiving session based on target and context.
 */
function suggestSkills(
  target: HandoffTarget,
  context: HandoffContext
): string[] {
  const skills: string[] = [];

  if (target === "NEPTUNE_V2") {
    skills.push("/tdd — Write failing tests first, implement, refactor");
    skills.push("/improve-codebase-architecture — Run after completing tickets");

    if (context.artifacts.length === 0) {
      skills.push("/grill — Run automated grill to understand the codebase");
    }
  } else {
    // Chat session
    const hasOpenQuestions = context.openQuestions.length > 0;
    const hasPRD = context.artifacts.some((a) => a.type === "prd");
    const hasResearch = context.artifacts.some((a) => a.type === "research");

    if (hasOpenQuestions) {
      skills.push("/grill — Resolve remaining open questions");
    }
    if (!hasPRD) {
      skills.push("/to-prd — Create PRD if one doesn't exist yet");
    }
    if (hasResearch) {
      skills.push("/grill-with-docs — Domain-driven grill using research docs");
    }
    skills.push("/prototype — If design exploration needed");
    skills.push("/to-issues — Break PRD into executable tickets");
    skills.push("/handoff — Pass to V2 when ready for implementation");
  }

  return skills;
}

// ── Context Compressor ─────────────────────────────────────────────────────

/**
 * Compresses a handoff document to markdown, targeting 300-800 words.
 */
export function formatHandoffMarkdown(doc: HandoffDocument): string {
  const lines: string[] = [
    `# Handoff: ${doc.title}`,
    "",
    `**From:** ${doc.fromSession} | **To:** ${doc.toSession}`,
    `**Generated:** ${doc.generatedAt} | **Target:** ${doc.target}`,
    `**Branch:** \`${doc.workingBranch || "N/A"}\``,
    `**Context Budget:** ${doc.contextBudget.turnsUsed} turns, ~${doc.contextBudget.tokensEstimated.toLocaleString()} tokens`,
    "",
    "---",
    "",
    "## Purpose",
    "",
    doc.context.purpose,
    "",
    "## Current State",
    "",
    doc.context.currentState,
    "",
  ];

  // Decisions
  if (doc.context.decisions.length > 0) {
    lines.push("## Key Decisions", "");
    for (const d of doc.context.decisions) {
      lines.push(`- **${d.decision}** → ${d.rationale}`);
      if (d.alternativeConsidered) {
        lines.push(`  _(Alternative considered: ${d.alternativeConsidered})_`);
      }
    }
    lines.push("");
  }

  // Open Questions
  if (doc.context.openQuestions.length > 0) {
    lines.push("## Open Questions", "");
    for (const q of doc.context.openQuestions) {
      lines.push(`- **Q:** ${q.question}`);
      lines.push(`  - Checked: ${q.whatWeChecked}`);
      lines.push(`  - Unresolved because: ${q.whyUnresolved}`);
    }
    lines.push("");
  }

  // Artifacts (pointers only — no duplication)
  if (doc.context.artifacts.length > 0) {
    lines.push("## Artifacts", "");
    for (const a of doc.context.artifacts) {
      lines.push(`- [${a.type}] \`${a.path}\` — ${a.summary}`);
    }
    lines.push("");
  }

  // Suggested Skills
  lines.push("## Suggested Skills", "");
  for (let i = 0; i < doc.suggestedSkills.length; i++) {
    lines.push(`${i + 1}. ${doc.suggestedSkills[i]}`);
  }
  lines.push("");

  // V2 Prompt (only for V2 handoffs)
  if (doc.v2Prompt && doc.target === "NEPTUNE_V2") {
    lines.push(
      "---",
      "",
      "## V2 Coding Prompt",
      "",
      "```markdown",
      formatV2PromptBlock(doc.v2Prompt),
      "```",
      ""
    );
  }

  return lines.join("\n");
}

function formatV2PromptBlock(v2: V2Prompt): string {
  const lines: string[] = [
    `## Tickets to Implement`,
    "",
  ];

  for (const ticket of v2.tickets) {
    lines.push(`### ${ticket.id}: ${ticket.title}`);
    for (const ac of ticket.acceptanceCriteria) {
      lines.push(`- [ ] ${ac}`);
    }
    lines.push("");
  }

  lines.push("## Repo Context", "");
  lines.push(`- **Repo:** ${v2.repoContext.repo}`);
  lines.push(`- **Branch:** ${v2.repoContext.branch}`);
  lines.push(`- **Key files to read first:**`);
  for (const f of v2.repoContext.keyFiles.slice(0, 5)) {
    lines.push(`  - \`${f}\``);
  }
  lines.push(`- **Patterns to follow:**`);
  for (const p of v2.repoContext.patterns) {
    lines.push(`  - ${p}`);
  }
  lines.push("");

  lines.push("## Test Expectations", "");
  lines.push("### Integration Tests");
  for (const t of v2.testExpectations.integrationTests.slice(0, 3)) {
    lines.push(`- ${t}`);
  }
  if (v2.testExpectations.e2eFlow) {
    lines.push(`- E2E: ${v2.testExpectations.e2eFlow}`);
  }
  lines.push("");

  if (v2.architectureHints) {
    lines.push(`## Architecture Hint`);
    lines.push(v2.architectureHints);
    lines.push("");
  }

  if (v2.knownPitfalls && v2.knownPitfalls.length > 0) {
    lines.push("## Known Pitfalls");
    for (const pitfall of v2.knownPitfalls) {
      lines.push(`- ⚠️ ${pitfall}`);
    }
    lines.push("");
  }

  lines.push("## Discipline");
  lines.push("- Use `/tdd` (red-green-refactor) for every ticket");
  lines.push("- One atomic commit per ticket");
  lines.push("- TypeScript strict: zero errors before commit");
  lines.push("- Run full test suite before handoff back");

  return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractCommonPitfalls(context: HandoffContext): string[] {
  const pitfalls: string[] = [];

  // Check for common patterns in decisions and questions
  const allText = [
    ...context.decisions.map((d) => d.decision + " " + d.rationale),
    ...context.openQuestions.map((q) => q.question),
  ].join(" ").toLowerCase();

  if (allText.includes("auth")) {
    pitfalls.push("Don't break auth flow — verify Better Auth middleware before committing");
  }
  if (allText.includes("env") || allText.includes("environment")) {
    pitfalls.push("Check .env.example for required variables — never commit .env files");
  }
  if (allText.includes("migration") || allText.includes("database")) {
    pitfalls.push("Create migrations with Drizzle — run `pnpm db:push` to apply");
  }
  if (allText.includes("api") || allText.includes("endpoint")) {
    pitfalls.push("Use Vercel AI SDK 6 tool() format with Zod schemas for new tools");
  }

  return pitfalls;
}

// ── File Operations ────────────────────────────────────────────────────────

/**
 * Saves a handoff document to a session storage path.
 */
export function saveHandoffDocument(
  doc: HandoffDocument,
  repoRoot: string
): string {
  const handoffDir = resolve(repoRoot, ".handoffs");
  if (!existsSync(handoffDir)) {
    mkdirSync(handoffDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = doc.title
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  const filename = `${timestamp}-${slug}.md`;
  const filepath = resolve(handoffDir, filename);

  const markdown = formatHandoffMarkdown(doc);
  writeFileSync(filepath, markdown, "utf-8");

  return filepath;
}

// ── Public API ─────────────────────────────────────────────────────────────

export default {
  generateHandoff,
  detectHandoffTarget,
  formatHandoffMarkdown,
  saveHandoffDocument,
};

// Re-export for easier imports
export const handoffEngine = {
  generate: generateHandoff,
  detect: detectHandoffTarget,
  format: formatHandoffMarkdown,
  save: saveHandoffDocument,
};
