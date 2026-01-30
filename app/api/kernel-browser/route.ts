import { auth } from '@/app/(auth)/auth';
import {
  createKernelBrowser,
  deleteKernelBrowser,
  getLiveViewUrl,
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

    if (action === 'create') {
      const browser = await createKernelBrowser(sessionId, { isMobile });
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
      const url = getLiveViewUrl(sessionId);
      return Response.json({ liveViewUrl: url });
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
