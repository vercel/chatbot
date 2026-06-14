"use client";

/**
 * MobileHeader — Top bar visible only on mobile (< 768px).
 * Phase 17: Navigation Rehaul — mobile parity.
 *
 * Layout: [Hamburger] · Neptune · [Avatar]
 * Sticky top, 48px height, border-b, bg-background.
 *
 * Hamburger opens the shadcn Sidebar as a Sheet.
 * Avatar opens the UserMenu dropdown.
 */

import { Menu, User } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const { toggleSidebar, isMobile } = useSidebar();

  // Only render on mobile
  if (!isMobile) return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-12 items-center justify-between",
        "border-b border-border/50 bg-background/95 backdrop-blur-xl",
        "px-3",
      )}
      role="banner"
    >
      {/* Hamburger */}
      <Button
        aria-label="Open navigation menu"
        className="h-8 w-8"
        onClick={toggleSidebar}
        size="icon"
        variant="ghost"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </Button>

      {/* Brand */}
      <h1 className="text-sm font-semibold tracking-tight select-none">
        Neptune
      </h1>

      {/* Avatar placeholder — the UserMenu renders in the sidebar footer */}
      <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
        <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
    </header>
  );
}
