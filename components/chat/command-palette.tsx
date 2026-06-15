"use client";

/**
 * CommandPalette — Cmd+K command palette for Neptune Chat.
 * Phase 17: Enhanced with library search + canvas integration.
 *
 * Pattern: shadcn/ui Command + cmdk under the hood.
 *
 * A11y: ARIA combobox role, keyboard-first navigation, focus trap.
 * Shortcut: Cmd+K (Mac) / Ctrl+K (Windows/Linux) globally.
 */

import {
  BarChart3,
  BookOpen,
  Brain,
  FileCode2,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Play,
  Plug,
  Puzzle,
  Sparkles,
  Wrench,
  Zap,
  FolderGit2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasMode } from "@/lib/canvas/types";

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  panel?: string;
  href?: string;
  action?: () => void;
  /** Canvas mode to open on select */
  canvasMode?: CanvasMode;
  canvasContext?: Record<string, string>;
  group?: string;
}

interface CommandPaletteProps {
  onSelectPanel: (panel: any) => void;
  onToggleSidebar: () => void;
}

// ── Static library items for instant search ────────────────────────────────

const LIBRARY_ITEMS: PaletteAction[] = [
  // Connectors
  { id: "connector-nmi", label: "NMI Connector", icon: Puzzle, canvasMode: "connector-detail", canvasContext: { connectorName: "nmi" }, group: "Connectors" },
  { id: "connector-slack", label: "Slack Connector", icon: Puzzle, canvasMode: "connector-detail", canvasContext: { connectorName: "slack" }, group: "Connectors" },
  { id: "connector-github", label: "GitHub Connector", icon: Puzzle, canvasMode: "connector-detail", canvasContext: { connectorName: "github" }, group: "Connectors" },
  { id: "connector-vercel", label: "Vercel Connector", icon: Puzzle, canvasMode: "connector-detail", canvasContext: { connectorName: "vercel" }, group: "Connectors" },
  { id: "connector-vapi", label: "Vapi Connector", icon: Puzzle, canvasMode: "connector-detail", canvasContext: { connectorName: "vapi" }, group: "Connectors" },
  { id: "connector-base44", label: "Base44 Connector", icon: Puzzle, canvasMode: "connector-detail", canvasContext: { connectorName: "base44" }, group: "Connectors" },
  // Skills
  { id: "skill-billing", label: "Billing & Payments", icon: Sparkles, canvasMode: "skill-detail", canvasContext: { skillName: "billing-and-payments" }, group: "Skills" },
  { id: "skill-ui", label: "UI & Design", icon: Sparkles, canvasMode: "skill-detail", canvasContext: { skillName: "ui-and-design" }, group: "Skills" },
  { id: "skill-tool-routing", label: "Tool Routing", icon: Sparkles, canvasMode: "skill-detail", canvasContext: { skillName: "tool-routing" }, group: "Skills" },
  { id: "skill-vps", label: "VPS Operations", icon: Sparkles, canvasMode: "skill-detail", canvasContext: { skillName: "vps-operations" }, group: "Skills" },
  { id: "skill-dispatch", label: "Dispatch", icon: Sparkles, canvasMode: "skill-detail", canvasContext: { skillName: "dispatch" }, group: "Skills" },
  // Playbooks
  { id: "playbook-billing", label: "Billing Flow", icon: FolderGit2, canvasMode: "playbook-detail", canvasContext: { playbookName: "billing-flow" }, group: "Playbooks" },
  { id: "playbook-disputes", label: "Credit Disputes", icon: FolderGit2, canvasMode: "playbook-detail", canvasContext: { playbookName: "credit-disputes" }, group: "Playbooks" },
  { id: "playbook-eng", label: "Engineering", icon: FolderGit2, canvasMode: "playbook-detail", canvasContext: { playbookName: "engineering" }, group: "Playbooks" },
  { id: "playbook-deploy", label: "Deploy (Vercel+GitHub)", icon: FolderGit2, canvasMode: "playbook-detail", canvasContext: { playbookName: "deploy-vercel-github" }, group: "Playbooks" },
  // Workflows
  { id: "workflow-prd-to-deploy", label: "PRD → Deploy", icon: Play, href: "/workflows/prd-to-deploy", group: "Workflows" },
  { id: "workflow-v2", label: "V2 Coding Sessions", icon: Play, href: "/v2-sessions", group: "Workflows" },
  { id: "workflow-sandbox", label: "Sandbox", icon: Play, href: "/sandbox", group: "Workflows" },
];

// ── Navigation items ───────────────────────────────────────────────────────

const NAVIGATION_ITEMS: PaletteAction[] = [
  { id: "chats", label: "Chats", icon: MessageSquare, shortcut: "⌘1", href: "/" },
  { id: "connectors", label: "Connectors", icon: Plug, shortcut: "⌘2", href: "/connectors" },
  { id: "tools", label: "Tools", icon: Wrench, shortcut: "⌘3", href: "/tools" },
  { id: "wiki", label: "Knowledge Base", icon: BookOpen, shortcut: "⌘4", href: "/wiki" },
  { id: "workflows", label: "Workflows", icon: Zap, shortcut: "⌘5", href: "/workflows" },
  { id: "reports", label: "Reports", icon: BarChart3, shortcut: "⌘6", href: "/reports" },
  { id: "secrets", label: "Secrets", icon: KeyRound, shortcut: "⌘7", href: "/secrets" },
];

const APP_ACTIONS: PaletteAction[] = [
  {
    id: "toggle-sidebar",
    label: "Toggle Sidebar",
    icon: LayoutDashboard,
    shortcut: "⌘B",
    action: undefined, // Set at runtime
  },
  {
    id: "new-chat",
    label: "New Chat",
    icon: MessageSquare,
    shortcut: "⌘N",
    href: "/",
  },
  {
    id: "switch-model",
    label: "Switch Model",
    icon: Brain,
    shortcut: "⌘M",
    href: "/tools",
  },
];

export function CommandPalette({
  onSelectPanel,
  onToggleSidebar,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const canvasOpen = useCanvasStore((s) => s.open);

  // ── Wire the toggle action ────────────────────────────────────────
  const actions = useMemo(
    () =>
      APP_ACTIONS.map((a) =>
        a.id === "toggle-sidebar" ? { ...a, action: onToggleSidebar } : a,
      ),
    [onToggleSidebar],
  );

  // ── Global keyboard shortcut: Cmd+K / Ctrl+K ─────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        if (!open) setQuery("");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  // ── Filter library items by query ─────────────────────────────────
  const filteredLibrary = useMemo(() => {
    if (!query) return LIBRARY_ITEMS.slice(0, 8);
    const q = query.toLowerCase();
    return LIBRARY_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.group ?? "").toLowerCase().includes(q),
    );
  }, [query]);

  const filteredNav = useMemo(() => {
    if (!query) return NAVIGATION_ITEMS;
    const q = query.toLowerCase();
    return NAVIGATION_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  const filteredActions = useMemo(() => {
    if (!query) return actions;
    const q = query.toLowerCase();
    return actions.filter((item) => item.label.toLowerCase().includes(q));
  }, [query, actions]);

  // ── Run action ────────────────────────────────────────────────────
  const runAction = useCallback(
    (item: PaletteAction) => {
      setOpen(false);
      setQuery("");

      if (item.canvasMode) {
        canvasOpen(item.canvasMode, item.canvasContext);
        return;
      }
      if (item.action) {
        item.action();
      } else if (item.panel) {
        onSelectPanel(item.panel);
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [onSelectPanel, router, canvasOpen],
  );

  const hasLibrary = filteredLibrary.length > 0;
  const hasNav = filteredNav.length > 0;
  const hasActions = filteredActions.length > 0;
  const hasAny = hasLibrary || hasNav || hasActions;

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput
        onValueChange={setQuery}
        placeholder="Search library, navigate, or run a command..."
        value={query}
      />
      <CommandList>
        {!hasAny && <CommandEmpty>No results found.</CommandEmpty>}

        {hasLibrary && (
          <CommandGroup heading="Library">
            {filteredLibrary.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => runAction(item)}
                value={`${item.label} ${item.id}`}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
                {item.group && (
                  <span className="ml-auto text-[10px] text-muted-foreground/50">
                    {item.group}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasNav && (
          <>
            {hasLibrary && <CommandSeparator />}
            <CommandGroup heading="Navigate">
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => runAction(item)}
                  value={`nav-${item.id}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {hasActions && (
          <>
            {(hasLibrary || hasNav) && <CommandSeparator />}
            <CommandGroup heading="Actions">
              {filteredActions.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => runAction(item)}
                  value={`action-${item.id}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
