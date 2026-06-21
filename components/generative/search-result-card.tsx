"use client";

/**
 * SearchResultCard — generative UI card for search/discovery tool outputs.
 *
 * Shows:
 *   - Query header with result count + search time
 *   - Top N results with relevance score bars
 *   - Click-to-expand inline detail per result
 *   - Source tags per result
 *
 * Mobile-first 375px. Uses framer-motion + Tailwind glass-card conventions.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Hash,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────

export interface SearchResultItem {
  id: string;
  title: string;
  snippet?: string;
  relevance: number;          // 0.0 - 1.0
  source: string;            // e.g. "knowledge-graph", "cortex", "docs"
  tags?: string[];
  url?: string;
  detailPreview?: Record<string, unknown>;
}

export interface SearchResultData {
  query: string;
  results: SearchResultItem[];
  totalResults?: number;
  searchTimeMs?: number;
}

export interface SearchResultCardProps {
  data: SearchResultData;
  className?: string;
  onResultClick?: (result: SearchResultItem) => void;
}

// ── Config ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  "knowledge-graph": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "cortex": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "docs": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "code": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "skills": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "memory": "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? "bg-white/5 text-white/50 border-white/10";
}

function relevanceColor(score: number): string {
  if (score >= 0.7) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

// ── Component ────────────────────────────────────────────────────────────

export function SearchResultCard({
  data,
  className,
  onResultClick,
}: SearchResultCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalResults = data.totalResults ?? data.results.length;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

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
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Search className="size-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-medium text-foreground/80 italic truncate">
                "{data.query}"
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {totalResults} result{totalResults !== 1 ? "s" : ""}
                </span>
                {data.searchTimeMs !== undefined && (
                  <span className="flex items-center gap-1 text-[10px] text-white/30">
                    <Clock className="size-3" />
                    {data.searchTimeMs}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Results ───────────────────────────────────────────────── */}
        <div className="max-h-[420px] overflow-y-auto">
          <AnimatePresence>
            {data.results.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No results found for "{data.query}"
              </div>
            ) : (
              data.results.map((result, idx) => {
                const isExpanded = expandedId === result.id;
                const relBar = result.relevance;

                return (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.15 }}
                    className={cn(
                      "border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors",
                      isExpanded && "bg-white/[0.02]"
                    )}
                  >
                    {/* Result row */}
                    <div
                      className="px-4 py-2.5 cursor-pointer"
                      onClick={() => toggleExpand(result.id)}
                    >
                      <div className="flex items-start gap-2">
                        {/* Relevance score */}
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                              className={cn("h-full rounded-full", relevanceColor(relBar))}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(relBar * 100)}%` }}
                              transition={{ duration: 0.4, delay: idx * 0.04 }}
                            />
                          </div>
                          <span className="text-[9px] text-white/30 font-mono w-7 text-right">
                            {Math.round(relBar * 100)}%
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground/80 truncate">
                              {result.title}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="size-3 text-white/20 shrink-0" />
                            ) : (
                              <ChevronRight className="size-3 text-white/20 shrink-0" />
                            )}
                          </div>

                          {result.snippet && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                              {result.snippet}
                            </p>
                          )}

                          {/* Tags */}
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {result.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-white/30 border border-white/5"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Source badge */}
                      <div className="flex items-center gap-1.5 mt-1.5 ml-[58px]">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-medium border",
                          getSourceColor(result.source)
                        )}>
                          {result.source}
                        </span>
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[9px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                          >
                            <ExternalLink className="size-2.5" />
                            Open
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3 pl-[60px]">
                            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                              {/* Full snippet */}
                              {result.snippet && (
                                <p className="text-[10px] text-foreground/70 leading-relaxed mb-2">
                                  {result.snippet}
                                </p>
                              )}

                              {/* Detail preview (if available) */}
                              {result.detailPreview && Object.keys(result.detailPreview).length > 0 && (
                                <div>
                                  <span className="text-[9px] text-white/30 uppercase tracking-wider">
                                    Details
                                  </span>
                                  <pre className="text-[10px] text-white/50 font-mono mt-1 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                    {JSON.stringify(result.detailPreview, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>

                            {onResultClick && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onResultClick(result);
                                }}
                                className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium
                                           border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              >
                                <FileText className="size-3" />
                                Open full result
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer status ─────────────────────────────────────────── */}
        {data.totalResults && data.totalResults > data.results.length && (
          <div className="px-4 py-2 border-t border-white/5 text-center text-[10px] text-muted-foreground">
            Showing top {data.results.length} of {data.totalResults} results
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SearchResultCard;
