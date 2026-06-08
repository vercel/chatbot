import { NextResponse } from "next/server";

export async function GET() {
  const integrations = [
    { name: "Slack", status: "connected", tools: 5, icon: "slack" },
    { name: "NMI", status: "connected", tools: 4, icon: "credit-card" },
    { name: "Base44", status: "connected", tools: 4, icon: "database" },
    { name: "Linear", status: "connected", tools: 1, icon: "list" },
    { name: "Forth DPP", status: "pending", tools: 0, icon: "file-text" },
    { name: "GitHub MCP", status: "not-configured", tools: 0, icon: "github" },
    {
      name: "Filesystem MCP",
      status: "not-configured",
      tools: 0,
      icon: "folder",
    },
    {
      name: "Brave Search MCP",
      status: "not-configured",
      tools: 0,
      icon: "search",
    },
  ];
  return NextResponse.json({
    integrations,
    vpsBridgeUrl: "https://187.127.250.171:8400",
  });
}
