"use client";

/**
 * SkillCard — Phase 36 Stream 2
 * Generative UI component: LLM renders "Here's the skill I'm using" inline.
 * Shows YAML frontmatter, links to file, related skills via KG, last updated.
 */
import { useState, useEffect } from "react";
import {
  Cpu, ChevronDown, ChevronUp, ExternalLink, Clock,
  Tag, Network, BookOpen, Code, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillInfo {
  name: string;
  description: string;
  version: string;
  path: string;
  domain: string;
  type: string;
  tags: string[];
  updated: string;
  totalActions?: number;
  mcp?: boolean;
  customClient?: boolean;
  relatedSkills?: { name: string; path: string }[];
  antiPatterns?: string[];
  patterns?: string[];
}

interface SkillCardProps {
  skill: SkillInfo;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function SkillCard({ skill, expanded: externalExpanded, onToggle, className }: SkillCardProps) {
  const [isExpanded, setIsExpanded] = useState(externalExpanded ?? false);

  useEffect(() => {
    if (externalExpanded !== undefined) setIsExpanded(externalExpanded);
  }, [externalExpanded]);

  const handleToggle = () => {
    setIsExpanded(v => !v);
    onToggle?.();
  };

  const typeConfig: Record<string, { icon: React.ComponentType<{ size?: number }>; color: string }> = {
    skill: { icon: Cpu, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
    playbook: { icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" },
    connector: { icon: Network, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" },
  };

  const config = typeConfig[skill.type] || typeConfig.skill;
  const Icon = config.icon;

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all duration-200",
      config.color.split(" ").slice(-2).join(" "),
      "hover:shadow-sm",
      className
    )}>
      {/* Header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn("flex size-8 items-center justify-center rounded-lg shrink-0", config.color.split(" ").slice(0, 2).join(" "))}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate">{skill.name}</h4>
            {skill.mcp && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium">
                MCP
              </span>
            )}
            {skill.customClient && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-medium">
                Custom
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">v{skill.version}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock size={10} /> {skill.updated}
            </span>
            {skill.totalActions && (
              <>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{skill.totalActions} actions</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-3 py-3 space-y-3 bg-muted/10 animate-in slide-in-from-top-2 duration-150">
          {/* Tags */}
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skill.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground font-medium">
                  <Tag size={9} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* YAML Frontmatter preview */}
          <div className="rounded-md bg-muted/50 border p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">YAML Frontmatter</p>
            <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
              <code>{`type: "${skill.type}"
name: "${skill.name}"
description: "${skill.description.slice(0, 60)}..."
version: "${skill.version}"
domain: "${skill.domain}"
updated: "${skill.updated}"${skill.totalActions ? `\ntotal_actions: ${skill.totalActions}` : ""}${skill.mcp ? "\nmcp: true" : ""}${skill.customClient ? "\ncustom_client: true" : ""}`}</code>
            </pre>
          </div>

          {/* Related Skills */}
          {skill.relatedSkills && skill.relatedSkills.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Related Skills (via KG)</p>
              <div className="space-y-1">
                {skill.relatedSkills.map(rs => (
                  <a
                    key={rs.path}
                    href={`/knowledge?file=${rs.path}`}
                    className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
                  >
                    <Cpu size={10} />
                    {rs.name}
                    <ExternalLink size={9} className="opacity-30" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {skill.patterns && skill.patterns.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <Code size={10} /> Patterns
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
                {skill.patterns.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* Anti-Patterns */}
          {skill.antiPatterns && skill.antiPatterns.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <AlertTriangle size={10} className="text-amber-500" /> Anti-Patterns
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
                {skill.antiPatterns.map((ap, i) => <li key={i}>{ap}</li>)}
              </ul>
            </div>
          )}

          {/* Open file link */}
          <a
            href={`/library/skills?file=${skill.path}`}
            className="inline-flex items-center gap-1.5 text-[10px] text-primary hover:underline font-medium"
          >
            <ExternalLink size={10} />
            Open {skill.path}
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * LLM callable: renders a SkillCard for a given skill path.
 * Usage from LLM: "Here is the skill I'm using: <SkillCard skillPath='connectors/nmi/SKILL.md' />"
 */
export async function fetchSkillInfo(skillPath: string): Promise<SkillInfo | null> {
  try {
    const res = await fetch(`/api/skills/${encodeURIComponent(skillPath)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name || skillPath,
      description: data.description || "",
      version: data.version || "0.1.0",
      path: skillPath,
      domain: data.domain || "unknown",
      type: data.type || "skill",
      tags: data.tags || [],
      updated: data.updated || "",
      totalActions: data.total_actions,
      mcp: data.mcp,
      customClient: data.custom_client,
      relatedSkills: data.related_skills,
    };
  } catch {
    return null;
  }
}
