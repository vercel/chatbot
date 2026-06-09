"use client";
/**
 * ToolsClient — search + expandable tool categories auto-derived from connector registry.
 */
import { ChevronDown, Search, Wrench } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ToolDef {
  name: string;
  description: string;
  inputs: string;
  connectorName?: string;
}

interface Category {
  name: string;
  connectorId?: string;
  brandColor?: string;
  tools: ToolDef[];
}

export function ToolsClient({ categories }: { categories: Category[] }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c.name, true]))
  );

  const filtered = categories
    .map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (t) =>
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => cat.tools.length > 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          type="text"
          value={search}
        />
      </div>

      {filtered.map((cat) => (
        <div key={cat.name}>
          <button
            className="flex items-center gap-2 w-full text-left py-1 mb-2 group"
            onClick={() =>
              setExpanded((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }))
            }
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                !expanded[cat.name] && "-rotate-90"
              )}
            />
            <span className="text-sm font-medium">{cat.name}</span>
            {cat.brandColor && (
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cat.brandColor }}
              />
            )}
            <span className="text-xs text-muted-foreground">
              {cat.tools.length} tools
            </span>
          </button>

          {expanded[cat.name] && (
            <div className="grid gap-2 ml-6">
              {cat.tools.map((tool) => (
                <div
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  key={tool.name}
                >
                  <Wrench className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-primary">
                        {tool.name}
                      </code>
                      {tool.connectorName && (
                        <Badge
                          className="text-[9px] px-1.5 py-0"
                          variant="secondary"
                        >
                          {tool.connectorName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tool.description}
                    </p>
                    <code className="text-[10px] text-muted-foreground/60 mt-1 block truncate">
                      {tool.inputs}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No tools match &quot;{search}&quot;
        </p>
      )}
    </div>
  );
}
