"use client";

/**
 * components/canvas/modes/wiki-browser.tsx — Wiki Browser mode.
 *
 * Phase 16.G: Markdown reader with TOC sidebar + cross-references highlighted +
 * 'Ask AI about this' inline buttons.
 */

import { useState } from "react";
import type { ModeProps } from "@/lib/canvas/types";
import { useCanvasSynthesis } from "@/hooks/use-canvas-synthesis";
import { FileText, MessageCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function WikiBrowser({ context, onNavigate }: ModeProps) {
  const wikiPath = context.wikiPath || "";
  const { data, isLoading, error } = useCanvasSynthesis("wiki", wikiPath);
  const [aiQuestion, setAiQuestion] = useState("");

  if (!wikiPath) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No wiki page specified.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── TOC Sidebar ─────────────────────────────────────────────── */}
      <div className="w-48 flex-shrink-0 border-r border-border/30 p-3 overflow-y-auto hidden lg:block">
        <h3 className="text-xs font-medium text-muted-foreground/50 uppercase mb-2">
          On This Page
        </h3>
        {data?.sections && data.sections.length > 0 ? (
          <nav className="space-y-0.5">
            {(data.sections || []).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block text-xs text-muted-foreground/60 hover:text-foreground/80 py-1 transition-colors truncate"
              >
                {section.title}
              </a>
            ))}
          </nav>
        ) : (
          <p className="text-xs text-muted-foreground/30">No sections</p>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-[#0A84FF]" />
            <h2 className="text-xl font-bold">{wikiPath}</h2>
          </div>
          <p className="text-sm text-muted-foreground/60">
            Documentation
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
            <div className="h-4 w-full bg-muted/20 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-muted/20 rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Failed to load wiki content.
          </div>
        ) : (
          <>
            {/* Markdown content */}
            <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none">
              <pre className="text-sm whitespace-pre-wrap bg-muted/20 rounded-lg p-4 font-sans">
                {data?.markdown || "No content available."}
              </pre>
            </div>

            {/* Cross-references */}
            {data?.wikiRefs && data.wikiRefs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Related Pages</h3>
                <div className="space-y-1">
                  {data.wikiRefs.map((ref, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        onNavigate("wiki-browser", { wikiPath: ref.path })
                      }
                      className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/20 transition-colors text-left"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-sm">{ref.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ask AI about this */}
            <div className="rounded-xl border border-border/30 p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Ask AI about this page
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className={cn(
                    "flex-1 h-8 px-3 rounded-lg text-xs",
                    "bg-muted/10 border border-border/30",
                    "focus:outline-none focus:ring-1 focus:ring-primary/20",
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && aiQuestion) {
                      // Send to chat as AI question
                      window.dispatchEvent(
                        new CustomEvent("neptune:chat:ask", {
                          detail: { question: aiQuestion, context: wikiPath },
                        }),
                      );
                      setAiQuestion("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!aiQuestion) return;
                    window.dispatchEvent(
                      new CustomEvent("neptune:chat:ask", {
                        detail: { question: aiQuestion, context: wikiPath },
                      }),
                    );
                    setAiQuestion("");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium",
                    "bg-[#0A84FF] text-white hover:bg-[#0070E0]",
                    "transition-colors disabled:opacity-30",
                  )}
                  disabled={!aiQuestion}
                >
                  Ask
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
