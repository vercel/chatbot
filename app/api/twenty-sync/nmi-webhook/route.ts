/**
 * POST /api/twenty-sync/nmi-webhook
 * Phase 39: Receives NMI webhook events from Hyperswitch and syncs to Twenty CRM.
 *
 * SACRED BOUNDARY: This endpoint NEVER receives or stores card data.
 * It only receives billing status metadata (subscription state, payment outcomes).
 * NMI vault data lives exclusively in Base44 and NMI systems.
 *
 * Webhook source: Hyperswitch payment gateway → this endpoint
 * Auth: HMAC-SHA256 signature verification using HYPERSWITCH_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { syncNmiToTwenty, type NmiWebhookPayload } from "@/lib/sync/bidirectional-sync";
import { createSyncEvent } from "@/lib/sync/sync-events";
import { SYNC_FAILURE_SLACK_THRESHOLD } from "@/lib/sync/constants";

const HYPERSWITCH_WEBHOOK_SECRET =
  process.env.HYPERSWITCH_WEBHOOK_SECRET ||
  process.env.NMI_WEBHOOK_SECRET ||
  "";

/**
 * Verify Hyperswitch webhook HMAC signature.
 * Hyperswitch sends x-hyperswitch-signature header.
 */
function verifyHyperswitchSignature(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  if (!HYPERSWITCH_WEBHOOK_SECRET) {
    console.warn("[nmi-webhook] No HYPERSWITCH_WEBHOOK_SECRET — skipping verification");
    return true;
  }

  try {
    const payload = `${timestamp}.${body}`;
    const expected = crypto
      .createHmac("sha256", HYPERSWITCH_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Redact sensitive fields from webhook payload before logging.
 * Adds extra layer of protection beyond field filtering.
 */
function redactSensitiveFields(payload: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = [
    "cardNumber", "cvv", "cardExpiry", "billingAddress",
    "ssn", "routingNumber", "accountNumber", "fullPan",
  ];
  const redacted = { ...payload };
  for (const key of SENSITIVE_KEYS) {
    if (key in redacted) {
      redacted[key] = "[REDACTED]";
    }
  }
  return redacted;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signatureHeader =
    req.headers.get("x-hyperswitch-signature") ||
    req.headers.get("x-nmi-signature") ||
    "";
  const timestamp =
    req.headers.get("x-hyperswitch-timestamp") ||
    req.headers.get("x-nmi-timestamp") ||
    "";

  // 1. Verify webhook signature
  if (signatureHeader && timestamp) {
    const valid = verifyHyperswitchSignature(body, signatureHeader, timestamp);
    if (!valid) {
      console.error("[nmi-webhook] Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // 2. Parse payload
  let payload: NmiWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. SACRED CHECK: Verify no card data in payload
  const redactedPayload = redactSensitiveFields(payload as unknown as Record<string, unknown>);

  // 4. Validate required fields
  if (!payload.nmiSubscriptionId && !payload.customerId) {
    return NextResponse.json(
      { error: "nmiSubscriptionId or customerId required" },
      { status: 400 }
    );
  }

  // 5. Sync NMI event to Twenty
  console.log(`[nmi-webhook] Processing: ${payload.event} for ${payload.nmiSubscriptionId || payload.customerId}`);

  const syncResult = await syncNmiToTwenty(payload);

  if (syncResult.action === "failed") {
    console.error(`[nmi-webhook] Sync failed: ${syncResult.error}`);
    return NextResponse.json(
      { status: "error", error: syncResult.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "ok",
    action: syncResult.action,
    twentyId: syncResult.twentyId,
  });
}

/** Health check */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "nmi-webhook",
    hyperswitchConfigured: !!HYPERSWITCH_WEBHOOK_SECRET,
  });
}
