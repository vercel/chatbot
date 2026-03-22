import type { UseChatHelpers } from "@ai-sdk/react";
import { useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { useScrollToBottom } from "./use-scroll-to-bottom";

export function useMessages({
  status,
}: {
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
  } = useScrollToBottom();

  const [hasSentMessage, setHasSentMessage] = useState(false);

  if (status === "submitted" && !hasSentMessage) {
    setHasSentMessage(true);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
    reset,
  };
}
