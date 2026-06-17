"use client";

/**
 * Concept Card — Hover preview for knowledge graph nodes
 *
 * Shows metadata and quick actions when hovering over a node.
 */

import { getTypeColor, getTypeIcon } from "@/lib/knowledge/graph-builder";
import type { D3Node } from "@/lib/knowledge/graph-builder";

interface ConceptCardProps {
  node: D3Node | null;
  position?: { x: number; y: number };
  onOpenFile: (node: D3Node) => void;
  onPinNode: (node: D3Node) => void;
}

export function ConceptCard({
  node,
  position,
  onOpenFile,
  onPinNode,
}: ConceptCardProps) {
  if (!node) return null;

  const color = getTypeColor(node.type);
  const icon = getTypeIcon(node.type);

  return (
    <div
      className="absolute z-50 w-72 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-4 pointer-events-auto"
      style={{
        left: position ? `${position.x}px` : "auto",
        top: position ? `${position.y}px` : "auto",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ background: `${color}20`, color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-50 truncate">
            {node.name}
          </h3>
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: `${color}20`, color }}
          >
            {node.type}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-1.5 mb-3 text-xs">
        {node.domain && (
          <div className="flex justify-between">
            <span className="text-slate-500">Domain</span>
            <span className="text-slate-300">{node.domain}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Version</span>
          <span className="text-slate-300">v{node.version}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Links</span>
          <span className="text-slate-300">{node.linkCount}</span>
        </div>
        {node.description && (
          <p className="text-slate-400 mt-2 line-clamp-3">
            {node.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onOpenFile(node)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 text-xs font-medium hover:bg-teal-500/20 transition-colors"
        >
          Open File
        </button>
        <button
          onClick={() => onPinNode(node)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium hover:bg-slate-700 transition-colors"
        >
          Pin
        </button>
      </div>
    </div>
  );
}
