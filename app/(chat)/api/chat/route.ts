import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
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
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider, webAutomationModel } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import { apricotTools } from '@/lib/ai/tools/apricot';
import { createBrowserTool } from '@/lib/ai/tools/browser';
import { gapAnalysis } from '@/lib/ai/tools/gap-analysis';
import { formSummary } from '@/lib/ai/tools/form-summary';
import { actionLabel } from '@/lib/ai/tools/action-label';
import { getWebAutomationSystemPrompt } from '@/lib/ai/prompts/web-automation';
import { loadSkill } from '@/lib/ai/tools/load-skill';
import { readSkillFile } from '@/lib/ai/tools/read-skill-file';
import { createMessageCompressor } from '@/lib/ai/context-compression';
import { registerChatAbort, clearChatAbort } from '@/lib/chat-abort-registry';

export const maxDuration = 300; // 5 minutes for web automation tasks

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (!error.message.includes('REDIS_URL')) {
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
      modelOverride,
      selectedVisibilityType,
    } = requestBody;

    // Only honour modelOverride in non-production environments.
    const resolvedModelOverride = !isProductionEnvironment ? modelOverride : undefined;

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

    // Create session ID for browser isolation
    // sessionId includes both chatId and userId to ensure global uniqueness
    const sessionId = `${id}-${session.user.id}`;

    // Register an AbortController the client can trigger via
    // POST /api/chat/stop. Cloud Run HTTP/1.1 does not propagate client
    // disconnects to request.signal, so this explicit channel is the
    // only reliable way to abort an in-flight run from the browser.
    const chatAbort = registerChatAbort(id);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const initialModelMessages = await convertToModelMessages(uiMessages);

        // One compressor instance per request; its cache persists across all
        // prepareStep calls so generateText is not re-fired on every step.
        // Compaction triggers on step 1+ using SDK-reported inputTokens
        // (step 0 has no prior usage data, so it runs uncompacted).
        const compressStep = createMessageCompressor();

        const activeModel = resolvedModelOverride
          ? myProvider.languageModel(resolvedModelOverride)
          : webAutomationModel;

        const result = streamText({
          model: activeModel,
          system: getWebAutomationSystemPrompt(),
          messages: initialModelMessages,
          tools: {
            ...apricotTools,
            gapAnalysis,
            formSummary,
            actionLabel,
            browser: createBrowserTool(sessionId, session.user.id),
            loadSkill,
            readSkillFile,
          },
          // request.signal.aborted is checked at each step boundary so the
          // tool loop halts even before Node's write-failure-based abort
          // detection fires. Without this, streamText keeps running until
          // a write to the closed socket fails — which can be seconds of
          // extra tool calls after the user hits stop.
          // Abort is checked at step boundaries via stopWhen — not
          // passed as abortSignal. Mid-tool abort would leave a
          // tool-call with no matching tool-result, triggering
          // AI_MissingToolResultsError on the next turn.
          stopWhen: [stepCountIs(500), () => chatAbort.signal.aborted],
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
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        clearChatAbort(id, chatAbort);
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
