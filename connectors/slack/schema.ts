/**
 * Slack Connector — Zod schemas for all tool inputs and outputs.
 *
 * These schemas are extracted from the tool implementations in tools/
 * to serve as the canonical contract for each tool.
 */

import { z } from "zod";

// ── listChannels ──────────────────────────────────────────────────────────

export const listChannelsSchema = {
  input: z.object({}).describe("List all accessible Slack channels"),
  output: z.object({
    channels: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        isPrivate: z.boolean(),
        topic: z.string().optional(),
        numMembers: z.number().optional(),
      })
    ),
    count: z.number(),
  }),
};

export type ListChannelsInput = z.infer<typeof listChannelsSchema.input>;
export type ListChannelsOutput = z.infer<typeof listChannelsSchema.output>;

// ── postMessage ───────────────────────────────────────────────────────────

export const postMessageSchema = {
  input: z.object({
    channel: z
      .string()
      .describe("Channel name (e.g., 'newleaf-admin') or ID (e.g., 'C096PSS45Q9')"),
    text: z.string().describe("Message text (max 40,000 characters)"),
    threadTs: z
      .string()
      .optional()
      .describe("Thread timestamp to reply in a thread"),
  }),
  output: z.object({
    channel: z.string(),
    ts: z.string(),
    ok: z.boolean(),
  }),
};

export type PostMessageInput = z.infer<typeof postMessageSchema.input>;
export type PostMessageOutput = z.infer<typeof postMessageSchema.output>;

// ── pullMessages ──────────────────────────────────────────────────────────

export const pullMessagesSchema = {
  input: z.object({
    channel: z
      .string()
      .describe("Channel name or ID (supports 'newleaf-admin', 'jarvis-admin' shortcuts)"),
    limit: z.number().int().min(1).max(200).default(50),
    since: z
      .string()
      .optional()
      .describe("ISO timestamp or relative (e.g., '7 days ago')"),
  }),
  output: z.object({
    channel: z.string(),
    channelName: z.string(),
    count: z.number(),
    hasMore: z.boolean(),
    messages: z.array(
      z.object({
        user: z.string(),
        text: z.string(),
        ts: z.string(),
        type: z.string(),
      })
    ),
  }),
};

export type PullMessagesInput = z.infer<typeof pullMessagesSchema.input>;
export type PullMessagesOutput = z.infer<typeof pullMessagesSchema.output>;

// ── reactionAdd ───────────────────────────────────────────────────────────

export const reactionAddSchema = {
  input: z.object({
    channel: z.string().describe("Channel ID containing the message"),
    timestamp: z.string().describe("Message timestamp (ts)"),
    reaction: z.string().describe("Emoji name (e.g., 'thumbsup', 'rocket')"),
  }),
  output: z.object({
    ok: z.boolean(),
    channel: z.string(),
    ts: z.string(),
    reaction: z.string(),
  }),
};

export type ReactionAddInput = z.infer<typeof reactionAddSchema.input>;
export type ReactionAddOutput = z.infer<typeof reactionAddSchema.output>;

// ── searchChannels ────────────────────────────────────────────────────────

export const searchChannelsSchema = {
  input: z.object({
    query: z.string().describe("Search query for channel name or topic"),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  output: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        purpose: z.string().optional(),
        topic: z.string().optional(),
      })
    ),
    count: z.number(),
  }),
};

export type SearchChannelsInput = z.infer<typeof searchChannelsSchema.input>;
export type SearchChannelsOutput = z.infer<typeof searchChannelsSchema.output>;

// ── Aggregate Exports ─────────────────────────────────────────────────────

export const slackSchemas = {
  listChannels: listChannelsSchema,
  postMessage: postMessageSchema,
  pullMessages: pullMessagesSchema,
  reactionAdd: reactionAddSchema,
  searchChannels: searchChannelsSchema,
} as const;
