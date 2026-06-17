"use client";

/**
 * UserBar — Top bar for Command Center
 *
 * Phase 29: Neptune Command Center UI
 *
 * Displays:
 *  - User avatar + name
 *  - Role badge (color-coded: blue/orange/red)
 *  - Search input
 *  - Drawer toggle button
 *  - Phase 22 glass surface + borders
 */

import { useCallback } from "react";
import type { DefaultSession } from "next-auth";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { RoleConfig } from "@/lib/harness/roles";

interface UserBarProps {
  user: DefaultSession["user"];
  role: RoleConfig;
  onToggleDrawer: () => void;
  drawerOpen: boolean;
  onSearchFocus?: () => void;
}

const ROLE_COLOR_MAP: Record<string, string> = {
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  orange:
    "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  red: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
};

export function UserBar({
  user,
  role,
  onToggleDrawer,
  drawerOpen,
  onSearchFocus,
}: UserBarProps) {
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  const handleSignOut = useCallback(async () => {
    await signOut({ redirectTo: "/login" });
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-surface-1)] px-4 backdrop-blur-[16px] saturate-[120%]">
      {/* ── Left: Drawer Toggle ────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggleDrawer}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={drawerOpen ? "Close drawer" : "Open drawer"}
        title={`${drawerOpen ? "Close" : "Open"} Chat Drawer (Cmd+/)`}
      >
        {drawerOpen ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </button>

      {/* ── Center: Search Bar ──────────────────────────────────── */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search records, customers, activities..."
          className="h-8 w-full rounded-md border border-border bg-muted/40 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-offset-background focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
          onFocus={onSearchFocus}
        />
      </div>

      {/* ── Right: User + Role ──────────────────────────────────── */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Role Badge */}
        <Badge
          variant="outline"
          className={`gap-1 px-2 py-0.5 text-xs font-medium ${ROLE_COLOR_MAP[role.color] || ROLE_COLOR_MAP.blue}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              role.color === "blue"
                ? "bg-blue-500"
                : role.color === "orange"
                  ? "bg-orange-500"
                  : "bg-red-500"
            }`}
          />
          {role.label}
        </Badge>

        {/* User Avatar + Name */}
        <div className="flex items-center gap-1.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user?.name || user?.email?.split("@")[0] || "User"}
          </span>
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
