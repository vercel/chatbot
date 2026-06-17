import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { getAvailableTools } from "@/lib/agent/inline-tools";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { routeModel } from "@/lib/ai/model-router";
import { type RequestHints, isProgressiveDisclosureEnabled, systemPrompt } from "@/lib/ai/prompts";
import { progressiveTools } from "@/lib/ai/tools/progressive-disclosure";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { createMission } from "@/lib/ai/tools/create-mission";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { getNmiTransaction } from "@/lib/ai/tools/get-nmi-transaction";
import { pullSlackThread } from "@/lib/ai/tools/pull-slack-thread";
import { pullSlackChannelHistory } from "@/lib/ai/tools/pull-slack-channel-history";
import { searchSlackMessages, listSlackChannels } from "@/lib/ai/tools/search-slack-messages";
import { runDiscoveryWorkflow } from "@/lib/ai/tools/run-discovery-workflow";
import { bulkNmiQuery } from "@/lib/ai/tools/bulk-nmi-query";
import { bulkBase44Pull } from "@/lib/ai/tools/bulk-base44-pull";
import { getCustomerProfile } from "@/lib/ai/tools/get-customer-profile";
import { getVapiCall } from "@/lib/ai/tools/get-vapi-call";
import { getGithubPr } from "@/lib/ai/tools/get-github-pr";
import { getVercelDeploy } from "@/lib/ai/tools/get-vercel-deploy";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { getMCPToolNames, getMCPTools } from "@/lib/mcp/client";
import { checkIpRateLimit } from "@/lib/ratelimit";
import { sandboxTools } from "@/lib/sandbox/tools";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { discoverActionGroup } from "@/lib/playbook-os-client";
import { swarmDispatchTool } from "@/lib/ai/tools/swarm-dispatch";
import { loadPlaybooksForIntent, formatPlaybookContext } from "@/lib/ai/playbook-loader";
import {
  createTokenTracker,
  estimateMessageTokens,
  generateCheckpointSummary,
} from "@/lib/ai/token-tracker";
import { classifyIntentSync } from "@/lib/chat/intent-classifier";
import { classifyMessage, dispatchToDiscovery } from "@/lib/chat/router";

export const maxDuration = 300;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType, fusionMode, fusionPresetName } =
      requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const messageText = message?.parts
      ?.filter((p) => p.type === "text")
      ?.map((p) => p.text)
      ?.join(" ") ?? "";

    // ── Phase 38.5: Discovery Routing ──────────────────────────────────
    // Check if this is a bulk discovery operation BEFORE dispatching to LLM.
    // If so, route to the Phase 38 Discovery Engine instead of streamText.
    const discoveryClassification = message?.role === "user"
      ? classifyIntentSync(messageText)
      : null;

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : routeModel(messageText, null).modelId;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    // ── Phase 23A: Panel Mode — Multi-Agent Council Execution ──────────────────
    if (fusionMode === "panel" && fusionPresetName && message) {
      const userText = message.parts?.filter((p: Record<string, unknown>) => p.type === "text").map((p: Record<string, unknown>) => p.text).join(" ") ?? "";

      const panelStream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
          // Dynamic import to avoid bundling panel code when not used
          const { executePanel } = await import("@/lib/ai/fusion");
          const { getPresetByName } = await import("@/lib/ai/fusion/presets");

          const preset = getPresetByName(fusionPresetName);
          if (!preset) {
            dataStream.write({ type: "data-textDelta", data: `Panel preset "${fusionPresetName}" not found. Falling back to model mode.\n\n`, transient: false } as never);
            return;
          }

          const result = await executePanel({
            preset,
            messages: uiMessages.map((m) => ({
              role: m.role,
              content: m.parts?.filter((p: Record<string, unknown>) => p.type === "text").map((p: Record<string, unknown>) => p.text).join(" ") ?? "",
            })),
            onEvent: (event) => {
              // Forward panel events as data stream events
              if (event.type === "judge:token") {
                dataStream.write({ type: "data-textDelta", data: event.token, transient: false } as never);
              }
            },
            sessionId: id,
            userId: session.user.id,
          });

          dataStream.write({ type: "data-finish", finishReason: "stop" } as never);

          // Log telemetry via after()
          after(async () => {
            try {
              const { logPanelRun } = await import("@/lib/ai/fusion/telemetry");
              await logPanelRun({
                presetId: preset.id,
                presetName: preset.name,
                sessionId: id,
                userId: session.user.id,
                executionMode: "council",
                modeDecision: "auto",
                taskAnalysis: result.taskAnalysis,
                agentResponses: result.agentResponses,
                judgeResponse: result.judgeResponse,
                totalCost: result.totalCost,
                totalLatency: result.totalLatency,
                totalTokensIn: result.totalTokensIn,
                totalTokensOut: result.totalTokensOut,
                status: "completed",
              });
            } catch (err) {
              console.warn("[fusion] Telemetry log failed (non-fatal):", (err as Error).message);
            }
          });
        },
        generateId: generateUUID,
        onFinish: async ({ messages: finishedMessages }) => {
          if (finishedMessages.length > 0) {
            await saveMessages({
              messages: finishedMessages.map((currentMessage) => ({
                id: currentMessage.id,
                role: currentMessage.role,
                parts: currentMessage.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              })),
            });
          }

          if (titlePromise) {
            try {
              const title = await titlePromise;
              updateChatTitleById({ chatId: id, title });
            } catch (_) { /* non-fatal */ }
          }
        },
        onError: (error) => {
          console.error("[fusion-panel] Error:", error);
          return "Panel execution failed";
        },
      });

      return createUIMessageStreamResponse({ stream: panelStream });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    // Pre-fetch MCP tools (gracefully degrades if no MCP server configured)
    const [mcpToolNames, mcpTools] = await Promise.all([
      getMCPToolNames(),
      getMCPTools(),
    ]);

    const modelMessages = await convertToModelMessages(uiMessages);

    // V4: Discover relevant action groups for the user's task
    const userPrompt = uiMessages.filter(m => m.role === 'user').pop()?.parts?.find(p => p.type === 'text')?.text || '';
    const actionGroupCtx = typeof userPrompt === 'string'
      ? (await discoverActionGroup({ prompt: userPrompt }).catch(() => null)) ||
        formatPlaybookContext(loadPlaybooksForIntent(userPrompt))
      : null;

    // Phase 10-D: Token tracking — estimate tokens from message history
    const tokenTracker = createTokenTracker(
      chatModel,
      estimateMessageTokens(uiMessages as Array<{ role: string; parts: unknown }>, chatModel)
    );

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // ── Phase 38.5: Discovery Engine Routing (via lib/chat/router) ──────
        // If intent classifier detected a bulk discovery operation,
        // route to the Phase 38 Discovery Engine instead of using streamText.
        if (discoveryClassification?.isBulkIntent && discoveryClassification.workflowId) {
          const workflowId = discoveryClassification.workflowId;
          const config = discoveryClassification.extractedConfig as Record<string, unknown>;

          // Use the centralized router for dispatch
          const dispatchResult = await dispatchToDiscovery(workflowId, config);

          if (dispatchResult.success && dispatchResult.runId) {
            // Stream back a discovery mission card message
            const missionMessage = JSON.stringify({
              type: "discovery_mission",
              runId: dispatchResult.runId,
              workflowId,
              workflowName: dispatchResult.workflowName,
              estimatedDuration: dispatchResult.estimatedDuration,
              sseUrl: dispatchResult.sseUrl,
              confidence: discoveryClassification.confidence,
              reasoning: discoveryClassification.reasoning,
            });

            dataStream.write({
              type: "data-textDelta",
              data: `\n\n🔄 **Routing to Discovery Engine...**\n\n` +
                `Workflow: **${dispatchResult.workflowName}**\n` +
                `Run ID: \`${dispatchResult.runId}\`\n` +
                `Estimated: ${dispatchResult.estimatedDuration}\n\n` +
                `<!--DISCOVERY_MISSION:${missionMessage}-->\n\n`,
              transient: false,
            } as never);
          } else {
            // Discovery API failed — fall through to normal LLM flow
            dataStream.write({
              type: "data-textDelta",
              data: `\n\n⚠️ Discovery Engine unavailable — falling back to standard analysis.\n\n`,
              transient: false,
            } as never);
            // Continue to normal LLM flow below
          }

          // If we successfully routed, finish here
          dataStream.write({ type: "data-finish", finishReason: "stop" } as never);
          return;
        }

        // Phase 10-D: Send warning if >80% context window used
        if (tokenTracker.shouldWarn()) {
          dataStream.write({
            type: "data-textDelta",
            data: `\n\n${tokenTracker.getWarningMessage()}\n\n`,
            transient: false,
          } as any);
        }

        // Phase 12.C: Progressive Disclosure mode — minimal context + 3 loader tools
        const progressiveEnabled = isProgressiveDisclosureEnabled();

        const baseSystem = systemPrompt({
          requestHints,
          supportsTools,
          progressive: progressiveEnabled,
          presetName: fusionPresetName, // Phase 23B fix: pass preset to system prompt
        });
        const systemWithContext = progressiveEnabled
          ? baseSystem // Progressive mode: no connector catalog or action group context
          : actionGroupCtx
            ? `${baseSystem}\n\n${actionGroupCtx}`
            : baseSystem;

        // Tool configuration: progressive mode = only 3 loaders; normal mode = full suite
        const progressiveToolNames = ["load_playbook", "load_connector", "load_function"];
        const normalToolNames = isReasoningModel && !supportsTools
          ? []
          : [
              "getWeather",
              "createDocument",
              "editDocument",
              "updateDocument",
              "requestSuggestions",
              "createMission",
              "viewFile",
              "getNmiTransaction",
              "pullSlackThread",
              "pullSlackChannelHistory",
              "searchSlackMessages",
              "getCustomerProfile",
              "getVapiCall",
              "getGithubPr",
              "getVercelDeploy",
              "executeSkill",
              "listPlaybooks",
              "loadSkill",
              "selfCode",
              "spawnCodingAgent",
              "planSession",
              "swarmDispatch",
              "runDiscoveryWorkflow",
              "bulkNmiQuery",
              "bulkBase44Pull",
              "graphQuery",
              ...mcpToolNames,
            ];

        const activeToolNames = progressiveEnabled
          ? progressiveToolNames
          : normalToolNames;

        const normalTools = {
          getWeather,
          createDocument: createDocument({ session, dataStream, modelId: chatModel }),
          editDocument: editDocument({ dataStream, session }),
          updateDocument: updateDocument({ session, dataStream, modelId: chatModel }),
          requestSuggestions: requestSuggestions({ session, dataStream, modelId: chatModel }),
          createMission,
          getNmiTransaction,
          pullSlackThread,
          pullSlackChannelHistory,
          searchSlackMessages,
          getCustomerProfile,
          getVapiCall,
          getGithubPr,
          getVercelDeploy,
          swarmDispatch: swarmDispatchTool,
          runDiscoveryWorkflow,
          bulkNmiQuery,
          bulkBase44Pull,
          ...getAvailableTools(),
          ...sandboxTools,
          ...mcpTools,
        };

        const progressiveOnlyTools = {
          ...progressiveTools,
        };

        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemWithContext,
          messages: modelMessages,
          stopWhen: stepCountIs(20),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          experimental_activeTools: activeToolNames as any,
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          tools: progressiveEnabled
            ? progressiveOnlyTools
            : normalTools,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (_) {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        // Phase 10-D: Track actual token usage from finished messages
        const allMessages = [...(uiMessages || []), ...finishedMessages];
        tokenTracker.addMessageTokens(JSON.stringify(finishedMessages));

        // Phase 10-D: If >95% context window, save a checkpoint (non-blocking)
        if (tokenTracker.shouldCheckpoint()) {
          after(async () => {
            try {
              const checkpointId = generateUUID();
              const summary = generateCheckpointSummary(
                allMessages as Array<{ role: string; parts: unknown }>
              );
              const messageIds = finishedMessages.map((m) => m.id);

              // Save checkpoint to DB (table created by migration 0005)
              const { saveCheckpoint } = await import("@/lib/ai/token-tracker");
              await saveCheckpoint({
                id: checkpointId,
                chatId: id,
                userId: session?.user?.id ?? "anonymous",
                reason: "token_limit_95pct",
                tokenCount: tokenTracker.estimatedTokens,
                usagePercent: Math.round(tokenTracker.usageRatio * 100),
                conversationSummary: summary,
                messageIds,
                modelId: chatModel,
                contextWindow: tokenTracker.contextWindow,
              });

              console.log(`[checkpoint] Auto-saved checkpoint ${checkpointId} at ${tokenTracker.usageRatio * 100}% usage`);
            } catch (err) {
              console.warn("[checkpoint] Failed to save (non-fatal):", (err as Error).message);
            }
          });
        }

        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }

        // U7.2-U7.3: Session-end hook — collect raw log + trigger knowledge extraction (non-blocking)
        after(async () => {
          try {
            const lastAssistant = finishedMessages.findLast((m) => m.role === "assistant");
            const lastUser = finishedMessages.findLast((m) => m.role === "user");
            if (lastUser && lastAssistant) {
              const { collectRawLog } = await import("@/lib/raw-logs/collector");
              const { extractKnowledgeFromLog } = await import("@/lib/knowledge/extractor");

              const turnId = generateUUID();
              const userText = typeof lastUser.parts === "string"
                ? lastUser.parts
                : JSON.stringify(lastUser.parts);
              const assistantText = typeof lastAssistant.parts === "string"
                ? lastAssistant.parts
                : JSON.stringify(lastAssistant.parts);

              const logEntry = {
                sessionId: id,
                turnId,
                userId: session?.user?.id ?? "anonymous",
                userMessage: userText,
                systemPrompt: "",
                loadedPlaybook: "",
                outcomes: { success: true, durationMs: 0, errors: [] },
                finalResponse: assistantText,
              };

              await collectRawLog(logEntry);
              await extractKnowledgeFromLog({
                ...logEntry,
                id: turnId,
                sessionId: id,
                timestamp: new Date().toISOString(),
                userId: session?.user?.id ?? "anonymous",
                systemPromptHash: "",
                knowledgeQueries: [],
                toolCalls: [],
                reasoning: "",
                annotations: [],
                knowledgeUpdates: [],
                outcomes: { success: true, durationMs: 0, errors: [] },
              });
            }
          } catch (err) {
            console.warn("[session-end-hook] Extraction failed (non-fatal):", (err as Error).message);
          }
        });
      },
      onError: (error) => {
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
