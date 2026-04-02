import Dexie, { type Table } from 'dexie';
import type {
  ArtifactRecord,
  AttachmentRecord,
  LocalMessageRecord,
  MessageBranchRecord,
  PageContextRecord,
  ThreadRecord,
  ToolExecutionRecord,
  TraceEventRecord,
  UsageStatRecord,
} from '@/lib/types';

export class HeliosDatabase extends Dexie {
  threads!: Table<ThreadRecord, string>;
  messages!: Table<LocalMessageRecord, string>;
  toolExecutions!: Table<ToolExecutionRecord, string>;
  artifacts!: Table<ArtifactRecord, string>;
  pageContexts!: Table<PageContextRecord, string>;
  attachments!: Table<AttachmentRecord, string>;
  messageBranches!: Table<MessageBranchRecord, string>;
  usageStats!: Table<UsageStatRecord, string>;
  traceEvents!: Table<TraceEventRecord, string>;

  constructor() {
    super('helios-extension-db');

    this.version(1).stores({
      threads: '&id,updatedAt,title',
      messages: '&id,threadId,createdAt,role',
      toolExecutions: '&id,threadId,messageId,createdAt,status',
      artifacts: '&id,threadId,messageId,createdAt',
      pageContexts: '&id,threadId,capturedAt',
      attachments: '&id,threadId,messageId,createdAt',
      messageBranches: '&id,threadId,messageId,parentMessageId',
      usageStats: '&id,threadId,messageId,createdAt',
      traceEvents: '&id,threadId,messageId,createdAt,type',
    });

    // Migration scaffold reserved for the next schema evolution.
    // Keep as an explicit version boundary to make future upgrades deterministic.
    this.version(2).stores({
      threads: '&id,updatedAt,title',
      messages: '&id,threadId,createdAt,role',
      toolExecutions: '&id,threadId,messageId,createdAt,status',
      artifacts: '&id,threadId,messageId,createdAt',
      pageContexts: '&id,threadId,capturedAt',
      attachments: '&id,threadId,messageId,createdAt',
      messageBranches: '&id,threadId,messageId,parentMessageId',
      usageStats: '&id,threadId,messageId,createdAt',
      traceEvents: '&id,threadId,messageId,createdAt,type',
    });
  }
}

export const extensionDb = new HeliosDatabase();
