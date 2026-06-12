/**
 * Playbook Loader — loads and caches PLAYBOOK.md files for all connectors.
 *
 * When a tool from connector X is invoked, the chat orchestrator injects
 * relevant PLAYBOOK.md sections into the system prompt.
 *
 * Architecture:
 * - On first access: reads PLAYBOOK.md from each connector directory
 * - In-memory cache: avoids filesystem reads on every request
 * - Section extraction: parses ## headings to extract specific sections
 * - Graceful degradation: if PLAYBOOK.md is missing, returns empty playbook
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlaybookSection {
  heading: string;
  content: string;
  level: number; // 2 = ##, 3 = ###
}

export interface Playbook {
  connectorId: string;
  connectorName: string;
  sections: PlaybookSection[];
  rawMarkdown: string;
  loadedAt: number;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const playbookCache = new Map<string, Playbook>();

// ── Config ─────────────────────────────────────────────────────────────────

/** Sections to inject into system prompt (most relevant for AI tool usage) */
const SYSTEM_PROMPT_SECTIONS = [
  "Operational Knowledge",
  "Anti-Patterns",
  "Safeguards",
  "Common Workflows",
];

/** Maximum combined length of injected playbook context */
const MAX_PLAYBOOK_CONTEXT_LENGTH = 12000;

// ── Section Parser ─────────────────────────────────────────────────────────

/**
 * Parses markdown content into sections based on ## and ### headings.
 */
function parseSections(markdown: string): PlaybookSection[] {
  const sections: PlaybookSection[] = [];
  const lines = markdown.split("\n");
  let currentHeading = "";
  let currentContent: string[] = [];
  let currentLevel = 0;

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);
    const h1Match = line.match(/^# (.+)/);

    if (h1Match) {
      // H1 — flush current, start main heading
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading || "(preamble)",
          content: currentContent.join("\n").trim(),
          level: currentLevel,
        });
      }
      currentHeading = h1Match[1];
      currentContent = [];
      currentLevel = 1;
    } else if (h2Match) {
      // H2 — flush current, start new section
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading || "(preamble)",
          content: currentContent.join("\n").trim(),
          level: currentLevel,
        });
      }
      currentHeading = h2Match[1];
      currentContent = [];
      currentLevel = 2;
    } else if (h3Match) {
      // H3 — flush current, start new subsection
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading || "(preamble)",
          content: currentContent.join("\n").trim(),
          level: currentLevel,
        });
      }
      currentHeading = h3Match[1];
      currentContent = [];
      currentLevel = 3;
    } else {
      currentContent.push(line);
    }
  }

  // Flush final section
  if (currentHeading || currentContent.length > 0) {
    sections.push({
      heading: currentHeading || "(preamble)",
      content: currentContent.join("\n").trim(),
      level: currentLevel,
    });
  }

  return sections;
}

// ── Loader ─────────────────────────────────────────────────────────────────

/**
 * Loads a single playbook from a connector directory.
 */
function loadPlaybook(connectorId: string): Playbook | null {
  const playbookPath = resolve(
    process.cwd(),
    `connectors/${connectorId}/PLAYBOOK.md`
  );

  if (!existsSync(playbookPath)) {
    console.warn(`[playbook-loader] No PLAYBOOK.md found for ${connectorId}`);
    return null;
  }

  const rawMarkdown = readFileSync(playbookPath, "utf-8");
  const sections = parseSections(rawMarkdown);

  // Extract connector name from H1 or use connectorId
  const h1Section = sections.find((s) => s.level === 1);
  const connectorName = h1Section
    ? h1Section.heading.replace(/\s+Connector Playbook.*$/i, "").trim()
    : connectorId;

  return {
    connectorId,
    connectorName,
    sections,
    rawMarkdown,
    loadedAt: Date.now(),
  };
}

/**
 * Gets or loads a playbook for a connector.
 */
export function getPlaybook(connectorId: string): Playbook | null {
  const cached = playbookCache.get(connectorId);
  if (cached) return cached;

  const playbook = loadPlaybook(connectorId);
  if (playbook) {
    playbookCache.set(connectorId, playbook);
  }
  return playbook;
}

/**
 * Gets the system prompt sections from a playbook — only the most
 * AI-relevant sections: Operational Knowledge, Anti-Patterns, Safeguards, Common Workflows.
 */
export function getPlaybookSystemContext(connectorId: string): string {
  const playbook = getPlaybook(connectorId);
  if (!playbook) return "";

  const relevantSections = playbook.sections.filter((s) =>
    SYSTEM_PROMPT_SECTIONS.some((name) =>
      s.heading.toLowerCase().includes(name.toLowerCase())
    )
  );

  if (relevantSections.length === 0) return "";

  const parts: string[] = [
    `\n--- CONNECTOR PLAYBOOK: ${playbook.connectorName} (${connectorId}) ---`,
  ];

  for (const section of relevantSections) {
    parts.push(`\n## ${section.heading}\n${section.content}`);
  }

  const full = parts.join("\n");
  if (full.length > MAX_PLAYBOOK_CONTEXT_LENGTH / 2) {
    return full.slice(0, MAX_PLAYBOOK_CONTEXT_LENGTH / 2) + "\n...(truncated)";
  }

  return full;
}

/**
 * Builds a comprehensive system prompt addendum from ALL available playbooks.
 * Use this to inject operational context for ALL connected tools.
 *
 * Only includes connectors whose env vars are configured (connected status).
 */
export function buildAllPlaybooksContext(
  connectedConnectorIds: string[]
): string {
  const loaded: string[] = [];

  for (const id of connectedConnectorIds) {
    const context = getPlaybookSystemContext(id);
    if (context) {
      loaded.push(context);
    }
  }

  if (loaded.length === 0) return "";

  const combined = loaded.join("\n");

  // Hard truncate to prevent context overflow
  if (combined.length > MAX_PLAYBOOK_CONTEXT_LENGTH) {
    return (
      combined.slice(0, MAX_PLAYBOOK_CONTEXT_LENGTH) +
      "\n...(playbook context truncated to prevent overflow)"
    );
  }

  return combined;
}

/**
 * Resolves a tool name like "slack.postMessage" or "pullSlackMessages"
 * to its connector ID.
 *
 * Handles both namespaced (connector.tool) and legacy (inline tool) naming.
 */
export function resolveConnectorFromTool(toolName: string): string | null {
  // Map of known tool name patterns to connector IDs
  const toolToConnector: Record<string, string | null> = {
    // Slack tools
    pullSlackMessages: "slack",
    "slack.listChannels": "slack",
    "slack.postMessage": "slack",
    "slack.pullMessages": "slack",
    "slack.reactionAdd": "slack",
    "slack.searchChannels": "slack",
    // GHL tools
    "ghl.createContact": "ghl",
    "ghl.sendSms": "ghl",
    "ghl.sendEmail": "ghl",
    "ghl.queryConversations": "ghl",
    "ghl.getOpportunity": "ghl",
    // GitHub tools
    "github.searchCode": "github",
    "github.getFile": "github",
    "github.listPRs": "github",
    "github.createPR": "github",
    "github.spawnCodingAgent": "github",
    spawnCodingAgent: "github",
    // NMI tools
    "nmi.getSubscription": "nmi",
    "nmi.getVault": "nmi",
    "nmi.queryTransactions": "nmi",
    "nmi.refundTransaction": "nmi",
    // Vercel tools
    "vercel.listDeploys": "vercel",
    "vercel.getDeployLog": "vercel",
    "vercel.listProjects": "vercel",
    "vercel.createProject": "vercel",
    "vercel.redeploy": "vercel",
    // Base44 tools
    "base44.createEntity": "base44",
    "base44.customer360": "base44",
    "base44.invokeFunction": "base44",
    "base44.queryEntity": "base44",
    "base44.reportingHub": "base44",
    "base44.updateEntity": "base44",
    queryDatabase: "base44",
    // Hyperswitch tools
    "hyperswitch.createPaymentLink": "hyperswitch",
    "hyperswitch.listPayments": "hyperswitch",
    "hyperswitch.refundPayment": "hyperswitch",
    // Linear tools
    "linear.listIssues": "linear",
    "linear.createIssue": "linear",
    "linear.searchIssues": "linear",
    "linear.listProjects": "linear",
    // Affy tools
    "affy.getChargebacks": "affy",
    "affy.submitEvidence": "affy",
    "affy.generateAffidavit": "affy",
    "affy.trackDispute": "affy",
    // Forth tools
    "forth.getDisputes": "forth",
    "forth.updateDispute": "forth",
    "forth.queryContact": "forth",
    "forth.pullCreditReport": "forth",
    "forth.listEnrollments": "forth",
    // Wiki tools
    "wiki.ingestSource": "wiki",
    "wiki.queryWiki": "wiki",
    "wiki.lintWiki": "wiki",
    "wiki.writeWikiPage": "wiki",
    "wiki.updateIndex": "wiki",
    // Vapi tools
    "vapi.listV2Sessions": "vapi",
    "vapi.getV2Session": "vapi",
    "vapi.postV2Session": "vapi",
    "vapi.streamV2Progress": "vapi",
    "vapi.controlV2Session": "vapi",
    listV2Sessions: "vapi",
    getV2Session: "vapi",
    postV2Session: "vapi",
    streamV2Progress: "vapi",
    controlV2Session: "vapi",
    // MCP Hub tools
    "mcp-hub.listServers": "mcp-hub",
    "mcp-hub.connectServer": "mcp-hub",
    "mcp-hub.listTools": "mcp-hub",
    // Workflow
    runWorkflow: null, // Internal, no connector
    // Generic
    fetchURL: null,
    requestSuggestions: null,
    createDocument: null,
    editDocument: null,
    updateDocument: null,
    getWeather: null,
    readSkill: null,
    readPRD: null,
    listSkills: null,
    searchKnowledge: null,
    // Sandbox
    runScript: null,
    scrapeURL: null,
    processData: null,
    spawnPersistentSession: null,
  };

  return toolToConnector[toolName] ?? null;
}

/**
 * Invalidates the playbook cache. Call after PLAYBOOK.md files are updated.
 */
export function invalidatePlaybookCache(): void {
  playbookCache.clear();
}

/**
 * Returns all cached connector IDs.
 */
export function getCachedConnectorIds(): string[] {
  return [...playbookCache.keys()];
}
