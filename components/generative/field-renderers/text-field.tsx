"use client";

import { cn } from "@/lib/utils";

/**
 * Default text field renderer.
 */
export function TextField({
  label,
  value,
  mono = false,
  className = "",
}: {
  label?: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {label && (
        <span className="block text-[10px] uppercase tracking-wider text-white/30">{label}</span>
      )}
      <span className={cn("text-sm text-white/80", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
