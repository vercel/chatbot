"use client";

import type { User } from "next-auth";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import type { Chat } from "@/lib/chat/types";

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

export function SidebarHistory({ user }: { user: User | undefined }) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
        History
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
          {user
            ? "History is disabled until your backend is connected."
            : "Sign in to use your connected backend history later."}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
