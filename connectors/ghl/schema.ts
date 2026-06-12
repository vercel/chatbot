/**
 * GoHighLevel Connector — Zod schemas for all tool inputs and outputs.
 */

import { z } from "zod";

export const createContactSchema = {
  input: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    contactId: z.string().optional(),
    created: z.boolean().optional(),
    updated: z.boolean().optional(),
  }),
};

export const sendSmsSchema = {
  input: z.object({
    contactId: z.string().describe("GHL contact ID"),
    message: z.string().describe("SMS message body (max 1600 chars)"),
  }),
  output: z.object({
    messageId: z.string().optional(),
    status: z.string().optional(),
  }),
};

export const sendEmailSchema = {
  input: z.object({
    contactId: z.string().describe("GHL contact ID"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (HTML or plain text)"),
  }),
  output: z.object({
    messageId: z.string().optional(),
    status: z.string().optional(),
  }),
};

export const queryConversationsSchema = {
  input: z.object({
    contactId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    keyword: z.string().optional(),
    limit: z.number().default(20),
  }),
  output: z.object({
    conversations: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const getOpportunitySchema = {
  input: z.object({
    opportunityId: z.string().describe("GHL opportunity/pipeline ID"),
  }),
  output: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    pipeline: z.string().optional(),
    value: z.number().optional(),
  }),
};

export type CreateContactInput = z.infer<typeof createContactSchema.input>;
export type SendSmsInput = z.infer<typeof sendSmsSchema.input>;
export type SendEmailInput = z.infer<typeof sendEmailSchema.input>;
export type QueryConversationsInput = z.infer<typeof queryConversationsSchema.input>;
export type GetOpportunityInput = z.infer<typeof getOpportunitySchema.input>;

export const ghlSchemas = {
  createContact: createContactSchema,
  sendSms: sendSmsSchema,
  sendEmail: sendEmailSchema,
  queryConversations: queryConversationsSchema,
  getOpportunity: getOpportunitySchema,
} as const;
