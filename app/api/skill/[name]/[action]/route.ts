/**
 * POST /api/skill/[name]/[action] — Skill action invocation bridge (U2.3 Enhanced)
 *
 * V2 calls this to execute specific skill actions via HTTP.
 * Auth: Bearer NEPTUNE_INTERNAL_TOKEN
 *
 * Routing order:
 *   1. Try connectors/<name>/client.ts → execute({ action, args }) (U2.3+)
 *   2. Fall back to lib/connectors/<name>/tools → toolsModule[action](params) (legacy)
 *
 * Example: POST /api/skill/base44-connector/customer_profile_query
 * Body: { args: { limit: 5, filter: {} } }
 */
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string; action: string }> }
) {
  const { name, action } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const expectedToken = secrets.internal.neptuneInternalToken || process.env.NEPTUNE_INTERNAL_TOKEN || "";
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Support both { args } (U2.3 client.ts) and { params } (legacy tools)
  const actionArgs = (body.args ?? body.params ?? {}) as Record<string, unknown>;
  const connectorName = name.replace("-connector", "");

  // ── Route 1: Try U2.3 client.ts pattern ────────────────────────────────────
  try {
    const clientModule = await import(
      `@/connectors/${connectorName}/client`
    );
    if (typeof (clientModule as Record<string, unknown>).execute === "function") {
      const execute = (clientModule as Record<string, Function>).execute;
      const result = await execute({ action, args: actionArgs });
      return NextResponse.json(result);
    }
  } catch {
    // Client module not found or no execute function — fall through to legacy
  }

  // ── Route 2: Legacy tool module pattern ────────────────────────────────────
  try {
    // Hide dynamic import from Turbopack bundler tracing
    const toolsModule = await new Function('p', 'return import(p)')(
      `@/lib/connectors/${connectorName}/tools`
    );

    if (typeof (toolsModule as Record<string, unknown>)[action] !== "function") {
      return NextResponse.json(
        {
          error: `Action '${action}' not found on skill '${name}'`,
          availableActions: Object.keys(toolsModule as object).filter(
            (k) => typeof (toolsModule as Record<string, unknown>)[k] === "function"
          ),
        },
        { status: 404 }
      );
    }

    const fn = (toolsModule as Record<string, Function>)[action];
    const result = await fn(actionArgs);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = (err as Error).message;

    // Tool module not found — no routes matched
    if (message.includes("Cannot find module")) {
      return NextResponse.json(
        {
          error: `Skill '${name}' not found. No client.ts or tools module for connector '${connectorName}'.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: `Action failed: ${message}` },
      { status: 500 }
    );
  }
}

// Late import to avoid circular deps (secrets is loaded at module init)
import { secrets } from "@/secrets";
