"use client";

/**
 * DependencyGraph — SVG visualization of manifest.yaml dependencies.
 * Phase 22: Visual dependency tree for playbooks and connectors.
 *
 * Features:
 *  - SVG-based force layout with nodes and edges
 *  - Interactive hover/tap for node details
 *  - Glass surface container
 *  - Handles both parent→child and peer dependencies
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DepNode {
  id: string;
  label: string;
  type: "playbook" | "connector" | "skill" | "function";
  href?: string;
}

export interface DepEdge {
  from: string;
  to: string;
  label?: string;
}

interface DependencyGraphProps {
  nodes: DepNode[];
  edges: DepEdge[];
  title?: string;
  className?: string;
  onNodeClick?: (node: DepNode) => void;
}

const TYPE_COLORS: Record<string, string> = {
  playbook: "#f59e0b",
  connector: "#06b6d4",
  skill: "#10b981",
  function: "#8b5cf6",
};

const RADIUS = {
  playbook: 22,
  connector: 18,
  skill: 16,
  function: 14,
};

function simpleLayout(nodes: DepNode[], edges: DepEdge[], width: number, height: number) {
  const positioned: { id: string; x: number; y: number }[] = [];
  const centerX = width / 2;
  const centerY = height / 2;

  if (nodes.length === 1) {
    positioned.push({ id: nodes[0].id, x: centerX, y: centerY });
    return positioned;
  }

  // Radial layout
  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    const radius = Math.min(width, height) * 0.35;
    positioned.push({
      id: node.id,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  return positioned;
}

export function DependencyGraph({
  nodes,
  edges,
  title = "Dependencies",
  className,
  onNodeClick,
}: DependencyGraphProps) {
  const width = 400;
  const height = 280;

  const layout = useMemo(
    () => simpleLayout(nodes, edges, width, height),
    [nodes, edges]
  );

  const posMap = useMemo(
    () => Object.fromEntries(layout.map((n) => [n.id, n])),
    [layout]
  );

  return (
    <div className={cn("rounded-xl glass-1 p-4", className)}>
      {title && (
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {title}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Dependency graph: ${title}`}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = posMap[edge.from];
          const to = posMap[edge.to];
          if (!from || !to) return null;
          return (
            <line
              key={`edge-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="oklch(0 0 0 / 0.12)"
              strokeWidth={1.5}
              strokeDasharray={edge.label ? "4 3" : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = posMap[node.id];
          if (!pos) return null;
          const r = RADIUS[node.type] ?? 14;
          const color = TYPE_COLORS[node.type] ?? "#6b7280";
          return (
            <g
              key={node.id}
              onClick={() => onNodeClick?.(node)}
              className={cn(onNodeClick && "cursor-pointer")}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={`${color}15`}
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fontSize={10}
                fontWeight={600}
                className="select-none"
              >
                {node.label.slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div
              className="size-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DependencyGraph;
