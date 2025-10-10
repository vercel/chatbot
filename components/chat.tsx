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
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { BenefitApplicationsLanding } from './benefit-applications-landing';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
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
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: initialChatModel === 'web-automation-model' ?
        (process.env.NEXT_PUBLIC_MASTRA_SERVER_URL ?
          `${process.env.NEXT_PUBLIC_MASTRA_SERVER_URL}/chat` :
          'http://mastra-app:4112/chat') :
        '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest: initialChatModel !== 'web-automation-model' ?
        ({ messages, id, body }) => ({
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        }) : ({ messages, id, body }) => ({
          body: {
            messages,
            threadId: id,
            resourceId: session.user.id,
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

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact, artifact } = useArtifact();
  const [browserArtifactDismissed, setBrowserArtifactDismissed] = useState(false);

  const getArtifactTitle = () => {
    // If we have an artifact with a title, use it
    if (artifact?.title) {
      return artifact.title;
    }

    // Otherwise, create a title from the first user message
    const userMessage = messages.find(msg => msg.role === 'user');
    if (userMessage) {
      const messageText = userMessage.parts?.find(part => part.type === 'text')?.text || 'Browser session';
      return `Browser: ${messageText.slice(0, 40)}${messageText.length > 40 ? '...' : ''}`;
    }

    return 'Browser:';
  };

  const artifactTitle = getArtifactTitle();

  // Simple session start time
  const sessionStartTime = 'Session started';

  // Monitor messages for browser tool usage
  useEffect(() => {
    const hasBrowserToolCall = messages.some(message => 
      message.parts?.some(part => {
        const partType = (part as any).type;
        const toolName = (part as any).toolName;
        
        // Check for tool-call type with playwright toolName
        if (partType === 'tool-call' && 
            (toolName?.startsWith('playwright_browser') || 
             toolName?.startsWith('mcp_playwright_browser'))) {
          return true;
        }
        
        // Check for tool- prefixed types (how tools appear in message parts)
        if (partType?.startsWith('tool-playwright_browser') ||
            partType?.startsWith('tool-mcp_playwright_browser')) {
          return true;
        }
        
        return false;
      })
    );
    
    if (hasBrowserToolCall && !isArtifactVisible && !browserArtifactDismissed) {
      const userMessage = messages.find(msg => msg.role === 'user');
      const messageText = userMessage?.parts.find(part => part.type === 'text')?.text || 'Web Automation';
      const title = `Browser: ${messageText.slice(0, 40)}${messageText.length > 40 ? '...' : ''}`;

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
  }, [messages, isArtifactVisible, setArtifact, browserArtifactDismissed]);

  // Track when user manually closes the browser artifact
  useEffect(() => {
    // If artifact was visible and now it's not, and we have browser tool calls, user dismissed it
    if (!isArtifactVisible && !browserArtifactDismissed) {
      const hasBrowserToolCall = messages.some(message => 
        message.parts?.some(part => {
          const partType = (part as any).type;
          const toolName = (part as any).toolName;
          
          return (partType === 'tool-call' && 
                  (toolName?.startsWith('playwright_browser') || 
                   toolName?.startsWith('mcp_playwright_browser'))) ||
                 (partType?.startsWith('tool-playwright_browser') ||
                  partType?.startsWith('tool-mcp_playwright_browser'));
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
      if (lastMessage.role === 'user' && browserArtifactDismissed) {
        setBrowserArtifactDismissed(false);
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
      <div className="flex h-dvh bg-background flex-col">
        <div className="flex flex-col min-w-0 size-full">
          <Messages
            chatId={id}
            status={status}
            votes={votes}
            messages={messages}
            setMessages={setMessages}
            regenerate={regenerate}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
          />

          <div className="shrink-0 mx-auto px-4 pt-6 bg-[#EFD9E9] pb-4 md:pb-6 w-full">
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
                />
              </form>
            )}
          </div>
        </div>
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
