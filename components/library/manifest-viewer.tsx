"use client";

/**
 * ManifestViewer — YAML pretty-print for manifest.yaml files.
 * Phase 22: Premium YAML display with syntax highlighting.
 *
 * Features:
 *  - Glass surface container
 *  - YAML key highlighting (blue keys, green strings, amber numbers)
 *  - Copy button
 *  - Collapsed/expanded toggle for large manifests
 */

import { Check, Copy } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ManifestViewerProps {
  content: string;
  title?: string;
  collapsed?: boolean;
  className?: string;
  maxHeight?: string;
}

/**
 * Simple YAML syntax highlighter.
 * Highlights: keys, strings, numbers, booleans, comments, anchors.
 */
function highlightYAML(yaml: string): string {
  return yaml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((line) => {
      // Comments
      if (/^\s*#/.test(line)) {
        return `<span class="text-muted-foreground/50">${line}</span>`;
      }
      // Key-value pairs
      return line.replace(
        /^(\s*)([\w_-]+)(\s*:\s*)(.*)$/,
        (_, indent, key, sep, value) => {
          let coloredValue = value;
          if (/^(true|false)$/i.test(value.trim())) {
            coloredValue = `<span class="text-amber-400">${value}</span>`;
          } else if (/^\d+(\.\d+)?$/.test(value.trim())) {
            coloredValue = `<span class="text-violet-400">${value}</span>`;
          } else if (/^["'].*["']$/.test(value.trim()) || /^[^{[].+/.test(value.trim())) {
            coloredValue = `<span class="text-emerald-400">${value}</span>`;
          }
          return `${indent}<span class="text-blue-400">${key}</span>${sep}${coloredValue}`;
        }
      );
    })
    .join("\n");
}

export function ManifestViewer({
  content,
  title = "manifest.yaml",
  collapsed: initialCollapsed = false,
  className,
  maxHeight = "320px",
}: ManifestViewerProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => highlightYAML(content), [content]);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div className={cn("rounded-xl glass-1 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-amber-400/60" />
          <span className="text-xs font-mono text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            className="h-6 text-[10px]"
          >
            {collapsed ? "Expand" : "Collapse"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={copyContent}
            className="h-6 w-6"
            aria-label="Copy YAML"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </Button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          className="overflow-auto p-4"
          style={{ maxHeight }}
        >
          <pre
            className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      )}
    </div>
  );
}

export default ManifestViewer;
