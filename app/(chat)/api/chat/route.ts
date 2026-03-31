import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';

import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider, webAutomationModel } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

// AI SDK web automation imports (used when USE_AI_SDK_AGENT=true)
import { apricotTools } from '@/lib/ai/tools/apricot';
import { createBrowserTool } from '@/lib/ai/tools/browser';
import { gapAnalysis } from '@/lib/ai/tools/gap-analysis';
import { formSummary } from '@/lib/ai/tools/form-summary';
import { actionLabel } from '@/lib/ai/tools/action-label';
import { getWebAutomationSystemPrompt } from '@/lib/ai/prompts/web-automation';
import { loadSkill } from '@/lib/ai/tools/load-skill';
import { readSkillFile } from '@/lib/ai/tools/read-skill-file';
import { createMessageCompressor, preCompactMessages } from '@/lib/ai/context-compression';

// Feature flag for AI SDK agent vs Mastra
const useAiSdkAgent = process.env.USE_AI_SDK_AGENT === 'true';

export const maxDuration = 300; // 5 minutes for web automation tasks

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      modelOverride,
      selectedVisibilityType,
    } = requestBody;

    // Only honour modelOverride in non-production environments.
    const resolvedModelOverride = !isProductionEnvironment ? modelOverride : undefined;

    console.log(`[chat] selectedChatModel=${selectedChatModel} rawModelOverride=${modelOverride ?? 'none'} isProduction=${isProductionEnvironment} resolvedOverride=${resolvedModelOverride ?? 'none'}`);

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type ?? 'regular';

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];
    const existingMessageIds = new Set(uiMessages.map((m) => m.id));

    // Save only messages generated during this request (not already in DB).
    const saveNewMessages = async (messages: Array<{ id: string; role: string; parts: unknown }>) => {
      const newMessages = messages.filter((m) => !existingMessageIds.has(m.id));
      if (newMessages.length > 0) {
        await saveMessages({
          messages: newMessages.map((m) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      }
    };

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Web automation model handling
    if (selectedChatModel === 'web-automation-model') {
      // Feature flag: if false, return error so client falls back to mastra-proxy
      if (!useAiSdkAgent) {
        return new ChatSDKError(
          'bad_request:api',
          'Web automation uses Mastra backend'
        ).toResponse();
      }

      // Create session ID for browser isolation
      // sessionId includes both chatId and userId to ensure global uniqueness
      const sessionId = `${id}-${session.user.id}`;

      const stream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
          // Pre-compact messages loaded from DB if they exceed the context
          // window threshold. This handles the cross-request case where a
          // previous request compacted mid-stream but saved raw messages.
          const initialModelMessages = await convertToModelMessages(uiMessages);
          const { messages: preCompacted, compacted: wasPreCompacted, summary: preCompactSummary } =
            await preCompactMessages(initialModelMessages, () => {
              dataStream.write({
                type: 'data-compacting',
                data: { timestamp: Date.now() },
                transient: true,
              });
            });

          if (wasPreCompacted) {
            dataStream.write({
              type: 'data-checkpoint',
              data: {
                stepNumber: 0,
                inputTokens: 0,
                timestamp: Date.now(),
                summary: preCompactSummary,
              },
              transient: true,
            });
          }

          // One compressor instance per request; its cache persists across all
          // prepareStep calls so generateText is not re-fired on every step.
          const compressStep = createMessageCompressor();

          const activeModel = resolvedModelOverride
            ? myProvider.languageModel(resolvedModelOverride)
            : webAutomationModel;

          const result = streamText({
            model: activeModel,
            system: getWebAutomationSystemPrompt(),
            messages: preCompacted,
            tools: {
              ...apricotTools,
              gapAnalysis,
              formSummary,
              actionLabel,
              browser: createBrowserTool(sessionId, session.user.id),
              loadSkill,
              readSkillFile,
            },
            stopWhen: stepCountIs(500),
            abortSignal: request.signal,
            // Compress message history when token usage approaches the context
            // window limit (75% of 200K). First step has no prior usage data so
            // compression is skipped (correct — first step is always small).
            prepareStep: async ({ messages: stepMessages, steps }) => {
              const lastInputTokens = steps.length > 0
                ? steps[steps.length - 1].usage.inputTokens
                : undefined;
              const { messages: compressed, compacted, summary } = await compressStep(
                stepMessages,
                lastInputTokens,
                () => {
                  dataStream.write({
                    type: 'data-compacting',
                    data: { timestamp: Date.now() },
                    transient: true,
                  });
                },
              );
              if (compacted) {
                console.log(
                  `[compressor] emitting data-checkpoint — step=${steps.length}, inputTokens=${lastInputTokens}`
                );
                dataStream.write({
                  type: 'data-checkpoint',
                  data: {
                    stepNumber: steps.length,
                    inputTokens: lastInputTokens,
                    timestamp: Date.now(),
                    summary,
                  },
                  transient: true,
                });
              }
              return { messages: compressed };
            },
            // Emit cumulative token usage after each step so the client can
            // display it in real-time via the Context component.
            onStepFinish: ({ usage }) => {
              dataStream.write({
                type: 'data-token-usage',
                data: usage,
                transient: true,
              });
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'web-automation-agent',
            },
          });

          dataStream.merge(result.toUIMessageStream());
          consumeStream({ stream: result.textStream });
        },
        generateId: generateUUID,
        onFinish: async ({ messages }) => {
          await saveNewMessages(messages);
        },
        onError: () => {
          return 'Oops, an error occurred!';
        },
      });

      const streamContext = getStreamContext();

      if (streamContext) {
        return new Response(
          await streamContext.resumableStream(streamId, () =>
            stream.pipeThrough(new JsonToSseTransformStream())
          )
        );
      }
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }

    // Default handling for other models
    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: await convertToModelMessages(uiMessages),
          abortSignal: request.signal,
          stopWhen: stepCountIs(100),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
        consumeStream({ stream: result.textStream });
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveNewMessages(messages);
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    console.error('Unexpected error in chat API:', error);
    return new ChatSDKError('internal_server_error:api').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
