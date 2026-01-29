"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { memo } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { data: session } = useSession();

  return (
    <header className="absolute top-0 right-0 left-0 p-4 flex items-center gap-4 z-10 justify-between pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="md:hidden">
          <SidebarToggle />
        </div>
        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            className="hidden md:flex bg-background/50 backdrop-blur-md border-border/50"
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
      </div>

      <div className="flex items-center gap-3 pointer-events-auto">
        {session?.user ? (
          <SidebarUserNav user={session.user} />
        ) : (
          <div className="size-8 rounded-full bg-muted/20 animate-pulse" />
        )}
        <Button
          asChild
          className="bg-foreground text-background px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Link href="/pricing">Get Pro</Link>
        </Button>
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
