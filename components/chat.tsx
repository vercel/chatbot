'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
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

// Feature flag for AI SDK agent vs Mastra (client-side)
const useAiSdkAgent = process.env.NEXT_PUBLIC_USE_AI_SDK_AGENT === 'true';

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
  

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop: originalStop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      // Route based on feature flag: when AI SDK agent is enabled, use /api/chat for web automation
      // Otherwise, use /api/mastra-proxy for backward compatibility
      api:
        initialChatModel === 'web-automation-model' && !useAiSdkAgent
          ? '/api/mastra-proxy'
          : '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest:
        initialChatModel === 'web-automation-model' && !useAiSdkAgent
          ? ({ messages, id, body }) => ({
              body: {
                messages,
                threadId: id,
                resourceId: session?.user?.id,
                ...body,
              },
            })
          : ({ messages, id, body }) => ({
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

  // Custom stop function that sends stopChat action for web automation
  const stop = async () => {
    // Always call the original stop to abort the stream
    originalStop();

    // For web automation model using Mastra backend, also send stopChat action
    // When using AI SDK agent, the AbortController handles stopping
    if (initialChatModel === 'web-automation-model' && !useAiSdkAgent) {
      try {
        await fetch('/api/mastra-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'stopChat',
            threadId: id,
            resourceId: session?.user?.id,
          }),
        });
      } catch (error) {
        console.error('Error sending stopChat action:', error);
      }
    }
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

  // Monitor messages for browser tool usage - only open artifact for new messages, not when navigating to existing chats
  useEffect(() => {
    // Only check for browser tool calls if we're actively streaming (new message being processed)
    // This prevents artifacts from opening when just navigating to view an existing chat
    if (status !== 'streaming') {
      return;
    }

    const hasBrowserToolCall = messages.some(message =>
      message.parts?.some(part => {
        const partType = (part as any).type;
        const toolName = (part as any).toolName;

        // Check for tool-call type with browser-related toolName
        // Supports: browser (AI SDK), browser_navigate, playwright_browser_*, mcp_playwright_browser_*, playwright.browser_*
        if (partType === 'tool-call' &&
            (toolName === 'browser' || // AI SDK agent browser tool
             toolName?.startsWith('browser_') ||
             toolName?.startsWith('playwright_browser') ||
             toolName?.startsWith('mcp_playwright_browser') ||
             toolName?.startsWith('playwright.browser_') ||
             toolName?.includes('_browser_'))) {
          return true;
        }

        // Check for tool- prefixed types (how tools appear in message parts)
        if (partType === 'tool-browser' || // AI SDK agent browser tool
            partType?.startsWith('tool-browser_') ||
            partType?.startsWith('tool-playwright_browser') ||
            partType?.startsWith('tool-mcp_playwright_browser') ||
            partType?.startsWith('tool-playwright.browser_')) {
          return true;
        }

        return false;
      })
    );
    
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
  }, [messages, isArtifactVisible, browserArtifactDismissed, status, setArtifact]);

  // Track when user manually closes the browser artifact
  useEffect(() => {
    // If artifact was visible and now it's not, and we have browser tool calls, user dismissed it
    if (!isArtifactVisible && !browserArtifactDismissed) {
      const hasBrowserToolCall = messages.some(message =>
        message.parts?.some(part => {
          const partType = (part as any).type;
          const toolName = (part as any).toolName;

          // Supports: browser (AI SDK), browser_navigate, playwright_browser_*, mcp_playwright_browser_*, playwright.browser_*
          return (partType === 'tool-call' &&
                  (toolName === 'browser' || // AI SDK agent browser tool
                   toolName?.startsWith('browser_') ||
                   toolName?.startsWith('playwright_browser') ||
                   toolName?.startsWith('mcp_playwright_browser') ||
                   toolName?.startsWith('playwright.browser_') ||
                   toolName?.includes('_browser_'))) ||
                 (partType === 'tool-browser' || // AI SDK agent browser tool
                  partType?.startsWith('tool-browser_') ||
                  partType?.startsWith('tool-playwright_browser') ||
                  partType?.startsWith('tool-mcp_playwright_browser') ||
                  partType?.startsWith('tool-playwright.browser_'));
        })
      );

      if (hasBrowserToolCall && initialChatModel === 'web-automation-model') {
        setBrowserArtifactDismissed(true);
      }
    }
  }, [isArtifactVisible, browserArtifactDismissed, messages, initialChatModel]);

  // Reset dismissed state when messages change significantly (new automation request)
  useEffect(() => {
    // If we have new messages and the last message is from user, reset dismissed state
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        if (browserArtifactDismissed) {
          setBrowserArtifactDismissed(false);
        }
        // Dispatch event to dismiss any UserActionConfirmation components
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
      <>
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
        />
      </>
    );
  }

  // Unified layout for all models
  return (
    <>
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
      />
    </>
  );
}
