import { tool } from "ai";
import { z } from "zod";

const BASE44_API = process.env.BASE44_API_URL || "http://187.127.250.171:3001";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

async function callBridge(
  action: string,
  payload: Record<string, unknown> = {}
) {
  const res = await fetch(`${BASE44_API}/api/ghlBridge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BASE44_KEY}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok)
    throw new Error(
      `GHL Bridge error: ${res.status} ${await res.text().catch(() => "")}`
    );
  return res.json();
}

export const createContact = tool({
  description: "Create or update a contact in GoHighLevel CRM",
  inputSchema: z.object({
    firstName: z.string().optional().describe("First name"),
    lastName: z.string().optional().describe("Last name"),
    email: z.string().optional().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    tags: z.array(z.string()).optional().describe("Contact tags"),
    customFields: z
      .record(z.unknown())
      .optional()
      .describe("Custom field values"),
  }),
  execute: async (input) => callBridge("createContact", input),
});

export const sendSms = tool({
  description: "Send an SMS message through GoHighLevel",
  inputSchema: z.object({
    contactId: z.string().describe("GHL contact ID"),
    message: z.string().describe("SMS message body (max 1600 chars)"),
  }),
  execute: async (input) => callBridge("sendSms", input),
});

export const sendEmail = tool({
  description: "Send an email through GoHighLevel",
  inputSchema: z.object({
    contactId: z.string().describe("GHL contact ID"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (HTML or plain text)"),
  }),
  execute: async (input) => callBridge("sendEmail", input),
});

export const queryConversations = tool({
  description:
    "Search GoHighLevel conversations by contact, date range, or keyword",
  inputSchema: z.object({
    contactId: z.string().optional().describe("Filter by GHL contact ID"),
    startDate: z.string().optional().describe("Start date (ISO)"),
    endDate: z.string().optional().describe("End date (ISO)"),
    keyword: z.string().optional().describe("Search keyword"),
    limit: z.number().default(20).describe("Max results"),
  }),
  execute: async (input) => callBridge("queryConversations", input),
});

export const getOpportunity = tool({
  description: "Get pipeline opportunity details from GoHighLevel",
  inputSchema: z.object({
    opportunityId: z.string().describe("GHL opportunity ID"),
  }),
  execute: async (input) => callBridge("getOpportunity", input),
});
