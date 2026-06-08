import { NextResponse } from "next/server";

export async function GET() {
  const tools = [
    {
      name: "readSkill",
      category: "knowledge",
      description: "Read a skill from cortex",
    },
    {
      name: "readPRD",
      category: "knowledge",
      description: "Read a PRD document",
    },
    {
      name: "listSkills",
      category: "knowledge",
      description: "List available skills",
    },
    {
      name: "searchKnowledge",
      category: "knowledge",
      description: "Search knowledge graph",
    },
    {
      name: "queryDatabase",
      category: "data",
      description: "Query the database",
    },
    {
      name: "pullSlackMessages",
      category: "data",
      description: "Pull Slack messages",
    },
    {
      name: "fetchURL",
      category: "data",
      description: "Fetch content from URL",
    },
    {
      name: "runScript",
      category: "sandbox",
      description: "Execute code in sandbox",
    },
    {
      name: "scrapeURL",
      category: "sandbox",
      description: "Scrape a URL via sandbox",
    },
    {
      name: "processData",
      category: "sandbox",
      description: "Process data in sandbox",
    },
    {
      name: "runWorkflow",
      category: "workflow",
      description: "Run a multi-step workflow",
    },
    {
      name: "spawnPersistentSession",
      category: "sandbox",
      description: "Spawn persistent sandbox session",
    },
    {
      name: "spawnCodingAgent",
      category: "v2-bridge",
      description: "Hand off to V2 coding agent",
    },
    {
      name: "listV2Sessions",
      category: "v2-bridge",
      description: "List V2 sessions",
    },
    {
      name: "getV2Session",
      category: "v2-bridge",
      description: "Get V2 session details",
    },
    {
      name: "streamV2Progress",
      category: "v2-bridge",
      description: "Stream V2 progress",
    },
  ];
  return NextResponse.json({ tools, count: tools.length });
}
