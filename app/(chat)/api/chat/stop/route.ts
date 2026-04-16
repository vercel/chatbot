import { auth } from '@/app/(auth)/auth';
import { abortChat } from '@/lib/chat-abort-registry';
import { getChatById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

/**
 * Explicit cancellation endpoint.
 *
 * Cloud Run over HTTP/1.1 does not propagate client disconnects, so
 * pressing Stop on the client can't rely on `request.signal` firing in
 * the in-flight POST /api/chat request. The client instead hits this
 * endpoint with the chatId to abort the registered AbortController.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let body: { chatId?: string };
  try {
    body = await request.json();
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const chatId = body.chatId;
  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const chat = await getChatById({ id: chatId });
  if (chat && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const aborted = abortChat(chatId);
  console.log(`[chat-stop] chatId=${chatId} aborted=${aborted}`);
  return Response.json({ aborted });
}
