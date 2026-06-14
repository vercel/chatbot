/**
 * POST /api/wizard/check-mcp — Check if an MCP server exists on smithery.ai or GitHub.
 *
 * Body: { name: string, apiUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { name, apiUrl } = body;
  const domain = new URL(apiUrl).hostname.replace(/^api\./, "").replace(/\.com$/, "");
  const searchTerms = [name, domain, domain.replace("-", "")];

  const result = {
    exists: false,
    url: null as string | null,
    servers: [] as string[],
    checkedSources: [] as string[],
  };

  // 1. Check smithery.ai
  for (const term of searchTerms) {
    try {
      const res = await fetch(
        `https://registry.smithery.ai/servers?search=${encodeURIComponent(term)}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.servers ?? data.items ?? data.results ?? [];
        if (Array.isArray(items) && items.length > 0) {
          result.exists = true;
          result.url = `https://smithery.ai/search?q=${encodeURIComponent(term)}`;
          result.servers.push(...items.map((s: Record<string, unknown>) => String(s.name ?? s.slug ?? "")));
        }
        result.checkedSources.push("smithery.ai");
      }
    } catch { /* continue */ }
  }

  // 2. Check GitHub for MCP server repos
  if (!result.exists) {
    for (const term of searchTerms.slice(0, 2)) {
      try {
        const res = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(term + " mcp server")}&sort=stars&per_page=3`,
          {
            signal: AbortSignal.timeout(8_000),
            headers: {
              Accept: "application/vnd.github.v3+json",
              ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.items ?? [];
          if (items.length > 0) {
            result.exists = true;
            result.url = items[0].html_url ?? null;
            result.servers.push(...items.map((i: Record<string, unknown>) => String(i.full_name ?? "")));
          }
          result.checkedSources.push("github.com");
        }
      } catch { /* continue */ }
    }
  }

  return NextResponse.json(result);
}
