"use client";

import {
  History,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useTheme } from "next-themes";

import { SidebarHistory } from "@/components/sidebar-history";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const { setTheme, theme } = useTheme();

  return (
    <Sidebar
      className="border-r border-border bg-sidebar-background z-20"
      collapsible="icon"
    >
      <SidebarHeader className="flex flex-col items-center gap-6 py-6 p-0! pt-6!">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-10 rounded-lg text-muted-foreground hover:bg-muted"
                onClick={toggleSidebar}
                size="icon"
                variant="ghost"
              >
                <LayoutDashboard className="size-6" />
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Toggle Sidebar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-10 rounded-lg bg-foreground text-background hover:opacity-80 shadow-sm"
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
                size="icon"
                variant="default"
              >
                <Plus className="size-5" />
                <span className="sr-only">New Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarHeader>

      <SidebarContent className="flex flex-col items-center gap-4 mt-8 w-full p-0!">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-10 rounded-lg text-muted-foreground hover:bg-muted"
                size="icon"
                variant="ghost"
              >
                <Search className="size-6" />
                <span className="sr-only">Search</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Search</TooltipContent>
          </Tooltip>

          <Sheet>
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>
                  <Button
                    className="size-10 rounded-lg text-muted-foreground hover:bg-muted"
                    size="icon"
                    variant="ghost"
                  >
                    <History className="size-6" />
                    <span className="sr-only">History</span>
                  </Button>
                </SheetTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">History</TooltipContent>
            </Tooltip>
            <SheetContent
              className="w-[300px] sm:w-[400px] ml-[4.5rem] h-full shadow-xl border-r border-border"
              side="left"
            >
              <div className="flex flex-col h-full">
                <SheetHeader className="mb-4 px-1">
                  <SheetTitle>History</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  <SidebarHistory user={user} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </TooltipProvider>
      </SidebarContent>

      <SidebarFooter className="flex flex-col items-center gap-4 pb-6 p-0! mb-2!">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-10 rounded-lg text-muted-foreground hover:bg-muted"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                size="icon"
                variant="ghost"
              >
                <Sun className="size-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-6 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle Theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Toggle Theme</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}
