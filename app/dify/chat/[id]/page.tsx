import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

const DIFY_PROMPT_ID = "dify-rule-ver5";

export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <DifyChatPage params={props.params} />
    </Suspense>
  );
}

async function DifyChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = await getChatById({ id });

  if (!chat) {
    redirect("/dify");
  }

  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  if (chat.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");
  const fixedDifyModelId = process.env.AI_DIFY_MODEL;

  const chatProps = {
    autoResume: true,
    id: chat.id,
    initialMessages: uiMessages,
    initialVisibilityType: chat.visibility,
    isReadonly: session?.user?.id !== chat.userId,
    systemPromptId: DIFY_PROMPT_ID,
    chatPathPrefix: "/dify/chat",
    newChatPath: "/dify",
    inputPlaceholder: "Describe the workflow you want to build...",
  };

  const initialChatModel =
    fixedDifyModelId ?? chatModelFromCookie?.value ?? DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        {...chatProps}
        fixedChatModelId={fixedDifyModelId}
        initialChatModel={initialChatModel}
      />
      <DataStreamHandler />
    </>
  );
}
