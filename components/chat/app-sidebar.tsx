"use client";

import {
  BarChart3Icon,
  BrainCircuitIcon,
  KeyRoundIcon,
  MessageSquareIcon,
  PanelLeftIcon,
  PenSquareIcon,
  PlugIcon,
  TrashIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ConnectorsPanel } from "../sidebar/connectors-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const NAV_ITEMS = [
  { id: "chats", label: "Chats", icon: MessageSquareIcon, href: "/", shortcut: "1" },
  { id: "connectors", label: "Connectors", icon: PlugIcon, href: "/connectors", shortcut: "2" },
  { id: "wiki", label: "Wiki", icon: BrainCircuitIcon, href: "/wiki", shortcut: "3" },
  { id: "workflows", label: "Workflows", icon: ZapIcon, href: "/workflows", shortcut: "4" },
  { id: "reports", label: "Reports", icon: BarChart3Icon, href: "/reports", shortcut: "5" },
  { id: "secrets", label: "Secrets", icon: KeyRoundIcon, href: "/secrets", shortcut: "6" },
] as const;

export function AppSidebar({ user }: { user: User | undefined }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, toggleSidebar, state } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const isCollapsed = state === "collapsed";

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], { revalidate: false });
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, { method: "DELETE" });
    toast.success("All chats deleted");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || (pathname?.startsWith("/chat") && !NAV_ITEMS.slice(1).some((item) => pathname?.startsWith(item.href)));
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-950">
        <SidebarHeader className="pb-0 pt-3">
          <SidebarMenu>
            <SidebarMenuItem className="flex flex-row items-center justify-between">
              <div className="group/logo relative flex items-center justify-center">
                <SidebarMenuButton asChild className="size-8 !px-0 items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0" tooltip="Neptune">
                  <Link href="/" onClick={() => setOpenMobile(false)}>
                    <MessageSquareIcon className="size-4 text-cyan-400" />
                  </Link>
                </SidebarMenuButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100" onClick={() => toggleSidebar()}>
                      <PanelLeftIcon className="size-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block" side="right">Toggle sidebar</TooltipContent>
                </Tooltip>
              </div>
              {!isCollapsed && <span className="text-sm font-semibold text-zinc-100 ml-2">Neptune</span>}
              <div className="group-data-[collapsible=icon]:hidden ml-auto">
                <SidebarTrigger className="text-zinc-400 transition-colors duration-150 hover:text-zinc-200" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="overflow-y-auto">
          <SidebarGroup className="pt-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="h-8 rounded-lg border border-zinc-800 text-[13px] text-zinc-300 transition-colors duration-150 hover:bg-zinc-800/50 hover:text-zinc-100" onClick={() => { setOpenMobile(false); router.push("/"); }} tooltip="New Chat">
                    <PenSquareIcon className="size-4" />
                    <span className="font-medium">New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton className="rounded-lg text-zinc-500 transition-colors duration-150 hover:bg-red-950/30 hover:text-red-400" onClick={() => setShowDeleteAllDialog(true)} tooltip="Delete All Chats">
                      <TrashIcon className="size-4" />
                      <span className="text-[13px]">Delete all</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarHistory user={user} />
          <SidebarSeparator className="bg-zinc-800" />
          <SidebarGroup>
            <SidebarGroupLabel className="text-zinc-500 text-[11px] tracking-wider uppercase">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild isActive={active} className={cn("transition-colors duration-150", active && "bg-cyan-400/10 text-cyan-400")} onClick={() => setOpenMobile(false)} tooltip={item.label}>
                        <Link href={item.href}>
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator className="bg-zinc-800" />
          <ConnectorsPanel />
        </SidebarContent>
        <SidebarFooter className="border-t border-zinc-800 pt-2 pb-3">
          {user ? <SidebarUserNav user={user} /> : <div className="px-3 py-2 text-xs text-zinc-500">Neptune v3.2 · Grand Unification</div>}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <AlertDialog onOpenChange={setShowDeleteAllDialog} open={showDeleteAllDialog}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">This action cannot be undone. This will permanently delete all your chats and remove them from our servers.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 text-white hover:bg-red-700">Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
