"use client";

/**
 * AppSidebar — Enterprise shadcn sidebar for Neptune Chat.
 *
 * Phase 17: Navigation Rehaul — unified sidebar + mobile parity + canvas integration.
 *
 * Structure:
 *   SidebarHeader  → WorkspaceSwitcher (dropdown with workspace selector)
 *   SidebarContent → New Chat button + NavAgents + NavLibrary + LibraryTreePanel + NavAdmin
 *   SidebarFooter  → UserMenu (avatar + name + email + Sign Out)
 *   SidebarRail    → Drag-to-resize rail
 *
 * Keyboard shortcuts:
 *   Cmd+B → Toggle sidebar (built into shadcn)
 *   Cmd+K → Command palette (via CommandPalette component)
 *
 * A11y: aria-labels on all interactive elements, focus-visible ring,
 * screen reader announces group state.
 */

import {
  MessageSquareIcon,
  PenSquareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WorkspaceSwitcher } from "@/components/sidebar/workspace-switcher";
import { NavAgents } from "@/components/sidebar/nav-agents";
import { NavLibrary } from "@/components/sidebar/nav-library";
import { NavAdmin } from "@/components/sidebar/nav-admin";
import { LibraryTreePanel } from "@/components/sidebar/library-tree-panel";
import { UserMenu } from "@/components/sidebar/user-menu";
import { cn } from "@/lib/utils";

/** Panel IDs used to swap right-panel content (no page navigation) */
export type PanelId =
  | "chats"
  | "connectors"
  | "tools"
  | "wiki"
  | "workflows"
  | "reports"
  | "secrets"
  | null;

interface AppSidebarProps {
  user: User | undefined;
  activePanel: PanelId;
  onSelectPanel: (panel: PanelId) => void;
}

export function AppSidebar({
  user,
  activePanel,
  onSelectPanel,
}: AppSidebarProps) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar, state } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [libraryTreeExpanded, setLibraryTreeExpanded] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });
    toast.success("All chats deleted");
  };

  return (
    <>
      <Sidebar
        aria-label="Main navigation"
        className="border-r border-sidebar-border bg-sidebar"
        collapsible="icon"
      >
        {/* ── Header: Workspace Switcher ──────────────────────────────── */}
        <SidebarHeader className="pb-2 pt-3">
          <WorkspaceSwitcher />
        </SidebarHeader>

        {/* ── Content: New Chat + NavAgents + NavLibrary + Tree + NavAdmin ── */}
        <SidebarContent className="overflow-y-auto">
          {/* New Chat button + Delete All */}
          <div className="px-2 pb-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-label="Start new chat"
                  className="h-9 rounded-lg border border-sidebar-border text-[13px] text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push("/");
                  }}
                  tooltip="New Chat"
                >
                  <PenSquareIcon className="size-4" />
                  <span className="font-medium">New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    aria-label="Delete all chats"
                    className="rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setShowDeleteAllDialog(true)}
                    tooltip="Delete All Chats"
                  >
                    <TrashIcon className="size-4" />
                    <span className="text-[13px]">Delete all</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </div>

          {/* Chat History */}
          <SidebarHistory user={user} />
          <SidebarSeparator className="bg-sidebar-border" />

          {/* Agents Group */}
          <NavAgents />
          <SidebarSeparator className="bg-sidebar-border" />

          {/* Library Group — with inline tree */}
          <div className="px-2 pt-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-expanded={libraryTreeExpanded}
                  aria-label={`Library tree ${libraryTreeExpanded ? "expanded" : "collapsed"}`}
                  className={cn(
                    "rounded-lg text-[13px] transition-all duration-150",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    libraryTreeExpanded && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                  )}
                  onClick={() => setLibraryTreeExpanded(!libraryTreeExpanded)}
                  tooltip="Library Tree"
                >
                  <span className="flex-1 text-left">Library</span>
                  <span className="text-[10px] text-muted-foreground">
                    {libraryTreeExpanded ? "▾" : "▸"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {libraryTreeExpanded && (
              <LibraryTreePanel className="max-h-[50vh] overflow-y-auto border-l-2 border-sidebar-accent ml-2 my-1" />
            )}
          </div>
          <NavLibrary />
          <SidebarSeparator className="bg-sidebar-border" />

          {/* Admin Group */}
          <NavAdmin />
        </SidebarContent>

        {/* ── Footer: User Card ───────────────────────────────────────── */}
        <UserMenu user={user} />

        {/* ── Rail: Drag handle ───────────────────────────────────────── */}
        <SidebarRail />
      </Sidebar>

      {/* Delete All Chats confirmation dialog */}
      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAll}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
