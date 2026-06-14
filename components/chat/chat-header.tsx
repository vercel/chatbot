"use client";

import { PanelLeftIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { VercelIcon } from "./icons";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";
import { ChatStatusBar } from "./chat-status-bar";
import { StopButton } from "./stop-button";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  isStreaming = false,
  v2SessionId,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  isStreaming?: boolean;
  v2SessionId?: string;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 bg-sidebar px-3">
      <Button
        className="md:hidden"
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
      >
        <PanelLeftIcon className="size-4" />
      </Button>

      <Link
        className="flex size-8 items-center justify-center rounded-lg md:hidden"
        href="https://vercel.com/templates/next.js/chatbot"
        rel="noopener noreferrer"
        target="_blank"
      >
        <VercelIcon size={14} />
      </Link>

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
        />
      )}

      {/* Phase 9: Live status bar — VPS health, V2 sessions, telemetry nav */}
      <ChatStatusBar />

      <div className="ml-auto flex items-center gap-2">
        {/* Phase 11: Always-visible Stop button during streaming */}
        <StopButton
          chatId={chatId}
          isStreaming={isStreaming}
          v2SessionId={v2SessionId}
        />

        <Button
          asChild
          className="hidden rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90 md:flex"
        >
          <Link
            href="https://vercel.com/templates/next.js/chatbot"
            rel="noopener noreferrer"
            target="_blank"
          >
            <VercelIcon size={16} />
            Deploy with Vercel
          </Link>
        </Button>
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.v2SessionId === nextProps.v2SessionId
  );
});
