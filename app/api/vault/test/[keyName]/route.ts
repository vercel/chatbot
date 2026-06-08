/**
 * Vault Test API — Proxies key health checks to VPS tools bridge.
 *
 * POST /api/vault/test/:keyName
 * Tests whether a secret key is configured and working on the VPS.
 * NEVER returns the actual key value.
 */
import { auth } from "@/app/(auth)/auth";

const VPS_BRIDGE_URL = process.env.VPS_BRIDGE_URL || "http://localhost:8400";
const NEPTUNE_INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";

/** Known env keys that can be tested */
const TESTABLE_KEYS: Record<string, { category: string; checkType: string }> = {
  SLACK_BOT_TOKEN: { category: "slack", checkType: "auth_test" },
  NMI_SECURITY_KEY: { category: "nmi", checkType: "auth_test" },
  BASE44_API_KEY: { category: "base44", checkType: "auth_test" },
  OPENAI_API_KEY: { category: "model", checkType: "auth_test" },
  ANTHROPIC_API_KEY: { category: "model", checkType: "auth_test" },
  GOOGLE_API_KEY: { category: "model", checkType: "auth_test" },
  GROQ_API_KEY: { category: "model", checkType: "auth_test" },
  XAI_API_KEY: { category: "model", checkType: "auth_test" },
  DEEPSEEK_API_KEY: { category: "model", checkType: "auth_test" },
  POSTGRES_URL: { category: "database", checkType: "connection_test" },
  REDIS_URL: { category: "database", checkType: "connection_test" },
  BLOB_READ_WRITE_TOKEN: { category: "storage", checkType: "auth_test" },
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ keyName: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyName } = await params;
  const keyInfo = TESTABLE_KEYS[keyName];

  if (!keyInfo) {
    return Response.json(
      {
        key: keyName,
        status: "unknown",
        message: "Key not in testable registry",
      },
      { status: 200 }
    );
  }

  try {
    // Proxy test to VPS bridge
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(
      `${VPS_BRIDGE_URL}/tool/${keyInfo.category}/${keyInfo.checkType}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NEPTUNE_INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({ keyName }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      // Bridge unavailable — check locally if key exists in env
      const exists = Boolean(process.env[keyName]);
      return Response.json({
        key: keyName,
        status: exists ? "configured" : "missing",
        bridgeStatus: "unavailable",
        message: exists
          ? "Key is configured but bridge test unavailable"
          : "Key not found in environment",
      });
    }

    const data = await res.json();
    return Response.json({
      key: keyName,
      status: data.ok ? "connected" : "configured",
      message:
        data.message || (data.ok ? "Connection verified" : "Connection failed"),
      latency: data.durationMs,
    });
  } catch {
    // Graceful degradation: check if key is in local env
    const exists = Boolean(process.env[keyName]);
    return Response.json({
      key: keyName,
      status: exists ? "configured" : "missing",
      bridgeStatus: "unreachable",
      message: exists
        ? "Key is configured (bridge unreachable for live test)"
        : "Key not found in environment",
    });
  }
}
