/**
 * /library/wiki — System Capability Wiki (Phase 22.5)
 *
 * Renders the auto-generated system-capabilities.json as human-legible
 * entity cards organized by section. Filterable, searchable, mobile-responsive.
 *
 * This is THE canonical capability reference — human + machine legible.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { WikiClient } from "./client";
import * as fs from "node:fs";
import * as path from "node:path";

export const metadata: Metadata = {
  title: "Wiki — System Capabilities",
  description: "Browse all connectors, playbooks, skills, functions, workflows, and models",
};

export interface WikiEntity {
  id: string;
  type: string;
  name: string;
  label: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface WikiData {
  generatedAt: string;
  version: string;
  sections: {
    title: string;
    type: string;
    entities: WikiEntity[];
  }[];
  counts: Record<string, number>;
}

function loadCapabilities(): WikiData | null {
  try {
    const capsPath = path.join(process.cwd(), "lib", "system-capabilities.json");
    if (!fs.existsSync(capsPath)) return null;

    const caps = JSON.parse(fs.readFileSync(capsPath, "utf-8"));

    const sections: WikiData["sections"] = [];

    // Connectors
    sections.push({
      title: "Connectors",
      type: "connector",
      entities: (caps.connectors || []).map((c: Record<string, unknown>) => ({
        id: `connector:${c.name}`,
        type: "connector",
        name: c.name as string,
        label: (c.name as string).replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        description: c.playbooksReferencing && Array.isArray(c.playbooksReferencing) && (c.playbooksReferencing as string[]).length > 0
          ? `Used by: ${(c.playbooksReferencing as string[]).join(", ")}`
          : `${c.name} integration`,
        metadata: {
          hasMcp: c.hasMcp,
          hasCustomClient: c.hasCustomClient,
          toolCount: c.toolCount,
          toolNames: c.toolNames,
          playbooksReferencing: c.playbooksReferencing,
        },
      })),
    });

    // Playbooks
    sections.push({
      title: "Playbooks",
      type: "playbook",
      entities: (caps.playbooks || []).map((p: Record<string, unknown>) => ({
        id: `playbook:${p.name}`,
        type: "playbook",
        name: p.name as string,
        label: (p.name as string).replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        description: p.description as string || `${p.name} playbook`,
        metadata: {
          isMeta: p.isMeta,
          version: p.version,
          hasManifest: p.hasManifest,
          requires: p.requires,
        },
      })),
    });

    // Skills
    sections.push({
      title: "Skills",
      type: "skill",
      entities: (caps.skills || []).map((s: Record<string, unknown>) => ({
        id: `skill:${s.name}`,
        type: "skill",
        name: s.name as string,
        label: (s.name as string).replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        description: s.description as string || "",
        metadata: { type: s.type, path: s.path },
      })),
    });

    // Functions
    sections.push({
      title: "Functions",
      type: "function",
      entities: (caps.functions || []).map((f: Record<string, unknown>) => ({
        id: `function:${f.name}`,
        type: "function",
        name: f.name as string,
        label: (f.name as string).replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        description: f.description as string || "",
        metadata: { path: f.path },
      })),
    });

    // Workflows
    sections.push({
      title: "Workflows",
      type: "workflow",
      entities: (caps.workflows || []).map((w: Record<string, unknown>) => ({
        id: `workflow:${w.name}`,
        type: "workflow",
        name: w.name as string,
        label: (w.name as string).replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        description: w.description as string || "",
        metadata: { durable: w.durable, path: w.path },
      })),
    });

    // Models
    sections.push({
      title: "AI Models",
      type: "model",
      entities: (caps.models || []).slice(0, 15).map((m: Record<string, unknown>) => ({
        id: `model:${m.id}`,
        type: "model",
        name: m.id as string,
        label: m.name as string || m.id as string,
        description: m.description as string || "",
        metadata: { provider: m.provider, routeType: m.routeType },
      })),
    });

    return {
      generatedAt: caps.generatedAt,
      version: caps.version || "1.0",
      sections,
      counts: caps.counts || {},
    };
  } catch (err) {
    console.error("[wiki] Failed to load capabilities:", err);
    return null;
  }
}

export default function WikiPage() {
  cookies(); // Force dynamic rendering
  const data = loadCapabilities();

  return <WikiClient data={data} />;
}
