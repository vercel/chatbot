'use client';

import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector, useArtifact } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { BenefitApplicationsLanding } from './benefit-applications-landing';
import { TokenUsageProvider } from '@/hooks/use-token-usage';

export type CheckpointData = { messageId: string; stepNumber: number; summary: string };

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  initialQuery,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session | null;
  autoResume: boolean;
  initialQuery?: string;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>('');

  // Local state; passed to TokenUsageProvider so SideChatHeader can read it
  // without prop threading through the Artifact memo boundary.
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    currentInputTokens: number;
  }>({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, currentInputTokens: 0 });

  // Track compaction checkpoints. Each entry records the message ID,
  // the number of parts that message had at checkpoint time, and the summary.
  // This lets us render the card between parts at the right position.
  const [checkpoints, setCheckpoints] = useState<CheckpointData[]>(
    []
  );
  // True while the compressor is running the Sonnet summary call
  const [isCompacting, setIsCompacting] = useState(false);
  // Ref to always have the latest messages in the onData closure
  const messagesRef = useRef<ChatMessage[]>([]);

  // When the user presses Stop, useChat aborts the in-flight fetch but
  // auto-continues the tool loop on the next render (because the last
  // assistant message ends with a completed tool call). We guard the
  // auto-send with this flag so Stop actually halts the loop. Reset
  // on the next user-initiated send.
  const stoppedRef = useRef(false);

  const {
    messages,
    setMessages,
    sendMessage: rawSendMessage,
    status,
    stop: originalStop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages }) =>
      !stoppedRef.current && lastAssistantMessageIsCompleteWithToolCalls({ messages }),
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest: ({ messages, id, body }) => ({
        body: {
          id,
          message: messages.at(-1),
          selectedChatModel: initialChatModel,
          selectedVisibilityType: visibilityType,
          ...body,
        },
      }),
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      // Capture per-step token usage emitted by onStepFinish in route.ts
      const part = dataPart as any;
      if (part?.type === 'data-compacting') {
        setIsCompacting(true);
      }
      if (part?.type === 'data-checkpoint') {
        setIsCompacting(false);
        const currentMessages = messagesRef.current;
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg) {
          const data = part.data as any;
          const summary = data?.summary ?? '';
          const stepNumber = data?.stepNumber ?? 0;
          setCheckpoints((prev) => [
            ...prev,
            {
              messageId: lastMsg.id,
              stepNumber,
              summary,
            },
          ]);
        }
      }
      if (part?.type === 'data-token-usage' && part.data) {
        const {
          inputTokens = 0,
          outputTokens = 0,
          cachedInputTokens = 0,
        } = part.data as {
          inputTokens: number;
          outputTokens: number;
          cachedInputTokens?: number;
        };
        setTokenUsage((prev) => ({
          inputTokens: prev.inputTokens + inputTokens,
          outputTokens: prev.outputTokens + outputTokens,
          cachedInputTokens: prev.cachedInputTokens + (cachedInputTokens ?? 0),
          currentInputTokens: inputTokens,
        }));
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      console.error('Chat error:', error);
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      } else {
        // Handle other errors (like quota errors from Mastra)
        toast({
          type: 'error',
          description: error?.message || 'An error occurred. Please try again.',
        });
      }
    },
  });

  // Keep ref in sync so onData closure always has latest messages
  messagesRef.current = messages;

  const stop = async () => {
    stoppedRef.current = true;
    // Explicit server-side cancel. Cloud Run over HTTP/1.1 does not
    // propagate the fetch abort, so we POST to /api/chat/stop to trigger
    // the server's AbortController directly. Fire-and-forget — errors
    // here shouldn't block the local stop().
    fetch('/api/chat/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: id }),
    }).catch((err) => console.error('[stop] server cancel failed', err));
    originalStop();
  };

  const sendMessage: typeof rawSendMessage = (...args) => {
    stoppedRef.current = false;
    return rawSendMessage(...args);
  };

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (initialQuery && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: initialQuery }],
      });

      setHasAppendedQuery(true);

      // Clear the shared link cookie
      document.cookie = 'shared_link_content=; path=/; max-age=0';

      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [initialQuery, sendMessage, hasAppendedQuery, id]);

  // const { data: votes } = useSWR<Array<Vote>>(
  //   messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
  //   fetcher,
  // );
  const votes = undefined;

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact, artifact } = useArtifact();
  const [browserArtifactDismissed, setBrowserArtifactDismissed] = useState(false);

  // Derive once — whether any message contains a browser tool call
  const hasBrowserToolCall = useMemo(
    () =>
      messages.some((message) =>
        message.parts?.some((part) => {
          const partType = (part as any).type;
          const toolName = (part as any).toolName;

          if (
            partType === 'tool-call' &&
            (toolName === 'browser' ||
              toolName?.startsWith('browser_') ||
              toolName?.includes('_browser_'))
          ) {
            return true;
          }

          if (
            partType === 'tool-browser' ||
            partType?.startsWith('tool-browser_')
          ) {
            return true;
          }

          return false;
        }),
      ),
    [messages],
  );

  // Open browser artifact when streaming starts and a browser tool call appears
  useEffect(() => {
    if (status !== 'streaming') return;

    if (hasBrowserToolCall && !isArtifactVisible && !browserArtifactDismissed) {
      const userMessage = messages.find(msg => msg.role === 'user');
      const messageText = userMessage?.parts.find(part => part.type === 'text')?.text || 'Web Automation';
      const title = `Browser: ${messageText}`;

      setArtifact({
        documentId: generateUUID(),
        content: `# ${title}\n\nBrowser automation session starting...`,
        kind: 'browser',
        title,
        status: 'idle',
        isVisible: true,
        boundingBox: {
          top: 0,
          left: 0,
          width: 0,
          height: 0,
        },
      });
    }
  }, [hasBrowserToolCall, isArtifactVisible, browserArtifactDismissed, status, messages, setArtifact]);

  // Track when user manually closes the browser artifact
  useEffect(() => {
    if (!isArtifactVisible && !browserArtifactDismissed && hasBrowserToolCall && initialChatModel === 'web-automation-model') {
      setBrowserArtifactDismissed(true);
    }
  }, [isArtifactVisible, browserArtifactDismissed, hasBrowserToolCall, initialChatModel]);

  // Reset dismissed state when a new user message arrives
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        if (browserArtifactDismissed) {
          setBrowserArtifactDismissed(false);
        }
        window.dispatchEvent(new CustomEvent('new-user-message'));
      }
    }
  }, [messages, browserArtifactDismissed]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Special UI for web automation agent - show landing page
  if (initialChatModel === 'web-automation-model' && messages.length === 0) {
    return (
      <TokenUsageProvider value={tokenUsage}>
        <div className="flex h-dvh bg-chat-background flex-col">
          <BenefitApplicationsLanding
            input={input}
            setInput={setInput}
            isReadonly={isReadonly}
            chatId={id}
            sendMessage={sendMessage}
            selectedVisibilityType={visibilityType}
            status={status}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            setMessages={setMessages}
            session={session}
          />
        </div>
        <Artifact
          chatId={id}
          input={input}
          setInput={setInput}
          status={status}
          stop={stop}
          attachments={attachments}
          setAttachments={setAttachments}
          sendMessage={sendMessage}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          votes={votes}
          isReadonly={isReadonly}
          selectedVisibilityType={visibilityType}
          initialChatModel={initialChatModel}
          checkpoints={checkpoints}
          isCompacting={isCompacting}
        />
      </TokenUsageProvider>
    );
  }

  // Unified layout for all models
  return (
    <TokenUsageProvider value={tokenUsage}>
      {!isArtifactVisible && (
        <div className="flex h-dvh bg-background flex-col">
          <div className="flex flex-col min-w-0 size-full">
            <Messages
              chatId={id}
              status={status}
              votes={votes}
              messages={messages}
              setMessages={setMessages}
              regenerate={regenerate}
              sendMessage={sendMessage}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
              checkpoints={checkpoints}
              isCompacting={isCompacting}
            />
  
            <div className="shrink-0 mx-auto px-4 pt-6 bg-chat-background pb-4 md:pb-6 w-full">
              {!isReadonly && (
                <form className="flex gap-2 w-full md:max-w-3xl mx-auto">
                  <MultimodalInput
                    chatId={id}
                    input={input}
                    setInput={setInput}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    setMessages={setMessages}
                    sendMessage={sendMessage}
                    selectedVisibilityType={visibilityType}
                    session={session}
                  />
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
        initialChatModel={initialChatModel}
        checkpoints={checkpoints}
        isCompacting={isCompacting}
      />
    </TokenUsageProvider>
  );
}
