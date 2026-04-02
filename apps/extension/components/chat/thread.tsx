"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import type { AppModelId } from "@/lib/types";
import { ContextDisplay } from "./context-display";
import { MessageTiming } from "./message-timing";
import { ModelSelector } from "./model-selector";
import { ToolCallCard } from "./tool-call-card";

export function Thread({
  selectedModel,
  onModelChange,
  usedTokens,
  maxTokens,
}: {
  selectedModel: AppModelId;
  onModelChange: (model: AppModelId) => void;
  usedTokens: number;
  maxTokens: number;
}) {
  return (
    <ThreadPrimitive.Root className="thread-panel">
      <div className="thread-toolbar">
        <ModelSelector value={selectedModel} onChange={onModelChange} />
        <ContextDisplay usedTokens={usedTokens} maxTokens={maxTokens} />
      </div>

      <ThreadPrimitive.Viewport
        autoScroll
        turnAnchor="bottom"
        className="thread-viewport"
      >
        <ThreadPrimitive.Messages>
          {() => (
            <MessagePrimitive.Root className="message-bubble">
              <div className="message-header">
                <span>
                  <MessagePrimitive.If user>User</MessagePrimitive.If>
                  <MessagePrimitive.If assistant>Assistant</MessagePrimitive.If>
                  <MessagePrimitive.If system>System</MessagePrimitive.If>
                </span>
                <BranchPickerPrimitive.Root className="branch-picker">
                  <BranchPickerPrimitive.Previous type="button">
                    Prev
                  </BranchPickerPrimitive.Previous>
                  <BranchPickerPrimitive.Count />
                  <BranchPickerPrimitive.Next type="button">
                    Next
                  </BranchPickerPrimitive.Next>
                </BranchPickerPrimitive.Root>
              </div>

              <MessagePrimitive.Parts
                components={{
                  Text: ({ text }) => <p className="message-text">{text}</p>,
                  Reasoning: ({ text }) => (
                    <pre className="message-reasoning">{text}</pre>
                  ),
                  tools: {
                    Fallback: ({ toolName, status, args, result, isError }) => (
                      <ToolCallCard
                        toolName={toolName}
                        status={status}
                        args={args}
                        result={result}
                        isError={isError}
                      />
                    ),
                  },
                }}
              />

              <ChainOfThoughtPrimitive.Root className="cot-root">
                <ChainOfThoughtPrimitive.AccordionTrigger
                  type="button"
                  className="cot-trigger"
                >
                  Show/Hide thinking
                </ChainOfThoughtPrimitive.AccordionTrigger>
                <div className="cot-parts">
                  <ChainOfThoughtPrimitive.Parts
                    components={{
                      Reasoning: ({ text }) => (
                        <pre className="message-reasoning">{text}</pre>
                      ),
                      tools: {
                        Fallback: ({ toolName, status, args, result, isError }) => (
                          <ToolCallCard
                            toolName={toolName}
                            status={status}
                            args={args}
                            result={result}
                            isError={isError}
                          />
                        ),
                      },
                    }}
                  />
                </div>
              </ChainOfThoughtPrimitive.Root>

              <ActionBarPrimitive.Root className="message-actions">
                <ActionBarPrimitive.Copy type="button">
                  Copy
                </ActionBarPrimitive.Copy>
                <ActionBarPrimitive.Reload type="button">
                  Retry
                </ActionBarPrimitive.Reload>
                <MessageTiming />
              </ActionBarPrimitive.Root>
            </MessagePrimitive.Root>
          )}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="composer">
        <ComposerPrimitive.Input
          autoFocus
          placeholder="Send a message..."
          className="composer-input"
        />
        <div className="composer-actions">
          <ComposerPrimitive.Cancel type="button">Stop</ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send type="button">Send</ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}
