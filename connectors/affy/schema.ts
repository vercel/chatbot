/**
 * Affy (Chargeback) Connector — Zod schemas for all tool inputs and outputs.
 *
 * Affy tools proxy through the Base44 affyBridge.
 */

import { z } from "zod";

export const getChargebacksSchema = {
  input: z.object({
    customerId: z.string().optional(),
    status: z.enum(["open", "under_review", "won", "lost", "all"]).default("all"),
    limit: z.number().default(20),
  }),
  output: z.object({
    chargebacks: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const submitEvidenceSchema = {
  input: z.object({
    chargebackId: z.string().describe("Chargeback dispute ID"),
    evidence: z.string().describe("Evidence content (markdown or structured JSON)"),
    attachments: z.array(z.string()).optional().describe("Attachment URLs or file references"),
  }),
  output: z.object({
    submitted: z.boolean().optional(),
    submissionId: z.string().optional(),
  }),
};

export const generateAffidavitSchema = {
  input: z.object({
    transactionId: z.string().describe("NMI transaction ID"),
    customerId: z.string().describe("Customer ID"),
    reason: z.string().optional().describe("Chargeback reason code"),
  }),
  output: z.object({
    affidavit: z.string().optional(),
    transactionId: z.string().optional(),
  }),
};

export const trackDisputeSchema = {
  input: z.object({
    disputeId: z.string().describe("Dispute ID to track"),
    includeHistory: z.boolean().default(false),
  }),
  output: z.object({
    status: z.string().optional(),
    history: z.array(z.record(z.unknown())).optional(),
    resolution: z.string().optional(),
  }),
};

export type GetChargebacksInput = z.infer<typeof getChargebacksSchema.input>;
export type SubmitEvidenceInput = z.infer<typeof submitEvidenceSchema.input>;
export type GenerateAffidavitInput = z.infer<typeof generateAffidavitSchema.input>;
export type TrackDisputeInput = z.infer<typeof trackDisputeSchema.input>;

export const affySchemas = {
  getChargebacks: getChargebacksSchema,
  submitEvidence: submitEvidenceSchema,
  generateAffidavit: generateAffidavitSchema,
  trackDispute: trackDisputeSchema,
} as const;
