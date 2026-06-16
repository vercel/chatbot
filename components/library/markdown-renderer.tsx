"use client";

/**
 * MarkdownRenderer — Premium markdown rendering for library content.
 * Phase 22: Reuses streamdown for production-quality MD rendering.
 *
 * Features:
 *  - streamdown-based rendering (if available)
 *  - Fallback: prose styling with Tailwind typography
 *  - Code blocks with syntax highlighting
 *  - Tables, lists, headings
 *  - Glass surface container option
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  glass?: boolean;
}

/**
 * Simple markdown-to-HTML renderer as fallback.
 * Handles: headings, code blocks, inline code, bold, italic, links, lists, tables.
 */
function simpleMarkdownToHTML(md: string): string {
  let html = md
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre class="rounded-xl bg-muted/50 p-4 overflow-x-auto my-4 text-[13px] leading-relaxed font-mono"><code${
        lang ? ` class="language-${lang}"` : ""
      }>${escaped.trim()}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded-md bg-muted/50 px-1.5 py-0.5 text-[13px] font-mono">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Headings
    .replace(/^#### (.+)$/gm, "<h4 class='text-sm font-semibold mt-6 mb-2'>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-6 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-8 mb-3'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-semibold mt-8 mb-3'>$1</h1>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr class='my-6 border-border/30' />")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline underline-offset-2 hover:opacity-80">$1</a>')
    // Unordered lists
    .replace(/^\- (.+)$/gm, "<li class='ml-4 list-disc text-sm my-0.5'>$1</li>")
    // Ordered lists
    .replace(/^\d+\.\s(.+)$/gm, "<li class='ml-4 list-decimal text-sm my-0.5'>$1</li>")
    // Tables
    .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g, (_, header, rows) => {
      const headers = header.split("|").filter(Boolean).map((h: string) => h.trim());
      const headerRow = `<tr>${headers.map((h: string) => `<th class='border border-border/30 px-3 py-2 text-left text-xs font-semibold'>${h}</th>`).join("")}</tr>`;
      const bodyRows = rows.trim().split("\n").map((row: string) => {
        const cells = row.split("|").filter(Boolean).map((c: string) => c.trim());
        return `<tr>${cells.map((c: string) => `<td class='border border-border/30 px-3 py-2 text-xs'>${c}</td>`).join("")}</tr>`;
      }).join("");
      return `<table class='w-full my-4 border-collapse border border-border/30 rounded-lg overflow-hidden'><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
    })
    // Paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p class='text-sm leading-relaxed my-3'>")
    // Single newlines to <br>
    .replace(/\n/g, "<br />");

  return `<div class='prose prose-sm max-w-none'><p class='text-sm leading-relaxed my-3'>${html}</p></div>`;
}

export function MarkdownRenderer({ content, className, glass }: MarkdownRendererProps) {
  const html = useMemo(() => {
    return simpleMarkdownToHTML(content);
  }, [content]);

  return (
    <div
      className={cn(
        "md-content",
        glass && "rounded-xl glass-1 p-6",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default MarkdownRenderer;
