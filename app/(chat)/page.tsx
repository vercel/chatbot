import { cookies, headers } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const cookieStore = await cookies();
  const id = generateUUID();
  const modelIdFromCookie = cookieStore.get('chat-model');
  
  // Check if this is the first load of the app (no referrer or referrer doesn't indicate internal navigation)
  const headersList = await headers();
  const referer = headersList.get('referer');
  
  // If no referrer or referrer doesn't contain internal routes, this is likely the first load - redirect to home
  const isInternalNavigation = referer && (
    referer.includes('/home') || 
    referer.includes('/chat/') || 
    referer.includes('/')
  );
  
  if (!isInternalNavigation) {
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
      />
      <DataStreamHandler />
    </>
  );
}
