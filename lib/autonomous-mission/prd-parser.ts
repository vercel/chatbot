/**
 * Autonomous Mission — PRD Parser
 *
 * Parses a PRD markdown file into a structured ExecutionPlan.
 * Extracts YAML frontmatter, stream definitions, steps, acceptance criteria, and cardinal rules.
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 compatible.
 * Phase 38: Autonomous Coding Platform
 */

export interface ExecutionStep {
  id: string;
  type: "create_file" | "edit_file" | "run_test" | "run_build" | "commit" | "deploy" | "verify" | "slack" | "linear";
  description: string;
  filePath?: string;
  content?: string;
  command?: string;
  expectedOutput?: string;
}

export interface StreamPlan {
  id: string;
  name: string;
  budget: number;
  order: number;
  steps: ExecutionStep[];
  dependsOn: string[];
}

export interface CardinalRule {
  rule: string;
  category: "security" | "git" | "deploy" | "general";
}

export interface ExecutionPlan {
  missionId: string;
  prdName: string;
  prdPath: string;
  description: string;
  version: string;
  priority: string;
  streams: StreamPlan[];
  acceptanceCriteria: string[];
  cardinals: CardinalRule[];
  estimatedTotalTokens: number;
  targetBranch: string;
}

interface PrdFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  priority?: string;
  streams?: { name: string; budget: number; order: number }[];
  tags?: string[];
  domain?: string;
  scope?: string;
}

/**
 * Parse PRD markdown content into an ExecutionPlan.
 */
export function parsePrdToPlan(prdContent: string, prdPath: string): ExecutionPlan {
  // Extract YAML frontmatter
  const fmMatch = prdContent.match(/^---\n([\s\S]*?)\n---/);
  const fm: PrdFrontmatter = {};
  if (fmMatch) {
    const yamlBlock = fmMatch[1];
    for (const line of yamlBlock.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        (fm as Record<string, unknown>)[key] = value;
      }
    }
  }

  const missionId = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = fmMatch ? prdContent.slice(fmMatch[0].length) : prdContent;

  // Extract streams from markdown headings
  const streams: StreamPlan[] = [];
  const streamRegex = /^##\s+Stream\s+(\d+):?\s*(.+)$/gm;
  let streamMatch;

  while ((streamMatch = streamRegex.exec(body)) !== null) {
    const streamNum = parseInt(streamMatch[1], 10);
    const streamName = streamMatch[2].trim();
    const budget = extractBudget(body, streamMatch[0]);

    // Extract steps from this stream (content between this heading and next ## heading)
    const startIdx = streamMatch.index + streamMatch[0].length;
    const nextHeadingIdx = body.indexOf("\n## ", startIdx);
    const streamContent = nextHeadingIdx !== -1
      ? body.slice(startIdx, nextHeadingIdx)
      : body.slice(startIdx);

    const steps = extractSteps(streamContent);

    streams.push({
      id: `stream-${streamNum}`,
      name: streamName,
      budget,
      order: streamNum,
      steps,
      dependsOn: streamNum > 1 ? [`stream-${streamNum - 1}`] : [],
    });
  }

  // If no streams found, create single default stream
  if (streams.length === 0) {
    const steps = extractSteps(body);
    streams.push({
      id: "stream-1",
      name: "Implementation",
      budget: 5000,
      order: 1,
      steps,
      dependsOn: [],
    });
  }

  // Extract acceptance criteria
  const acceptanceCriteria = extractAcceptanceCriteria(body);

  // Extract cardinal rules
  const cardinals = extractCardinals(body);

  // Calculate estimated tokens
  const estimatedTotalTokens = streams.reduce((sum, s) => sum + s.budget, 0);

  // Generate target branch
  const safeName = (fm.name || "mission")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const targetBranch = `feat/auto-${safeName}-${dateStr}`;

  return {
    missionId,
    prdName: fm.name || "Unnamed Mission",
    prdPath,
    description: fm.description || "",
    version: fm.version || "0.1.0",
    priority: fm.priority || "P2",
    streams: streams.sort((a, b) => a.order - b.order),
    acceptanceCriteria,
    cardinals,
    estimatedTotalTokens,
    targetBranch,
  };
}

/**
 * Extract budget from stream heading line.
 */
function extractBudget(body: string, headingLine: string): number {
  // Look for budget hint in parentheses: (5000t) or (5000 tokens)
  const budgetMatch = headingLine.match(/\((\d+)\s*t/i);
  if (budgetMatch) return parseInt(budgetMatch[1], 10);

  // Default: 3500t per stream
  return 3500;
}

/**
 * Extract execution steps from stream content.
 */
function extractSteps(content: string): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("- ")) continue;

    const text = trimmed.slice(2).trim();
    const step = classifyStep(text);
    if (step) steps.push(step);
  }

  return steps;
}

/**
 * Classify a bullet point text into an ExecutionStep.
 */
export function classifyStep(text: string): ExecutionStep | null {
  const id = `step-${Math.random().toString(36).slice(2, 8)}`;

  // Detect file operations
  const createMatch = text.match(/creat(?:e|ing)\s+(?:file\s+)?`?([^\s`]+)/i);
  if (createMatch || text.toLowerCase().includes("create")) {
    return {
      id,
      type: "create_file",
      description: text,
      filePath: createMatch?.[1] || undefined,
    };
  }

  const editMatch = text.match(/(?:edit|modify|update|change)\s+(?:file\s+)?`?([^\s`]+)/i);
  if (editMatch || text.toLowerCase().includes("edit")) {
    return {
      id,
      type: "edit_file",
      description: text,
      filePath: editMatch?.[1] || undefined,
    };
  }

  // Detect test operations
  if (/test|e2e|playwright|vitest|jest/i.test(text)) {
    return { id, type: "run_test", description: text, command: extractCommand(text) };
  }

  // Detect build operations
  if (/build|compile|typecheck|tsc/i.test(text)) {
    return { id, type: "run_build", description: text, command: extractCommand(text) };
  }

  // Detect commit operations
  if (/commit|push|branch/i.test(text)) {
    return { id, type: "commit", description: text };
  }

  // Detect deploy operations
  if (/deploy|vercel|ship/i.test(text)) {
    return { id, type: "deploy", description: text };
  }

  // Detect verification operations
  if (/verify|check|test.*url|curl/i.test(text)) {
    return { id, type: "verify", description: text };
  }

  // Detect Slack operations
  if (/slack|land|notify/i.test(text)) {
    return { id, type: "slack", description: text };
  }

  // Detect Linear operations
  if (/linear|ticket/i.test(text)) {
    return { id, type: "linear", description: text };
  }

  // Default: treat as create_file
  return { id, type: "create_file", description: text };
}

/**
 * Extract a command from text (e.g., `pnpm build` or `npx tsc`)
 */
function extractCommand(text: string): string | undefined {
  const match = text.match(/`([^`]+)`/);
  return match?.[1] || undefined;
}

/**
 * Extract acceptance criteria (checkbox lists).
 */
export function extractAcceptanceCriteria(body: string): string[] {
  const criteria: string[] = [];
  const sectionMatch = body.match(/##\s+Acceptance\s+Criteria[\s\S]*?(?=\n## |$)/i);
  if (!sectionMatch) return criteria;

  const lines = sectionMatch[0].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [") || trimmed.startsWith("- [")) {
      criteria.push(trimmed.replace(/^-\s*\[.\]\s*/, "").trim());
    }
  }

  return criteria;
}

/**
 * Extract cardinal rules from PRD body.
 */
function extractCardinals(body: string): CardinalRule[] {
  const rules: CardinalRule[] = [];
  const sectionMatch = body.match(/##\s+Cardinal\s+Rules[\s\S]*?(?=\n## |$)/i);
  if (!sectionMatch) return rules;

  const lines = sectionMatch[0].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || /^\d+\./.test(trimmed)) {
      const ruleText = trimmed.replace(/^[\d.-]+\s*/, "").trim();
      if (!ruleText) continue;

      let category: CardinalRule["category"] = "general";
      if (/force.push|main|branch/i.test(ruleText)) category = "git";
      if (/secret|credential|\.env|token|api.key/i.test(ruleText)) category = "security";
      if (/deploy|vercel|ship/i.test(ruleText)) category = "deploy";

      rules.push({ rule: ruleText, category });
    }
  }

  return rules;
}
