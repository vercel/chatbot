/**
 * Tools Page — Categorized tool registry from @neptune/core + inline + sandbox.
 */
import { auth } from "@/app/(auth)/auth";
import { ToolsClient } from "./client";

const TOOL_CATEGORIES = [
  {
    name: "Knowledge",
    tools: [
      {
        name: "readSkill",
        description: "Read a skill from Jarvis cortex",
        inputs: "name: string",
      },
      {
        name: "readPRD",
        description: "Read a PRD document",
        inputs: "path: string",
      },
      {
        name: "listSkills",
        description: "List available cortex skills",
        inputs: "query?: string",
      },
      {
        name: "searchKnowledge",
        description: "Search knowledge graph",
        inputs: "query: string, limit?: number",
      },
    ],
  },
  {
    name: "Data",
    tools: [
      {
        name: "queryDatabase",
        description: "Run read-only SQL queries",
        inputs: "sql: string",
      },
      {
        name: "pullSlackMessages",
        description: "Pull messages from Slack channels",
        inputs: "channel: string, limit?: number",
      },
      {
        name: "fetchURL",
        description: "Fetch content from a URL",
        inputs: "url: string, returnType?: text|json",
      },
    ],
  },
  {
    name: "Sandbox",
    tools: [
      {
        name: "runScript",
        description: "Execute code in secure sandbox",
        inputs: "code: string, runtime?: node|python",
      },
      {
        name: "scrapeURL",
        description: "Scrape content from URLs",
        inputs: "url: string, selectors?: string[]",
      },
      {
        name: "processData",
        description: "Transform/filter/aggregate data",
        inputs: "data: string, operation: string",
      },
      {
        name: "runWorkflow",
        description: "Execute multi-step workflows",
        inputs: "steps[]: Step[], parallel?: bool",
      },
    ],
  },
  {
    name: "V2 Bridge",
    tools: [
      {
        name: "listV2Sessions",
        description: "List V2 coding sessions",
        inputs: "status?: string, limit?: number",
      },
      {
        name: "getV2Session",
        description: "Get V2 session details",
        inputs: "sessionId: string",
      },
      {
        name: "postV2Session",
        description: "Hand off coding task to V2",
        inputs: "prompt: string, context?: string",
      },
      {
        name: "streamV2Progress",
        description: "Stream V2 session SSE events",
        inputs: "sessionId: string",
      },
    ],
  },
  {
    name: "Document",
    tools: [
      {
        name: "createDocument",
        description: "Create a new document",
        inputs: "title: string, kind?: text|code",
      },
      {
        name: "editDocument",
        description: "Edit an existing document",
        inputs: "documentId: string, content: string",
      },
      {
        name: "updateDocument",
        description: "Update document metadata",
        inputs: "documentId: string, title?: string",
      },
    ],
  },
];

export default async function ToolsPage() {
  const session = await auth();
  if (!session?.user) {
    return <div className="p-8">Sign in to view tools.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Tools</h1>
        <p className="text-sm text-muted-foreground">
          {TOOL_CATEGORIES.reduce((sum, c) => sum + c.tools.length, 0)} tools
          across {TOOL_CATEGORIES.length} categories
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ToolsClient categories={TOOL_CATEGORIES} />
      </div>
    </div>
  );
}
