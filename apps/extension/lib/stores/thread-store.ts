"use client";

import { create } from "zustand";
import { extensionDb } from "@/lib/db/database";
import { appendTraceEvent, listTraceEvents } from "@/lib/runtime/trace-events";
import {
  defaultConfigState,
  getConfigState,
  setConfigState,
} from "@/lib/storage/config-storage";
import type {
  ActivePageContext,
  AppModelId,
  ArtifactRecord,
  AttachmentRecord,
  LocalMessageRecord,
  MessageBranchRecord,
  PageContextRecord,
  ThreadRecord,
  ToolExecutionRecord,
  TraceEventRecord,
  TraceEventType,
  UsageStatRecord,
} from "@/lib/types";

type TraceFilter = "all" | "tool" | "auth" | "artifact";

type ThreadStoreState = {
  initialized: boolean;
  activeThreadId: string | null;
  threads: ThreadRecord[];
  messages: LocalMessageRecord[];
  toolExecutions: ToolExecutionRecord[];
  artifacts: ArtifactRecord[];
  pageContexts: PageContextRecord[];
  attachments: AttachmentRecord[];
  messageBranches: MessageBranchRecord[];
  usageStats: UsageStatRecord[];
  traceEvents: TraceEventRecord[];
  selectedModel: AppModelId;
  isRunning: boolean;
  traceFilter: TraceFilter;
};

type ThreadStoreActions = {
  initialize: () => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  switchToNewThread: () => Promise<void>;
  setSelectedModel: (modelId: AppModelId) => Promise<void>;
  setIsRunning: (isRunning: boolean) => void;
  setTraceFilter: (filter: TraceFilter) => void;
  addUserMessage: (text: string) => Promise<LocalMessageRecord>;
  upsertAssistantMessage: (message: LocalMessageRecord) => Promise<void>;
  replaceMessages: (messages: LocalMessageRecord[]) => Promise<void>;
  addTraceEvent: (
    type: TraceEventType,
    payload?: Record<string, unknown>,
    messageId?: string,
  ) => Promise<void>;
  addPageContext: (context: ActivePageContext) => Promise<void>;
  addArtifact: (artifact: Omit<ArtifactRecord, "id" | "createdAt">) => Promise<void>;
  clearLocalStateForSignOut: () => Promise<void>;
};

type ThreadStore = ThreadStoreState & ThreadStoreActions;

const nowIso = () => new Date().toISOString();

const createThreadRecord = (id: string): ThreadRecord => {
  const createdAt = nowIso();
  return {
    id,
    title: "New thread",
    createdAt,
    updatedAt: createdAt,
  };
};

const ensureThread = async (threadId: string): Promise<ThreadRecord> => {
  const existing = await extensionDb.threads.get(threadId);
  if (existing) return existing;
  const created = createThreadRecord(threadId);
  await extensionDb.threads.put(created);
  return created;
};

const refreshThreads = () =>
  extensionDb.threads.orderBy("updatedAt").reverse().toArray();

const loadThreadData = async (threadId: string) => {
  const [
    messages,
    toolExecutions,
    artifacts,
    pageContexts,
    attachments,
    messageBranches,
    usageStats,
    traceEvents,
  ] = await Promise.all([
    extensionDb.messages.where("threadId").equals(threadId).sortBy("createdAt"),
    extensionDb.toolExecutions.where("threadId").equals(threadId).sortBy("createdAt"),
    extensionDb.artifacts.where("threadId").equals(threadId).sortBy("createdAt"),
    extensionDb.pageContexts.where("threadId").equals(threadId).sortBy("capturedAt"),
    extensionDb.attachments.where("threadId").equals(threadId).sortBy("createdAt"),
    extensionDb.messageBranches
      .where("threadId")
      .equals(threadId)
      .sortBy("createdAt"),
    extensionDb.usageStats.where("threadId").equals(threadId).sortBy("createdAt"),
    listTraceEvents(threadId),
  ]);

  return {
    messages,
    toolExecutions,
    artifacts,
    pageContexts,
    attachments,
    messageBranches,
    usageStats,
    traceEvents,
  };
};

export const useThreadStore = create<ThreadStore>((set, get) => ({
  initialized: false,
  activeThreadId: null,
  threads: [],
  messages: [],
  toolExecutions: [],
  artifacts: [],
  pageContexts: [],
  attachments: [],
  messageBranches: [],
  usageStats: [],
  traceEvents: [],
  selectedModel: defaultConfigState.selectedModel,
  isRunning: false,
  traceFilter: "all",

  initialize: async () => {
    const config = await getConfigState();
    const threads = await refreshThreads();
    const activeThreadId =
      config.lastOpenedThreadId ?? threads[0]?.id ?? crypto.randomUUID();

    await ensureThread(activeThreadId);
    const threadData = await loadThreadData(activeThreadId);

    set({
      initialized: true,
      activeThreadId,
      threads: await refreshThreads(),
      selectedModel: config.selectedModel,
      ...threadData,
    });
  },

  switchThread: async (threadId) => {
    await ensureThread(threadId);
    await setConfigState({ lastOpenedThreadId: threadId });
    const threadData = await loadThreadData(threadId);

    set({
      activeThreadId: threadId,
      threads: await refreshThreads(),
      ...threadData,
    });
  },

  switchToNewThread: async () => {
    const threadId = crypto.randomUUID();
    await extensionDb.threads.put(createThreadRecord(threadId));
    await setConfigState({ lastOpenedThreadId: threadId });

    set({
      activeThreadId: threadId,
      threads: await refreshThreads(),
      messages: [],
      toolExecutions: [],
      artifacts: [],
      pageContexts: [],
      attachments: [],
      messageBranches: [],
      usageStats: [],
      traceEvents: [],
    });
  },

  setSelectedModel: async (modelId) => {
    await setConfigState({ selectedModel: modelId });
    set({ selectedModel: modelId });
  },

  setIsRunning: (isRunning) => {
    set({ isRunning });
  },

  setTraceFilter: (traceFilter) => {
    set({ traceFilter });
  },

  addUserMessage: async (text) => {
    const threadId = get().activeThreadId ?? crypto.randomUUID();
    const thread = await ensureThread(threadId);
    const createdAt = nowIso();

    const message: LocalMessageRecord = {
      id: crypto.randomUUID(),
      threadId,
      role: "user",
      createdAt,
      parts: [{ type: "text", text }],
      metadata: {},
    };

    await extensionDb.messages.put(message);
    await extensionDb.threads.put({
      ...thread,
      title: text.slice(0, 80) || thread.title,
      updatedAt: createdAt,
    });

    set((state) => ({
      activeThreadId: threadId,
      threads: [
        {
          ...thread,
          title: text.slice(0, 80) || thread.title,
          updatedAt: createdAt,
        },
        ...state.threads.filter((item) => item.id !== threadId),
      ],
      messages: [...state.messages, message],
    }));

    return message;
  },

  upsertAssistantMessage: async (message) => {
    await extensionDb.messages.put(message);
    const thread = await ensureThread(message.threadId);
    await extensionDb.threads.put({ ...thread, updatedAt: nowIso() });

    set((state) => {
      const nextMessages = state.messages.filter((item) => item.id !== message.id);
      nextMessages.push(message);
      nextMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { messages: nextMessages };
    });
  },

  replaceMessages: async (messages) => {
    const threadId = get().activeThreadId;
    if (!threadId) return;

    const existingIds = await extensionDb.messages
      .where("threadId")
      .equals(threadId)
      .primaryKeys();

    if (existingIds.length > 0) {
      await extensionDb.messages.bulkDelete(existingIds as string[]);
    }

    if (messages.length > 0) {
      await extensionDb.messages.bulkPut(messages);
    }

    set({ messages: [...messages] });
  },

  addTraceEvent: async (type, payload, messageId) => {
    const threadId = get().activeThreadId;
    if (!threadId) return;

    const saved = await appendTraceEvent({
      threadId,
      type,
      payload,
      messageId,
    });

    set((state) => ({ traceEvents: [saved, ...state.traceEvents] }));
  },

  addPageContext: async (context) => {
    const threadId = get().activeThreadId;
    if (!threadId) return;

    const record: PageContextRecord = {
      id: crypto.randomUUID(),
      threadId,
      url: context.url,
      title: context.title,
      selection: context.selection,
      textPreview: context.textPreview,
      tokenEstimate: context.tokenEstimate,
      capturedAt: nowIso(),
    };

    await extensionDb.pageContexts.put(record);
    set((state) => ({ pageContexts: [...state.pageContexts, record] }));
  },

  addArtifact: async (artifact) => {
    const record: ArtifactRecord = {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      ...artifact,
    };

    await extensionDb.artifacts.put(record);
    set((state) => ({ artifacts: [...state.artifacts, record] }));
  },

  clearLocalStateForSignOut: async () => {
    await Promise.all([
      extensionDb.threads.clear(),
      extensionDb.messages.clear(),
      extensionDb.toolExecutions.clear(),
      extensionDb.artifacts.clear(),
      extensionDb.pageContexts.clear(),
      extensionDb.attachments.clear(),
      extensionDb.messageBranches.clear(),
      extensionDb.usageStats.clear(),
      extensionDb.traceEvents.clear(),
    ]);

    await setConfigState({
      selectedModel: defaultConfigState.selectedModel,
      lastOpenedThreadId: null,
      lightweightThreadIndex: [],
    });

    set({
      initialized: true,
      activeThreadId: null,
      threads: [],
      messages: [],
      toolExecutions: [],
      artifacts: [],
      pageContexts: [],
      attachments: [],
      messageBranches: [],
      usageStats: [],
      traceEvents: [],
      isRunning: false,
      traceFilter: "all",
      selectedModel: defaultConfigState.selectedModel,
    });
  },
}));
