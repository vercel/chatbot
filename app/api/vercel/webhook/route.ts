/**
 * Vercel Webhook Handler — receives deployment events from Vercel.
 *
 * Verifies HMAC-SHA1 signature, parses event payloads, writes events
 * to /home/hermes/data/vercel-events/, and posts deployment.error to
 * #jarvis-admin Slack with remediation dispatch.
 *
 * Registered via POST /v1/webhooks (team-scoped, both neptune-v2 + neptune-chat).
 *
 * Event types handled:
 *   - deployment.created
 *   - deployment.ready
 *   - deployment.error   → Slack alert + remediation dispatch
 *   - deployment.canceled
 */
import crypto from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const VERCEL_EVENTS_DIR = process.env.VERCEL_EVENTS_DIR || "/home/hermes/data/vercel-events";
const WEBHOOK_SECRET = process.env.VERCEL_WEBHOOK_SECRET || "";
const SLACK_JARVIS_ADMIN_URL = process.env.SLACK_JARVIS_ADMIN_WEBHOOK_URL || "";

// ─── HMAC-SHA1 Signature Verification ─────────────────────────────────────

function verifySignature(rawBody: string, headerSignature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[vercel-webhook] WEBHOOK_SECRET not set — skipping signature verification");
    return true; // Allow passthrough in dev (still log)
  }

  if (!headerSignature) {
    console.error("[vercel-webhook] Missing x-vercel-signature header");
    return false;
  }

  const bodySignature = crypto
    .createHmac("sha1", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (headerSignature.length !== bodySignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(headerSignature),
    Buffer.from(bodySignature)
  );
}

// ─── Persist Event to VPS ──────────────────────────────────────────────────

async function persistEvent(event: VercelWebhookPayload): Promise<string> {
  const { type, payload } = event;
  const deploymentId = payload?.deployment?.id || "unknown";
  const timestamp = new Date(event.createdAt).toISOString().replace(/[:.]/g, "-");

  const fileName = `${type}-${deploymentId}-${timestamp}.json`;
  const filePath = path.join(VERCEL_EVENTS_DIR, fileName);

  await mkdir(VERCEL_EVENTS_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(event, null, 2), "utf-8");

  console.log(`[vercel-webhook] Event persisted: ${filePath}`);
  return filePath;
}

// ─── Post to Slack ─────────────────────────────────────────────────────────

async function postToSlack(event: VercelWebhookPayload): Promise<void> {
  if (!SLACK_JARVIS_ADMIN_URL) {
    console.warn("[vercel-webhook] SLACK_JARVIS_ADMIN_WEBHOOK_URL not set — skipping Slack post");
    return;
  }

  const { payload } = event;
  const deployment = payload.deployment;
  const project = payload.project;
  const links = payload.links;

  const buildLogUrl = links?.deployment
    ? `${links.deployment}/logs`
    : `https://vercel.com/deployments/${deployment?.id || "unknown"}`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Vercel Deployment ${event.type.toUpperCase()}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Project:*\n${project?.id || "unknown"}` },
        { type: "mrkdwn", text: `*Deployment:*\n\`${deployment?.id || "unknown"}\`` },
        { type: "mrkdwn", text: `*Target:*\n${payload.target || "preview"}` },
        { type: "mrkdwn", text: `*URL:*\n${deployment?.url || "N/A"}` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${buildLogUrl}|📋 View Build Log> | <${links?.project || "#"}|📁 Project Dashboard>`,
      },
    },
  ];

  // For error events, add remediation info
  if (event.type === "deployment.error") {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*⚠️ Remediation:* Use \`vercel.listDeploys\` + \`vercel.getDeployLog\` to diagnose. ` +
          `Auto-fix loop is *OPT-IN* — dispatch a remediation session via hybridDispatch to investigate.`,
      },
    });
  }

  try {
    await fetch(SLACK_JARVIS_ADMIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    console.log("[vercel-webhook] Posted to Slack #jarvis-admin");
  } catch (err) {
    console.error("[vercel-webhook] Slack post failed:", err);
  }
}

// ─── Dispatch Remediation Session (OPT-IN) ─────────────────────────────────

async function dispatchRemediation(event: VercelWebhookPayload): Promise<void> {
  // Auto-remediation is OPT-IN — we alert on Slack but do NOT auto-merge fixes.
  console.log(
    `[vercel-webhook] Remediation available for ${event.payload.deployment?.id || "unknown"}. ` +
    `Dispatch via hybridDispatch to investigate.`
  );
  // Future: POST to hybridDispatch endpoint to open a non-auto-merge investigation session
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface VercelWebhookPayload {
  id: string;
  type: string;
  createdAt: number;
  region?: string | null;
  payload: {
    team?: { id: string } | null;
    user?: { id: string } | null;
    deployment?: {
      id: string;
      meta?: Record<string, string>;
      url?: string;
      name?: string;
    } | null;
    links?: {
      deployment?: string;
      project?: string;
    } | null;
    target?: string | null;
    project?: { id: string } | null;
    plan?: string;
    regions?: string[];
    alias?: string[];
  };
}

// ─── Route Handler ─────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // 1. Read raw body for signature verification
  const rawBody = await request.text();

  // 2. Verify HMAC-SHA1 signature
  const headerSignature = request.headers.get("x-vercel-signature");
  if (!verifySignature(rawBody, headerSignature)) {
    return Response.json(
      { error: "Invalid signature" },
      { status: 403 }
    );
  }

  // 3. Parse payload
  let event: VercelWebhookPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const eventType = event.type;
  console.log(`[vercel-webhook] Received event: ${eventType} (id: ${event.id})`);

  // 4. Persist event to VPS
  try {
    await persistEvent(event);
  } catch (err) {
    console.error("[vercel-webhook] Failed to persist event:", err);
  }

  // 5. Handle specific event types
  switch (eventType) {
    case "deployment.error": {
      // Alert Slack + offer remediation
      await postToSlack(event);
      await dispatchRemediation(event);
      break;
    }
    case "deployment.created": {
      console.log(
        `[vercel-webhook] Deployment created: ${event.payload.deployment?.id} ` +
        `(target: ${event.payload.target}, project: ${event.payload.project?.id})`
      );
      break;
    }
    case "deployment.succeeded":
    case "deployment.ready": {
      console.log(
        `[vercel-webhook] Deployment READY: ${event.payload.deployment?.url}`
      );
      break;
    }
    case "deployment.canceled": {
      console.log(
        `[vercel-webhook] Deployment canceled: ${event.payload.deployment?.id}`
      );
      await postToSlack(event);
      break;
    }
    default: {
      console.log(`[vercel-webhook] Unhandled event type: ${eventType}`);
    }
  }

  return Response.json(
    { received: true, eventType, eventId: event.id },
    { status: 200 }
  );
}

// Support OPTIONS for CORS preflight (webhook registration verification)
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-vercel-signature",
    },
  });
}
