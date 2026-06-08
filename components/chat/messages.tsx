import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isLoading,
  selectedModelId: _selectedModelId,
  onEditMessage,
}: MessagesProps) {
  useDataStream();

  const [hasSentMessage, setHasSentMessage] = useState(false);

  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  return (
    <Conversation
      className={cn(
        "relative flex-1 bg-background",
        isArtifactVisible && "no-scrollbar"
      )}
      key={chatId}
    >
      {messages.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Greeting />
        </div>
      )}

      <ConversationContent
        className={cn(
          "mx-auto min-w-0 max-w-4xl gap-5 px-2 py-6 md:gap-7 md:px-4 stagger-children scroll-smooth",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
      >
        {messages.map((message, index) => (
          <PreviewMessage
            addToolApprovalResponse={addToolApprovalResponse}
            chatId={chatId}
            isLoading={status === "streaming" && messages.length - 1 === index}
            isReadonly={isReadonly}
            key={message.id}
            message={message}
            onEdit={onEditMessage}
            regenerate={regenerate}
            requiresScrollPadding={
              hasSentMessage && index === messages.length - 1
            }
            setMessages={setMessages}
            vote={
              votes
                ? votes.find((vote) => vote.messageId === message.id)
                : undefined
            }
          />
        ))}

        {status === "submitted" && messages.at(-1)?.role !== "assistant" && (
          <ThinkingMessage />
        )}
      </ConversationContent>

      <ConversationScrollButton />
    </Conversation>
  );
}

export const Messages = PureMessages;
