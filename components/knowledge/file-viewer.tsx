"use client";

/**
 * File Viewer — Markdown render with syntax highlighting
 *
 * Renders a knowledge file with YAML frontmatter display and
 * linked navigation.
 */

import { useState, useEffect } from "react";
import type { KnowledgeFrontmatter } from "@/lib/knowledge/parser";
import { getTypeColor, getTypeIcon } from "@/lib/knowledge/graph-builder";

interface FileViewerProps {
  content: string;
  frontmatter: KnowledgeFrontmatter | null;
  path: string;
  onClose: () => void;
  onLinkClick: (path: string) => void;
}

export function FileViewer({
  content,
  frontmatter,
  path,
  onClose,
  onLinkClick,
}: FileViewerProps) {
  const [renderedContent, setRenderedContent] = useState("");

  useEffect(() => {
    // Simple markdown → HTML renderer
    let html = content;

    // Code blocks (fenced)
    html = html.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (_match, lang, code) => {
        const escaped = escapeHtml(code.trim());
        return `<pre class="bg-slate-950 rounded-lg p-4 my-3 overflow-x-auto text-xs"><code class="text-slate-300 font-mono">${escaped}</code></pre>`;
      }
    );

    // Inline code
    html = html.replace(
      /`([^`]+)`/g,
      '<code class="bg-slate-800 text-teal-400 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
    );

    // Headers
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-200 mt-4 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-slate-100 mt-5 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-50 mt-6 mb-3">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-50 mt-6 mb-4">$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr class="border-slate-700 my-4">');

    // Blockquotes
    html = html.replace(
      /^> (.+)$/gm,
      '<blockquote class="border-l-2 border-teal-500 pl-4 my-2 text-slate-400 italic">$1</blockquote>'
    );

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4 text-slate-300">$1</li>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-slate-300">$1</li>');

    // Tables (simple)
    html = html.replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter(Boolean);
      if (cells.every((c) => c.trim().match(/^-+$/))) return ""; // Separator row
      return `<div class="flex gap-4 py-1 border-b border-slate-800">${cells
        .map((c) => `<span class="flex-1 text-xs text-slate-300">${c.trim()}</span>`)
        .join("")}</div>`;
    });

    // Paragraphs (lines not matching other patterns)
    html = html.replace(
      /^(?!<[a-z/]|#|<hr|<block|<div|<li|<pre)(.+)$/gm,
      '<p class="text-sm text-slate-300 leading-relaxed my-2">$1</p>'
    );

    // Blank lines
    html = html.replace(/^$/gm, '<br>');

    setRenderedContent(html);
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          {frontmatter && (
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{
                background: `${getTypeColor(frontmatter.type || "concept")}20`,
                color: getTypeColor(frontmatter.type || "concept"),
              }}
            >
              {getTypeIcon(frontmatter.type || "concept")}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 truncate">
              {frontmatter?.name || path.split("/").pop()}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">{path}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Frontmatter display */}
      {frontmatter && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex flex-wrap gap-3 text-xs">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: `${getTypeColor(frontmatter.type || "concept")}15`,
                color: getTypeColor(frontmatter.type || "concept"),
              }}
            >
              {frontmatter.type}
            </span>
            {frontmatter.version && (
              <span className="text-slate-500">
                v{frontmatter.version}
              </span>
            )}
            {frontmatter.domain && (
              <span className="text-slate-400">
                Domain: {frontmatter.domain}
              </span>
            )}
            {frontmatter.status && (
              <span
                className={`px-1.5 py-0.5 rounded font-medium ${
                  frontmatter.status === "completed"
                    ? "bg-green-500/10 text-green-400"
                    : frontmatter.status === "in_progress"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-slate-800 text-slate-400"
                }`}
              >
                {frontmatter.status}
              </span>
            )}
          </div>
          {frontmatter.tags && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {frontmatter.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </div>
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
