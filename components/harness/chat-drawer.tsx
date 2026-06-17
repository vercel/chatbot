"use client";

/**
 * ChatDrawer — Slide-out AI Chat Panel for Command Center
 *
 * Phase 29: Neptune Command Center UI
 *
 * Layout:
 *  ┌─────────────────────────────┐
 *  │  ChatDrawerHeader            │  — Title + collapse/expand/close
 *  ├─────────────────────────────┤
 *  │  Context Panel               │  — Current Twenty record context
 *  ├─────────────────────────────┤
 *  │  Messages Area               │  — Chat messages + MissionCards
 *  │                              │
 *  ├─────────────────────────────┤
 *  │  Quick Input                 │  — Command input bar
 *  └─────────────────────────────┘
 *
 * States:
 *  - Open: full 30% width (desktop) or fullscreen (mobile)
 *  - Collapsed: 0% width, hidden, expand handle visible
 *  - Closed: hidden entirely
 */

import { useCallback, useRef, useState } from "react";
import type { DefaultSession } from "next-auth";
import {
  X,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Send,
  GripHorizontal,
  User,
  Mail,
  Building2,
  Hash,
} from "lucide-react";
import type { RoleConfig } from "@/lib/harness/roles";
import type { TwentyEvent } from "@/lib/harness/postmessage-bus";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ChatDrawerProps {
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  user: DefaultSession["user"];
  role: RoleConfig;
  currentContext: TwentyEvent | null;
  onSendCommand: (command: string, payload?: Record<string, unknown>) => void;
  isMobile: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "system" | "mission";
  content: string;
  timestamp: string;
}

export function ChatDrawer({
  open,
  collapsed,
  onToggle,
  onCollapse,
  onExpand,
  user,
  role,
  currentContext,
  onSendCommand,
  isMobile,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: `Welcome to Neptune Command Center, ${user?.name || user?.email?.split("@")[0] || "Agent"}. You're signed in as ${role.label}. Use Cmd+/ to toggle this drawer.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Add message on new context ──────────────────────────────────
  const prevContextRef = useRef<string | null>(null);

  if (currentContext && currentContext.type && currentContext.type !== prevContextRef.current) {
    prevContextRef.current = currentContext.type;
    const newMsg: ChatMessage = {
      id: `ctx-${Date.now()}`,
      role: "system",
      content: buildContextMessage(currentContext),
      timestamp: new Date().toISOString(),
    };
    if (!messages.find((m) => m.id === newMsg.id)) {
      // Delayed to avoid render-loop: use setTimeout
      setTimeout(() => {
        setMessages((prev) => [...prev, newMsg]);
      }, 0);
    }
  }

  // ── Send Message ────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Send as command to Twenty if it looks like a navigation command
    if (trimmed.startsWith("/")) {
      const [cmd, ...args] = trimmed.slice(1).split(" ");
      if (cmd === "navigate" || cmd === "go") {
        onSendCommand("navigate", { path: args.join(" ") });
      } else if (cmd === "refresh") {
        onSendCommand("refresh", { objectType: args[0] });
      } else if (cmd === "find") {
        onSendCommand("highlight", { recordId: args[0] });
      }
    }
  }, [inputValue, onSendCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Mobile: bottom sheet variant ────────────────────────────────
  if (isMobile) {
    if (!open) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onToggle}
        />

        {/* Bottom Sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[80dvh] flex-col rounded-t-2xl bg-[var(--glass-surface-1)] shadow-[var(--glass-shadow-3)] backdrop-blur-[16px] saturate-[120%] border border-[var(--glass-border)]">
          {/* Drag Handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <h3 className="text-sm font-semibold">Neptune Chat</h3>
            <button
              type="button"
              onClick={onToggle}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Context */}
          {currentContext && (
            <ContextBanner context={currentContext} />
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <MessageList messages={messages} />
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-[var(--glass-border)] px-4 py-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or message..."
              className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary/40"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Desktop: slide-out panel ────────────────────────────────────
  if (collapsed || !open) {
    // Collapsed state — just the expand handle
    return (
      <div className="relative flex items-center border-l border-[var(--glass-border)] bg-[var(--glass-surface-1)]">
        <button
          type="button"
          onClick={onExpand}
          className="flex h-10 w-6 items-center justify-center rounded-l-md bg-[var(--glass-surface-2)] text-muted-foreground hover:bg-[var(--glass-surface-1)] hover:text-foreground transition-colors"
          title="Expand Chat Drawer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Full open state ─────────────────────────────────────────────
  return (
    <aside className="flex w-[30%] min-w-[320px] flex-col border-l border-[var(--glass-border)] bg-[var(--glass-surface-1)] shadow-[var(--glass-shadow-1)] backdrop-blur-[16px] saturate-[120%]">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--glass-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Neptune Chat
          </h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {role.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            title="Collapse drawer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            title="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Context Banner ───────────────────────────────────────── */}
      {currentContext && <ContextBanner context={currentContext} />}

      {/* ── Messages Area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom Input ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--glass-border)] p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type /navigate, /find, /refresh..."
            className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-opacity"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Cmd+/ toggle · /navigate · /find · /refresh
        </p>
      </div>
    </aside>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function ContextBanner({ context }: { context: TwentyEvent }) {
  const payload = context.payload || {};

  return (
    <div className="shrink-0 border-b border-[var(--glass-border)] bg-[var(--glass-surface-2)] px-4 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">
          {context.type === "contextChanged" && (
            <User className="h-4 w-4 text-blue-500" />
          )}
          {context.type === "actionRequested" && (
            <Hash className="h-4 w-4 text-orange-500" />
          )}
          {context.type === "recordOpened" && (
            <Building2 className="h-4 w-4 text-green-500" />
          )}
          {context.type === "fieldEdited" && (
            <Mail className="h-4 w-4 text-purple-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {contextLabels[context.type] || context.type}
          </p>
          {payload.name && (
            <p className="text-xs text-muted-foreground truncate">
              {String(payload.name)}
            </p>
          )}
          {payload.action && (
            <p className="text-xs text-muted-foreground">
              Action: {String(payload.action)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const contextLabels: Record<string, string> = {
  contextChanged: "Context Updated",
  actionRequested: "Action Requested",
  recordOpened: "Record Opened",
  fieldEdited: "Field Edited",
};

function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${
            msg.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : msg.role === "mission"
                  ? "border border-orange-500/30 bg-orange-500/10 text-foreground"
                  : "bg-muted/60 text-foreground"
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildContextMessage(event: TwentyEvent): string {
  switch (event.type) {
    case "contextChanged":
      const name = event.payload?.name || "Unknown";
      return `📋 Now viewing: **${String(name)}** in Twenty CRM.`;
    case "recordOpened":
      const record = event.payload?.record || {};
      return `📂 Opened record: ${JSON.stringify(record).slice(0, 200)}`;
    case "fieldEdited":
      return `✏️ Field **${String(event.payload?.field || "unknown")}** was updated.`;
    case "actionRequested":
      return `⚡ Action requested: **${String(event.payload?.action || "unknown")}**`;
    default:
      return `Event: ${event.type}`;
  }
}
