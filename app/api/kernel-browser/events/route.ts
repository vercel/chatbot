import { auth } from '@/app/(auth)/auth';
import { readStatusEvents } from '@/lib/kernel/message-queue';

const SSE_POLL_INTERVAL_MS = 500;
const SSE_MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes, then client reconnects

/**
 * Server-Sent Events endpoint for real-time browser command status.
 *
 * The client opens an EventSource connection to this endpoint and receives
 * status events (command_queued, command_started, command_completed, etc.)
 * as they are published by the command worker via Redis Streams.
 *
 * The stream auto-closes after 5 minutes to avoid stale connections — the
 * client should reconnect with the `Last-Event-ID` header to resume.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('sessionId query parameter is required', {
      status: 400,
    });
  }

  // Validate session ownership
  if (!sessionId.endsWith(`-${userId}`)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Support reconnection: client sends Last-Event-ID to resume from cursor
  const lastEventId =
    request.headers.get('Last-Event-ID') || url.searchParams.get('cursor') || '0-0';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cursor = lastEventId;
      const deadline = Date.now() + SSE_MAX_DURATION_MS;
      let closed = false;

      // Listen for client disconnect
      request.signal.addEventListener('abort', () => {
        closed = true;
      });

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ cursor })}\n\n`),
      );

      while (!closed && Date.now() < deadline) {
        try {
          const { events, cursor: newCursor } = await readStatusEvents(
            userId,
            sessionId,
            cursor,
          );

          if (events.length > 0) {
            cursor = newCursor;

            for (const event of events) {
              const payload = JSON.stringify(event);
              // Include the cursor as the event ID so the client can resume
              controller.enqueue(
                encoder.encode(`id: ${cursor}\nevent: status\ndata: ${payload}\n\n`),
              );
            }
          }
        } catch (err) {
          console.error('[SSE] Error reading status events:', err);
          // Send error event but keep connection alive
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: 'Failed to read events' })}\n\n`,
            ),
          );
        }

        // Sleep between polls
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, SSE_POLL_INTERVAL_MS);
          request.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        });
      }

      // Send close event before ending
      if (!closed) {
        controller.enqueue(
          encoder.encode(
            `event: timeout\ndata: ${JSON.stringify({ cursor, message: 'Stream timeout, please reconnect' })}\n\n`,
          ),
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
