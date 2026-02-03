'use client';

import type { ChatMessage, Attachment } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Dispatch, SetStateAction } from 'react';
import type { Session } from 'next-auth';
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
  session: Session | null;
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
  session,
}: BenefitApplicationsLandingProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-8 pt-8 sm:pt-12 md:pt-16 bg-chat-background overflow-hidden">
      <div className="max-w-4xl w-full text-left px-0 sm:px-4 min-w-0">
        {/* Main Title */}
        <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-[64px] font-source-serif leading-[1.15] text-black dark:text-white mb-4 sm:mb-6 md:mb-12 break-words">
          Let&apos;s start a new application.
        </h1>

        {/* Subheader */}
        {/* TODO: When the suggested actions are gone switch back to mb-6 sm:mb-8 md:mb-12*/}
        <h2 className="text-base sm:text-lg md:text-2xl font-inter text-black dark:text-white mb-4 sm:mb-6 md:mb-8">
          What&apos;s your client&apos;s Apricot ID number and which program are they applying for?
        </h2>

        {/* Input Form */}
        <div className="mb-4 sm:mb-6 md:mb-8 w-full max-w-4xl min-w-0">
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
            showStopButton={false}
            placeholder="Ex. Retrieve ID# and fill in https://riversideihss.org/IntakeApp"
            session={session}
          />
        </div>
      </div>
    </div>
  );
}
