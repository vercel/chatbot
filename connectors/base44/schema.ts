/**
 * Base44 Connector — Zod schemas for all tool inputs and outputs.
 */

import { z } from "zod";

const ENTITY_NAMES = [
  "CustomerProfile", "PaymentLog", "AdminNotification", "SupportTicket",
  "SlackSubmission", "CallLog", "VapiCallEvent", "CreditReport",
  "BillingQueue", "RecoveryItem", "Subscription", "NmiTransaction",
] as const;

const REPORT_ACTIONS = [
  "overview", "enrollments", "lead_flow", "billing", "communications",
  "calls", "agents", "support", "automations", "activity_feed",
  "customer_360", "customer_comms", "sync_health", "morning_pulse",
  "vapi_intelligence", "enrollment_intelligence",
] as const;

export const createEntitySchema = {
  input: z.object({
    entity: z.string().describe("Entity type to create"),
    data: z.record(z.unknown()).describe("Field values for the new record"),
  }),
  output: z.object({
    created: z.boolean(),
    entity: z.string(),
    record: z.unknown(),
  }),
};

export const customer360Schema = {
  input: z.object({
    customerId: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  output: z.object({
    customer: z.unknown(),
  }),
};

export const invokeFunctionSchema = {
  input: z.object({
    functionName: z.string().describe("e.g., 'reportingHubQuery', 'nmiMcpBridge'"),
    payload: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    function: z.string(),
    result: z.unknown(),
  }),
};

export const queryEntitySchema = {
  input: z.object({
    entity: z.enum(ENTITY_NAMES),
    filter: z.record(z.unknown()).optional(),
    sort: z.string().optional().describe("e.g., '-created_date'"),
    limit: z.number().int().min(1).max(500).optional().default(50),
  }),
  output: z.object({
    entity: z.string(),
    count: z.number(),
    results: z.unknown(),
  }),
};

export const reportingHubSchema = {
  input: z.object({
    action: z.enum(REPORT_ACTIONS),
    params: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    action: z.string(),
    report: z.unknown(),
  }),
};

export const updateEntitySchema = {
  input: z.object({
    entity: z.string(),
    id: z.string(),
    data: z.record(z.unknown()).describe("Fields to update (partial patch)"),
  }),
  output: z.object({
    updated: z.boolean(),
    entity: z.string(),
    id: z.string(),
    record: z.unknown(),
  }),
};

export type CreateEntityInput = z.infer<typeof createEntitySchema.input>;
export type Customer360Input = z.infer<typeof customer360Schema.input>;
export type InvokeFunctionInput = z.infer<typeof invokeFunctionSchema.input>;
export type QueryEntityInput = z.infer<typeof queryEntitySchema.input>;
export type ReportingHubInput = z.infer<typeof reportingHubSchema.input>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema.input>;

export const base44Schemas = {
  createEntity: createEntitySchema,
  customer360: customer360Schema,
  invokeFunction: invokeFunctionSchema,
  queryEntity: queryEntitySchema,
  reportingHub: reportingHubSchema,
  updateEntity: updateEntitySchema,
} as const;
