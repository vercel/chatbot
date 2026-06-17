"use client";

/**
 * Knowledge Graph — Interactive D3 Force-Directed Graph
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Renders an interactive D3.js force-directed graph of the knowledge layer.
 */

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type {
  D3Node,
  D3Edge,
  D3GraphData,
} from "@/lib/knowledge/graph-builder";
import {
  getTypeColor,
  getNodeRadius,
} from "@/lib/knowledge/graph-builder";

interface KnowledgeGraphProps {
  data: D3GraphData;
  onNodeClick: (node: D3Node) => void;
  onNodeHover: (node: D3Node | null) => void;
  selectedNodeId?: string;
  width?: number;
  height?: number;
}

export function KnowledgeGraph({
  data,
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  width = 800,
  height = 600,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);

  const render = useCallback(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Initial transform
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.7)
    );

    // Simulation
    const simulation = d3
      .forceSimulation<D3Node>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Edge>(data.edges)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide().radius((d) => getNodeRadius(d) + 5))
      .alphaDecay(0.02);

    simulationRef.current = simulation;

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, D3Edge>("line")
      .data(data.edges)
      .join("line")
      .attr("stroke", "#334155")
      .attr("stroke-width", (d) => {
        const isConnected =
          d.source.id === selectedNodeId || d.target.id === selectedNodeId;
        return isConnected ? 2 : 0.8;
      })
      .attr("stroke-opacity", (d) => {
        const isConnected =
          d.source.id === selectedNodeId || d.target.id === selectedNodeId;
        return isConnected ? 0.8 : 0.3;
      });

    // Nodes
    const node = g
      .append("g")
      .selectAll<SVGCircleElement, D3Node>("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", (d) => getTypeColor(d.type))
      .attr("stroke", "#0F172A")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .attr("opacity", (d) => {
        if (!selectedNodeId) return 1;
        const isSelected = d.id === selectedNodeId;
        const isConnected =
          data.edges.some(
            (e) =>
              (e.source.id === selectedNodeId && e.target.id === d.id) ||
              (e.target.id === selectedNodeId && e.source.id === d.id)
          );
        return isSelected ? 1 : isConnected ? 0.7 : 0.2;
      })
      .on("click", (_event, d) => {
        onNodeClick(d);
      })
      .on("mouseenter", (_event, d) => {
        onNodeHover(d);
      })
      .on("mouseleave", () => {
        onNodeHover(null);
      })
      .call(
        d3
          .drag<SVGCircleElement, D3Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Labels
    const label = g
      .append("g")
      .selectAll<SVGTextElement, D3Node>("text")
      .data(data.nodes)
      .join("text")
      .text((d) =>
        d.name.length > 30 ? d.name.slice(0, 27) + "..." : d.name
      )
      .attr("font-size", 7)
      .attr("fill", "#94A3B8")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getNodeRadius(d) + 10)
      .style("pointer-events", "none")
      .attr("opacity", (d) => {
        if (!selectedNodeId) return 0.8;
        const isSelected = d.id === selectedNodeId;
        const isConnected = data.edges.some(
          (e) =>
            (e.source.id === selectedNodeId && e.target.id === d.id) ||
            (e.target.id === selectedNodeId && e.source.id === d.id)
        );
        return isSelected ? 1 : isConnected ? 0.6 : 0.1;
      });

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as D3Node).x ?? 0)
        .attr("y1", (d) => (d.source as D3Node).y ?? 0)
        .attr("x2", (d) => (d.target as D3Node).x ?? 0)
        .attr("y2", (d) => (d.target as D3Node).y ?? 0);

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);

      label.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [data, width, height, selectedNodeId, onNodeClick, onNodeHover]);

  useEffect(() => {
    render();
    return () => {
      simulationRef.current?.stop();
    };
  }, [render]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full h-full rounded-xl"
      style={{ background: "transparent" }}
    />
  );
}
