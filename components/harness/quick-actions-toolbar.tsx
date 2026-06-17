"use client";

/**
 * QuickActionsToolbar — Bottom action bar for Command Center
 *
 * Phase 29: Neptune Command Center UI (Stream 4 — Full implementation)
 *
 * Five context-aware quick actions:
 *   💳 Send Payment Link  — NMI vault payment link
 *   💬 Send SMS           — GHL SMS composer
 *   📝 Add Note           — Quick note → Twenty Activity
 *   🎫 Create Ticket      — Linear + Twenty ticket
 *   ⚡ Run Workflow       — Library workflow runner
 *
 * Role-aware: Some actions hidden based on user role
 * Context-aware: Pre-fills data if a Twenty record is currently active
 */

import { useMemo } from "react";
import {
  CreditCard,
  MessageCircle,
  StickyNote,
  Ticket,
  Zap,
  Lock,
} from "lucide-react";
import type { RoleConfig } from "@/lib/harness/roles";
import type { TwentyEvent } from "@/lib/harness/postmessage-bus";

interface QuickActionsToolbarProps {
  role: RoleConfig;
  currentContext: TwentyEvent | null;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
  permission: keyof RoleConfig["permissions"];
  requiresContext?: boolean;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "send-payment",
    label: "Send Payment Link",
    icon: <CreditCard className="h-4 w-4" />,
    shortcut: "P",
    permission: "canSendPayment",
    requiresContext: true,
    description: "Generate and send a payment link via SMS or email",
  },
  {
    id: "send-sms",
    label: "Send SMS",
    icon: <MessageCircle className="h-4 w-4" />,
    shortcut: "S",
    permission: "canSendSMS",
    description: "Send an SMS message via GHL",
  },
  {
    id: "add-note",
    label: "Add Note",
    icon: <StickyNote className="h-4 w-4" />,
    shortcut: "N",
    permission: "canAddNote",
    requiresContext: true,
    description: "Add a quick note to the current record",
  },
  {
    id: "create-ticket",
    label: "Create Ticket",
    icon: <Ticket className="h-4 w-4" />,
    shortcut: "T",
    permission: "canCreateTicket",
    description: "Create a support ticket in Linear + Twenty",
  },
  {
    id: "run-workflow",
    label: "Run Workflow",
    icon: <Zap className="h-4 w-4" />,
    shortcut: "W",
    permission: "canRunWorkflow",
    description: "Execute an automated workflow",
  },
];

export function QuickActionsToolbar({
  role,
  currentContext,
  onAction,
}: QuickActionsToolbarProps) {
  const visibleActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) => {
        // Check role permission
        if (!role.permissions[action.permission]) return false;
        return true;
      }),
    [role]
  );

  const isContextReady = currentContext?.type === "contextChanged" || currentContext?.type === "recordOpened";

  return (
    <div className="flex h-[60px] shrink-0 items-center gap-1 border-t border-[var(--glass-border)] bg-[var(--glass-surface-2)] px-2 backdrop-blur-[12px] saturate-[150%]">
      {/* ── Action Buttons ───────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center gap-1">
        {visibleActions.map((action) => {
          const disabled = action.requiresContext && !isContextReady;

          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                const payload: Record<string, unknown> = {
                  action: action.id,
                  context: currentContext?.payload,
                  timestamp: new Date().toISOString(),
                };
                onAction(action.id, payload);
              }}
              className={`group relative flex h-11 min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-medium transition-all duration-150 hover:bg-[var(--glass-surface-1)] hover:shadow-[var(--glass-shadow-1)] ${
                disabled
                  ? "cursor-not-allowed opacity-30"
                  : "cursor-pointer text-foreground"
              }`}
              title={`${action.label}${disabled ? " (no record selected)" : ` (${action.shortcut})`}`}
            >
              {/* Icon */}
              <span
                className={`transition-colors ${
                  disabled
                    ? "text-muted-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {action.icon}
              </span>

              {/* Label */}
              <span className="truncate max-w-full leading-tight">
                {action.label}
              </span>

              {/* Context-required indicator */}
              {action.requiresContext && !isContextReady && (
                <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Context Indicator ────────────────────────────────────── */}
      <div className="mr-2 flex items-center gap-2 text-xs text-muted-foreground">
        {isContextReady ? (
          <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {String(currentContext?.payload?.name || "Record selected").slice(
              0,
              20
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            No record
          </span>
        )}
      </div>
    </div>
  );
}
