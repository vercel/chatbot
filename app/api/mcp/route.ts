import { NextResponse } from "next/server";
import { mcpHub } from "@/lib/mcp/hub";

export async function GET() {
  const servers = mcpHub.getServerList();
  return NextResponse.json({
    servers,
    toolCount: servers.reduce((sum, s) => sum + s.tools.length, 0),
  });
}
