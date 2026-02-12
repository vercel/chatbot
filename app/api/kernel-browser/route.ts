import { auth } from '@/app/(auth)/auth';
import {
  getOrCreateBrowser,
  deleteBrowser,
  getBrowser,
  stopBrowserOperations,
} from '@/lib/kernel/browser';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { action, sessionId, isMobile } = await request.json();

    if (!sessionId) {
      return Response.json(
        { error: 'sessionId is required' },
        { status: 400 },
      );
    }

    // Validate session ownership: sessionId must end with `-{userId}`
    if (!sessionId.endsWith(`-${userId}`)) {
      return Response.json(
        { error: 'Forbidden: session does not belong to user' },
        { status: 403 },
      );
    }

    if (action === 'get') {
      const browser = await getBrowser(sessionId, userId);
      if (!browser) {
        return Response.json({ liveViewUrl: null });
      }
      return Response.json({
        liveViewUrl: browser.liveViewUrl,
        sessionId: browser.kernelSessionId,
      });
    }

    if (action === 'create') {
      const browser = await getOrCreateBrowser(sessionId, userId, {
        isMobile,
      });
      return Response.json({
        liveViewUrl: browser.liveViewUrl,
        sessionId: browser.kernelSessionId,
      });
    }

    if (action === 'delete') {
      await deleteBrowser(sessionId, userId);
      return Response.json({ success: true });
    }

    if (action === 'stop') {
      await stopBrowserOperations(sessionId, userId);
      return Response.json({ success: true });
    }

    if (action === 'heartbeat') {
      const browser = await getBrowser(sessionId, userId);
      if (!browser) {
        return Response.json(
          { error: 'Session expired or not found' },
          { status: 404 },
        );
      }
      return Response.json({
        success: true,
        liveViewUrl: browser.liveViewUrl,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Kernel browser API error:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to manage browser',
      },
      { status: 500 },
    );
  }
}
