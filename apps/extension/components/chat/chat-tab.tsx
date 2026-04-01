"use client";

import { ThreadListView } from "@/components/chat/thread-list";
import type { AppModelId } from "@/lib/types";
import { Thread } from "./thread";

export function ChatTab({
  selectedModel,
  onModelChange,
  usedTokens,
  maxTokens,
}: {
  selectedModel: AppModelId;
  onModelChange: (modelId: AppModelId) => Promise<void> | void;
  usedTokens: number;
  maxTokens: number;
}) {
  return (
    <section className="thread-layout">
      <ThreadListView />
      <Thread
        selectedModel={selectedModel}
        onModelChange={(modelId) => {
          void onModelChange(modelId);
        }}
        usedTokens={usedTokens}
        maxTokens={maxTokens}
      />
    </section>
  );
}
