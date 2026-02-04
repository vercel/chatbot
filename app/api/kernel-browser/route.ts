import { auth } from '@/app/(auth)/auth';
import {
  createKernelBrowser,
  deleteKernelBrowser,
  getLiveViewUrl,
  recordLiveViewConnection,
  recordLiveViewDisconnection,
  recordLiveViewHeartbeat,
} from '@/lib/kernel/browser';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, sessionId, isMobile } = await request.json();

    if (!sessionId) {
      return Response.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Validate session ownership: sessionId must end with `-{userId}`
    if (!sessionId.endsWith(`-${session.user.id}`)) {
      return Response.json(
        { error: 'Forbidden: session does not belong to user' },
        { status: 403 }
      );
    }

    if (action === 'create') {
      const browser = await createKernelBrowser(sessionId, session.user.id, { isMobile });
      return Response.json({
        liveViewUrl: browser.browser_live_view_url,
        sessionId: browser.session_id,
      });
    }

    if (action === 'delete') {
      await deleteKernelBrowser(sessionId);
      return Response.json({ success: true });
    }

    if (action === 'getLiveView') {
      const url = await getLiveViewUrl(sessionId, session.user.id);
      return Response.json({ liveViewUrl: url });
    }

    if (action === 'liveViewConnected') {
      await recordLiveViewConnection(sessionId, session.user.id);
      return Response.json({ success: true });
    }

    if (action === 'liveViewDisconnected') {
      await recordLiveViewDisconnection(sessionId, session.user.id);
      return Response.json({ success: true });
    }

    if (action === 'liveViewHeartbeat') {
      try {
        await recordLiveViewHeartbeat(sessionId, session.user.id);
        return Response.json({ success: true });
      } catch (error) {
        // If heartbeat fails (session expired), return 404 so client disconnects
        if (error instanceof Error && error.message.includes('different user')) {
          return Response.json({ error: 'Session expired or invalid' }, { status: 404 });
        }
        throw error;
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Kernel browser API error:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to manage browser',
      },
      { status: 500 }
    );
  }
}
