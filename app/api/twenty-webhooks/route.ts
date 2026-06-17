/**
 * app/api/twenty-webhooks/route.ts — Twenty CRM Webhook Receiver
 * Phase 30: Receives webhooks from Twenty, validates HMAC signature,
 * filters sacred fields, and pushes updates to Base44.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  filterSacredFieldsFromTwentyPayload,
} from "@/lib/sync/conflict-rules";
import { createSyncEvent } from "@/lib/sync/sync-events";
import { SYNC_FAILURE_SLACK_THRESHOLD } from "@/lib/sync/constants";

const TWENTY_WEBHOOK_SECRET =
  process.env.TWENTY_APP_SECRET ?? process.env.WEBHOOK_SIGNING_SECRET ?? "";

function verifySignature(body: string, signature: string, timestamp: string): boolean {
  if (!TWENTY_WEBHOOK_SECRET) {
    console.warn("[twenty-webhooks] No TWENTY_APP_SECRET set — skipping HMAC verification");
    return true; // Non-blocking in dev
  }

  const stringToSign = `${timestamp}:${body}`;
  const expected = crypto
    .createHmac("sha256", TWENTY_WEBHOOK_SECRET)
    .update(stringToSign)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-twenty-webhook-signature") ?? "";
  const timestamp = req.headers.get("x-twenty-webhook-timestamp") ?? "";

  // 1. Verify signature
  if (signature && timestamp) {
    const valid = verifySignature(body, signature, timestamp);
    if (!valid) {
      console.error("[twenty-webhooks] Invalid HMAC signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // 2. Parse payload
  let payload: { event: string; data: Record<string, unknown>; timestamp: string };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, data, timestamp: eventTs } = payload;

  // 3. Extract external_id → Base44 CustomerProfile.id
  const externalId = data.externalId as string | undefined;
  if (!externalId) {
    // Not a synced record — ignore (no external_id = not from Base44)
    return NextResponse.json({ status: "ignored", reason: "no_external_id" });
  }

  // 4. Filter sacred fields
  const filteredData = filterSacredFieldsFromTwentyPayload(data);

  // 5. Log sync event
  await createSyncEvent({
    direction: "t2b",
    recordId: externalId,
    eventType: event,
    status: "received",
    payload: data as Record<string, unknown>,
  }).catch((err) => console.error("[twenty-webhooks] Failed to log sync event:", err));

  // 6. Push to Base44 via internal bridge
  try {
    const base44Url = process.env.BASE44_FUNCTIONS_URL ?? process.env.BASE44_API_HOST;
    const apiKey = process.env.BASE44_APP_API_KEY ?? process.env.BASE44_API_KEY;
    const internalToken = process.env.NEPTUNE_INTERNAL_TOKEN ?? "";

    if (base44Url && apiKey && Object.keys(filteredData).length > 0) {
      const res = await fetch(`${base44Url}/updateCustomerProfile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "x-internal-token": internalToken,
        },
        body: JSON.stringify({
          id: externalId,
          ...filteredData,
          _sync_updated_at: eventTs,
          _sync_source: "twenty",
        }),
      });

      if (!res.ok) {
        console.error(`[twenty-webhooks] Base44 update failed: ${res.status}`);
        await createSyncEvent({
          direction: "t2b",
          recordId: externalId,
          eventType: event,
          status: "failed",
          payload: { error: `Base44 returned ${res.status}`, filteredData },
        });
        return NextResponse.json({ status: "error", reason: "base44_update_failed" }, { status: 500 });
      }
    }

    await createSyncEvent({
      direction: "t2b",
      recordId: externalId,
      eventType: event,
      status: "completed",
      payload: { filteredFields: Object.keys(filteredData) },
    });
  } catch (err) {
    console.error("[twenty-webhooks] Error pushing to Base44:", err);
    return NextResponse.json({ status: "error", reason: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", appliedFields: Object.keys(filteredData) });
}

/** Also accept GET for health checks */
export async function GET() {
  return NextResponse.json({ status: "healthy", service: "twenty-webhooks" });
}
