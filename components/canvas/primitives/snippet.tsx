"use client";

/**
 * components/canvas/primitives/snippet.tsx — Snippet primitive.
 *
 * Phase 16.F: Single-line invokable code with copy + run buttons.
 * Built on existing CodeBlock AI Element compound pattern.
 */

import { useState, useCallback } from "react";
import { Copy, Play, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnippetProps {
  code: string;
  language?: string;
  label?: string;
  description?: string;
  /** If true, shows a "Run" button that triggers onRun */
  runnable?: boolean;
  onRun?: () => void | Promise<void>;
  className?: string;
}

export function Snippet({
  code,
  language = "typescript",
  label,
  description,
  runnable = false,
  onRun,
  className,
}: SnippetProps) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const handleRun = useCallback(async () => {
    if (!onRun) return;
    setRunning(true);
    try {
      await onRun();
    } finally {
      setRunning(false);
    }
  }, [onRun]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/30 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/20">
        <div className="flex items-center gap-2">
          {label && (
            <span className="text-[11px] font-medium text-muted-foreground/60">
              {label}
            </span>
          )}
          {language && (
            <span className="text-[10px] text-muted-foreground/30 uppercase">
              {language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {runnable && onRun && (
            <button
              onClick={handleRun}
              disabled={running}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
                "bg-[#0A84FF]/10 text-[#0A84FF] hover:bg-[#0A84FF]/20",
                "transition-colors disabled:opacity-50",
              )}
              type="button"
            >
              {running ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Run
            </button>
          )}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
              "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30",
              "transition-colors",
            )}
            type="button"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className="p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all overflow-x-auto">
        <code>{code}</code>
      </pre>

      {/* Description */}
      {description && (
        <p className="px-3 pb-2 text-[11px] text-muted-foreground/50">
          {description}
        </p>
      )}
    </div>
  );
}

// ── Multi-snippet container ───────────────────────────────────────────────────

interface SnippetGroupProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function SnippetGroup({ children, title, className }: SnippetGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
          {title}
        </h4>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}
