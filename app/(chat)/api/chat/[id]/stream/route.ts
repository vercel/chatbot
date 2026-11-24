import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { auth } from "@/app/(auth)/auth";
import { getChatById, getStreamIdsByChatId } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { getStreamContext } from "../../route";

const RESUME_TIMEOUT_MS = 5000;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const chat = await getChatById({ id });

  if (!chat) {
    return new Response(null, { status: 204 });
  }

  if (chat.visibility === "private" && chat.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  if (!process.env.REDIS_URL) {
    return new Response(null, { status: 204 });
  }

  const streamId = (await getStreamIdsByChatId({ chatId: id })).at(-1);
  const streamContext = streamId ? getStreamContext() : null;

  if (!(streamId && streamContext)) {
    return new Response(null, { status: 204 });
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const stream = await Promise.race([
      streamContext.resumeExistingStream(streamId),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), RESUME_TIMEOUT_MS);
      }),
    ]);

    if (!stream) {
      return new Response(null, { status: 204 });
    }

    return new Response(stream, { headers: UI_MESSAGE_STREAM_HEADERS });
  } catch {
    return new Response(null, { status: 204 });
  } finally {
    clearTimeout(timeout);
  }
}
