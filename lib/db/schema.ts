import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  // Phase 10: Chat resilience — parent chain and checkpoint linkage
  parentChatId: uuid("parent_chat_id"),
  checkpointId: uuid("checkpoint_id"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  // Phase 10: Token tracking + artifact metadata
  tokenCount: integer("token_count"),
  artifactSpec: text("artifact_spec"),
  artifactModel: varchar("artifact_model", { length: 64 }),
  // Phase 11: Artifact draft persistence for refresh recovery
  artifactDraft: text("artifact_draft"),
  streamPosition: integer("stream_position").default(0),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const sandboxRun = pgTable("SandboxRun", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sandboxId: text("sandboxId").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  toolName: text("toolName").notNull(),
  runtime: text("runtime").notNull().default("node24"),
  status: text("status").notNull().default("created"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  durationMs: text("durationMs"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  destroyedAt: timestamp("destroyedAt"),
});

export type SandboxRun = InferSelectModel<typeof sandboxRun>;

// Phase 9: Handoff sessions table for V2 coding agent session tracking
export const handoffSession = pgTable("handoff_sessions", {
  id: text("id").primaryKey().notNull(),
  chatMessageId: text("chat_message_id"),
  userId: uuid("user_id").references(() => user.id),
  repo: text("repo"),
  goal: text("goal"),
  v2SessionId: text("v2_session_id"),
  v2SandboxId: text("v2_sandbox_id"),
  status: text("status").notNull().default("spawning"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  prUrl: text("pr_url"),
  deployUrl: text("deploy_url"),
  resultSummary: text("result_summary"),
});

export type HandoffSession = InferSelectModel<typeof handoffSession>;

// Phase 10: Chat checkpoints — auto-saved when conversation approaches context limit
export const chatCheckpoint = pgTable("chat_checkpoints", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 32 }).notNull().default("manual"),
  tokenCount: integer("token_count").notNull().default(0),
  usagePercent: integer("usage_percent").notNull().default(0),
  conversationSummary: text("conversation_summary"),
  messageIds: jsonb("message_ids").default([]),
  modelId: varchar("model_id", { length: 64 }),
  contextWindow: integer("context_window"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatCheckpoint = InferSelectModel<typeof chatCheckpoint>;
