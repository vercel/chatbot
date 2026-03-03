import { PreviewMessage, ThinkingMessage } from './message';
import { Checkpoint, CheckpointIcon } from './ai-elements';
import type { Vote } from '@/lib/db/schema';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import type { UIArtifact } from './artifact';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import type { ChatMessage } from '@/lib/types';

interface ArtifactMessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  isReadonly: boolean;
  artifactStatus: UIArtifact['status'];
  checkpointMessageIds?: Set<string>;
}

function PureArtifactMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  sendMessage,
  isReadonly,
  checkpointMessageIds,
}: ArtifactMessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
    messages,
  });

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col gap-4 h-full items-center overflow-y-auto px-6 pt-6"
    >
      {messages.map((message, index) => (
        <div key={message.id} className="w-full">
          {checkpointMessageIds?.has(message.id) && (
            <Checkpoint className="my-2">
              <CheckpointIcon />
              <span className="shrink-0 px-2 text-xs">Earlier messages summarized</span>
            </Checkpoint>
          )}
          <PreviewMessage
            chatId={chatId}
            message={message}
            isLoading={status === 'streaming' && index === messages.length - 1}
            vote={
              votes
                ? votes.find((vote) => vote.messageId === message.id)
                : undefined
            }
            setMessages={setMessages}
            regenerate={regenerate}
            sendMessage={sendMessage}
            isReadonly={isReadonly}
            isArtifactVisible={true}
            requiresScrollPadding={
              hasSentMessage && index === messages.length - 1
            }
          />
        </div>
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

function areEqual(
  prevProps: ArtifactMessagesProps,
  nextProps: ArtifactMessagesProps,
) {
  if (
    prevProps.artifactStatus === 'streaming' &&
    nextProps.artifactStatus === 'streaming'
  )
    return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.checkpointMessageIds?.size !== nextProps.checkpointMessageIds?.size) return false;

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
