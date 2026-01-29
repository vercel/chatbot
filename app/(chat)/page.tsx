import { cookies, headers } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();

  const cookieStore = await cookies();
  const id = generateUUID();
  const modelIdFromCookie = cookieStore.get('chat-model');

  // Check for shared link content from cookie (set by /link/[token] route)
  const sharedLinkCookie = cookieStore.get('shared_link_content');
  const initialQuery = sharedLinkCookie?.value || undefined;

  // Check if this is the first load of the app (no referrer)
  // If no referrer and no shared link cookie, redirect to home
  const headersList = await headers();
  const referer = headersList.get('referer');

  if (!referer && !initialQuery) {
    redirect('/home');
  }

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
          initialQuery={initialQuery}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
        initialQuery={initialQuery}
      />
      <DataStreamHandler />
    </>
  );
}
