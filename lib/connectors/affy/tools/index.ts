import { tool } from "ai";
import { z } from "zod";

const BASE44_API = process.env.BASE44_API_URL || "http://187.127.250.171:3001";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

async function callAffyBridge(
  action: string,
  payload: Record<string, unknown> = {}
) {
  const res = await fetch(`${BASE44_API}/api/affyBridge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BASE44_KEY}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error(`Affy Bridge error: ${res.status}`);
  return res.json();
}

export const getChargebacks = tool({
  description: "List chargebacks by status, customer, or date range",
  inputSchema: z.object({
    customerId: z.string().optional().describe("Filter by customer"),
    status: z
      .enum(["open", "under_review", "won", "lost", "all"])
      .default("all"),
    limit: z.number().default(20).describe("Max results"),
  }),
  execute: async (input) => callAffyBridge("getChargebacks", input),
});

export const submitEvidence = tool({
  description: "Submit defense evidence for a chargeback dispute",
  inputSchema: z.object({
    chargebackId: z.string().describe("Chargeback case ID"),
    evidence: z
      .string()
      .describe("Evidence content (markdown or structured JSON)"),
    attachments: z
      .array(z.string())
      .optional()
      .describe("Attachment URLs or file references"),
  }),
  execute: async (input) => callAffyBridge("submitEvidence", input),
});

export const generateAffidavit = tool({
  description:
    "Auto-generate a chargeback defense affidavit from transaction data",
  inputSchema: z.object({
    transactionId: z.string().describe("NMI transaction ID"),
    customerId: z.string().describe("Customer identifier for contact info"),
    reason: z
      .string()
      .optional()
      .describe(
        "Chargeback reason code (e.g., 'fraud', 'product_not_received')"
      ),
  }),
  execute: async (input) => callAffyBridge("generateAffidavit", input),
});

export const trackDispute = tool({
  description: "Track chargeback dispute through resolution lifecycle",
  inputSchema: z.object({
    disputeId: z.string().describe("Dispute case ID"),
    includeHistory: z
      .boolean()
      .default(false)
      .describe("Include full status history"),
  }),
  execute: async (input) => callAffyBridge("trackDispute", input),
});
