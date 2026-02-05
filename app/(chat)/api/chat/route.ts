import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ZodError } from "zod";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveDifyWorkflowDsl,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { getDifyClient } from "@/lib/dify/client";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

async function saveDslToTempFile({
  chatId,
  dslYaml,
  workflowName,
}: {
  chatId: string;
  dslYaml: string;
  workflowName?: string | null;
}): Promise<string | null> {
  try {
    const dslDir = join(process.cwd(), "dsl");
    await mkdir(dslDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeWorkflowName = workflowName
      ? workflowName.replace(/[^a-zA-Z0-9-_]/g, "_")
      : "workflow";
    const filename = `${safeWorkflowName}_${chatId}_${timestamp}.yml`;
    const filePath = join(dslDir, filename);

    await writeFile(filePath, dslYaml, "utf8");
    return filePath;
  } catch (error) {
    console.error("Failed to save DSL to temporary file:", error);
    return null;
  }
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  let requestJson: unknown;

  try {
    requestJson = await request.json();
    requestBody = postRequestBodySchema.parse(requestJson);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorDetails = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      console.error(
        "Validation error:",
        errorDetails,
        "Request body:",
        JSON.stringify(requestJson)
      );
      return new ChatSDKError("bad_request:api", errorDetails).toResponse();
    }
    console.error("Request parsing error:", error);
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      systemPromptId,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

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

    const isDifyMode = systemPromptId === "dify-rule-ver5";
    const resolvedChatModel =
      (isDifyMode ? process.env.AI_DIFY_MODEL : undefined) ?? selectedChatModel;
    const isReasoningModel =
      resolvedChatModel.includes("reasoning") ||
      resolvedChatModel.includes("thinking");
    const shouldUseTools = !isReasoningModel && !isDifyMode;

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(resolvedChatModel),
          system: systemPrompt({
            selectedChatModel: resolvedChatModel,
            requestHints,
            systemPromptId,
          }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools: shouldUseTools
            ? [
                "getWeather",
                "createDocument",
                "updateDocument",
                "requestSuggestions",
              ]
            : [],
          providerOptions: isReasoningModel
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 10_000 },
                },
              }
            : undefined,
          tools: shouldUseTools
            ? {
                getWeather,
                createDocument: createDocument({ session, dataStream }),
                updateDocument: updateDocument({ session, dataStream }),
                requestSuggestions: requestSuggestions({ session, dataStream }),
              }
            : undefined,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        const isDifyMode = systemPromptId === "dify-rule-ver5";

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

          if (isDifyMode && session?.user?.id) {
            // Save the latest generated DSL (YAML fenced block) as a separate record.
            const latestAssistant = [...finishedMessages]
              .reverse()
              .find((m) => m.role === "assistant");

            const extractTextFromParts = (parts: unknown[]): string => {
              return parts
                .filter(
                  (p): p is { type: "text"; text: string } =>
                    typeof p === "object" &&
                    p !== null &&
                    "type" in p &&
                    (p as { type?: unknown }).type === "text" &&
                    "text" in p &&
                    typeof (p as { text?: unknown }).text === "string"
                )
                .map((p) => p.text)
                .join("");
            };

            const extractYamlCodeBlock = (text: string): string | null => {
              const matches = [
                ...text.matchAll(/```(?:ya?ml)?\s*([\s\S]*?)```/gi),
              ];
              const last = matches.at(-1);
              const yaml = last?.[1]?.trim();
              return yaml ? yaml : null;
            };

            const inferMode = (yaml: string) => {
              const match = yaml.match(
                /(^|\n)\s*mode:\s*(advanced-chat|workflow|agent-chat)\b/i
              );
              return (match?.[2]?.toLowerCase() as
                | "advanced-chat"
                | "workflow"
                | "agent-chat"
                | undefined) ?? null;
            };

            const inferWorkflowName = (yaml: string) => {
              // Heuristic: prefer "name:" near the top.
              const head = yaml.split("\n").slice(0, 60).join("\n");
              const match =
                head.match(/(^|\n)\s*name:\s*['"]?([^'"\n]+)['"]?/i) ??
                head.match(
                  /(^|\n)\s*app:\s*\n\s+name:\s*['"]?([^'"\n]+)['"]?/i
                );
              return match?.[2]?.trim() ?? null;
            };

            if (latestAssistant?.parts) {
              const text = extractTextFromParts(latestAssistant.parts as unknown[]);
              const yaml = extractYamlCodeBlock(text);
              if (yaml) {
                try {
                  const workflowName = inferWorkflowName(yaml);
                  await saveDifyWorkflowDsl({
                    chatId: id,
                    userId: session.user.id,
                    messageId: latestAssistant.id,
                    dslYaml: yaml,
                    workflowName,
                    mode: inferMode(yaml),
                  });

                  // Save DSL file to temporary directory
                  const tempFilePath = await saveDslToTempFile({
                    chatId: id,
                    dslYaml: yaml,
                    workflowName,
                  });
                  if (tempFilePath) {
                    console.log(
                      `DSL file saved to temporary location: ${tempFilePath}`
                    );

                    // 自動インポートと公開（オプショナル）
                    const difyClient = getDifyClient();
                    if (difyClient && tempFilePath) {
                      try {
                        const result = await difyClient.importAndPublish(
                          tempFilePath
                        );
                        console.log(
                          `Dify workflow imported and published: ${result.appId}`
                        );
                        console.log(`Publish URL: ${result.publishUrl}`);
                      } catch (error) {
                        // Difyインポートが失敗してもチャット処理は継続
                        console.error(
                          "Failed to auto-import DSL to Dify:",
                          error
                        );
                      }
                    }
                  }
                } catch {
                  // Don't fail the chat if DSL persistence fails (e.g. migrations not applied yet).
                }
              }
            }
          }
        }
      },
      onError: () => "Oops, an error occurred!",
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
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
