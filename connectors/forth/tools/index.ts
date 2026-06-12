import { tool } from "ai";
import { z } from "zod";

const BASE44_API = process.env.BASE44_API_URL || "http://187.127.250.171:3001";
const BASE44_KEY = process.env.BASE44_API_KEY || "";

async function callForthBridge(
  action: string,
  payload: Record<string, unknown> = {}
) {
  const res = await fetch(`${BASE44_API}/api/forthBridge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BASE44_KEY}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) throw new Error(`Forth Bridge error: ${res.status}`);
  return res.json();
}

export const getDisputes = tool({
  description: "Retrieve active disputes for a customer from Forth DPP",
  inputSchema: z.object({
    customerId: z.string().describe("Customer identifier"),
    status: z
      .enum(["active", "resolved", "pending", "all"])
      .default("all")
      .describe("Filter by dispute status"),
  }),
  execute: async (input) => callForthBridge("getDisputes", input),
});

export const updateDispute = tool({
  description: "Update dispute status or add evidence in Forth DPP",
  inputSchema: z.object({
    disputeId: z.string().describe("Forth dispute ID"),
    status: z
      .enum(["pending", "in_review", "resolved", "rejected"])
      .optional()
      .describe("New status"),
    evidence: z
      .string()
      .optional()
      .describe("Evidence text or document reference"),
  }),
  execute: async (input) => callForthBridge("updateDispute", input),
});

export const queryContact = tool({
  description: "Query Forth DPP for contact/credit report information",
  inputSchema: z.object({
    ssn: z.string().optional().describe("Last 4 of SSN"),
    firstName: z.string().optional().describe("First name"),
    lastName: z.string().optional().describe("Last name"),
    dob: z.string().optional().describe("Date of birth (YYYY-MM-DD)"),
  }),
  execute: async (input) => callForthBridge("queryContact", input),
});

export const pullCreditReport = tool({
  description: "Pull a credit report from Forth DPP for a customer",
  inputSchema: z.object({
    customerId: z.string().describe("Customer identifier"),
    reportType: z
      .enum(["triple_bureau", "single"])
      .default("triple_bureau")
      .describe("Report type"),
  }),
  execute: async (input) => callForthBridge("pullCreditReport", input),
});

export const listEnrollments = tool({
  description: "List Forth DPP enrollments with status",
  inputSchema: z.object({
    status: z
      .enum(["active", "completed", "cancelled", "all"])
      .default("all")
      .describe("Filter by enrollment status"),
    limit: z.number().default(20).describe("Max results"),
  }),
  execute: async (input) => callForthBridge("listEnrollments", input),
});
