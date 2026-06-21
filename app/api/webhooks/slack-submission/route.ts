/**
 * POST /api/webhooks/slack-submission — M3 Direction B
 * Slack Events API → HMAC validate → AI parser → upsert Person → thread reply
 *
 * Receives Slack message events from #newleaf-submissions channel.
 * Parses natural-language client submissions using Claude Haiku via AI Gateway.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateSlackSignature, postThreadReply } from "@/lib/m3/slack-helpers";
import { aiParseSubmission } from "@/lib/m3/ai-parser";
import { upsertPerson, getPersonById } from "@/lib/m3/db-helpers";
import { resolveAgentEmail } from "@/lib/m3/agent-resolver";

// Dedupe in-memory cache (5 min window)
const dedupeCache = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MIN_CONFIDENCE = 0.7;

// Channel to monitor (configurable)
const SUBMISSION_CHANNEL = process.env.SUBMISSION_SLACK_CHANNEL_ID || "";
// Bot user ID to avoid self-replies
const BOT_USER_ID = process.env.SLACK_BOT_USER_ID || "";

/** Clean expired dedupe entries */
function cleanDedupe() {
  const now = Date.now();
  for (const [key, ts] of dedupeCache.entries()) {
    if (now - ts > DEDUPE_WINDOW_MS) dedupeCache.delete(key);
  }
}

export async function POST(req: NextRequest) {
  // 1. Read raw body for HMAC validation
  const body = await req.text();
  const signature = req.headers.get("x-slack-signature") || "";
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";

  // HMAC validate
  if (!validateSlackSignature(body, signature, timestamp)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 2. Parse event
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // URL verification challenge (Slack Events API handshake)
  if (event.type === "url_verification") {
    return new Response(event.challenge as string, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Only handle event callbacks
  if (event.type !== "event_callback") {
    return new Response("ok");
  }

  const msg = event.event as Record<string, unknown>;
  if (!msg || msg.type !== "message") {
    return new Response("ok");
  }

  // Skip bot messages, edits, and message_changed
  if (msg.subtype && msg.subtype !== "message_replied") {
    return new Response("ok");
  }

  // Skip if not from submission channel (if configured)
  if (SUBMISSION_CHANNEL && event.event?.channel !== SUBMISSION_CHANNEL) {
    return new Response("ok");
  }

  // Skip bot's own messages
  if (BOT_USER_ID && msg.user === BOT_USER_ID) {
    return new Response("ok");
  }

  const messageTs = msg.ts as string;
  const messageText = msg.text as string;
  const channel = (event.event as Record<string, string>)?.channel || msg.channel as string;

  if (!messageTs || !messageText) {
    return new Response("ok");
  }

  // 3. Deduplicate
  cleanDedupe();
  const dedupeKey = `slack-sub:${messageTs}`;
  if (dedupeCache.has(dedupeKey)) {
    return new Response("dup");
  }
  dedupeCache.set(dedupeKey, Date.now());

  // 4. AI parse
  const parsed = await aiParseSubmission(messageText);

  if (parsed.confidence < MIN_CONFIDENCE || (!parsed.firstName && !parsed.lastName)) {
    await postThreadReply(
      channel,
      messageTs,
      `:thinking_face: I couldn't parse this submission with confidence (${Math.round(parsed.confidence * 100)}%).
Please format like: \`New client John Smith 555-1234 john@example.com agent Jerry\`

Detected: ${[
        parsed.firstName && `Name: ${parsed.firstName}`,
        parsed.lastName && `Last: ${parsed.lastName}`,
        parsed.phone && `Phone: ${parsed.phone}`,
        parsed.email && `Email: ${parsed.email}`,
      ].filter(Boolean).join(", ") || "nothing"}.`
    );
    return new Response("ok");
  }

  // 5. Resolve agent
  const agentEmail = resolveAgentEmail(parsed.agentName) || "unassigned@newleaf-financial.com";

  // 6. Upsert Person
  const result = await upsertPerson({
    firstName: parsed.firstName || "Unknown",
    lastName: parsed.lastName || "Unknown",
    email: parsed.email,
    phone: parsed.phone,
    agentEmail,
    notes: parsed.notes,
  });

  // 7. Verify the person was created/updated
  const person = await getPersonById(result.personId);

  // 8. Reply in thread
  const twentyUrl = `https://crm.newleaf.financial/object/person/${result.personId}`;
  const replyLines = [
    `:white_check_mark: **${result.action === "created" ? "Created" : "Updated"}** Person: ${parsed.firstName} ${parsed.lastName}`,
    `• Phone: ${parsed.phone || "—"} | Email: ${parsed.email || "—"}`,
    `• Agent: ${agentEmail} | Confidence: ${Math.round(parsed.confidence * 100)}%`,
    `• <${twentyUrl}|View in Twenty CRM>`,
    parsed.notes ? `• Notes: ${parsed.notes}` : "",
  ].filter(Boolean).join("\n");

  await postThreadReply(channel, messageTs, replyLines);

  return new Response("ok");
}
