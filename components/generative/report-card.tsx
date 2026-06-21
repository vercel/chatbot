"use client";

/**
 * ReportCard — generative UI card for any report tool output.
 *
 * Shows:
 *   - Title + relative timestamp
 *   - Markdown body (rendered via @streamdown)
 *   - Source attribution section
 *   - Export buttons: Copy Markdown, CSV
 *
 * Mobile-first 375px. Uses framer-motion + Tailwind glass-card conventions.
 */

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  Copy,
  Download,
  CheckCheck,
  ExternalLink,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────

export interface ReportSource {
  name: string;
  url?: string;
  attribution: string;
}

export interface ReportCardData {
  title: string;
  timestamp?: string;
  body: string;               // markdown content
  sources?: ReportSource[];
  reportType?: string;
}

export interface ReportCardProps {
  data: ReportCardData;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const streamingHints = `
This is markdown plain rendering.
For full formatting (tables, code blocks, headings), see the Streamdown integration note.
`;

// ── Component ────────────────────────────────────────────────────────────

export function ReportCard({
  data,
  className,
}: ReportCardProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const hasSources = data.sources && data.sources.length > 0;
  const relTime = relativeTime(data.timestamp);

  // Copy markdown to clipboard
  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = data.body;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data.body]);

  // Export as CSV (extract markdown tables to CSV)
  const handleExportCsv = useCallback(() => {
    setExportingCsv(true);
    try {
      // Extract markdown tables
      const tableRe = /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g;
      let csv = "";
      let match;
      while ((match = tableRe.exec(data.body)) !== null) {
        const headerRow = match[1];
        const bodyRows = match[2];
        if (!headerRow || !bodyRows) continue;

        const headers = headerRow.split("|").map((h) => h.trim()).filter(Boolean);
        csv += headers.join(",") + "\n";

        const rows = bodyRows.split("\n").filter((r) => r.trim());
        for (const row of rows) {
          const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
          csv += cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",") + "\n";
        }
        csv += "\n";
      }

      if (!csv) {
        // No tables found, export body as-is
        csv = data.body;
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(data.title || "report").replace(/\s+/g, "-").toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }, [data.body, data.title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl",
        "border-white/10 bg-white/5",
        "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {/* Glass shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="p-4 pb-2">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
              <FileText className="size-4 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                {data.title || "Report"}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {data.reportType && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/40 border border-white/10 capitalize">
                    {data.reportType}
                  </span>
                )}
                {data.timestamp && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    {relTime}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className={cn(
            "p-3 rounded-lg border border-white/5 bg-white/[0.02]",
            "max-h-[320px] overflow-y-auto"
          )}>
            <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono">
              {data.body}
            </div>
          </div>
        </div>

        {/* ── Sources ───────────────────────────────────────────────── */}
        {hasSources && (
          <div className="px-4 pb-1">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground/70 transition-colors"
            >
              {sourcesExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              Sources ({data.sources!.length})
            </button>

            {sourcesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="mt-1 space-y-1"
              >
                {data.sources!.map((src, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px] text-white/40 px-2 py-1 rounded bg-white/[0.02]"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="font-medium text-white/50">{src.name}</span>
                    <span className="text-white/20">·</span>
                    <span className="truncate">{src.attribution}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* ── Export Bar ────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-white/5 flex flex-wrap gap-2">
          {/* Copy Markdown */}
          <button
            onClick={handleCopyMarkdown}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              copied
                ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10"
                : "border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
            )}
          >
            {copied ? (
              <CheckCheck className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "Copied!" : "Copy Markdown"}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              "border-white/10 text-white/50 hover:text-white/80 hover:border-white/20",
              exportingCsv && "opacity-50 cursor-not-allowed"
            )}
          >
            <FileSpreadsheet className="size-3" />
            {exportingCsv ? "Exporting..." : "CSV"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ReportCard;
