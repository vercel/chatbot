'use client';

import type { ChatMessage, Attachment } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Dispatch, SetStateAction } from 'react';
import { MultimodalInput } from './multimodal-input';

interface BenefitApplicationsLandingProps {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isReadonly: boolean;
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

export function BenefitApplicationsLanding({
  input,
  setInput,
  isReadonly,
  chatId,
  sendMessage,
  selectedVisibilityType,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
}: BenefitApplicationsLandingProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-chat-background">
      <div className="max-w-4xl w-full text-left">
        {/* Main Title */}
        <h1 className="text-[64px] font-serif leading-[1.15] text-black dark:text-white mb-16">
          What program would you like to apply for?
        </h1>

        {/* Input Form */}
        <div className="mb-8 max-w-4xl mx-auto">
          <MultimodalInput
            chatId={chatId}
            input={input}
            setInput={setInput}
            status={status}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            setMessages={setMessages}
            sendMessage={sendMessage}
            selectedVisibilityType={selectedVisibilityType}
          />
        </div>
      </div>
    </div>
  );
}
