/**
 * Forth (DPP/Credit) Connector — Zod schemas for all tool inputs and outputs.
 *
 * Forth tools proxy through the Base44 forthBridge.
 */

import { z } from "zod";

export const getDisputesSchema = {
  input: z.object({
    customerId: z.string().describe("Customer ID"),
    status: z.enum(["active", "resolved", "pending", "all"]).default("all"),
  }),
  output: z.object({
    disputes: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const updateDisputeSchema = {
  input: z.object({
    disputeId: z.string().describe("Dispute ID"),
    status: z.enum(["pending", "in_review", "resolved", "rejected"]).optional(),
    evidence: z.string().optional(),
  }),
  output: z.object({
    updated: z.boolean().optional(),
    disputeId: z.string().optional(),
  }),
};

export const queryContactSchema = {
  input: z.object({
    ssn: z.string().optional().describe("Last 4 of SSN"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    dob: z.string().optional().describe("Date of birth (YYYY-MM-DD)"),
  }),
  output: z.object({
    contacts: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const pullCreditReportSchema = {
  input: z.object({
    customerId: z.string().describe("Customer ID"),
    reportType: z.enum(["triple_bureau", "single"]).default("triple_bureau"),
  }),
  output: z.object({
    report: z.record(z.unknown()).optional(),
    reportId: z.string().optional(),
  }),
};

export const listEnrollmentsSchema = {
  input: z.object({
    status: z.enum(["active", "completed", "cancelled", "all"]).default("all"),
    limit: z.number().default(20),
  }),
  output: z.object({
    enrollments: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export type GetDisputesInput = z.infer<typeof getDisputesSchema.input>;
export type UpdateDisputeInput = z.infer<typeof updateDisputeSchema.input>;
export type QueryContactInput = z.infer<typeof queryContactSchema.input>;
export type PullCreditReportInput = z.infer<typeof pullCreditReportSchema.input>;
export type ListEnrollmentsInput = z.infer<typeof listEnrollmentsSchema.input>;

export const forthSchemas = {
  getDisputes: getDisputesSchema,
  updateDispute: updateDisputeSchema,
  queryContact: queryContactSchema,
  pullCreditReport: pullCreditReportSchema,
  listEnrollments: listEnrollmentsSchema,
} as const;
