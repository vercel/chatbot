/**
 * Automated Grill Engine — Matt Pocock's /grill-me, self-answering edition.
 *
 * KEY INNOVATION: The grill asks questions AND answers them by exploring
 * the codebase, checking git history, reading docs, and inspecting connected
 * services. Only truly unanswerable questions reach the human.
 *
 * Architecture:
 *   Phase 1: Generate design tree questions from feature intent
 *   Phase 2: For each question, attempt self-answer via multiple probes
 *   Phase 3: Classify each question as RESOLVED (with evidence) or UNRESOLVED
 *   Phase 4: Present only UNRESOLVED to human (or skip if none)
 *   Phase 5: Compile grill output as structured context for /to-prd
 *
 * Three modes:
 *   Mode 1 — SELF_GRILL: Answers everything from codebase/docs/git (default)
 *   Mode 2 — MULTI_AGENT: Routes questions to V2/connectors for answers
 *   Mode 3 — HUMAN_IN_LOOP: Traditional Pocock grill, all questions to human
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve, relative, dirname } from "path";
import { execSync } from "child_process";

// ── Types ──────────────────────────────────────────────────────────────────

export type GrillMode = "SELF_GRILL" | "MULTI_AGENT" | "HUMAN_IN_LOOP";

export interface GrillQuestion {
  id: string;
  topic: string;
  question: string;
  dependsOn?: string[]; // question IDs this depends on
  children: GrillQuestion[];
  status: "PENDING" | "RESOLVED" | "UNRESOLVED" | "SKIPPED";
  answer?: string;
  evidence?: GrillEvidence[];
  resolution?: "CODEBASE" | "DOCS" | "GIT" | "CONNECTOR" | "HUMAN" | "ASSUMED";
  humanPrompt?: string; // only set if UNRESOLVED and HUMAN_IN_LOOP
}

export interface GrillEvidence {
  source: string; // file path, git commit, API response, doc path
  type: "FILE" | "GIT" | "DOC" | "API" | "CONFIG";
  snippet: string; // relevant excerpt
  confidence: number; // 0.0 — 1.0
}

export interface GrillOutput {
  featureId: string;
  mode: GrillMode;
  generatedAt: string;
  designTree: GrillQuestion[];
  resolvedCount: number;
  unresolvedCount: number;
  riskRegister: GrillRisk[];
  readyForPRD: boolean;
  summary: string;
}

export interface GrillRisk {
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  relatedQuestion: string; // question ID
  mitigation: string;
}

export interface SelfAnswerContext {
  repoRoot: string;
  featureDescription: string;
  filesChanged?: string[];
  gitHistoryDepth?: number;
  connectorStates?: Record<string, unknown>;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Recursive type for design tree templates before ID assignment */
type TemplateQuestion = Omit<GrillQuestion, "id" | "status" | "children"> & {
  children: TemplateQuestion[];
};

/** Top-level design tree questions — first pass at any feature */
const DESIGN_TREE_TEMPLATES: TemplateQuestion[] = [
  {
    topic: "Purpose",
    question: "What problem does this feature solve? Who is it for?",
    children: [
      {
        topic: "User",
        question: "Is the user an existing customer, new customer, or internal operator?",
        children: [],
      },
      {
        topic: "Scope",
        question: "What is explicitly OUT of scope for this feature?",
        children: [],
      },
    ],
  },
  {
    topic: "Codebase Impact",
    question: "What parts of the codebase does this feature touch?",
    children: [
      {
        topic: "Existing Patterns",
        question: "Is there an existing pattern or component we should follow?",
        children: [],
      },
      {
        topic: "Conflicts",
        question: "Does this overlap or conflict with any existing feature?",
        children: [],
      },
    ],
  },
  {
    topic: "Dependencies",
    question: "What are the internal and external dependencies?",
    children: [
      {
        topic: "API",
        question: "What external APIs or services does this depend on?",
        children: [],
      },
      {
        topic: "Data",
        question: "What database changes are required? New tables, columns, or migrations?",
        children: [],
      },
    ],
  },
  {
    topic: "Contract",
    question: "What is the API/UI contract for this feature?",
    children: [
      {
        topic: "API Shape",
        question: "What does the request/response look like? What are the error states?",
        children: [],
      },
      {
        topic: "UI States",
        question: "What are ALL UI states: loading, empty, error, edge cases?",
        children: [],
      },
    ],
  },
  {
    topic: "Risk",
    question: "What could break? What are the failure modes?",
    children: [
      {
        topic: "Breaking Changes",
        question: "Could this break existing users or features?",
        children: [],
      },
      {
        topic: "Performance",
        question: "Are there performance implications? (N+1 queries, large payloads, etc.)",
        children: [],
      },
      {
        topic: "Security",
        question: "Are there auth, authorization, or data exposure concerns?",
        children: [],
      },
    ],
  },
  {
    topic: "Testing",
    question: "How will we know this works? What's the testing strategy?",
    children: [
      {
        topic: "Integration",
        question: "What integration tests are needed?",
        children: [],
      },
      {
        topic: "Edge Cases",
        question: "What edge cases must be tested explicitly?",
        children: [],
      },
    ],
  },
];

/** Maximum questions before force-resolving remainder as HUMAN_IN_LOOP */
const MAX_QUESTIONS = 50;

/** Minimum confidence to auto-resolve a question */
const AUTO_RESOLVE_CONFIDENCE = 0.7;

// ── Design Tree Generator ──────────────────────────────────────────────────

/**
 * Generates the initial design tree from a feature description.
 * Starts with template questions and extends with feature-specific follow-ups.
 */
export function generateDesignTree(
  featureDescription: string,
  repoRoot: string
): GrillQuestion[] {
  const questions: GrillQuestion[] = DESIGN_TREE_TEMPLATES.map(
    (template, i) => ({
      ...template,
      id: `Q-${String(i + 1).padStart(3, "0")}`,
      status: "PENDING",
      children: template.children.map((child, j) => ({
        ...child,
        id: `Q-${String(i + 1).padStart(3, "0")}-${String(j + 1).padStart(2, "0")}`,
        dependsOn: [`Q-${String(i + 1).padStart(3, "0")}`],
        status: "PENDING",
        children: [],
      })),
    })
  );

  // Feature-specific branch: is this UI, API, or infrastructure?
  const isUI = /ui|component|page|layout|style|animation|modal|sidebar|button/i.test(
    featureDescription
  );
  const isAPI = /api|endpoint|route|query|mutation|database|schema/i.test(
    featureDescription
  );
  const isInfra = /deploy|build|config|ci|pipeline|auth|sandbox/i.test(
    featureDescription
  );

  if (isUI) {
    questions.push({
      id: "Q-UI-001",
      topic: "UI/UX",
      question: "What are the mobile, tablet, and desktop breakpoints for this UI?",
      children: [
        {
          id: "Q-UI-001-01",
          topic: "Accessibility",
          question: "Does this UI meet accessibility requirements? (keyboard nav, screen reader, contrast)",
          children: [],
          status: "PENDING",
        },
      ],
      status: "PENDING",
    });
  }

  if (isAPI) {
    questions.push({
      id: "Q-API-001",
      topic: "API Design",
      question: "What is the rate limiting, caching, and pagination strategy?",
      children: [
        {
          id: "Q-API-001-01",
          topic: "Backward Compat",
          question: "Is this API backward-compatible? If not, what's the migration path?",
          children: [],
          status: "PENDING",
        },
      ],
      status: "PENDING",
    });
  }

  return questions;
}

// ── Self-Answer Probes ─────────────────────────────────────────────────────

/**
 * Probe 1: Search the codebase for answers via grep.
 */
function probeCodebase(
  question: GrillQuestion,
  repoRoot: string
): GrillEvidence[] {
  const evidence: GrillEvidence[] = [];
  const searchTerms = extractSearchTerms(question.question);

  for (const term of searchTerms) {
    try {
      const result = execSync(
        `grep -rIl "${term}" ${repoRoot}/lib ${repoRoot}/app ${repoRoot}/components 2>/dev/null | head -5`,
        { encoding: "utf-8", timeout: 5000 }
      );
      if (result.trim()) {
        const files = result.trim().split("\n").filter(Boolean).slice(0, 3);
        for (const file of files) {
          const relativePath = relative(repoRoot, file);
          const content = readFileSync(file, "utf-8").slice(0, 200);
          evidence.push({
            source: relativePath,
            type: "FILE",
            snippet: content,
            confidence: 0.6,
          });
        }
      }
    } catch {
      // grep found nothing — that's fine, try next probe
    }
  }

  return evidence;
}

/**
 * Probe 2: Check git history for past decisions, reverted attempts.
 */
function probeGitHistory(
  question: GrillQuestion,
  repoRoot: string,
  depth = 30
): GrillEvidence[] {
  const evidence: GrillEvidence[] = [];

  try {
    const log = execSync(
      `cd ${repoRoot} && git log --oneline -${depth} --all --grep="${sanitizeForGrep(question.topic)}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 5000 }
    );
    if (log.trim()) {
      evidence.push({
        source: `git log (${depth} commits, topic: ${question.topic})`,
        type: "GIT",
        snippet: log.trim().slice(0, 300),
        confidence: 0.5,
      });
    }
  } catch {
    // No relevant git history
  }

  return evidence;
}

/**
 * Probe 3: Search existing docs (AGENTS.md, NEPTUNE.md, docs/, cortex/).
 */
function probeDocs(
  question: GrillQuestion,
  repoRoot: string
): GrillEvidence[] {
  const evidence: GrillEvidence[] = [];
  const docPaths = [
    resolve(repoRoot, "AGENTS.md"),
    resolve(repoRoot, "NEPTUNE.md"),
    resolve(repoRoot, "docs"),
    resolve(repoRoot, "cortex"),
  ];

  for (const docPath of docPaths) {
    try {
      if (!existsSync(docPath)) continue;
      const isDir = !docPath.endsWith(".md");

      if (isDir) {
        const files = findMdFiles(docPath, 2);
        for (const file of files) {
          const content = readFileSync(file, "utf-8");
          if (content.toLowerCase().includes(question.topic.toLowerCase())) {
            evidence.push({
              source: relative(repoRoot, file),
              type: "DOC",
              snippet: extractRelevantSnippet(content, question.topic, 200),
              confidence: 0.7,
            });
          }
        }
      } else {
        const content = readFileSync(docPath, "utf-8");
        if (content.toLowerCase().includes(question.topic.toLowerCase())) {
          evidence.push({
            source: relative(repoRoot, docPath),
            type: "DOC",
            snippet: extractRelevantSnippet(content, question.topic, 200),
            confidence: 0.8,
          });
        }
      }
    } catch {
      // Document not accessible
    }
  }

  return evidence;
}

/**
 * Probe 4: Check environment/config for constraints.
 */
function probeConfig(repoRoot: string): GrillEvidence[] {
  const evidence: GrillEvidence[] = [];
  const configFiles = [".env.example", "vercel.json", "next.config.ts", "package.json", "tsconfig.json"];

  for (const configFile of configFiles) {
    const configPath = resolve(repoRoot, configFile);
    try {
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, "utf-8");
        evidence.push({
          source: configFile,
          type: "CONFIG",
          snippet: content.slice(0, 300),
          confidence: 0.4,
        });
      }
    } catch {
      // Config not found
    }
  }

  return evidence;
}

// ── Self-Answer Engine ─────────────────────────────────────────────────────

/**
 * Attempts to self-answer a single grill question by probing all available sources.
 */
export function selfAnswerQuestion(
  question: GrillQuestion,
  context: SelfAnswerContext
): GrillQuestion {
  let evidence: GrillEvidence[] = [];

  // Step 1: Codebase search
  evidence = evidence.concat(probeCodebase(question, context.repoRoot));

  // Step 2: Git history
  evidence = evidence.concat(
    probeGitHistory(question, context.repoRoot, context.gitHistoryDepth || 30)
  );

  // Step 3: Documentation
  evidence = evidence.concat(probeDocs(question, context.repoRoot));

  // Step 4: Configuration
  evidence = evidence.concat(probeConfig(context.repoRoot));

  // Determine resolution
  if (evidence.length === 0) {
    // No evidence found — cannot self-answer
    return {
      ...question,
      status: "UNRESOLVED",
      answer: "No codebase, documentation, or git evidence found.",
      evidence: [],
      resolution: "HUMAN",
      humanPrompt: `Cannot find any codebase evidence for: "${question.question}"`,
    };
  }

  // Score evidence and decide
  const bestEvidence = evidence.reduce((best, curr) =>
    curr.confidence > best.confidence ? curr : best
  );

  if (bestEvidence.confidence >= AUTO_RESOLVE_CONFIDENCE) {
    // We can answer this!
    const resolutionType = bestEvidence.type === "FILE"
      ? "CODEBASE"
      : bestEvidence.type === "GIT"
        ? "GIT"
        : bestEvidence.type === "DOC"
          ? "DOCS"
          : "CONNECTOR";

    return {
      ...question,
      status: "RESOLVED",
      answer: synthesizeAnswer(question, evidence),
      evidence,
      resolution: resolutionType,
    };
  }

  // Low confidence — flag for human or multi-agent
  return {
    ...question,
    status: "UNRESOLVED",
    answer: "Low confidence from codebase evidence.",
    evidence,
    resolution: "HUMAN",
    humanPrompt: `Low confidence evidence for: "${question.question}". Best source: ${bestEvidence.source}`,
  };
}

/**
 * Self-answers the entire design tree, resolving what it can.
 */
export function selfGrillDesignTree(
  questions: GrillQuestion[],
  context: SelfAnswerContext
): GrillQuestion[] {
  const resolved: GrillQuestion[] = [];

  for (const question of questions) {
    if (question.status === "SKIPPED") {
      resolved.push(question);
      continue;
    }

    // Skip questions whose dependencies are unresolved
    if (question.dependsOn && question.dependsOn.length > 0) {
      const depsResolved = question.dependsOn.every((depId) => {
        const dep = resolved.find((q) => q.id === depId);
        return dep?.status === "RESOLVED";
      });
      if (!depsResolved) {
        resolved.push({ ...question, status: "SKIPPED" });
        continue;
      }
    }

    const answered = selfAnswerQuestion(question, context);

    // Recursively answer children
    if (answered.children.length > 0) {
      answered.children = selfGrillDesignTree(answered.children, context);
    }

    resolved.push(answered);
    if (resolved.length >= MAX_QUESTIONS) break;
  }

  return resolved;
}

// ── Output Compiler ────────────────────────────────────────────────────────

/**
 * Compiles the final grill output document.
 */
export function compileGrillOutput(
  featureDescription: string,
  questions: GrillQuestion[],
  mode: GrillMode
): GrillOutput {
  const allQuestions = flattenQuestions(questions);
  const resolved = allQuestions.filter((q) => q.status === "RESOLVED");
  const unresolved = allQuestions.filter((q) => q.status === "UNRESOLVED");

  const riskRegister: GrillRisk[] = extractRisks(questions);

  return {
    featureId: slugify(featureDescription.slice(0, 50)),
    mode,
    generatedAt: new Date().toISOString(),
    designTree: questions,
    resolvedCount: resolved.length,
    unresolvedCount: unresolved.length,
    riskRegister,
    readyForPRD: unresolved.length <= 10,
    summary: `Grill complete: ${resolved.length} resolved (${countResolutions(resolved)}), ${unresolved.length} unresolved. ${riskRegister.length} risks identified. ${unresolved.length <= 10 ? "READY for /to-prd." : "Needs human input before proceeding."}`,
  };
}

/**
 * Formats the grill output as a markdown document.
 */
export function formatGrillMarkdown(output: GrillOutput): string {
  const lines: string[] = [
    `# Grill Output: ${output.featureId}`,
    "",
    `**Mode:** ${output.mode} | **Generated:** ${output.generatedAt}`,
    `**Resolved:** ${output.resolvedCount} | **Unresolved:** ${output.unresolvedCount}`,
    `**Ready for PRD:** ${output.readyForPRD ? "✅ YES" : "❌ NO — needs human input"}`,
    "",
    "---",
    "",
    "## Decision Tree",
    "",
    ...formatTreeMarkdown(output.designTree, 0),
    "",
    "---",
    "",
    "## Resolved Questions",
    "",
    ...formatResolvedQuestions(output.designTree),
    "",
    "## Unresolved Questions",
    "",
    ...formatUnresolvedQuestions(output.designTree),
    "",
    "---",
    "",
    "## Risk Register",
    "",
    ...formatRisks(output.riskRegister),
    "",
    "---",
    "",
    `## ${output.readyForPRD ? "✅ Ready for /to-prd" : "❌ Action Required"}`,
    "",
    output.readyForPRD
      ? "All questions resolved or within acceptable threshold. Run /to-prd to create the PRD."
      : `${output.unresolvedCount} questions need human input before /to-prd. Present these to the user.`,
    "",
  ];

  return lines.join("\n");
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run the full automated grill pipeline.
 *
 * @param featureDescription - What the user wants to build
 * @param repoRoot - Path to the repository root
 * @param mode - Grill mode (default SELF_GRILL)
 * @returns Compiled grill output
 */
export function runAutomatedGrill(
  featureDescription: string,
  repoRoot: string,
  mode: GrillMode = "SELF_GRILL"
): GrillOutput {
  // Phase 1: Generate design tree
  const designTree = generateDesignTree(featureDescription, repoRoot);

  // Phase 2: Self-answer (or route based on mode)
  let resolvedTree: GrillQuestion[];
  if (mode === "HUMAN_IN_LOOP") {
    // Traditional Pocock: all questions go to human, no self-answer
    resolvedTree = designTree.map((q) => ({ ...q, status: "UNRESOLVED" }));
  } else {
    // SELF_GRILL or MULTI_AGENT: attempt self-answer
    const context: SelfAnswerContext = {
      repoRoot,
      featureDescription,
      gitHistoryDepth: 50,
    };
    resolvedTree = selfGrillDesignTree(designTree, context);
  }

  // Phase 3-5: Compile output
  return compileGrillOutput(featureDescription, resolvedTree, mode);
}

// ── Helper Functions ───────────────────────────────────────────────────────

function extractSearchTerms(question: string): string[] {
  // Extract likely codebase identifiers from the question
  const words = question
    .toLowerCase()
    .replace(/[?.,;:!]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !["what", "does", "this", "that", "with", "from", "have", "been", "were", "they", "will", "when", "where", "which"].includes(w));

  return words.slice(0, 5);
}

function sanitizeForGrep(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, ".").slice(0, 30);
}

function findMdFiles(dir: string, depth: number): string[] {
  const results: string[] = [];
  if (depth < 0) return results;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("node_modules")) {
        results.push(...findMdFiles(fullPath, depth - 1));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission errors, etc.
  }
  return results;
}

function extractRelevantSnippet(content: string, topic: string, maxLen: number): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(topic.toLowerCase());
  if (idx === -1) return content.slice(0, maxLen);
  const start = Math.max(0, idx - 50);
  const end = Math.min(content.length, idx + topic.length + maxLen);
  return "..." + content.slice(start, end) + "...";
}

function synthesizeAnswer(
  question: GrillQuestion,
  evidence: GrillEvidence[]
): string {
  if (evidence.length === 0) return "No evidence found.";

  const bestEvidence = evidence.reduce((a, b) =>
    a.confidence >= b.confidence ? a : b
  );

  switch (bestEvidence.type) {
    case "FILE":
      return `Found in codebase at ${bestEvidence.source}: ${bestEvidence.snippet.slice(0, 100)}...`;
    case "GIT":
      return `Git history shows: ${bestEvidence.snippet.slice(0, 100)}...`;
    case "DOC":
      return `Documentation at ${bestEvidence.source} indicates: ${bestEvidence.snippet.slice(0, 100)}...`;
    case "CONFIG":
      return `Configuration in ${bestEvidence.source} constrains this.`;
    default:
      return `Answered from ${bestEvidence.type} evidence.`;
  }
}

function flattenQuestions(questions: GrillQuestion[]): GrillQuestion[] {
  const flat: GrillQuestion[] = [];
  for (const q of questions) {
    flat.push(q);
    if (q.children.length > 0) {
      flat.push(...flattenQuestions(q.children));
    }
  }
  return flat;
}

function countResolutions(questions: GrillQuestion[]): string {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    if (q.resolution) {
      counts[q.resolution] = (counts[q.resolution] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${k.toLowerCase()}`)
    .join(", ");
}

function extractRisks(questions: GrillQuestion[]): GrillRisk[] {
  const risks: GrillRisk[] = [];
  const allQuestions = flattenQuestions(questions);
  const riskTopicQuestions = allQuestions.filter(
    (q) => q.topic === "Risk" || q.topic === "Breaking Changes" || q.topic === "Performance" || q.topic === "Security"
  );

  for (const q of riskTopicQuestions) {
    if (q.answer && q.status === "RESOLVED") {
      risks.push({
        description: q.answer,
        severity: q.topic === "Security" ? "CRITICAL" : q.topic === "Breaking Changes" ? "HIGH" : "MEDIUM",
        relatedQuestion: q.id,
        mitigation: q.evidence && q.evidence.length > 0
          ? `See evidence in ${q.evidence[0].source}`
          : "Needs mitigation plan",
      });
    }
  }

  return risks;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function formatTreeMarkdown(
  questions: GrillQuestion[],
  depth: number
): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  const statusIcon = (q: GrillQuestion) =>
    q.status === "RESOLVED" ? "✅" : q.status === "UNRESOLVED" ? "❓" : q.status === "SKIPPED" ? "⏭️" : "⬜";

  for (const q of questions) {
    lines.push(`${indent}- ${statusIcon(q)} **${q.topic}**: ${q.question}`);
    if (q.answer) {
      lines.push(`${indent}  → ${q.answer.slice(0, 120)}`);
    }
    if (q.children.length > 0) {
      lines.push(...formatTreeMarkdown(q.children, depth + 1));
    }
  }

  return lines;
}

function formatResolvedQuestions(questions: GrillQuestion[]): string[] {
  const lines: string[] = [];
  const resolved = flattenQuestions(questions).filter(
    (q) => q.status === "RESOLVED"
  );

  if (resolved.length === 0) {
    lines.push("_No questions could be self-resolved._", "");
    return lines;
  }

  for (const q of resolved) {
    lines.push(`### ${q.topic}: ${q.question}`);
    lines.push("");
    lines.push(`**Answer:** ${q.answer}`);
    if (q.evidence && q.evidence.length > 0) {
      lines.push("");
      lines.push("**Evidence:**");
      for (const e of q.evidence) {
        lines.push(`- [${e.type}] \`${e.source}\` (confidence: ${(e.confidence * 100).toFixed(0)}%)`);
      }
    }
    lines.push(`**Resolution:** ${q.resolution}`, "");
  }

  return lines;
}

function formatUnresolvedQuestions(questions: GrillQuestion[]): string[] {
  const lines: string[] = [];
  const unresolved = flattenQuestions(questions).filter(
    (q) => q.status === "UNRESOLVED"
  );

  if (unresolved.length === 0) {
    lines.push("_All questions resolved! No human input needed._", "");
    return lines;
  }

  for (const q of unresolved) {
    lines.push(`### ❓ ${q.topic}: ${q.question}`);
    lines.push("");
    if (q.humanPrompt) {
      lines.push(`> ${q.humanPrompt}`);
    }
    if (q.evidence && q.evidence.length > 0) {
      lines.push("");
      lines.push("**Partial evidence:**");
      for (const e of q.evidence) {
        lines.push(`- [${e.type}] \`${e.source}\``);
      }
    }
    lines.push("");
  }

  return lines;
}

function formatRisks(risks: GrillRisk[]): string[] {
  const lines: string[] = [];

  if (risks.length === 0) {
    lines.push("_No risks identified._", "");
    return lines;
  }

  for (const risk of risks) {
    const severityIcon =
      risk.severity === "CRITICAL"
        ? "🔴"
        : risk.severity === "HIGH"
          ? "🟠"
          : risk.severity === "MEDIUM"
            ? "🟡"
            : "🟢";
    lines.push(
      `- ${severityIcon} **${risk.severity}**: ${risk.description} → ${risk.mitigation}`
    );
    lines.push(`  (Related: ${risk.relatedQuestion})`);
  }
  lines.push("");

  return lines;
}

// ── Export the public API ──────────────────────────────────────────────────

export default {
  runAutomatedGrill,
  generateDesignTree,
  selfAnswerQuestion,
  selfGrillDesignTree,
  compileGrillOutput,
  formatGrillMarkdown,
};
