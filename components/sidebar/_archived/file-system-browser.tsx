"use client";

import {
  BookOpenIcon,
  FileTextIcon,
  FolderIcon,
  PlugIcon,
  SearchIcon,
  WrenchIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface SkillItem {
  name: string;
  description?: string;
  category?: string;
}

interface ToolItem {
  name: string;
  description: string;
  category: string;
  inputs: Record<string, string>;
}

type Section = "skills" | "prds" | "tools" | "connectors";

interface SectionConfig {
  id: Section;
  label: string;
  icon: React.ReactNode;
  endpoint: string;
  itemKey: string;
}

// ── Section Config ───────────────────────────────────────────────────────

const SECTIONS: SectionConfig[] = [
  {
    id: "skills",
    label: "Skills",
    icon: <BookOpenIcon className="size-4" />,
    endpoint: "/api/skills",
    itemKey: "skills",
  },
  {
    id: "prds",
    label: "PRDs",
    icon: <FileTextIcon className="size-4" />,
    endpoint: "/api/prds",
    itemKey: "prds",
  },
  {
    id: "tools",
    label: "Tools",
    icon: <WrenchIcon className="size-4" />,
    endpoint: "/api/tools",
    itemKey: "tools",
  },
  {
    id: "connectors",
    label: "Connectors",
    icon: <PlugIcon className="size-4" />,
    endpoint: "/api/tools", // For now, connectors are shown as part of tools
    itemKey: "tools",
  },
];

// ── Component ─────────────────────────────────────────────────────────────

export function FileSystemBrowser() {
  const { state } = useSidebar();
  const [expandedSections, setExpandedSections] = useState<
    Record<Section, boolean>
  >({
    skills: true,
    prds: false,
    tools: false,
    connectors: false,
  });
  const [items, setItems] = useState<Record<string, SkillItem[] | ToolItem[]>>(
    {}
  );
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  // Load section data
  const loadSection = useCallback(async (section: SectionConfig) => {
    setLoading((prev) => ({ ...prev, [section.id]: true }));
    try {
      const res = await fetch(section.endpoint);
      if (res.ok) {
        const data = await res.json();
        const loadedItems = data[section.itemKey] ?? [];
        setItems((prev) => ({ ...prev, [section.id]: loadedItems }));
      }
    } catch {
      // Silently fail — items remain empty
    } finally {
      setLoading((prev) => ({ ...prev, [section.id]: false }));
    }
  }, []);

  // Load on first render
  useEffect(() => {
    for (const section of SECTIONS) {
      loadSection(section);
    }
  }, [loadSection]);

  // Toggle section
  const toggleSection = (section: Section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleItemClick = (item: SkillItem | ToolItem, section: Section) => {
    // Dispatch a custom event that the chat input can listen to
    // to inject the item context into the prompt
    const event = new CustomEvent("fs-browser-select", {
      detail: {
        name: item.name,
        description: "description" in item ? item.description : "",
        section,
        category: "category" in item ? item.category : "",
      },
    });
    window.dispatchEvent(event);
  };

  const filterItems = (sectionItems: SkillItem[] | ToolItem[]) => {
    if (!search) {
      return sectionItems;
    }
    const q = search.toLowerCase();
    return sectionItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        ("description" in item &&
          (item as SkillItem).description?.toLowerCase().includes(q))
    );
  };

  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>
          <FolderIcon className="size-4" />
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            Expand to browse
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="px-2 pt-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            type="text"
            value={search}
          />
        </div>
      </div>

      {/* Sections */}
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-2">
          <FolderIcon className="size-4" />
          File System
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {SECTIONS.map((section) => {
              const sectionItems = filterItems(
                (items[section.id] as Array<SkillItem | ToolItem>) ?? []
              );

              return (
                <Collapsible
                  asChild
                  key={section.id}
                  onOpenChange={() => toggleSection(section.id)}
                  open={expandedSections[section.id]}
                >
                  <div>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          {section.icon}
                          <span>{section.label}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {loading[section.id] ? "..." : sectionItems.length}
                          </span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                      <div className="pl-4 pr-2">
                        {loading[section.id] ? (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            Loading...
                          </div>
                        ) : sectionItems.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            No {section.label.toLowerCase()} available
                          </div>
                        ) : (
                          <SidebarMenu>
                            {sectionItems.slice(0, 25).map((item) => (
                              <SidebarMenuItem
                                key={`${section.id}-${item.name}`}
                              >
                                <SidebarMenuButton
                                  className={cn(
                                    "text-xs py-1 h-auto cursor-pointer hover:bg-accent"
                                  )}
                                  onClick={() =>
                                    handleItemClick(item, section.id)
                                  }
                                >
                                  <span className="truncate">{item.name}</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}
