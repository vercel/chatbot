"use client";

/**
 * useKeyboardShortcuts — global keyboard navigation for Neptune Chat.
 *
 * Shortcuts:
 *   Cmd+B / Ctrl+B    — Toggle sidebar
 *   Cmd+1..9          — Open panel (1=Chats, 2=Connectors, 3=Tools, 4=Wiki, 5=Workflows, 6=Reports, 7=Secrets)
 *   Escape             — Close active panel
 *
 * A11y: All shortcuts are non-destructive and have visible hints in the command palette.
 */
import { useCallback, useEffect } from "react";

interface UseKeyboardShortcutsOptions {
  activePanel: string | null;
  setActivePanel: (panel: any) => void;
  toggleSidebar: () => void;
}

const PANEL_MAP: Record<string, string> = {
  "1": "chats",
  "2": "connectors",
  "3": "tools",
  "4": "wiki",
  "5": "workflows",
  "6": "reports",
  "7": "secrets",
};

export function useKeyboardShortcuts({
  activePanel,
  setActivePanel,
  toggleSidebar,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+B: Toggle sidebar
      if (isMod && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+[1-9]: Open panel (or toggle if already open)
      if (isMod && PANEL_MAP[e.key]) {
        e.preventDefault();
        const target = PANEL_MAP[e.key];
        setActivePanel(activePanel === target ? null : target);
        return;
      }

      // Escape: Close active panel
      if (e.key === "Escape" && activePanel) {
        e.preventDefault();
        setActivePanel(null);
        return;
      }
    },
    [activePanel, setActivePanel, toggleSidebar]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
