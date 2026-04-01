import type {
  MessageStatus,
  ThreadMessageLike,
  ThreadSuggestion,
} from '@assistant-ui/react';
import type { UIMessage } from 'ai';

export type AppTab = 'chat' | 'artifact' | 'trace' | 'context';

export type AppModelId =
  | 'openai/gpt-4.1-mini'
  | 'openai/gpt-4.1'
  | 'anthropic/claude-3.7-sonnet';

export type TraceEventType =
  | 'turn-start'
  | 'turn-end'
  | 'turn-error'
  | 'turn-cancelled'
  | 'ttft'
  | 'tokens-per-second'
  | 'tool-start'
  | 'tool-end'
  | 'retry'
  | 'artifact-open'
  | 'auth-refresh';

type LocalMessageContent = Exclude<ThreadMessageLike['content'], string>;
export type MessagePart = LocalMessageContent[number];

export interface LocalMessageRecord {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: string;
  parts: MessagePart[];
  status?: MessageStatus;
  metadata?: Record<string, unknown>;
}

export interface ThreadRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolExecutionRecord {
  id: string;
  threadId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  status: 'started' | 'completed' | 'failed';
  args?: unknown;
  result?: unknown;
  error?: string;
  createdAt: string;
}

export interface ArtifactRecord {
  id: string;
  threadId: string;
  messageId: string;
  title: string;
  mimeType: string;
  html: string;
  createdAt: string;
}

export interface PageContextRecord {
  id: string;
  threadId: string;
  url: string;
  title: string;
  selection: string | null;
  textPreview: string;
  tokenEstimate: number;
  capturedAt: string;
}

export interface AttachmentRecord {
  id: string;
  threadId: string;
  messageId: string;
  name: string;
  mediaType: string;
  url: string;
  createdAt: string;
}

export interface MessageBranchRecord {
  id: string;
  threadId: string;
  messageId: string;
  parentMessageId: string | null;
  createdAt: string;
}

export interface UsageStatRecord {
  id: string;
  threadId: string;
  messageId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensPerSecond?: number;
  ttftMs?: number;
  createdAt: string;
}

export interface TraceEventRecord {
  id: string;
  threadId: string;
  messageId?: string;
  type: TraceEventType;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export type TraceEventInput = Omit<TraceEventRecord, 'id' | 'createdAt'>;

export interface ConfigState {
  selectedModel: AppModelId;
  sidebarWidth: number;
  compactMode: boolean;
  featureFlags: Record<string, boolean>;
  installVersion: number;
  lastOpenedThreadId: string | null;
  lightweightThreadIndex: Array<{ id: string; title: string; updatedAt: string }>;
  onboardingComplete: boolean;
  consentAccepted: boolean;
}

export interface SessionUiState {
  draftByThreadId: Record<string, string>;
  openPanels: Record<string, boolean>;
  traceFilter: 'all' | 'tool' | 'auth' | 'artifact';
  lastSelectedSnippet: string | null;
  artifactPreviewThreadId: string | null;
  streamingInFlight: boolean;
}

export interface ActivePageContext {
  url: string;
  title: string;
  selection: string | null;
  textPreview: string;
  tokenEstimate: number;
}

export interface ChatStreamRequestBody {
  threadId: string;
  model: string;
  messages: UIMessage[];
  context?: ActivePageContext | null;
}

export interface ChatStoreStateSnapshot {
  activeThreadId: string;
  threads: ThreadRecord[];
  activeMessages: LocalMessageRecord[];
  selectedModel: AppModelId;
  suggestions: ThreadSuggestion[];
}
