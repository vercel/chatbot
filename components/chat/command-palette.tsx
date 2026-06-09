"use client";

/**
 * CommandPalette — Cmd+K command palette for Neptune Chat.
 * Pattern: shadcn/ui Command + cmdk under the hood.
 *
 * A11y: ARIA combobox role, keyboard-first navigation, focus trap.
 * Shortcut: Cmd+K (Mac) / Ctrl+K (Windows/Linux) globally.
 */
import {
  BarChart3,
  BookOpen,
  KeyRound,
  MessageSquare,
  Plug,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  panel?: string;
  href?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  onSelectPanel: (panel: any) => void;
  onToggleSidebar: () => void;
}

export function CommandPalette({
  onSelectPanel,
  onToggleSidebar,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // ── Global keyboard shortcut: Cmd+K ─────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runAction = useCallback(
    (item: PaletteAction) => {
      setOpen(false);
      if (item.action) {
        item.action();
      } else if (item.panel) {
        onSelectPanel(item.panel);
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [onSelectPanel, router]
  );

  const navigationItems: PaletteAction[] = [
    { id: "chats", label: "Chats", icon: MessageSquare, shortcut: "⌘1", panel: "chats" },
    { id: "connectors", label: "Connectors", icon: Plug, shortcut: "⌘2", panel: "connectors" },
    { id: "tools", label: "Tools", icon: Wrench, shortcut: "⌘3", panel: "tools" },
    { id: "wiki", label: "Knowledge Base", icon: BookOpen, shortcut: "⌘4", panel: "wiki" },
    { id: "workflows", label: "Workflows", icon: Zap, shortcut: "⌘5", panel: "workflows" },
    { id: "reports", label: "Reports", icon: BarChart3, shortcut: "⌘6", panel: "reports" },
    { id: "secrets", label: "Secrets", icon: KeyRound, shortcut: "⌘7", panel: "secrets" },
  ];

  const appActions: PaletteAction[] = [
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      icon: MessageSquare,
      shortcut: "⌘B",
      action: onToggleSidebar,
    },
    {
      id: "new-chat",
      label: "New Chat",
      icon: MessageSquare,
      shortcut: "⌘N",
      href: "/",
    },
  ];

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runAction(item)}
              value={item.id}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {appActions.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runAction(item)}
              value={item.id}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
