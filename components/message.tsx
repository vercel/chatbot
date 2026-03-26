'use client';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { CollapsibleWrapper } from './ui/collapsible-wrapper';
import { getToolDisplayInfo } from './tool-icon';
import { Spinner } from './ui/spinner';
import { UserActionConfirmation, GapAnalysisCard, FormSummaryCard, CheckpointCard } from './ai-elements';
import type { CheckpointData } from './chat';
import { groupMessageParts, ToolCallGroup } from './tool-call-group';

// Responsive min-height calculation that accounts for side-chat-header height
// This ensures the last message has enough space to scroll properly with the header
const RESPONSIVE_MIN_HEIGHT = 'min-h-[calc(100vh-22rem)] md:min-h-[calc(100vh-24rem)] lg:min-h-[calc(100vh-26rem)]';

// Keywords that indicate the agent is asking the caseworker to intervene
const USER_ACTION_KEYWORDS = [
  'take control',
  'user intervention',
  'complete the application',
  'form is complete',
  'ready for submission',
  'submit the form',
  'please submit',
  'you can now submit',
  'ready to submit',
  'go ahead and submit',
  'proceed to submit',
  'form is all yours'
];

// Parse partner data from XML-wrapped content in user messages
function parsePartnerData(text: string): { participantData: any; taskText: string } | null {
  const match = text.match(/<partner_context>[\s\S]*?<participant_data>([\s\S]*?)<\/participant_data>[\s\S]*?<\/partner_context>\s*([\s\S]*)/);
  if (!match) return null;

  const jsonData = match[1].trim();
  const taskText = match[2].trim();

  let parsedData;
  try {
    parsedData = JSON.parse(jsonData);
    delete parsedData.task;
    delete parsedData.request;
  } catch {
    parsedData = jsonData;
  }

  return { participantData: parsedData, taskText };
}

// Type narrowing is handled by TypeScript's control flow analysis
// The AI SDK provides proper discriminated unions for tool calls

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  isCompacting,
  checkpoints,
  setMessages,
  regenerate,
  sendMessage,
  isReadonly,
  isArtifactVisible,
  requiresScrollPadding,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  isCompacting?: boolean;
  checkpoints?: CheckpointData[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [dismissedActionConfirmations, setDismissedActionConfirmations] = useState<Set<string>>(new Set());

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === 'file',
  );

  // Suppress "action required" card when the message contains a gap analysis tool
  // (the gap analysis card itself IS the user action — don't show a duplicate prompt)
  const hasGapAnalysis = message.parts.some(
    (part) => (part.type as string) === 'tool-gapAnalysis',
  );

  useDataStream();

  // Dismiss all action confirmations when user sends a new message
  useEffect(() => {
    const handleNewUserMessage = () => {
      setDismissedActionConfirmations((prev) => new Set([...prev, message.id]));
    };

    window.addEventListener('new-user-message', handleNewUserMessage);
    return () => {
      window.removeEventListener('new-user-message', handleNewUserMessage);
    };
  }, [message.id]);

  const processedParts = useMemo(
    () => groupMessageParts(message.parts ?? []),
    [message.parts],
  );

  const lastToolGroupIdx = useMemo(
    () => processedParts.reduce((last, p, i) => (p.kind === 'tool-group' ? i : last), -1),
    [processedParts],
  );

  // Map each checkpoint to the processed-part index it should render after.
  // We use the stepNumber from the checkpoint event to find the Nth step-start
  // in the original parts, then map that part index to the processed-part index.
  const checkpointsByProcessedIndex = useMemo(() => {
    if (!checkpoints?.length || !processedParts.length) return new Map<number, CheckpointData[]>();
    const parts = message.parts ?? [];

    const map = new Map<number, CheckpointData[]>();
    for (const cp of checkpoints) {
      // Find the original part index of the step-start for this checkpoint's stepNumber.
      // step-start parts are 0-indexed: the first step-start is step 0.
      let stepCount = 0;
      let checkpointPartIndex = parts.length; // default: end of parts
      for (let i = 0; i < parts.length; i++) {
        if ((parts[i] as any).type === 'step-start') {
          if (stepCount === cp.stepNumber) {
            checkpointPartIndex = i;
            break;
          }
          stepCount++;
        }
      }

      // Now find the processed-part index that contains or immediately precedes
      // the checkpointPartIndex.
      let bestIdx = processedParts.length - 1;
      for (let i = 0; i < processedParts.length; i++) {
        const p = processedParts[i];
        const startIdx = p.kind === 'tool-group' ? p.startIndex : p.index;
        if (startIdx >= checkpointPartIndex) {
          bestIdx = Math.max(0, i - 1);
          break;
        }
      }

      const existing = map.get(bestIdx) ?? [];
      existing.push(cp);
      map.set(bestIdx, existing);
    }
    return map;
  }, [checkpoints, processedParts, message.parts]);

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >

          <div
            className={cn('flex flex-col gap-4 w-full', {
              [RESPONSIVE_MIN_HEIGHT]: message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {attachmentsFromMessage.length > 0 && (
              <div
                data-testid={`message-attachments`}
                className="flex flex-row justify-end gap-2"
              >
                {attachmentsFromMessage.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={{
                      name: attachment.filename ?? 'file',
                      contentType: attachment.mediaType,
                      url: attachment.url,
                    }}
                  />
                ))}
              </div>
            )}

            {processedParts.map((processed, processedIdx) => {
              const cpCards = checkpointsByProcessedIndex.get(processedIdx);

              if (processed.kind === 'tool-group') {
                return (
                  <div key={`message-${message.id}-group-${processed.startIndex}`}>
                    <ToolCallGroup
                      parts={processed.parts as any}
                      isStreaming={isLoading && processedIdx === lastToolGroupIdx}
                    />
                    {cpCards?.map((cp, i) => (
                      <CheckpointCard key={`checkpoint-${cp.stepNumber}-${i}`} summary={cp.summary} />
                    ))}
                  </div>
                );
              }

              const { index } = processed;
              const part = processed.part as ChatMessage['parts'][number];
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning' && part.text?.trim().length > 0) {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.text}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  const partnerData = parsePartnerData(part.text);

                  if (partnerData && message.role === 'user') {
                    return (
                      <div key={key} className="flex flex-col gap-2 items-end w-full">
                        {partnerData.taskText && (
                          <div
                            data-testid="message-content"
                            className="bg-accent dark:bg-muted text-foreground dark:text-foreground px-[18px] py-[18px] rounded-xl text-xs leading-[18px] font-inter"
                          >
                            <Markdown>{sanitizeText(partnerData.taskText)}</Markdown>
                          </div>
                        )}
                        <CollapsibleWrapper
                          displayName="Participant data from partner"
                          output={partnerData.participantData}
                        />
                      </div>
                    );
                  }

                  const textContent = part.text.toLowerCase();
                  const requiresUserAction = USER_ACTION_KEYWORDS.some(
                    (keyword) => textContent.includes(keyword),
                  );

                  return (
                    <div key={key} className="flex flex-col gap-3">
                      <div className="flex flex-row gap-2 items-start">
                        {/* {message.role === 'user' && !isReadonly && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                data-testid="message-edit-button"
                                variant="ghost"
                                className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                                onClick={() => {
                                  setMode('edit');
                                }}
                              >
                                <PencilEditIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit message</TooltipContent>
                          </Tooltip>
                        )} */}

                        <div
                          data-testid="message-content"
                          className={cn('flex flex-col gap-4', {
                            'bg-accent dark:bg-muted text-foreground dark:text-foreground px-[18px] py-[18px] rounded-xl text-xs leading-[18px] font-inter':
                              message.role === 'user',
                            'assistant-message-bubble font-source-serif':
                              message.role === 'assistant',
                          })}
                        >
                          <Markdown>{sanitizeText(part.text)}</Markdown>
                        </div>
                      </div>
                      
                      {message.role === 'assistant' && requiresUserAction && !hasGapAnalysis && !isReadonly && !isLoading && !dismissedActionConfirmations.has(message.id) && isArtifactVisible && (
                        <UserActionConfirmation
                          approval={{ id: `action-${message.id}`, approved: undefined }}
                          state="approval-requested"
                          requestMessage='Manual action required to proceed.'
                          onApprove={(approvalId) => {
                            // Trigger browser control switch to user mode
                            const event = new CustomEvent('switch-browser-control', { 
                              detail: { mode: 'user' } 
                            });
                            window.dispatchEvent(event);
                          }}
                          // onReject={(approvalId) => {
                          //   // Dismiss the confirmation by adding message.id to the dismissed set
                          //   setDismissedActionConfirmations((prev) => new Set([...prev, message.id]));
                          // }}
                        />
                      )}
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        regenerate={regenerate}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-getWeather') {
                const { toolCallId, state } = part;

                if (state === 'input-available') {
                  return (
                    <div key={toolCallId} className="skeleton">
                      <Weather />
                    </div>
                  );
                }

                if (state === 'output-available') {
                  const { output } = part;
                  return (
                    <div key={toolCallId}>
                      <Weather weatherAtLocation={output} />
                    </div>
                  );
                }
              }

              if (type === 'tool-createDocument') {
                const { toolCallId, state } = part;

                if (state === 'input-available') {
                  const { input } = part;
                  return (
                    <div key={toolCallId}>
                      <DocumentPreview isReadonly={isReadonly} args={input} />
                    </div>
                  );
                }

                if (state === 'output-available') {
                  const { output } = part;

                  if ('error' in output) {
                    return (
                      <div
                        key={toolCallId}
                        className="text-red-500 p-2 border rounded"
                      >
                        Error: {String(output.error)}
                      </div>
                    );
                  }

                  return (
                    <div key={toolCallId}>
                      <DocumentPreview
                        isReadonly={isReadonly}
                        result={output}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-updateDocument') {
                const { toolCallId, state } = part;

                if (state === 'input-available') {
                  const { input } = part;

                  return (
                    <div key={toolCallId}>
                      <DocumentToolCall
                        type="update"
                        args={input}
                        isReadonly={isReadonly}
                      />
                    </div>
                  );
                }

                if (state === 'output-available') {
                  const { output } = part;

                  if ('error' in output) {
                    return (
                      <div
                        key={toolCallId}
                        className="text-red-500 p-2 border rounded"
                      >
                        Error: {String(output.error)}
                      </div>
                    );
                  }

                  return (
                    <div key={toolCallId}>
                      <DocumentToolResult
                        type="update"
                        result={output}
                        isReadonly={isReadonly}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-requestSuggestions') {
                const { toolCallId, state } = part;

                if (state === 'input-available') {
                  const { input } = part;
                  return (
                    <div key={toolCallId}>
                      <DocumentToolCall
                        type="request-suggestions"
                        args={input}
                        isReadonly={isReadonly}
                      />
                    </div>
                  );
                }

                if (state === 'output-available') {
                  const { output } = part;

                  if ('error' in output) {
                    return (
                      <div
                        key={toolCallId}
                        className="text-red-500 p-2 border rounded"
                      >
                        Error: {String(output.error)}
                      </div>
                    );
                  }

                  return (
                    <div key={toolCallId}>
                      <DocumentToolResult
                        type="request-suggestions"
                        result={output}
                        isReadonly={isReadonly}
                      />
                    </div>
                  );
                }
              }

              if ((type as string) === 'tool-gapAnalysis') {
                const { toolCallId, state, input } = part as any;

                if (state === 'input-available' || state === 'output-available') {
                  return (
                    <GapAnalysisCard
                      key={toolCallId}
                      formName={input?.formName}
                      missingFields={input?.missingFields ?? []}
                      sendMessage={sendMessage}
                    />
                  );
                }
              }

              if ((type as string) === 'tool-formSummary') {
                const { toolCallId, state, input } = part as any;

                if (state === 'input-available' || state === 'output-available') {
                  return (
                    <FormSummaryCard
                      key={toolCallId}
                      formName={input?.formName}
                      fields={input?.fields ?? []}
                      sendMessage={sendMessage}
                      isArtifactVisible={isArtifactVisible}
                    />
                  );
                }
              }

              // Handle any other tool calls (including web automation tools)
              if (type.startsWith('tool-') && !['tool-getWeather', 'tool-createDocument', 'tool-updateDocument', 'tool-requestSuggestions', 'tool-gapAnalysis', 'tool-formSummary'].includes(type)) {
                const { toolCallId, state } = part as any;

                if (state === 'input-available') {
                  const { input } = part as any;
                  const { text: displayName, icon: Icon } = getToolDisplayInfo(type, input);

                  if (displayName === 'Executed JavaScript' || displayName.startsWith('Loaded ')) {
                    return;
                  }
                  // Only use CollapsibleWrapper for get-participant-with-household
                  if (displayName === 'GetApricotRecord') {
                    return (
                      <CollapsibleWrapper key={toolCallId} displayName={displayName} input={input} icon={Icon} />
                    );
                  }

                  // For all other tools, show simple icon with text
                  return (
                    <div key={toolCallId} className="flex items-center gap-2 p-3 border-0 rounded-md">
                      <div className="text-[10px] leading-[150%] font-ibm-plex-mono text-muted-foreground flex items-center gap-2">
                        {Icon && (
                          <Icon size={12} className="text-gray-500 shrink-0" />
                        )}
                        {displayName}
                      </div>
                    </div>
                  );
                }

                if (state === 'output-available') {
                  const { output, input } = part as any;
                  const { text: displayName, icon: Icon } = getToolDisplayInfo(type, input);

                  if (displayName === 'Executed JavaScript' || displayName.startsWith('Loaded ')) {
                    return;
                  }

                  // Only use CollapsibleWrapper for get-participant-with-household
                  if (displayName === 'GetApricotRecord') {
                    // Check for actual error value, not just presence of 'error' key
                    const hasParticipantError = output && 'error' in output && output.error;
                    return (
                      <CollapsibleWrapper
                        key={toolCallId}
                        displayName={displayName}
                        input={input}
                        output={output}
                        isError={hasParticipantError}
                        icon={Icon}
                      />
                    );
                  }

                  // For all other tools, show simple icon with text
                  // Check for actual error value, not just presence of 'error' key (some tools return { error: null } on success)
                  const hasError = output && 'error' in output && output.error;
                  return (
                    <div key={toolCallId} className="flex items-center gap-2 p-3 border-0 rounded-md">
                      <div className={`text-[10px] leading-[150%] font-ibm-plex-mono flex items-center gap-2 ${hasError ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {Icon && (
                          <Icon size={12} className="text-gray-500 shrink-0" />
                        )}
                        {displayName}
                        {hasError && ' (Error)'}
                      </div>
                    </div>
                  );
                }
              }
            })}

            {/* Render any checkpoint cards that weren't placed within a tool-group */}
            {checkpoints?.filter((cp) => {
              // Check if this checkpoint was already rendered inside a tool-group
              for (const [, cps] of checkpointsByProcessedIndex) {
                if (cps.includes(cp)) return false;
              }
              return true;
            }).map((cp, i) => (
              <CheckpointCard key={`checkpoint-unplaced-${i}`} summary={cp.summary} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 border-0 rounded-md">
                <div className="text-[10px] leading-[150%] font-ibm-plex-mono text-muted-foreground flex items-center gap-2">
                  <Spinner className="size-3 shrink-0 text-primary" />
                  {isCompacting ? 'Summarizing the conversation...' : 'Processing...'}
                </div>
              </div>
            )}

            {/* {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )} */}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return false;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <motion.div
      ref={messageRef}
      data-testid="message-assistant-loading"
      className={`w-full mx-auto max-w-3xl px-4 group/message ${RESPONSIVE_MIN_HEIGHT}`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 assistant-message-bubble">
            Hmm...
          </div>
        </div>
      </div>
    </motion.div>
  );
};