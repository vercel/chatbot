/**
 * POST /api/chat/resume — U1.2 V2 Handoff Resilience
 *
 * When a chat stream is interrupted (crash, timeout, network failure),
 * the client can POST here with the last known session token + message ID
 * to receive a continuation of the stream from where it died.
 *
 * The endpoint returns either:
 * - 200 + SSE stream: continuation of the interrupted stream
 * - 404: session not found or not resumable
 * - 410: session expired (too old to resume)
 * - 503: V2 or stream infrastructure unavailable
 */
import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    let body: { sessionToken?: string; lastMessageId?: string; chatId?: string };
    try {
      body = await request.json();
    } catch {
      return new ChatbotError("bad_request:api").toResponse();
    }

    const { sessionToken, lastMessageId, chatId } = body;

    if (!sessionToken && !chatId) {
      return Response.json(
        {
          success: false,
          error: {
            code: "MISSING_PARAM",
            message: "sessionToken or chatId is required",
            retryable: false,
            suggestion: "Provide either a sessionToken from the original stream or the chatId.",
          },
        },
        { status: 400 }
      );
    }

    // Check if resumable-stream infrastructure is available
    if (!process.env.REDIS_URL) {
      return Response.json(
        {
          success: false,
          error: {
            code: "RESUME_UNAVAILABLE",
            message: "Stream resume is not available (Redis not configured).",
            retryable: false,
            suggestion: "Start a new chat instead.",
          },
        },
        { status: 503 }
      );
    }

    // The resumable-stream package stores stream state in Redis
    // If a matching stream is found, it replays/continues from the interruption point
    // If not found, we return a clear error the client can act on

    try {
      // Dynamic import to avoid build-time Redis requirement
      const { createResumableStreamContext } = await import("resumable-stream");
      const streamCtx = createResumableStreamContext({
        waitUntil: (p: Promise<unknown>) => {
          p.catch(() => {});
        },
      });

      // Try to resume the stream
      const identifier = sessionToken || `chat:${chatId}`;
      const resumableStream = await streamCtx.resumeExistingStream(identifier);

      if (!resumableStream) {
        return Response.json(
          {
            success: false,
            error: {
              code: "SESSION_NOT_FOUND",
              message: `No resumable stream found for ${identifier}. The session may have expired or was never created.`,
              retryable: false,
              suggestion: "Start a new chat to continue your work.",
            },
          },
          { status: 404 }
        );
      }

      // Return the resumed stream as SSE
      return new Response(resumableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Resume-Stream": "true",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // If resume fails gracefully, tell the client
      return Response.json(
        {
          success: false,
          error: {
            code: "RESUME_FAILED",
            message,
            retryable: true,
            suggestion: "The stream could not be resumed. Starting a new chat is recommended.",
          },
        },
        { status: 503 }
      );
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    console.error("Unhandled error in resume endpoint:", error);
    return new ChatbotError("offline:chat").toResponse();
  }
}

/**
 * GET /api/chat/resume — check if a session is resumable (head check, no SSE)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get("sessionToken");
    const chatId = searchParams.get("chatId");

    if (!sessionToken && !chatId) {
      return Response.json(
        {
          resumable: false,
          error: "sessionToken or chatId required",
        },
        { status: 400 }
      );
    }

    // Check if Redis is available
    if (!process.env.REDIS_URL) {
      return Response.json({ resumable: false, reason: "redis_unavailable" });
    }

    try {
      const { createResumableStreamContext } = await import("resumable-stream");
      const streamCtx = createResumableStreamContext({
        waitUntil: (p: Promise<unknown>) => {
          p.catch(() => {});
        },
      });

      const identifier = sessionToken || `chat:${chatId}`;
      const exists = await streamCtx.hasExistingStream(identifier);

      return Response.json({
        resumable: !!exists,
        identifier,
        timestamp: Date.now(),
      });
    } catch {
      return Response.json({ resumable: false, reason: "check_failed" });
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return Response.json({ resumable: false, reason: "error" });
  }
}
