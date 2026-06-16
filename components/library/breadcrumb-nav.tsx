"use client";

/**
 * BreadcrumbNav — Path-aware breadcrumbs for library navigation.
 * Phase 22: Shows current path depth with clickable segments.
 *
 * Features:
 *  - Auto-generates from usePathname()
 *  - Separator icons (ChevronRight)
 *  - Link segments are clickable
 *  - Last segment is active (non-link)
 *  - Responsive — truncates on mobile
 */

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface BreadcrumbSegment {
  label: string;
  href: string;
  isLast: boolean;
}

const LABEL_OVERRIDES: Record<string, string> = {
  library: "Library",
  playbooks: "Playbooks",
  connectors: "Connectors",
  neptune: "Neptune",
  skills: "Skills",
  workflows: "Workflows",
};

function segmentLabel(segment: string): string {
  return LABEL_OVERRIDES[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BreadcrumbNav({ className }: { className?: string }) {
  const pathname = usePathname();

  const segments = useMemo((): BreadcrumbSegment[] => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, i) => ({
      label: segmentLabel(part),
      href: "/" + parts.slice(0, i + 1).join("/"),
      isLast: i === parts.length - 1,
    }));
  }, [pathname]);

  if (segments.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-sm", className)}
    >
      <Link
        href="/library"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 -ml-1.5"
        aria-label="Library home"
      >
        <Home size={14} />
      </Link>

      {segments.map((seg, i) => (
        <React.Fragment key={seg.href}>
          <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />
          {seg.isLast ? (
            <span className="font-medium text-foreground truncate max-w-[160px] sm:max-w-[320px]">
              {seg.label}
            </span>
          ) : (
            <Link
              href={seg.href}
              className="text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 truncate max-w-[120px] sm:max-w-[200px]"
            >
              {seg.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default BreadcrumbNav;
