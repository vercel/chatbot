import { sendBackgroundMessageExpecting } from '@/lib/messaging/client';
import { pageContextResponseToActiveContext } from '@/lib/messaging/contracts';
import type { ActivePageContext } from '@/lib/types';

export async function captureActivePageContext(): Promise<ActivePageContext | null> {
  const response = await sendBackgroundMessageExpecting(
    { type: 'page/get-active-context' },
    'page/context',
  );

  return pageContextResponseToActiveContext(response);
}
