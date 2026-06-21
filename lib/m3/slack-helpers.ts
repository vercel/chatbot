/**
 * M3 Slack Helpers — Post messages to Slack channels
 */

import crypto from "crypto";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";
const SLACK_API = "https://slack.com/api";

export interface FormalCardInput {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  agentEmail: string | null;
  notes: string | null;
  personId: string;
  isNew: boolean;
}

/** Post a formal card to a Slack channel */
export async function postFormalCard(channel: string, input: FormalCardInput): Promise<string | null> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: input.isNew ? "🆕 New Client Submitted" : "✏️ Client Updated" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name:*\n${input.firstName} ${input.lastName}` },
        { type: "mrkdwn", text: `*Phone:*\n${input.phone || "—"}` },
        { type: "mrkdwn", text: `*Email:*\n${input.email || "—"}` },
        { type: "mrkdwn", text: `*Agent:*\n${input.agentEmail || "—"}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Notes:* ${input.notes || "None"}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<https://crm.newleaf.financial/object/person/${input.personId}|🔗 View in Twenty CRM>`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Person ID: \`${input.personId}\` | ${new Date().toISOString()}` }],
    },
  ];

  return slackApiPost("chat.postMessage", {
    channel,
    blocks,
    text: `${input.isNew ? "New" : "Updated"} client: ${input.firstName} ${input.lastName}`,
    unfurl_links: false,
  });
}

/** Reply in a thread with a formatted message */
export async function postThreadReply(
  channel: string,
  threadTs: string,
  text: string
): Promise<string | null> {
  return slackApiPost("chat.postMessage", {
    channel,
    thread_ts: threadTs,
    text,
    unfurl_links: false,
  });
}

/** Validate Slack HMAC signature */
export function validateSlackSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string = SLACK_SIGNING_SECRET
): boolean {
  if (!secret) {
    console.warn("[m3/slack] No SLACK_SIGNING_SECRET — skipping HMAC validation (dev mode)");
    return true;
  }

  // Check timestamp freshness (5 min replay window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.error("[m3/slack] Stale request timestamp");
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${body}`;
  const computedSig = "v0=" + crypto.createHmac("sha256", secret).update(sigBaseString).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSig),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

async function slackApiPost(method: string, data: Record<string, unknown>): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) {
    console.error("[m3/slack] No SLACK_BOT_TOKEN configured");
    return null;
  }

  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });

    const json = await res.json();
    if (!json.ok) {
      console.error(`[m3/slack] ${method} failed:`, json.error);
      return null;
    }
    return json.ts || json.channel || "ok";
  } catch (err) {
    console.error(`[m3/slack] ${method} error:`, err);
    return null;
  }
}
