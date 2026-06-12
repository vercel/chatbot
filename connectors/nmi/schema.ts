/**
 * NMI Connector — Zod schemas for all tool inputs and outputs.
 *
 * NMI tools proxy through the VPS tools bridge to keep API keys secure.
 */

import { z } from "zod";

export const getSubscriptionSchema = {
  input: z.object({
    subscriptionId: z.string().describe("NMI subscription ID"),
  }),
  output: z.object({
    subscriptionId: z.string().optional(),
    status: z.string().optional(),
    nextChargeDate: z.string().optional(),
    amount: z.number().optional(),
    customerVaultId: z.string().optional(),
  }),
};

export const getVaultSchema = {
  input: z.object({
    customerVaultId: z.string().describe("NMI customer vault ID"),
  }),
  output: z.object({
    customerVaultId: z.string().optional(),
    billingInfo: z.record(z.unknown()).optional(),
    subscriptions: z.array(z.record(z.unknown())).optional(),
  }),
};

export const queryTransactionsSchema = {
  input: z.object({
    customerVaultId: z.string().optional(),
    subscriptionId: z.string().optional(),
    startDate: z.string().optional().describe("ISO date"),
    endDate: z.string().optional().describe("ISO date"),
    limit: z.number().default(20),
  }),
  output: z.object({
    transactions: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const refundTransactionSchema = {
  input: z.object({
    transactionId: z.string().describe("NMI transaction ID to refund"),
    amount: z.number().positive().optional().describe("Amount in cents (default: full amount)"),
  }),
  output: z.object({
    refundId: z.string().optional(),
    status: z.string().optional(),
    amount: z.number().optional(),
  }),
};

export type GetSubscriptionInput = z.infer<typeof getSubscriptionSchema.input>;
export type GetVaultInput = z.infer<typeof getVaultSchema.input>;
export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema.input>;
export type RefundTransactionInput = z.infer<typeof refundTransactionSchema.input>;

export const nmiSchemas = {
  getSubscription: getSubscriptionSchema,
  getVault: getVaultSchema,
  queryTransactions: queryTransactionsSchema,
  refundTransaction: refundTransactionSchema,
} as const;
