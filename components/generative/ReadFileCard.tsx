"use client";

/**
 * ReadFileCard — Generative UI card for view_file / viewGithubFile tool output.
 *
 * M-NEPTUNE-GAPS-CLOSE-AND-LAND Part B2 (2026-06-21)
 *
 * Renders file content with:
 *   - Shiki syntax highlighting (auto-detected from file extension)
 *   - Collapsible past 100 lines
 *   - Copy to clipboard button
 *   - Open on GitHub button
 *   - File metadata header (path, repo, size, lines)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Github,
  FolderOpen,
  Hash,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ReadFileCardProps {
  data: {
    // Standard viewGithubFile output
    content?: string;
    path?: string;
    repo?: string;
    ref?: string;
    size?: number;
    sha?: string;
    encoding?: string;
    html_url?: string;
    cached?: boolean;
    // Fallback: viewFile (VPS/local) output
    source?: string;
    totalLines?: number;
    // Error state
    error?: string;
    status?: number;
    // Candidate suggestions (from VPS view-file tier 3)
    candidates?: string[];
    suggestion?: string;
  };
  className?: string;
}

// ── Language Detection ──────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  md: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  css: "css",
  scss: "scss",
  html: "html",
  htm: "html",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  env: "bash",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  graphql: "graphql",
  gql: "graphql",
  prisma: "prisma",
  dockerfile: "dockerfile",
};

function detectLanguage(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "text";
  const ext = parts[parts.length - 1]?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] || ext;
}

function getFileName(path?: string): string {
  if (!path) return "file";
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function formatSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Syntax Highlighted Content ──────────────────────────────────────────────

function HighlightedCode({
  code,
  language,
  collapsed,
  maxVisibleLines = 100,
}: {
  code: string;
  language: string;
  collapsed: boolean;
  maxVisibleLines?: number;
}) {
  const [highlighted, setHighlighted] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki");
        const html = await codeToHtml(code, {
          lang: language,
          theme: "github-dark",
        });
        if (!cancelled) {
          setHighlighted(html);
          setLoading(false);
        }
      } catch {
        // Shiki fallback — render plain text
        if (!cancelled) {
          setHighlighted(
            `<pre><code>${escapeHtml(code)}</code></pre>`
          );
          setLoading(false);
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const lines = code.split("\n");
  const displayLines = collapsed ? lines.slice(0, maxVisibleLines) : lines;
  const displayCode = displayLines.join("\n");
  const hiddenCount = collapsed ? Math.max(0, lines.length - maxVisibleLines) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Highlighting...
      </div>
    );
  }

  return (
    <div className="relative">
      {highlighted ? (
        <div
          className="overflow-x-auto text-sm leading-relaxed [&_pre]:!bg-transparent [&_pre]:p-4 [&_code]:!bg-transparent [&_.shiki]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-muted-foreground">
          <code>{displayCode}</code>
        </pre>
      )}
      {hiddenCount > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Component ───────────────────────────────────────────────────────────────

export function ReadFileCard({ data, className }: ReadFileCardProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);

  const isError = !!data.error;
  const isCached = !!data.cached;
  const content = data.content ?? "";
  const lines = content ? content.split("\n") : [];
  const totalLines = data.totalLines ?? (content ? lines.length : 0);
  const overThreshold = totalLines > 100;
  const filename = getFileName(data.path);
  const language = detectLanguage(filename);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleOpenGitHub = useCallback(() => {
    if (data.html_url) {
      window.open(data.html_url, "_blank", "noopener,noreferrer");
    }
  }, [data.html_url]);

  // ── Error State ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/30 bg-destructive/5 p-4",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-destructive">
              File not found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.error}
            </p>
            {data.path && (
              <p className="mt-1 text-xs text-muted-foreground">
                Path:{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  {data.repo ? `${data.repo}/${data.path}` : data.path}
                </code>
              </p>
            )}
            {data.candidates && data.candidates.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Did you mean one of these?
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {data.candidates.map((c) => (
                    <li key={c}>
                      <code className="rounded bg-muted px-1 py-0.5">{c}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.suggestion && (
              <p className="mt-2 text-xs italic text-muted-foreground">
                {data.suggestion}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State ──────────────────────────────────────────────────────────
  if (!content) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card p-4",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Empty file</span>
          {data.path && (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {data.path}
            </code>
          )}
        </div>
      </div>
    );
  }

  // ── Normal State ─────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {filename}
              </span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0 text-[10px] font-medium uppercase text-muted-foreground">
                {language}
              </span>
              {isCached && (
                <span className="shrink-0 rounded bg-green-500/10 px-1.5 py-0 text-[10px] font-medium text-green-600">
                  cached
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {data.repo && (
                <span className="flex items-center gap-1">
                  <Github className="h-3 w-3" />
                  {data.repo}
                </span>
              )}
              {data.ref && data.ref !== "main" && (
                <span className="rounded bg-muted px-1 py-0 text-[10px]">
                  {data.ref}
                </span>
              )}
              {data.path && (
                <span className="flex items-center gap-1 truncate">
                  <FolderOpen className="h-3 w-3" />
                  <span className="truncate">{data.path}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] text-muted-foreground">
            {totalLines} lines
            {data.size ? ` · ${formatSize(data.size)}` : ""}
          </span>
          <button
            onClick={handleCopy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {data.html_url && (
            <button
              onClick={handleOpenGitHub}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Open on GitHub"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
          {overThreshold && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={collapsed ? "Show all lines" : "Collapse"}
            >
              {collapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="relative max-h-[500px] overflow-auto bg-[#0d1117]">
        <HighlightedCode
          code={content}
          language={language}
          collapsed={collapsed}
          maxVisibleLines={100}
        />
      </div>

      {/* ── Collapse Footer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {collapsed && overThreshold && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center justify-center gap-2 border-t border-border/50 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
            Show all {totalLines} lines
            <Hash className="h-3 w-3" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── File Metadata Footer ───────────────────────────────────── */}
      {data.sha && (
        <div className="flex items-center gap-3 border-t border-border/50 px-4 py-1.5 text-[10px] text-muted-foreground">
          <span>
            SHA: <code className="rounded bg-muted px-1 py-0">{data.sha.slice(0, 7)}</code>
          </span>
          <span>Encoding: {data.encoding}</span>
          {data.source && <span>Source: {data.source}</span>}
        </div>
      )}
    </motion.div>
  );
}

export default ReadFileCard;
