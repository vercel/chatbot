#!/usr/bin/env tsx
/**
 * KNOWLEDGE VISUALIZER — Generate Static HTML Visualizer from OKF Bundle
 *
 * Reads an OKF bundle (or cortex/) and generates a standalone HTML file
 * with an interactive D3.js force-directed graph visualization of the
 * knowledge layer. Compatible with Google OKF v0.1 visualizer concept.
 *
 * Usage:
 *   pnpm tsx scripts/knowledge-layer/visualize-knowledge.ts [--output /tmp/visualizer.html] [--open]
 *
 * NEPTUNE-KNOWLEDGE-SPEC v1.0 — Reference Implementation
 * Author: hermes agent | Date: 2026-06-17
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}

const CORTEX_ROOT = path.resolve(process.cwd(), "jarvis/cortex");
const OUTPUT = getArg("--output", "/tmp/neptune-knowledge-visualizer.html");
const BUNDLE = getArg("--bundle", "");
const SOURCE = BUNDLE || CORTEX_ROOT;
const OPEN = args.includes("--open");

// ============================================================================
// DATA EXTRACTION
// ============================================================================

interface GraphNode {
  id: string;
  name: string;
  type: string;
  description: string;
  version: string;
  domain?: string;
  path: string;
  linkCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function extractGraphData(): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  function walk(dirPath: string, relativePath: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          const fm: Record<string, string> = {};

          if (fmMatch) {
            for (const line of fmMatch[1].split("\n")) {
              const colonIdx = line.indexOf(":");
              if (colonIdx > 0) {
                const key = line.slice(0, colonIdx).trim();
                let value = line.slice(colonIdx + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                  value = value.slice(1, -1);
                }
                fm[key] = value;
              }
            }
          }

          const nodeId = relPath;
          if (nodeIds.has(nodeId)) continue;
          nodeIds.add(nodeId);

          // Extract links
          const linkMatches = content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
          let linkCount = 0;
          for (const linkMatch of linkMatches) {
            const linkText = linkMatch[1];
            const linkTarget = linkMatch[2];
            if (!linkTarget.startsWith("http") && !linkTarget.startsWith("#")) {
              const resolved = path.resolve(path.dirname(fullPath), linkTarget);
              if (fs.existsSync(resolved)) {
                const targetRelPath = path.relative(SOURCE, resolved);
                edges.push({
                  source: nodeId,
                  target: targetRelPath,
                  label: linkText,
                });
                linkCount++;
              }
            }
          }

          nodes.push({
            id: nodeId,
            name: fm.name || path.basename(entry.name, ".md"),
            type: fm.type || "concept",
            description: (fm.description || "").slice(0, 120),
            version: fm.version || "0.1.0",
            domain: fm.domain || undefined,
            path: relPath,
            linkCount,
          });
        } catch {
          // Skip unreadable files
        }
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        walk(fullPath, relPath);
      }
    }
  }

  walk(SOURCE, "");
  return { nodes, edges };
}

// ============================================================================
// COLOR MAP
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
  skill: "#14B8A6",
  playbook: "#3B82F6",
  prd: "#8B5CF6",
  trd: "#7C3AED",
  design: "#EC4899",
  navigation: "#F43F5E",
  implementation: "#F97316",
  research: "#06B6D4",
  mission: "#22C55E",
  memory: "#F59E0B",
  concept: "#64748B",
  connector: "#84CC16",
  workflow: "#EAB308",
  index: "#94A3B8",
  log: "#94A3B8",
};

function getColor(type: string): string {
  return TYPE_COLORS[type] || TYPE_COLORS.concept;
}

// ============================================================================
// HTML GENERATOR
// ============================================================================

function generateHTML(data: GraphData): string {
  const nodesJSON = JSON.stringify(data.nodes);
  const edgesJSON = JSON.stringify(data.edges);
  const colorMapJSON = JSON.stringify(TYPE_COLORS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neptune Knowledge Visualizer — NKS v1.0</title>
<script src="https://d3js.org/d3.v7.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0F172A;
  color: #F8FAFC;
  overflow: hidden;
  height: 100vh;
}
#app { display: flex; height: 100vh; }
#sidebar {
  width: 320px;
  background: #1E293B;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
#sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #334155;
}
#sidebar-header h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #14B8A6;
  margin-bottom: 4px;
}
#sidebar-header p {
  font-size: 0.75rem;
  color: #64748B;
}
#search {
  margin: 16px;
  padding: 10px 14px;
  background: #0F172A;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #F8FAFC;
  font-size: 0.875rem;
  outline: none;
}
#search:focus { border-color: #14B8A6; }
#filters {
  padding: 0 16px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filter-btn {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  border: 1px solid #334155;
  background: transparent;
  color: #94A3B8;
  cursor: pointer;
  transition: all 150ms;
}
.filter-btn:hover, .filter-btn.active {
  background: #14B8A6;
  border-color: #14B8A6;
  color: #0F172A;
}
#node-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 16px;
}
.node-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 150ms;
  margin-bottom: 4px;
}
.node-item:hover { background: rgba(255,255,255,0.05); }
.node-item.selected { background: rgba(20,184,166,0.15); border: 1px solid rgba(20,184,166,0.3); }
.node-item .name { font-size: 0.8rem; font-weight: 600; }
.node-item .meta { font-size: 0.7rem; color: #64748B; margin-top: 2px; }
.node-item .badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 600;
  margin-right: 4px;
}
#graph-container { flex: 1; position: relative; }
#graph-container svg { width: 100%; height: 100%; }
#detail-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 340px;
  max-height: 50vh;
  background: rgba(15,23,42,0.95);
  backdrop-filter: blur(20px);
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 20px;
  overflow-y: auto;
  display: none;
}
#detail-panel.visible { display: block; }
#detail-panel h3 { font-size: 1rem; color: #14B8A6; margin-bottom: 8px; }
#detail-panel .field { margin-bottom: 6px; font-size: 0.8rem; }
#detail-panel .field-label { color: #64748B; }
#detail-panel .field-value { color: #F8FAFC; }
#detail-panel .links { margin-top: 12px; }
#detail-panel .links a {
  display: block;
  color: #3B82F6;
  font-size: 0.75rem;
  text-decoration: none;
  padding: 2px 0;
}
#detail-panel .links a:hover { color: #14B8A6; }
#stats {
  padding: 12px 16px;
  border-top: 1px solid #334155;
  font-size: 0.7rem;
  color: #64748B;
}
.tooltip {
  position: absolute;
  background: #1E293B;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.75rem;
  pointer-events: none;
  max-width: 260px;
  z-index: 100;
  display: none;
}
.graph-legend {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: #94A3B8;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
</head>
<body>
<div id="app">
  <div id="sidebar">
    <div id="sidebar-header">
      <h1>⚡ Neptune Knowledge</h1>
      <p>NKS v1.0 — ${data.nodes.length} nodes · ${data.edges.length} edges</p>
    </div>
    <input id="search" type="text" placeholder="🔍 Search knowledge...">
    <div id="filters"></div>
    <div id="node-list"></div>
    <div id="stats">
      Generated: ${new Date().toISOString()} | Source: ${SOURCE}
    </div>
  </div>
  <div id="graph-container">
    <div class="graph-legend" id="legend"></div>
    <div id="detail-panel"><h3 id="detail-title"></h3><div id="detail-body"></div></div>
    <div class="tooltip" id="tooltip"></div>
  </div>
</div>
<script>
const nodes = ${nodesJSON};
const edges = ${edgesJSON};
const typeColors = ${colorMapJSON};

let selectedNode = null;
let filteredNodes = [...nodes];
let filteredEdges = [...edges];

// D3 Graph
const container = document.getElementById('graph-container');
const width = container.clientWidth;
const height = container.clientHeight;

const svg = d3.select('#graph-container')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

const g = svg.append('g');

// Zoom
const zoom = d3.zoom()
  .scaleExtent([0.1, 4])
  .on('zoom', (event) => g.attr('transform', event.transform));
svg.call(zoom);

// Legend
const legendEl = document.getElementById('legend');
const types = [...new Set(nodes.map(n => n.type))].sort();
for (const type of types) {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.innerHTML = '<span class="legend-dot" style="background:' + (typeColors[type] || typeColors.concept) + '"></span>' + type;
  legendEl.appendChild(item);
}

// Simulation
const simulation = d3.forceSimulation(filteredNodes)
  .force('link', d3.forceLink(filteredEdges).id(d => d.id).distance(100))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(20));

// Links
const link = g.append('g')
  .selectAll('line')
  .data(filteredEdges)
  .join('line')
  .attr('stroke', '#334155')
  .attr('stroke-width', 1)
  .attr('stroke-opacity', 0.6);

// Nodes
const node = g.append('g')
  .selectAll('circle')
  .data(filteredNodes)
  .join('circle')
  .attr('r', d => Math.max(5, Math.min(15, 5 + d.linkCount * 2)))
  .attr('fill', d => typeColors[d.type] || typeColors.concept)
  .attr('stroke', '#0F172A')
  .attr('stroke-width', 1.5)
  .attr('cursor', 'pointer')
  .call(d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended));

// Labels
const label = g.append('g')
  .selectAll('text')
  .data(filteredNodes)
  .join('text')
  .text(d => d.name.length > 25 ? d.name.slice(0, 22) + '...' : d.name)
  .attr('font-size', 8)
  .attr('fill', '#94A3B8')
  .attr('text-anchor', 'middle')
  .attr('dy', d => (Math.max(5, Math.min(15, 5 + d.linkCount * 2))) + 12)
  .style('pointer-events', 'none');

// Tick
simulation.on('tick', () => {
  link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);
  node.attr('cx', d => d.x).attr('cy', d => d.y);
  label.attr('x', d => d.x).attr('y', d => d.y);
});

// Interactions
const tooltip = document.getElementById('tooltip');
const detailPanel = document.getElementById('detail-panel');

node
  .on('mouseover', (event, d) => {
    tooltip.style.display = 'block';
    tooltip.innerHTML = '<strong>' + d.name + '</strong><br>' +
      '<span style="color:#64748B">' + d.type + ' v' + d.version + '</span><br>' +
      (d.description ? d.description.slice(0,100) : '') +
      '<br><span style="color:#14B8A6">Links: ' + d.linkCount + '</span>';
  })
  .on('mousemove', (event) => {
    tooltip.style.left = (event.pageX - container.getBoundingClientRect().left + 12) + 'px';
    tooltip.style.top = (event.pageY - container.getBoundingClientRect().top - 12) + 'px';
  })
  .on('mouseout', () => { tooltip.style.display = 'none'; })
  .on('click', (event, d) => selectNode(d));

// Drag functions
function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null; d.fy = null;
}

// Selection
function selectNode(d) {
  selectedNode = d;
  document.querySelectorAll('.node-item').forEach(el => el.classList.remove('selected'));
  document.getElementById('node-' + d.id.replace(/[^a-zA-Z0-9]/g, '_'))?.classList.add('selected');

  detailPanel.classList.add('visible');
  document.getElementById('detail-title').textContent = d.name;
  let html = '<div class="field"><span class="field-label">Type:</span> <span class="field-value">' + d.type + '</span></div>';
  html += '<div class="field"><span class="field-label">Path:</span> <span class="field-value">' + d.path + '</span></div>';
  html += '<div class="field"><span class="field-label">Version:</span> <span class="field-value">' + d.version + '</span></div>';
  if (d.domain) html += '<div class="field"><span class="field-label">Domain:</span> <span class="field-value">' + d.domain + '</span></div>';
  if (d.description) html += '<div class="field"><span class="field-label">Description:</span> <span class="field-value">' + d.description + '</span></div>';
  html += '<div class="field"><span class="field-label">Links:</span> <span class="field-value">' + d.linkCount + '</span></div>';

  // Show connected nodes
  const connectedEdges = filteredEdges.filter(e => e.source.id === d.id || e.target.id === d.id);
  if (connectedEdges.length > 0) {
    html += '<div class="links"><strong>Connected to:</strong>';
    for (const edge of connectedEdges.slice(0, 10)) {
      const other = edge.source.id === d.id ? edge.target : edge.source;
      html += '<a href="#" onclick="event.preventDefault();selectNodeById(\\'' + other.id + '\\')">→ ' + (other.name || other.id) + '</a>';
    }
    if (connectedEdges.length > 10) html += '<span style="font-size:0.7rem;color:#64748B">... and ' + (connectedEdges.length - 10) + ' more</span>';
    html += '</div>';
  }

  document.getElementById('detail-body').innerHTML = html;

  // Highlight connected nodes
  node.attr('opacity', n => {
    if (n.id === d.id) return 1;
    return connectedEdges.some(e => e.source.id === n.id || e.target.id === n.id) ? 0.8 : 0.2;
  });
  link.attr('opacity', l => {
    return (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1;
  });
}

// Search
document.getElementById('search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  if (!query) {
    filteredNodes = [...nodes];
    filteredEdges = [...edges];
  } else {
    filteredNodes = nodes.filter(n =>
      n.name.toLowerCase().includes(query) ||
      n.type.toLowerCase().includes(query) ||
      (n.description && n.description.toLowerCase().includes(query))
    );
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = edges.filter(e => nodeIds.has(e.source.id || e.source) && nodeIds.has(e.target.id || e.target));
  }
  updateGraph();
});

// Filter buttons
const filtersDiv = document.getElementById('filters');
const allTypes = [...new Set(nodes.map(n => n.type))].sort();
const activeFilters = new Set();
function addFilterBtn(type) {
  const btn = document.createElement('button');
  btn.className = 'filter-btn';
  btn.textContent = type;
  btn.onclick = () => {
    if (activeFilters.has(type)) { activeFilters.delete(type); btn.classList.remove('active'); }
    else { activeFilters.add(type); btn.classList.add('active'); }
    applyFilters();
  };
  filtersDiv.appendChild(btn);
}
addFilterBtn('ALL');
for (const type of allTypes) addFilterBtn(type);

function applyFilters() {
  const query = document.getElementById('search').value.toLowerCase();
  if (activeFilters.size === 0 || activeFilters.has('ALL')) {
    filteredNodes = [...nodes];
  } else {
    filteredNodes = nodes.filter(n => activeFilters.has(n.type));
  }
  if (query) {
    filteredNodes = filteredNodes.filter(n =>
      n.name.toLowerCase().includes(query) ||
      n.type.toLowerCase().includes(query) ||
      (n.description && n.description.toLowerCase().includes(query))
    );
  }
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  filteredEdges = edges.filter(e => nodeIds.has(e.source.id || e.source) && nodeIds.has(e.target.id || e.target));
  updateGraph();
}

// Node list
const nodeListEl = document.getElementById('node-list');
function renderNodeList() {
  nodeListEl.innerHTML = '';
  const sorted = [...filteredNodes].sort((a,b) => a.name.localeCompare(b.name));
  for (const n of sorted.slice(0, 200)) {
    const div = document.createElement('div');
    div.className = 'node-item';
    div.id = 'node-' + n.id.replace(/[^a-zA-Z0-9]/g, '_');
    div.innerHTML = '<div class="name"><span class="badge" style="background:' + (typeColors[n.type] || typeColors.concept) + ';color:#0F172A">' + n.type + '</span>' + n.name + '</div>' +
      '<div class="meta">' + (n.domain||'') + ' · v' + n.version + ' · ' + n.linkCount + ' links</div>';
    div.onclick = () => selectNode(n);
    nodeListEl.appendChild(div);
  }
  if (sorted.length > 200) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size:0.7rem;color:#64748B;padding:8px;';
    note.textContent = '... and ' + (sorted.length - 200) + ' more (use search to narrow)';
    nodeListEl.appendChild(note);
  }
}
renderNodeList();

function updateGraph() {
  node.data(filteredNodes).join('circle')
    .attr('r', d => Math.max(5, Math.min(15, 5 + d.linkCount * 2)))
    .attr('fill', d => typeColors[d.type] || typeColors.concept);
  link.data(filteredEdges).join('line');
  label.data(filteredNodes).join('text')
    .text(d => d.name.length > 25 ? d.name.slice(0, 22) + '...' : d.name);
  simulation.nodes(filteredNodes);
  simulation.force('link').links(filteredEdges);
  simulation.alpha(1).restart();
  renderNodeList();
  node.attr('opacity', 1);
  link.attr('opacity', 0.6);
  detailPanel.classList.remove('visible');
}

// Initial zoom
svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.6));
</script>
</body>
</html>`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   KNOWLEDGE VISUALIZER GENERATOR       ║");
  console.log("║   NEPTUNE-KNOWLEDGE-SPEC v1.0          ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`Source: ${SOURCE}`);
  console.log(`Output: ${OUTPUT}`);
  console.log("");

  console.log("📊 Extracting graph data...");
  const data = extractGraphData();
  console.log(`   Nodes: ${data.nodes.length}`);
  console.log(`   Edges: ${data.edges.length}`);

  console.log("🎨 Generating HTML visualizer...");
  const html = generateHTML(data);
  fs.writeFileSync(OUTPUT, html, "utf-8");
  console.log(`   Size: ${(html.length / 1024).toFixed(1)} KB`);

  console.log("");
  console.log("═══ COMPLETE ═══");
  console.log(`📄 Visualizer: ${OUTPUT}`);

  if (OPEN) {
    console.log("🌐 Opening in browser...");
    try {
      execSync(`xdg-open ${OUTPUT} || open ${OUTPUT}`, { stdio: "ignore" });
    } catch {
      console.log("   Could not auto-open. Open manually:");
      console.log(`   file://${OUTPUT}`);
    }
  } else {
    console.log(`   Open: file://${OUTPUT}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
