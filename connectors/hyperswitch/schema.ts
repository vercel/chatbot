/**
 * Hyperswitch Connector — Zod schemas for all tool inputs and outputs.
 *
 * Hyperswitch tools proxy through the VPS tools bridge to keep API keys secure.
 */

import { z } from "zod";

export const createPaymentLinkSchema = {
  input: z.object({
    amount: z.number().positive().describe("Amount in cents (e.g., 12999 = $129.99)"),
    currency: z.string().optional().default("USD"),
    customerId: z.string().optional(),
    styleId: z.string().optional().default("newleaf-sub-signup"),
    description: z.string().optional(),
  }),
  output: z.object({
    paymentLink: z.string().optional(),
    paymentId: z.string().optional(),
    status: z.string().optional(),
  }),
};

export const listPaymentsSchema = {
  input: z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
    customerId: z.string().optional(),
    status: z
      .enum(["succeeded", "failed", "processing", "requires_payment_method"])
      .optional(),
  }),
  output: z.object({
    payments: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const refundPaymentSchema = {
  input: z.object({
    paymentId: z.string().describe("Hyperswitch payment_id to refund"),
    amount: z.number().positive().optional().describe("Amount in cents (default: full)"),
    reason: z.string().optional(),
  }),
  output: z.object({
    refundId: z.string().optional(),
    status: z.string().optional(),
    amount: z.number().optional(),
  }),
};

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema.input>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema.input>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema.input>;

export const hyperswitchSchemas = {
  createPaymentLink: createPaymentLinkSchema,
  listPayments: listPaymentsSchema,
  refundPayment: refundPaymentSchema,
} as const;
