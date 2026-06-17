"use client";
import { useMemo } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { Shimmer } from "../ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "../ai-elements/tool";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { StreamingIndicator, detectStreamPhase } from "./streaming-indicator";
import { ToolResultRenderer } from "./tool-result-renderer";
import { Weather } from "./weather";
import { UniversalConnectorCard } from "@/components/generative/universal-connector-card";
import { MissionCard } from "@/components/generative/mission-card";
import { HandoffCard } from "@/components/generative/handoff-card";
import {
  groupToolCalls,
  CollapsedToolGroup,
  ToolCallDensityGauge,
  type ToolPartLike,
  type ToolCallGroup,
} from "./tool-call-grouper";
import { useChatSettings } from "./chat-settings-provider";

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages: _setMessages,
  regenerate: _regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();
  const { showAllToolCalls } = useChatSettings();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      (part.type === "reasoning" &&
        "text" in part &&
        part.text?.trim().length > 0) ||
      part.type.startsWith("tool-")
  );
  const isThinking = isAssistant && isLoading && !hasAnyContent;

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          rendered: false,
        };
      }
      return acc;
    },
    { text: "", isStreaming: false, rendered: false }
  ) ?? { text: "", isStreaming: false, rendered: false };

  // U1.1: Pre-compute tool call collapse groups
  // Groups of 3+ same-tool calls get collapsed after 2nd call
  // When showAllToolCalls is enabled, no collapse happens
  const collapseInfo = useMemo(() => {
    if (showAllToolCalls) {
      return { hiddenToolCallIds: new Set<string>(), summaryInsertIndex: new Map() };
    }
    const rawParts = message.parts || [];
    const groups = groupToolCalls(rawParts as ToolPartLike[]);
    const hiddenToolCallIds = new Set<string>();
    const summaryInsertIndex = new Map<number, ToolCallGroup>();

    for (const item of groups) {
      if (item.kind === "tool-group") {
        const { group } = item;
        const shownCount = group.collapseAfter;
        for (let i = shownCount; i < group.parts.length; i++) {
          const p = group.parts[i];
          if (p.toolCallId) hiddenToolCallIds.add(p.toolCallId);
        }
        // Insert collapse summary at the position of the first hidden part
        const firstHidden = group.parts[shownCount];
        if (firstHidden?.index !== undefined) {
          summaryInsertIndex.set(firstHidden.index, group);
        }
      }
    }
    return { hiddenToolCallIds, summaryInsertIndex };
  }, [message.parts, showAllToolCalls]);

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      if (!mergedReasoning.rendered && mergedReasoning.text) {
        mergedReasoning.rendered = true;
        return (
          <MessageReasoning
            isLoading={isLoading || mergedReasoning.isStreaming}
            key={key}
            reasoning={mergedReasoning.text}
          />
        );
      }
      return null;
    }

    if (type === "text") {
      return (
        <MessageContent
          className={cn("text-[13px] leading-[1.65]", {
            "w-fit max-w-[min(80%,56ch)] overflow-hidden break-words rounded-2xl rounded-br-lg border border-border/30 bg-gradient-to-br from-secondary to-muted px-3.5 py-2 shadow-[var(--shadow-card)]":
              message.role === "user",
          })}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
        </MessageContent>
      );
    }

    if (type === "tool-getWeather") {
      const { toolCallId, state } = part;
      const approvalId = (part as { approval?: { id: string } }).approval?.id;
      const isDenied =
        state === "output-denied" ||
        (state === "approval-responded" &&
          (part as { approval?: { approved?: boolean } }).approval?.approved ===
            false);
      const widthClass = "w-[min(100%,450px)]";

      if (state === "output-available") {
        // Phase 24B: If output uses standard connector envelope, render UniversalConnectorCard
        const output = part.output as Record<string, unknown> | undefined;
        if (output && typeof output === "object" && "connectorType" in output && "data" in output) {
          return (
            <div className={widthClass} key={toolCallId}>
              <UniversalConnectorCard
                connector={output.connectorType as string}
                type={output.schemaVersion ? `schema-v${output.schemaVersion}` : "default"}
                data={output.data as Record<string, unknown>}
              />
            </div>
          );
        }
        return (
          <div className={widthClass} key={toolCallId}>
            <Weather weatherAtLocation={part.output} />
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={false}>
              <ToolHeader state="output-denied" type="tool-getWeather" />
              <ToolContent>
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  Weather lookup was denied.
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }

      if (state === "approval-responded") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={false}>
              <ToolHeader state={state} type="tool-getWeather" />
              <ToolContent>
                <ToolInput input={part.input} />
              </ToolContent>
            </Tool>
          </div>
        );
      }

      return (
        <div className={widthClass} key={toolCallId}>
          <Tool className="w-full" defaultOpen={false}>
            <ToolHeader state={state} type="tool-getWeather" />
            <ToolContent>
              {(state === "input-available" ||
                state === "approval-requested") && (
                <ToolInput input={part.input} />
              )}
              {state === "approval-requested" && approvalId && (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                  <button
                    className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                        reason: "User denied weather lookup",
                      });
                    }}
                    type="button"
                  >
                    Deny
                  </button>
                  <button
                    className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: true,
                      });
                    }}
                    type="button"
                  >
                    Allow
                  </button>
                </div>
              )}
            </ToolContent>
          </Tool>
        </div>
      );
    }

    if (type === "tool-createDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={toolCallId}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error updating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool
          className="w-[min(100%,450px)]"
          defaultOpen={false}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-red-500">
                      Error: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    // Generic tool-* handler — catches all inline tools (pullSlackMessages,
    // queryDatabase, fetchURL, readSkill, readPRD, listSkills, searchKnowledge,
    // runWorkflow, listV2Sessions, getV2Session, postV2Session, streamV2Progress,
    // controlV2Session, runScript, sandbox tools, MCP tools, etc.)
    if (type.startsWith("tool-")) {
      const toolPart = part as unknown as {
        toolCallId: string;
        state: string;
        input?: unknown;
        output?: unknown;
        errorText?: string;
      };
      const { toolCallId, state } = toolPart;

      // U1.1: Check if this tool call should be hidden (auto-collapsed)
      if (toolCallId && collapseInfo.hiddenToolCallIds.has(toolCallId)) {
        return null;
      }

      // U1.1: Insert collapse summary at the position of the first hidden part
      const collapseSummary = collapseInfo.summaryInsertIndex.get(index);

      const toolName = type.replace("tool-", "");
      const isError = state === "output-error";
      const isComplete = state === "output-available" || isError;
      const isStreaming = state === "input-streaming";
      const isRunning = state === "input-available";

      // For user-facing display, convert camelCase to Title Case with spaces
      const displayName = toolName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .replace(/V 2/g, "V2")
        .replace(/Prd/g, "PRD")
        .replace(/Url/g, "URL")
        .replace(/Mcp/g, "MCP")
        .trim();

      const toolCard = (
        <Tool
          className={cn(
            "w-[min(100%,550px)]",
            collapseSummary && "opacity-0 h-0 overflow-hidden pointer-events-none"
          )}
          defaultOpen={false}
          key={toolCallId}
        >
          <ToolHeader
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state={state as any}
            title={displayName}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type={type as any}
          />
          <ToolContent>
            {(isStreaming || isRunning || isComplete) &&
            toolPart.input != null ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <ToolInput input={toolPart.input as any} />
            ) : null}
            {isComplete && (
              <>
                {/* Phase 25+24B: Render MissionCard for createMission, UniversalConnectorCard for envelopes, else ToolResultRenderer */}
                {toolName === "createMission" &&
                toolPart.output &&
                typeof toolPart.output === "object" &&
                "missionId" in toolPart.output ? (
                  <MissionCard
                    mission={{
                      missionId: (toolPart.output as Record<string, unknown>).missionId as string,
                      title: (toolPart.output as Record<string, unknown>).title as string,
                      status: ((toolPart.output as Record<string, unknown>).status as string) || "running",
                      steps: ((toolPart.output as Record<string, unknown>).steps || []) as Array<{
                        id: string;
                        name: string;
                        status: "pending" | "running" | "complete" | "failed";
                        evidence: string[];
                        childCards?: unknown[];
                        type?: string;
                      }>,
                      estimatedCost: (toolPart.output as Record<string, unknown>).estimatedCost as number,
                      estimatedTime: (toolPart.output as Record<string, unknown>).estimatedTime as number,
                    }}
                  />
                ) : (toolName === "spawnCodingAgent" || toolName === "spawnCodingAgent") &&
                  toolPart.output &&
                  typeof toolPart.output === "object" &&
                  "handoff" in toolPart.output ? (
                  <HandoffCard
                    handoff={(toolPart.output as Record<string, unknown>).handoff as {
                      sessionId: string;
                      mode: string;
                      goal: string;
                      status: "spawning" | "running" | "ready_for_preview" | "ready_to_merge" | "completed" | "failed";
                      branch?: string;
                      prUrl?: string;
                      deployUrl?: string;
                      sandboxUrl?: string;
                      repo?: string;
                      progress?: number;
                      errorMessage?: string;
                      v2DirectUrl?: string;
                      libraryUrl?: string;
                    }}
                  />
                ) : toolPart.output &&
                  typeof toolPart.output === "object" &&
                  "connectorType" in toolPart.output &&
                  "data" in toolPart.output ? (
                  <UniversalConnectorCard
                    connector={(toolPart.output as Record<string, unknown>).connectorType as string}
                    type={
                      (toolPart.output as Record<string, unknown>).schemaVersion
                        ? `schema-v${(toolPart.output as Record<string, unknown>).schemaVersion}`
                        : "default"
                    }
                    data={(toolPart.output as Record<string, unknown>).data as Record<string, unknown>}
                  />
                ) : (
                  <ToolResultRenderer
                    part={
                      {
                        type: "dynamic-tool",
                        toolName,
                        state: toolPart.state,
                        output: toolPart.output,
                        errorText: toolPart.errorText,
                      } as any
                    }
                  />
                )}
              </>
            )}
          </ToolContent>
        </Tool>
      );

      // If this position has a collapse summary, render it AFTER the last visible card
      if (collapseSummary) {
        return (
          <div key={`collapse-group-${toolCallId}`}>
            {toolCard}
            <CollapsedToolGroup
              group={collapseSummary}
              renderPart={(hiddenPart) => {
                const hp = hiddenPart as unknown as {
                  toolCallId: string;
                  state: string;
                  input?: unknown;
                  output?: unknown;
                  errorText?: string;
                };
                const hToolName = collapseSummary!.toolName;
                const hDisplayName = collapseSummary!.displayName;
                const hIsComplete = hp.state === "output-available" || hp.state === "output-error";
                return (
                  <Tool
                    className="w-[min(100%,550px)]"
                    defaultOpen={false}
                    key={hp.toolCallId}
                  >
                    <ToolHeader
                      state={hp.state as any}
                      title={hDisplayName}
                      type={type as any}
                    />
                    <ToolContent>
                      {hp.input != null && <ToolInput input={hp.input as any} />}
                      {hIsComplete && (
                        <ToolResultRenderer
                          part={
                            {
                              type: "dynamic-tool",
                              toolName: hToolName,
                              state: hp.state,
                              output: hp.output,
                              errorText: hp.errorText,
                            } as any
                          }
                        />
                      )}
                    </ToolContent>
                  </Tool>
                );
              }}
            />
          </div>
        );
      }

      return toolCard;
    }

    return null;
  });

  // Phase 25: Auto-detect "Send to V2" candidates
  const showSendToV2 = useMemo(() => {
    if (!isAssistant || isLoading) return false;
    const textParts = message.parts?.filter(
      (p) => p.type === "text" && typeof p.text === "string"
    ) || [];
    for (const part of textParts) {
      const text = (part as { text: string }).text;
      // Code blocks > 50 lines
      const codeBlockMatch = text.match(/```[\s\S]*?```/g);
      if (codeBlockMatch) {
        for (const block of codeBlockMatch) {
          if (block.split("\n").length > 50) return true;
        }
      }
      // Mentions multi-file or create file or refactor
      if (
        /\b(multi.?file|create.?file|refactor.?entire|build.?a|generate.?code|scaffold)\b/i.test(
          text
        )
      ) {
        return true;
      }
    }
    return false;
  }, [message.parts, isAssistant, isLoading]);

  const actions = !isReadonly && (
    <div className="flex flex-wrap items-center gap-2">
      <MessageActions
        chatId={chatId}
        isLoading={isLoading}
        key={`action-${message.id}`}
        message={message}
        onEdit={onEdit ? () => onEdit(message) : undefined}
        vote={vote}
      />
      {showSendToV2 && (
        <button
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 hover:bg-purple-500/20 transition-colors"
          title="Send this code task to Neptune V2 for execution"
          onClick={() => {
            const inputEl = document.querySelector('[data-testid="chat-input"]') as HTMLTextAreaElement;
            if (inputEl) {
              inputEl.value = "spawnCodingAgent with mode=modify_existing goal=Implement the code changes from the last message";
              inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }}
        >
          🚀 Send to V2
        </button>
      )}
    </div>
  );

  // Detect stream phase for indicator
  const streamPhase = isAssistant && isLoading
    ? detectStreamPhase(message.parts)
    : { phase: "idle" as const };

  const content = isThinking ? (
    <div className="flex h-[calc(13px*1.65)] items-center text-[13px] leading-[1.65]">
      <Shimmer className="font-medium" duration={1}>
        Thinking...
      </Shimmer>
    </div>
  ) : (
    <>
      {attachments}
      {parts}
      {/* Streaming phase indicator */}
      {streamPhase.phase !== "idle" && (
        <StreamingIndicator
          phase={streamPhase.phase}
          toolName={streamPhase.toolName}
        />
      )}
      {/* U1.1: Tool call density gauge */}
      <ToolCallDensityGauge />
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser ? "flex flex-col items-end gap-2" : "flex items-start gap-3"
        )}
      >
        {isAssistant && (
          <div className="flex h-[calc(13px*1.65)] shrink-0 items-center">
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
              <SparklesIcon size={13} />
            </div>
          </div>
        )}
        {isAssistant ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">{content}</div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[calc(13px*1.65)] shrink-0 items-center">
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
            <SparklesIcon size={13} />
          </div>
        </div>

        <div className="flex h-[calc(13px*1.65)] items-center text-[13px] leading-[1.65]">
          <Shimmer className="font-medium" duration={1}>
            Thinking...
          </Shimmer>
        </div>
      </div>
    </div>
  );
};
