import {
  type ExternalStoreAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai';
import { useMemo } from 'react';
import { extensionEnv } from '@/lib/config/env';
import {
  addUsageStatFromMessage,
  extractUsageFromMetadata,
} from '@/lib/runtime/metrics';
import { appendTraceEvent } from '@/lib/runtime/trace-events';
import { useThreadStore } from '@/lib/stores/thread-store';
import type {
  ChatStreamRequestBody,
  LocalMessageRecord,
  MessagePart,
  TraceEventType,
} from '@/lib/types';

const convertToThreadMessage: NonNullable<
  ExternalStoreAdapter<LocalMessageRecord>['convertMessage']
> = (message): ThreadMessageLike => ({
  id: message.id,
  role: message.role,
  createdAt: new Date(message.createdAt),
  content: message.parts,
  ...(message.status ? { status: message.status } : {}),
  metadata: {
    custom: message.metadata ?? {},
  },
});

const extractTextFromParts = (parts: MessagePart[]) => {
  const textPart = parts.find((part) => part.type === 'text');
  return textPart?.type === 'text' ? textPart.text : '';
};

const resolveActiveContext = () => {
  const contexts = useThreadStore.getState().pageContexts;
  const latest = contexts
    .slice()
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];

  if (!latest) return null;
  return {
    url: latest.url,
    title: latest.title,
    selection: latest.selection,
    textPreview: latest.textPreview,
    tokenEstimate: latest.tokenEstimate,
  };
};

const mapLocalMessagesToUIMessages = (
  messages: LocalMessageRecord[],
): UIMessage[] => {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts as UIMessage['parts'],
    ...(message.metadata ? { metadata: message.metadata } : {}),
  }));
};

const addTraceEvent = async (
  type: TraceEventType,
  payload?: Record<string, unknown>,
  messageId?: string,
) => {
  const threadId = useThreadStore.getState().activeThreadId;
  if (!threadId) return;
  await appendTraceEvent({ threadId, type, payload, messageId });
};

const createAdapter = (): ExternalStoreAdapter<LocalMessageRecord> => ({
  get isRunning() {
    return useThreadStore.getState().isRunning;
  },
  get messages() {
    return useThreadStore.getState().messages;
  },
  convertMessage: convertToThreadMessage,
  setMessages: (messages) => {
    void useThreadStore
      .getState()
      .replaceMessages(messages as LocalMessageRecord[]);
  },
  onNew: async (appendMessage) => {
    const state = useThreadStore.getState();
    if (!state.activeThreadId) {
      await state.switchToNewThread();
    }

    const threadId = useThreadStore.getState().activeThreadId;
    if (!threadId) return;

    const text = extractTextFromParts(appendMessage.content as MessagePart[]);
    if (!text) return;

    const userMessage = await useThreadStore.getState().addUserMessage(text);
    const requestStartedAt = Date.now();
    useThreadStore.getState().setIsRunning(true);

    await addTraceEvent(
      'turn-start',
      { model: useThreadStore.getState().selectedModel },
      userMessage.id,
    );

    const requestBody: ChatStreamRequestBody = {
      threadId,
      model: useThreadStore.getState().selectedModel,
      context: resolveActiveContext(),
      messages: mapLocalMessagesToUIMessages(useThreadStore.getState().messages),
    };

    try {
      const transport = new DefaultChatTransport({
        api: `${extensionEnv.apiBaseUrl}/v1/chat/stream`,
        fetch: async (input, init) => {
          const response = await fetch(input, {
            ...init,
            headers: {
              ...(init?.headers ?? {}),
              'Content-Type': 'application/json',
            },
          });

          if (response.status === 401) {
            await addTraceEvent('auth-refresh', { status: 401 }, userMessage.id);
          }

          return response;
        },
      });

      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: threadId,
        messageId: undefined,
        messages: requestBody.messages,
        abortSignal: undefined,
        body: requestBody,
      });

      let ttftRecorded = false;

      for await (const message of readUIMessageStream({ stream })) {
        if (message.role !== 'assistant') continue;

        const assistantMessage: LocalMessageRecord = {
          id: message.id,
          threadId,
          role: 'assistant',
          createdAt: new Date().toISOString(),
          parts: message.parts as MessagePart[],
          ...(message.metadata
            ? { metadata: message.metadata as Record<string, unknown> }
            : {}),
        };

        await useThreadStore.getState().upsertAssistantMessage(assistantMessage);

        if (!ttftRecorded) {
          ttftRecorded = true;
          await addTraceEvent(
            'ttft',
            { ms: Date.now() - requestStartedAt },
            assistantMessage.id,
          );
        }
      }

      const assistantMessages = useThreadStore
        .getState()
        .messages.filter((item) => item.role === 'assistant');
      const latestAssistant = assistantMessages[assistantMessages.length - 1];

      if (latestAssistant) {
        const usage = extractUsageFromMetadata(latestAssistant.metadata);
        if (usage?.tokensPerSecond) {
          await addTraceEvent(
            'tokens-per-second',
            { value: usage.tokensPerSecond },
            latestAssistant.id,
          );
        }

        const usageRecord = await addUsageStatFromMessage(threadId, latestAssistant);
        await addTraceEvent(
          'turn-end',
          usageRecord
            ? {
                inputTokens: usageRecord.inputTokens,
                outputTokens: usageRecord.outputTokens,
                totalTokens: usageRecord.totalTokens,
              }
            : {},
          latestAssistant.id,
        );
      }
    } catch (error) {
      await addTraceEvent(
        'turn-error',
        {
          message: error instanceof Error ? error.message : 'Unknown stream failure',
        },
        userMessage.id,
      );
      throw error;
    } finally {
      useThreadStore.getState().setIsRunning(false);
    }
  },
  onCancel: async () => {
    useThreadStore.getState().setIsRunning(false);
    await addTraceEvent('turn-cancelled', {});
  },
  adapters: {
    threadList: {
      get threadId() {
        return useThreadStore.getState().activeThreadId ?? undefined;
      },
      get threads() {
        return useThreadStore.getState().threads.map((thread) => ({
          status: 'regular' as const,
          id: thread.id,
          title: thread.title,
          remoteId: thread.id,
        }));
      },
      onSwitchToThread: async (threadId) => {
        await useThreadStore.getState().switchThread(threadId);
      },
      onSwitchToNewThread: async () => {
        await useThreadStore.getState().switchToNewThread();
      },
    },
  },
});

export const useAssistantExternalRuntime = () => {
  const adapter = useMemo(() => createAdapter(), []);
  return useExternalStoreRuntime(adapter);
};
