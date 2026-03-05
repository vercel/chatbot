"use client";

import { useCallback, useEffect, useRef } from "react";

export type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category?: string;
  enabled?: boolean;
};

export type UseKeyboardShortcutsOptions = {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  preventDefault = true,
  stopPropagation = false,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const matchingShortcut = shortcutsRef.current.find(
        (shortcut) =>
          shortcut.enabled !== false &&
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          !!shortcut.ctrlKey === event.ctrlKey &&
          !!shortcut.shiftKey === event.shiftKey &&
          !!shortcut.altKey === event.altKey &&
          !!shortcut.metaKey === event.metaKey
      );

      if (matchingShortcut) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }

        matchingShortcut.action();
      }
    },
    [enabled, preventDefault, stopPropagation]
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);

  const addShortcut = useCallback((shortcut: KeyboardShortcut) => {
    shortcutsRef.current = [...shortcutsRef.current, shortcut];
  }, []);

  const removeShortcut = useCallback((key: string, modifiers: Partial<Pick<KeyboardShortcut, "ctrlKey" | "shiftKey" | "altKey" | "metaKey">>) => {
    shortcutsRef.current = shortcutsRef.current.filter(
      (shortcut) =>
        !(
          shortcut.key === key &&
          !!shortcut.ctrlKey === !!modifiers.ctrlKey &&
          !!shortcut.shiftKey === !!modifiers.shiftKey &&
          !!shortcut.altKey === !!modifiers.altKey &&
          !!shortcut.metaKey === !!modifiers.metaKey
        )
    );
  }, []);

  return {
    addShortcut,
    removeShortcut,
  };
}

// Common chat shortcuts
export function useChatKeyboardShortcuts({
  onNewChat,
  onClearChat,
  onToggleSidebar,
  onSearch,
  onExport,
  onSettings,
  onFocusInput,
  onPreviousMessage,
  onNextMessage,
  onCopyMessage,
  onDeleteMessage,
}: {
  onNewChat?: () => void;
  onClearChat?: () => void;
  onToggleSidebar?: () => void;
  onSearch?: () => void;
  onExport?: () => void;
  onSettings?: () => void;
  onFocusInput?: () => void;
  onPreviousMessage?: () => void;
  onNextMessage?: () => void;
  onCopyMessage?: () => void;
  onDeleteMessage?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "n",
      ctrlKey: true,
      action: onNewChat || (() => {}),
      description: "New Chat",
      category: "Chat",
    },
    {
      key: "l",
      ctrlKey: true,
      shiftKey: true,
      action: onClearChat || (() => {}),
      description: "Clear Chat",
      category: "Chat",
    },
    {
      key: "b",
      ctrlKey: true,
      action: onToggleSidebar || (() => {}),
      description: "Toggle Sidebar",
      category: "Navigation",
    },
    {
      key: "k",
      ctrlKey: true,
      action: onSearch || (() => {}),
      description: "Search",
      category: "Navigation",
    },
    {
      key: "e",
      ctrlKey: true,
      action: onExport || (() => {}),
      description: "Export Chat",
      category: "Chat",
    },
    {
      key: ",",
      ctrlKey: true,
      action: onSettings || (() => {}),
      description: "Settings",
      category: "Navigation",
    },
    {
      key: "/",
      action: onFocusInput || (() => {}),
      description: "Focus Input",
      category: "Input",
    },
    {
      key: "ArrowUp",
      ctrlKey: true,
      action: onPreviousMessage || (() => {}),
      description: "Previous Message",
      category: "Navigation",
    },
    {
      key: "ArrowDown",
      ctrlKey: true,
      action: onNextMessage || (() => {}),
      description: "Next Message",
      category: "Navigation",
    },
    {
      key: "c",
      ctrlKey: true,
      shiftKey: true,
      action: onCopyMessage || (() => {}),
      description: "Copy Message",
      category: "Messages",
    },
    {
      key: "Delete",
      ctrlKey: true,
      action: onDeleteMessage || (() => {}),
      description: "Delete Message",
      category: "Messages",
    },
  ];

  return useKeyboardShortcuts({ shortcuts });
}

// Helper hook for getting shortcut display text
export function useShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.shiftKey) parts.push("Shift");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.metaKey) parts.push("Cmd");

  // Handle special keys
  let keyDisplay = shortcut.key;
  switch (shortcut.key.toLowerCase()) {
    case " ":
      keyDisplay = "Space";
      break;
    case "arrowup":
      keyDisplay = "↑";
      break;
    case "arrowdown":
      keyDisplay = "↓";
      break;
    case "arrowleft":
      keyDisplay = "←";
      break;
    case "arrowright":
      keyDisplay = "→";
      break;
    case "enter":
      keyDisplay = "Enter";
      break;
    case "escape":
      keyDisplay = "Esc";
      break;
    case "delete":
      keyDisplay = "Del";
      break;
    case "backspace":
      keyDisplay = "Backspace";
      break;
    case "tab":
      keyDisplay = "Tab";
      break;
  }

  parts.push(keyDisplay);
  return parts.join(" + ");
}
