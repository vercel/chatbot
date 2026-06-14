/**
 * POST /api/wizard/discover-api — Parse an API URL to discover endpoints.
 *
 * Body: { apiUrl: string, apiDocUrl?: string }
 *
 * Strategy:
 *   1. Try HEAD/OPTIONS on the API URL
 *   2. Attempt to fetch common OpenAPI paths (/openapi.json, /swagger.json, /docs)
 *   3. Parse OpenAPI/Swagger spec to extract endpoints
 *   4. Fall back to common REST endpoint patterns
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  apiUrl: z.string().url().min(1),
  apiDocUrl: z.string().url().optional().or(z.literal("")),
});

// Common OpenAPI spec paths
const OPENAPI_PATHS = [
  "/openapi.json",
  "/api/openapi.json",
  "/swagger.json",
  "/api/swagger.json",
  "/api-docs/openapi.json",
  "/docs/openapi.json",
  "/v3/api-docs",
  "/api/v1/openapi.json",
];

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body — apiUrl required" }, { status: 400 });
  }

  const { apiUrl, apiDocUrl } = body;
  const endpoints: string[] = [];
  let suggestedName = "";

  try {
    // Parse hostname for suggested name
    const url = new URL(apiUrl);
    suggestedName = url.hostname
      .replace(/^api\./, "")
      .replace(/\.(com|org|io|dev|net)$/, "")
      .replace(/\./g, "-")
      .replace(/^www\./, "");

    // Try to fetch OpenAPI spec from the doc URL first
    if (apiDocUrl) {
      try {
        const docRes = await fetch(apiDocUrl, { signal: AbortSignal.timeout(10_000) });
        if (docRes.ok) {
          const text = await docRes.text();
          const found = extractEndpointsFromText(text);
          endpoints.push(...found);
        }
      } catch { /* continue */ }
    }

    // Try common OpenAPI paths
    if (endpoints.length === 0) {
      for (const path of OPENAPI_PATHS) {
        try {
          const specUrl = apiUrl.replace(/\/$/, "") + path;
          const res = await fetch(specUrl, { signal: AbortSignal.timeout(8_000) });
          if (res.ok) {
            const text = await res.text();
            const found = extractEndpointsFromText(text);
            if (found.length > 0) {
              endpoints.push(...found);
              break;
            }
          }
        } catch { continue; }
      }
    }

    // If still no endpoints, try the API URL directly
    if (endpoints.length === 0) {
      try {
        const res = await fetch(apiUrl, {
          signal: AbortSignal.timeout(8_000),
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const text = await res.text();
          const found = extractEndpointsFromText(text);
          endpoints.push(...found);
        }
      } catch { /* continue */ }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach API: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Fallback: generate common REST endpoints from the base URL
  if (endpoints.length === 0) {
    const commonEntities = ["items", "users", "resources", "data", "records"];
    for (const entity of commonEntities) {
      const base = apiUrl.replace(/\/$/, "");
      endpoints.push(`/${entity}`);
      endpoints.push(`/${entity}/{id}`);
    }
  }

  // Deduplicate and clean
  const cleaned = [...new Set(
    endpoints
      .map((e) => e.replace(apiUrl.replace(/\/$/, ""), "").replace(/^\//, ""))
      .filter((e) => e.length > 0 && e.length < 100)
  )];

  return NextResponse.json({
    endpoints: cleaned.length > 0 ? cleaned : ["/status", "/list", "/create"],
    suggestedName: `${suggestedName}-connector`,
    discoveredFrom: apiUrl,
  });
}

function extractEndpointsFromText(text: string): string[] {
  const endpoints: string[] = [];

  // Try JSON parse for OpenAPI
  try {
    const spec = JSON.parse(text);
    if (spec.paths) {
      for (const [path, methods] of Object.entries(spec.paths)) {
        if (typeof methods === "object" && methods !== null) {
          const httpMethods = Object.keys(methods).filter((k) =>
            ["get", "post", "put", "patch", "delete", "options"].includes(k.toLowerCase()),
          );
          for (const method of httpMethods) {
            endpoints.push(`${method.toUpperCase()} ${path}`);
          }
        }
      }
      return endpoints;
    }
  } catch { /* not JSON */ }

  // Try YAML-like path extraction
  const pathMatches = text.matchAll(/["'\s]*(\/[a-zA-Z0-9\-_\/{}]+)["'\s]*:/g);
  for (const m of pathMatches) {
    endpoints.push(m[1]);
  }

  // Try href extraction
  const hrefMatches = text.matchAll(/href=["'](\/[^"']+)["']/g);
  for (const m of hrefMatches) {
    if (m[1].includes("{") || /^\/[a-z]/.test(m[1])) {
      endpoints.push(m[1]);
    }
  }

  return [...new Set(endpoints)].slice(0, 30);
}
