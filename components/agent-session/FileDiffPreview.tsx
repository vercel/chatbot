"use client";

/**
 * FileDiffPreview — Syntax-highlighted file change preview (truncated at 500 lines).
 *
 * Shows:
 *   - File path + change type badge (added/modified/deleted)
 *   - Collapsible diff view with +/− line indicators
 *   - "Show more" toggle when >50 lines
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCode, Plus, Minus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileChange {
  path: string;
  changeType: "added" | "modified" | "deleted";
  diff?: string;
  additions?: number;
  deletions?: number;
}

export interface FileDiffPreviewProps {
  files: FileChange[];
  maxFiles?: number;
  maxLines?: number;
  className?: string;
}

const CHANGE_BADGES: Record<string, { icon: typeof FileCode; color: string; label: string }> = {
  added: { icon: Plus, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Added" },
  modified: { icon: Pencil, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Modified" },
  deleted: { icon: Minus, color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Deleted" },
};

export function FileDiffPreview({
  files,
  maxFiles = 10,
  maxLines = 500,
  className,
}: FileDiffPreviewProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  if (!files || files.length === 0) return null;

  const displayFiles = files.slice(0, maxFiles);
  const remaining = files.length - maxFiles;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5 mb-2">
        <FileCode className="size-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
          Files Changed ({files.length})
        </span>
      </div>

      <div className="space-y-0.5">
        {displayFiles.map((file) => {
          const badge = CHANGE_BADGES[file.changeType] || CHANGE_BADGES.modified;
          const BadgeIcon = badge.icon;
          const isExpanded = expandedFile === file.path;

          return (
            <div key={file.path} className="rounded-lg bg-black/10 border border-white/5 overflow-hidden">
              <button
                onClick={() => setExpandedFile(isExpanded ? null : file.path)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <BadgeIcon className="size-3 shrink-0" />
                <span className="text-xs font-mono text-foreground/80 truncate flex-1">
                  {file.path}
                </span>
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full border shrink-0",
                    badge.color
                  )}
                >
                  {badge.label}
                </span>
                {file.additions !== undefined && (
                  <span className="text-[9px] text-emerald-400">+{file.additions}</span>
                )}
                {file.deletions !== undefined && (
                  <span className="text-[9px] text-red-400">-{file.deletions}</span>
                )}
                {isExpanded ? (
                  <ChevronUp className="size-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Expanded diff */}
              <AnimatePresence>
                {isExpanded && file.diff && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <pre className="text-[10px] bg-black/20 p-2 max-h-[200px] overflow-y-auto text-white/60 font-mono leading-relaxed border-t border-white/5">
                      {file.diff.split("\n").slice(0, maxLines).map((line, i) => {
                        let lineClass = "text-white/40";
                        if (line.startsWith("+")) lineClass = "text-emerald-400/80";
                        else if (line.startsWith("-")) lineClass = "text-red-400/80";
                        else if (line.startsWith("@@")) lineClass = "text-cyan-400/60";

                        return (
                          <div key={i} className={lineClass}>
                            {line}
                          </div>
                        );
                      })}
                      {file.diff.split("\n").length > maxLines && (
                        <div className="text-white/20 italic mt-1">
                          ... {file.diff.split("\n").length - maxLines} more lines
                        </div>
                      )}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {remaining > 0 && (
          <div className="text-center text-[10px] text-white/20 py-1">
            +{remaining} more files
          </div>
        )}
      </div>
    </div>
  );
}
