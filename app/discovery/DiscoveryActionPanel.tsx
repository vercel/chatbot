/**
 * DiscoveryActionPanel — Human-in-the-loop action dispatcher.
 *
 * Shows pending actions from a discovery run. Users can:
 * - Approve individual actions (dispatching them)
 * - Reject actions
 * - Bulk approve all
 * - See dispatch status
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Play,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscoveryAction {
  id: string;
  runId: string;
  customerId: string;
  type: string;
  status: "pending" | "approved" | "rejected" | "dispatched" | "completed" | "failed";
  description: string;
  payload: Record<string, unknown>;
  suggestedBy: string;
}

interface DiscoveryActionPanelProps {
  actions: DiscoveryAction[];
  runId: string;
  className?: string;
  onActionUpdate?: (actionId: string, newStatus: string) => void;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  update_base44_status: "Update CRM Status",
  sync_nmi_to_base44: "Sync NMI → Base44",
  close_stale_ticket: "Close Stale Ticket",
  follow_up_with_customer: "Follow Up",
  dispatch_recovery_email: "Send Recovery Email",
  escalate_to_manager: "Escalate",
  update_customer_profile: "Update Profile",
  cancel_nmi_subscription: "Cancel Subscription",
  create_support_ticket: "Create Ticket",
  update_base44: "Update CRM",
  sync_nmi: "Sync NMI",
  close_ticket: "Close Ticket",
  follow_up: "Follow Up",
  email: "Send Email",
  escalate: "Escalate",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  dispatched: Play,
  completed: CheckCircle2,
  failed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-slate-400",
  approved: "text-blue-500",
  rejected: "text-red-400",
  dispatched: "text-amber-500",
  completed: "text-emerald-500",
  failed: "text-red-500",
};

export default function DiscoveryActionPanel({
  actions,
  runId,
  className,
  onActionUpdate,
}: DiscoveryActionPanelProps) {
  const [dispatching, setDispatching] = useState<Set<string>>(new Set());
  const [dispatchingAll, setDispatchingAll] = useState(false);

  const pendingActions = actions.filter((a) => a.status === "pending");
  const dispatchedActions = actions.filter((a) => a.status !== "pending");

  const dispatchAction = async (action: DiscoveryAction) => {
    setDispatching((prev) => new Set(prev).add(action.id));
    try {
      onActionUpdate?.(action.id, "dispatched");
    } catch {
      // Keep pending
    } finally {
      setDispatching((prev) => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
    }
  };

  const dispatchAll = async () => {
    setDispatchingAll(true);
    for (const action of pendingActions) {
      await dispatchAction(action);
    }
    setDispatchingAll(false);
  };

  if (actions.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
        <p className="text-sm text-muted-foreground">No actions pending</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Actions ({pendingActions.length} pending)
        </h3>
        {pendingActions.length > 1 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={dispatchingAll}
            onClick={dispatchAll}
            className="h-7 text-xs"
          >
            {dispatchingAll ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Dispatch All
          </Button>
        )}
      </div>

      {/* Pending actions */}
      {pendingActions.map((action) => (
        <div
          key={action.id}
          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/10"
        >
          <Clock className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">
                {ACTION_TYPE_LABELS[action.type] || action.type}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">{action.customerId}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            {action.payload && Object.keys(action.payload).length > 1 && (
              <div className="mt-1 flex gap-1 flex-wrap">
                {Object.entries(action.payload)
                  .filter(([k]) => !["customerId", "dimension", "score", "action"].includes(k))
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <span key={k} className="px-1.5 py-0.5 rounded text-[9px] bg-muted font-mono">
                      {k}: {String(v).slice(0, 30)}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0"
              disabled={dispatching.has(action.id)}
              onClick={() => dispatchAction(action)}
              title="Approve & dispatch"
            >
              {dispatching.has(action.id) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => onActionUpdate?.(action.id, "rejected")}
              title="Reject"
            >
              <XCircle className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </div>
        </div>
      ))}

      {/* Dispatched/completed actions (collapsed) */}
      {dispatchedActions.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
            {dispatchedActions.length} dispatched actions
          </summary>
          <div className="mt-2 space-y-1">
            {dispatchedActions.map((action) => {
              const Icon = STATUS_ICONS[action.status] || Clock;
              return (
                <div key={action.id} className="flex items-center gap-2 py-1 px-2 text-xs">
                  <Icon className={cn("h-3 w-3", STATUS_COLORS[action.status])} />
                  <span className="flex-1 truncate">
                    {ACTION_TYPE_LABELS[action.type] || action.type} — {action.description.slice(0, 50)}
                  </span>
                  <span className={cn("text-[10px]", STATUS_COLORS[action.status])}>
                    {action.status}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
