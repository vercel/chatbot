"use client";

/**
 * CommandPalette — ⌘K library-wide fuzzy search.
 * Phase 22: cmdk wrapper that indexes all library entities from APIs.
 *
 * Features:
 *  - Opens on ⌘K / Ctrl+K
 *  - Fuzzy searches across playbooks, connectors, skills, functions, workflows
 *  - Grouped results with icons
 *  - Keyboard nav (↑↓ Enter Esc)
 *  - Loading skeleton state
 *  - Glass-3 elevation styling
 */

import {
  BookOpen,
  Code2,
  FileText,
  FolderGit2,
  FunctionSquare,
  Plug,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  type: "playbook" | "connector" | "skill" | "function" | "workflow" | "page";
  description?: string;
  href: string;
  domain?: string;
  keywords?: string[];
}

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  playbook: { icon: FolderGit2, label: "Playbook", color: "text-amber-400" },
  connector: { icon: Plug, label: "Connector", color: "text-cyan-400" },
  skill: { icon: Sparkles, label: "Skill", color: "text-emerald-400" },
  function: { icon: FunctionSquare, label: "Function", color: "text-violet-400" },
  workflow: { icon: Workflow, label: "Workflow", color: "text-orange-400" },
  page: { icon: FileText, label: "Page", color: "text-muted-foreground" },
};

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchAllEntities(): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Static pages
  results.push(
    { id: "lib-home", name: "Library", type: "page", href: "/library", description: "Agent OS file system home", keywords: ["home", "files", "browse"] },
    { id: "lib-playbooks", name: "Playbooks", type: "page", href: "/library/playbooks", description: "Browse all playbook domains", keywords: ["domain", "business"] },
    { id: "lib-connectors", name: "Connectors", type: "page", href: "/library/connectors", description: "Browse all connectors", keywords: ["integration", "api", "mcp"] },
    { id: "lib-neptune", name: "Neptune", type: "page", href: "/library/neptune", description: "Agent-as-connector view", keywords: ["agent", "ai"] }
  );

  try {
    const [connectorsRes, skillsRes] = await Promise.allSettled([
      fetch("/api/connectors"),
      fetch("/api/skills"),
    ]);

    if (connectorsRes.status === "fulfilled" && connectorsRes.value.ok) {
      const data = await connectorsRes.value.json();
      const items = data.connectors ?? [];
      for (const c of items) {
        results.push({
          id: `connector-${c.id}`,
          name: c.name ?? c.id,
          type: "connector",
          href: `/library/connectors/${c.id}`,
          description: c.description ?? "",
          keywords: [c.id, "connector", "integration"],
        });
      }
    }

    if (skillsRes.status === "fulfilled" && skillsRes.value.ok) {
      const data = await skillsRes.value.json();
      const skills = data.skills ?? [];
      for (const s of skills) {
        results.push({
          id: `skill-${s.id ?? s.name}`,
          name: s.name ?? s.id,
          type: "skill",
          href: `/library/skills/${s.id ?? s.name}`,
          description: s.description ?? "",
          domain: s.domain,
          keywords: ["skill", s.domain ?? ""],
        });
      }
    }
  } catch {
    // Silent — use static results as fallback
  }

  return results;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch on mount
  useEffect(() => {
    setLoading(true);
    fetchAllEntities().then((r) => {
      setResults(r);
      setLoading(false);
    });
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement) &&
          (e.target.isContentEditable ||
            e.target.tagName === "INPUT" ||
            e.target.tagName === "TEXTAREA" ||
            e.target.tagName === "SELECT")
        ) {
          return;
        }
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="glass-3 rounded-2xl overflow-hidden">
        <CommandInput
          placeholder="Search playbooks, connectors, skills, functions..."
          className="border-0 bg-transparent"
        />

        <CommandList className="max-h-[320px]">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Search size={24} className="opacity-30" />
                  <span>No results found</span>
                  <span className="text-xs">Try a different search term</span>
                </div>
              </CommandEmpty>

              <CommandGroup heading="Pages">
                {results
                  .filter((r) => r.type === "page")
                  .map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.name + " " + (r.description ?? "")}
                      onSelect={() => navigate(r.href)}
                      className="flex items-center gap-3 py-2"
                    >
                      <FileText size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{r.name}</span>
                        {r.description && (
                          <span className="text-xs text-muted-foreground truncate">{r.description}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Connectors">
                {results
                  .filter((r) => r.type === "connector")
                  .slice(0, 10)
                  .map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.name + " " + (r.description ?? "")}
                      onSelect={() => navigate(r.href)}
                      className="flex items-center gap-3 py-2"
                    >
                      <Plug size={16} className="text-cyan-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{r.name}</span>
                        {r.description && (
                          <span className="text-xs text-muted-foreground truncate">{r.description}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Skills">
                {results
                  .filter((r) => r.type === "skill")
                  .slice(0, 10)
                  .map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.name + " " + (r.description ?? "")}
                      onSelect={() => navigate(r.href)}
                      className="flex items-center gap-3 py-2"
                    >
                      <Sparkles size={16} className="text-emerald-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{r.name}</span>
                        {r.description && (
                          <span className="text-xs text-muted-foreground truncate">{r.description}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd> Open
            </span>
          </div>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </CommandDialog>
  );
}

export default CommandPalette;
