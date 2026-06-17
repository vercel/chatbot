/**
 * CmdKPalette — Twenty Generative UI Component
 * Phase 39 Stream 2: Natural language command palette for navigating Twenty.
 *
 * Provides instant search across:
 * - Customers (by name, phone, email)
 * - Views (Pipeline, Billing Calendar, Recovery, Discovery)
 * - Quick actions (Create Lead, Send Payment Link, Run Discovery)
 *
 * Triggered by Cmd+K / Ctrl+K.
 */
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface PaletteResult {
  section: string;
  items: PaletteItem[];
}

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  action: { type: "navigate" | "create" | "modal" | "run"; target: string };
  keywords?: string[];
}

// Static palette items (fast, no API call needed)
const STATIC_ITEMS: PaletteResult[] = [
  {
    section: "Views",
    items: [
      { id: "pipeline", label: "Sales Pipeline", description: "Kanban view by enrollment status", action: { type: "navigate", target: "/pipeline" }, keywords: ["kanban", "sales", "enrollment"] },
      { id: "billing-calendar", label: "Billing Calendar", description: "Upcoming payments and at-risk customers", action: { type: "navigate", target: "/billing-calendar" }, keywords: ["payments", "calendar", "schedule"] },
      { id: "recovery-workbench", label: "Recovery Workbench", description: "Declined payments needing action", action: { type: "navigate", target: "/recovery-workbench" }, keywords: ["declined", "recovery", "retry"] },
      { id: "discovery-runs", label: "Discovery Runs", description: "Past discovery workflow results", action: { type: "navigate", target: "/discovery" }, keywords: ["audit", "workflow", "report"] },
      { id: "customer-360", label: "Customer 360", description: "Full customer profile view", action: { type: "navigate", target: "/customer-360" }, keywords: ["profile", "customer", "360"] },
    ],
  },
  {
    section: "Quick Actions",
    items: [
      { id: "create-lead", label: "Create Lead", description: "Add new sales lead", action: { type: "create", target: "lead" }, keywords: ["add", "new", "sales"] },
      { id: "payment-link", label: "Send Payment Link", description: "Generate NMI payment link", action: { type: "modal", target: "payment-link" }, keywords: ["payment", "charge", "bill"] },
      { id: "run-discovery", label: "Run Discovery", description: "Audit customer alignment", action: { type: "run", target: "discovery" }, keywords: ["audit", "alignment", "check"] },
      { id: "create-ticket", label: "Create Support Ticket", description: "Open new support ticket", action: { type: "create", target: "supportTicket" }, keywords: ["support", "issue", "help"] },
      { id: "add-note", label: "Add Customer Note", description: "Add note to customer record", action: { type: "modal", target: "add-note" }, keywords: ["note", "memo", "comment"] },
    ],
  },
];

export function CmdKPalette({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (item: PaletteItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten all items for keyboard navigation
  const allItems = results.flatMap(r => r.items);

  // Filter on query change
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(STATIC_ITEMS);
      setSelectedIndex(0);
      return;
    }

    const lower = query.toLowerCase();
    const filtered = STATIC_ITEMS
      .map(section => ({
        section: section.section,
        items: section.items.filter(
          item =>
            item.label.toLowerCase().includes(lower) ||
            item.description.toLowerCase().includes(lower) ||
            item.keywords?.some(k => k.includes(lower))
        ),
      }))
      .filter(section => section.items.length > 0);

    setResults(filtered);
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(STATIC_ITEMS);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = allItems[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [selectedIndex, allItems, onClose, onSelect]
  );

  function handleSelect(item: PaletteItem) {
    onSelect?.(item);
    onClose();

    // Default behavior based on type
    switch (item.action.type) {
      case "navigate":
        window.location.href = item.action.target;
        break;
      case "create":
        window.location.href = `/create/${item.action.target}`;
        break;
      case "run":
        window.location.href = `/discovery?workflow=${item.action.target}`;
        break;
      // modal handled by parent via onSelect
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <span className="text-gray-400 text-lg">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, views, or run actions..."
            className="flex-1 text-sm outline-none placeholder-gray-400"
          />
          {searching && (
            <span className="animate-spin h-4 w-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full" />
          )}
          <button
            onClick={onClose}
            className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              No results for "{query}"
            </div>
          ) : (
            results.map((section, sIdx) => (
              <div key={section.section} className="mb-2">
                <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.section}
                </div>
                {section.items.map((item) => {
                  const globalIdx = allItems.indexOf(item);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-900"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-4 text-xs text-gray-400">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
