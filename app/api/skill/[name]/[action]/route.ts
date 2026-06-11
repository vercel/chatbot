/**
 * POST /api/skill/[name]/[action] — Skill action invocation bridge
 *
 * V2 calls this to execute specific skill actions via HTTP.
 * Auth: Bearer NEPTUNE_INTERNAL_TOKEN
 *
 * Example: POST /api/skill/nmi-connector/refundTransaction
 * Body: { params: { transactionId: "txn_123", amount: 50.00 } }
 */
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string; action: string }> }
) {
  const { name, action } = await params;

  // Auth
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const expectedToken = process.env.NEPTUNE_INTERNAL_TOKEN ?? "";
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const params_data = (body.params ?? {}) as Record<string, unknown>;

  // Route to connector tool
  try {
    const connectorName = name.replace("-connector", "");
    const toolsModule = await import(
      `@/lib/connectors/${connectorName}/tools`
    );

    if (typeof (toolsModule as any)[action] !== "function") {
      return NextResponse.json(
        {
          error: `Action '${action}' not found on skill '${name}'`,
          availableActions: Object.keys(toolsModule).filter(
            (k) => typeof (toolsModule as any)[k] === "function"
          ),
        },
        { status: 404 }
      );
    }

    const result = await (toolsModule as any)[action](params_data);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = (err as Error).message;
    // Don't leak internal paths
    if (message.includes("Cannot find module")) {
      return NextResponse.json(
        { error: `Skill '${name}' is not a connector or tools not available` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: `Action failed: ${message}` },
      { status: 500 }
    );
  }
}
