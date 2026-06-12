/**
 * Vapi (Neptune V2 Bridge) Connector — Zod schemas for all tool inputs and outputs.
 *
 * Vapi bridges Neptune Chat to Neptune V2 (coding engine).
 * Tools are currently empty — schemas defined for the planned capabilities
 * declared in the manifest: getCallLogs, getTranscript.
 */

import { z } from "zod";

// ── Planned Tools (from manifest capabilities) ────────────────────────────

export const listV2SessionsSchema = {
  input: z.object({
    status: z.enum(["running", "completed", "failed", "all"]).default("all"),
    limit: z.number().default(10),
  }),
  output: z.object({
    sessions: z.array(z.record(z.unknown())).optional(),
    count: z.number().optional(),
  }),
};

export const getV2SessionSchema = {
  input: z.object({
    sessionId: z.string().describe("V2 session ID"),
  }),
  output: z.object({
    sessionId: z.string(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
  }),
};

export const postV2SessionSchema = {
  input: z.object({
    prompt: z.string().describe("The coding task description"),
    context: z.string().optional().describe("Additional codebase context"),
    model: z.string().optional().default("deepseek-v4-pro"),
  }),
  output: z.object({
    success: z.boolean(),
    sessionId: z.string().optional(),
    sessionUrl: z.string().optional(),
    sseUrl: z.string().optional(),
    error: z.string().optional(),
  }),
};

export const streamV2ProgressSchema = {
  input: z.object({
    sessionId: z.string().describe("V2 session ID"),
  }),
  output: z.object({
    sessionId: z.string(),
    streamUrl: z.string(),
    v2DirectStreamUrl: z.string().optional(),
  }),
};

export const controlV2SessionSchema = {
  input: z.object({
    sessionId: z.string().describe("V2 session ID"),
    action: z.enum(["pause", "resume", "cancel"]),
  }),
  output: z.object({
    success: z.boolean(),
    sessionId: z.string(),
    action: z.string(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
};

export type ListV2SessionsInput = z.infer<typeof listV2SessionsSchema.input>;
export type GetV2SessionInput = z.infer<typeof getV2SessionSchema.input>;
export type PostV2SessionInput = z.infer<typeof postV2SessionSchema.input>;
export type StreamV2ProgressInput = z.infer<typeof streamV2ProgressSchema.input>;
export type ControlV2SessionInput = z.infer<typeof controlV2SessionSchema.input>;

export const vapiSchemas = {
  listV2Sessions: listV2SessionsSchema,
  getV2Session: getV2SessionSchema,
  postV2Session: postV2SessionSchema,
  streamV2Progress: streamV2ProgressSchema,
  controlV2Session: controlV2SessionSchema,
} as const;
