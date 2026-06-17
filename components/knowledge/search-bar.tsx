"use client";

/**
 * Search Bar — Full-text search across knowledge graph
 *
 * Debounced search with results grouped by type.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { SearchResult } from "@/lib/knowledge/parser";
import { getTypeColor } from "@/lib/knowledge/graph-builder";

interface SearchBarProps {
  onSearch: (query: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  placeholder?: string;
}

export function SearchBar({
  onSearch,
  results,
  onSelectResult,
  placeholder = "Search knowledge...",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(value);
        setIsOpen(value.length > 0);
      }, 200);
    },
    [onSearch]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Group results by type
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results.slice(0, 20)) {
    const type = r.node.type;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(r);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              onSearch("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && grouped.size > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
          {Array.from(grouped.entries()).map(([type, items]) => (
            <div key={type}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {type}s ({items.length})
              </div>
              {items.map((result) => (
                <button
                  key={result.node.id}
                  onClick={() => {
                    onSelectResult(result);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-800/50 transition-colors flex items-center gap-3"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: getTypeColor(result.node.type),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">
                      {result.node.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {result.node.path}
                      {result.node.domain && ` · ${result.node.domain}`}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-600">
                    v{result.node.version}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {results.length > 20 && (
            <div className="px-4 py-2 text-xs text-slate-600 text-center border-t border-slate-800">
              +{results.length - 20} more results (refine your search)
            </div>
          )}
        </div>
      )}

      {isOpen && query.length > 0 && grouped.size === 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-center text-sm text-slate-500">
          No results for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
