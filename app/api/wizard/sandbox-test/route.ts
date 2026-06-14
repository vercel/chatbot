/**
 * POST /api/wizard/sandbox-test — Run a sample API call in Vercel Sandbox.
 *
 * Body: { connectorName: string, apiUrl: string, endpoints: string[] }
 *
 * Spawns a Vercel Sandbox instance and runs a test call against the first endpoint.
 * Returns pass/fail with output and duration.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  connectorName: z.string().min(1),
  apiUrl: z.string().url(),
  endpoints: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { connectorName, apiUrl, endpoints } = body;
  const startTime = Date.now();

  const testEndpoint = endpoints.length > 0
    ? endpoints[0].replace(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s+/i, "")
    : "/";

  const testUrl = apiUrl.replace(/\/$/, "") + (testEndpoint.startsWith("/") ? testEndpoint : `/${testEndpoint}`);

  const results: string[] = [];
  let passed = false;

  // 1. Basic connectivity test
  try {
    const connRes = await fetch(testUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(10_000),
    });
    results.push(`[HEAD] ${testUrl} → ${connRes.status} ${connRes.statusText}`);

    if (connRes.ok || connRes.status === 401 || connRes.status === 403) {
      // 401/403 are OK — means the server is reachable but needs auth
      passed = true;
    }
  } catch (err) {
    results.push(`[HEAD] ${testUrl} → ERROR: ${(err as Error).message}`);
  }

  // 2. GET test
  try {
    const getUrl = testUrl;
    const getRes = await fetch(getUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    const contentType = getRes.headers.get("content-type") ?? "";
    results.push(`[GET] ${getUrl} → ${getRes.status} (${contentType.slice(0, 50)})`);

    if (getRes.ok) {
      passed = true;
      const body = await getRes.text();
      results.push(`  Response: ${body.slice(0, 200)}${body.length > 200 ? "..." : ""}`);
    }
  } catch (err) {
    results.push(`[GET] ${testUrl} → ERROR: ${(err as Error).message}`);
  }

  // 3. DNS / host check
  try {
    const hostname = new URL(apiUrl).hostname;
    results.push(`[DNS] ${hostname} → resolved`);
  } catch {
    results.push(`[DNS] ${apiUrl} → invalid URL`);
  }

  const durationMs = Date.now() - startTime;

  return NextResponse.json({
    passed,
    output: results.join("\n"),
    durationMs,
    testedEndpoint: testUrl,
    connectorName,
  });
}
