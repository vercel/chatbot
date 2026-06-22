"use client";

/**
 * AgentSessionCard — Multi-Lane Agent Session Inline Card
 *
 * ROUTES between V2 and VPS card bodies based on `lane` field.
 * Connects to SSE stream at /api/agent-sessions/[id]/sse for live updates.
 * Supports 7 card states + routing:
 *   routing → spawning → running → building → deploying → complete | failed
 *
 * Tool-to-card mapping:
 *   spawn-coding-agent → AgentSessionCard (NEW)
 *   hermes-vps → redirect to AgentSessionCard with lane=vps
 *   v2-handoff → AgentSessionCard with lane=v2
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  RotateCw,
  Zap,
  ExternalLink,
} from "lucide-react";
import { V2SessionCardBody } from "./V2SessionCardBody";
import { VpsSessionCardBody } from "./VpsSessionCardBody";
import { SessionActions } from "./SessionActions";
import { SessionCardExpanded } from "./SessionCardExpanded";
import type { DeployState } from "./DeployStatus";
import type { FileChange } from "./FileDiffPreview";
import type { LogLine } from "./BuildLogStream";
import type { VpsStep, ToolCallEntry } from "./VpsSessionCardBody";
import { cn } from "@/lib/utils";
import { getBackoffDelay } from "@/lib/agent-sse-utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type CardStatus =
  | "routing"
  | "spawning"
  | "running"
  | "building"
  | "deploying"
  | "complete"
  | "failed";

export interface AgentSessionCardProps {
  sessionId: string;
  goal: string;
  lane?: "v2" | "vps" | null;
  className?: string;
  onDismiss?: () => void;
}

interface SSESessionState {
  status: CardStatus;
  lane: "v2" | "vps" | null;
  progress: number;
  model: string;
  repo?: string;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  deployState?: DeployState;
  v2DirectUrl?: string;
  dispatchId?: string;
  slackThreadTs?: string;
  steps: VpsStep[];
  toolCalls: ToolCallEntry[];
  files: FileChange[];
  logs: LogLine[];
  currentStep?: string;
  turnsUsed: number;
  maxTurns: number;
  elapsedMs: number;
  result?: string;
  error?: string;
  costCents?: number;
  pocockPhase?: string;
}

// ── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CardStatus, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  label: string;
  bgClass: string;
}> = {
  routing:   { icon: Loader2,      iconClass: "text-blue-400 animate-spin",   label: "Routing...",          bgClass: "bg-blue-500/5 border-blue-500/20" },
  spawning:  { icon: Zap,          iconClass: "text-purple-400",              label: "Spawning agent...",   bgClass: "bg-purple-500/5 border-purple-500/20" },
  running:   { icon: Bot,          iconClass: "text-amber-400",               label: "Agent working...",    bgClass: "bg-amber-500/5 border-amber-500/20" },
  building:  { icon: RotateCw,     iconClass: "text-purple-400 animate-spin", label: "Building...",          bgClass: "bg-purple-500/5 border-purple-500/20" },
  deploying: { icon: RotateCw,     iconClass: "text-cyan-400 animate-spin",   label: "Deploying...",        bgClass: "bg-cyan-500/5 border-cyan-500/20" },
  complete:  { icon: CheckCircle2, iconClass: "text-emerald-400",             label: "Complete",            bgClass: "bg-emerald-500/5 border-emerald-500/20" },
  failed:    { icon: XCircle,      iconClass: "text-red-400",                 label: "Failed",              bgClass: "bg-red-500/5 border-red-500/20" },
};

const LANE_BADGE: Record<string, { label: string; bgClass: string; textClass: string }> = {
  v2: { label: "V2", bgClass: "bg-purple-500/10 border-purple-500/20", textClass: "text-purple-400" },
  vps: { label: "VPS", bgClass: "bg-amber-500/10 border-amber-500/20", textClass: "text-amber-400" },
};

// ── Component ──────────────────────────────────────────────────────────────

export function AgentSessionCard({
  sessionId,
  goal,
  lane: initialLane,
  className,
  onDismiss,
}: AgentSessionCardProps) {
  const [state, setState] = useState<SSESessionState>({
    status: initialLane ? "spawning" : "routing",
    lane: initialLane || null,
    progress: 0,
    model: initialLane === "v2" ? "Claude Sonnet 4" : "DeepSeek V4 Pro",
    steps: [],
    toolCalls: [],
    files: [],
    logs: [],
    turnsUsed: 0,
    maxTurns: 60,
    elapsedMs: 0,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const reconnectAttempt = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef(Date.now());

  const isTerminal = state.status === "complete" || state.status === "failed";
  const config = STATUS_CONFIG[state.status] || STATUS_CONFIG.routing;
  const Icon = config.icon;

  // ── SSE Connection ──────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`/api/agent-sessions/${sessionId}/sse`);
    esRef.current = es;

    es.onopen = () => {
      reconnectAttempt.current = 0;
    };

    es.addEventListener("lane:assigned", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          lane: data.lane || "v2",
          status: "spawning",
        }));
      } catch {}
    });

    es.addEventListener("status:change", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          status: (data.status as CardStatus) || prev.status,
          turnsUsed: data.turnsUsed || prev.turnsUsed,
        }));
      } catch {}
    });

    es.addEventListener("progress:update", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          progress: data.progress ?? prev.progress,
          currentStep: data.currentStep || prev.currentStep,
        }));
      } catch {}
    });

    es.addEventListener("tool:start", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        const newTc: ToolCallEntry = {
          toolName: data.toolName,
          status: "running",
          preview: data.preview,
        };
        setState((prev) => ({
          ...prev,
          toolCalls: [...prev.toolCalls.slice(-49), newTc],
        }));
      } catch {}
    });

    es.addEventListener("tool:complete", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          toolCalls: prev.toolCalls.map((tc) =>
            tc.toolName === data.toolName && tc.status === "running"
              ? { ...tc, status: "complete", preview: data.preview }
              : tc
          ),
        }));
      } catch {}
    });

    es.addEventListener("tool:error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          toolCalls: prev.toolCalls.map((tc) =>
            tc.toolName === data.toolName && tc.status === "running"
              ? { ...tc, status: "error", preview: data.preview }
              : tc
          ),
        }));
      } catch {}
    });

    es.addEventListener("file:changed", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        const newFile: FileChange = {
          path: data.path || "unknown",
          changeType: data.changeType || "modified",
          diff: data.diff,
          additions: data.additions,
          deletions: data.deletions,
        };
        setState((prev) => ({
          ...prev,
          files: [...prev.files, newFile],
        }));
      } catch {}
    });

    es.addEventListener("build:log", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          status: "building",
          logs: [...prev.logs.slice(-1999), {
            level: data.level || "build",
            message: data.message,
            timestamp: data.timestamp,
          }],
        }));
      } catch {}
    });

    es.addEventListener("deploy:status", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          status: "deploying",
          deployState: data.state || "building",
          deployUrl: data.url || prev.deployUrl,
        }));
      } catch {}
    });

    es.addEventListener("pr:created", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          prUrl: data.url || prev.prUrl,
        }));
      } catch {}
    });

    es.addEventListener("cost:update", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          costCents: data.costCents,
        }));
      } catch {}
    });

    es.addEventListener("pocock:phase", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          pocockPhase: data.phase,
        }));
      } catch {}
    });

    es.addEventListener("enhancement:finding", () => {
      // Logged for future use (KG nodes, audit)
    });

    es.addEventListener("complete", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setState((prev) => ({
          ...prev,
          status: "complete",
          deployUrl: data.deployUrl || prev.deployUrl,
          prUrl: data.prUrl || prev.prUrl,
          result: data.summary || prev.result,
          slackThreadTs: data.slackThreadTs || prev.slackThreadTs,
        }));
      } catch {}
      es.close();
    });

    es.addEventListener("cancelled", () => {
      setState((prev) => ({ ...prev, status: "failed" }));
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const msgEvent = e as MessageEvent;
        const data = JSON.parse(msgEvent.data);
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: data.message || "Unknown error",
        }));
      } catch {
        setState((prev) => ({ ...prev, status: "failed", error: "Connection error" }));
      }
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        // Attempt reconnection with backoff
        if (!isTerminal && reconnectAttempt.current < 10) {
          const delay = getBackoffDelay(reconnectAttempt.current);
          reconnectAttempt.current++;
          setTimeout(() => connectSSE(), delay);
        } else if (!isTerminal) {
          setState((prev) => ({
            ...prev,
            status: "failed",
            error: "SSE connection lost after 10 retries",
          }));
        }
      }
    };
  }, [sessionId, isTerminal]);

  // ── Initial connect ────────────────────────────────────────────────────

  useEffect(() => {
    startTimeRef.current = Date.now();
    connectSSE();

    // Elapsed time ticker
    const timer = setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedMs: Date.now() - startTimeRef.current,
      }));
    }, 1000);

    return () => {
      clearInterval(timer);
      esRef.current?.close();
    };
  }, [connectSSE]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (isCancelling || isTerminal) return;
    setIsCancelling(true);
    try {
      await fetch(`/api/agent-sessions/${sessionId}/cancel`, { method: "POST" });
      setState((prev) => ({ ...prev, status: "failed", error: "Cancelled by user" }));
    } catch (err) {
      console.error("[AgentSessionCard] Cancel error:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = () => {
    setState((prev) => ({
      ...prev,
      status: "routing",
      error: undefined,
      progress: 0,
      steps: [],
      toolCalls: [],
      files: [],
      logs: [],
    }));
    startTimeRef.current = Date.now();
    reconnectAttempt.current = 0;
    connectSSE();
  };

  // ── Derived values ─────────────────────────────────────────────────────

  const elapsedStr = useMemo(() => {
    const secs = Math.round(state.elapsedMs / 1000);
    return secs > 60
      ? `${Math.floor(secs / 60)}m ${secs % 60}s`
      : `${secs}s`;
  }, [state.elapsedMs]);

  const promptPreview = goal.length > 80 ? goal.slice(0, 80) + "..." : goal;
  const laneBadge = state.lane ? LANE_BADGE[state.lane] : null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={cn(
          "rounded-xl border p-4 my-2 text-sm",
          config.bgClass,
          className
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "size-6 rounded-lg flex items-center justify-center shrink-0",
            state.status === "complete" ? "bg-emerald-500/10" :
            state.status === "failed" ? "bg-red-500/10" :
            state.status === "running" ? "bg-amber-500/10" :
            "bg-blue-500/10"
          )}>
            <Icon className={cn("size-3.5", config.iconClass)} />
          </div>

          <span className="font-medium text-foreground text-sm">
            {config.label}
          </span>

          {/* Lane badge */}
          {laneBadge && (
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border",
              laneBadge.bgClass, laneBadge.textClass
            )}>
              {laneBadge.label}
            </span>
          )}

          {/* Pocock phase (if active) */}
          {state.pocockPhase && (
            <span className="text-[9px] text-white/20 px-1.5 py-0.5 rounded border border-white/5">
              {state.pocockPhase}
            </span>
          )}

          {/* Cost badge */}
          {state.costCents !== undefined && state.costCents > 0 && (
            <span className="text-[9px] text-white/30 ml-auto">
              ${(state.costCents / 100).toFixed(2)}
            </span>
          )}

          {/* Spinner for active states */}
          {!isTerminal && (
            <Loader2 className="size-3 animate-spin text-blue-400 shrink-0 ml-auto" />
          )}

          {/* Dismiss button (terminal states) */}
          {isTerminal && onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-auto p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Prompt preview */}
        <p className="text-xs text-muted-foreground mb-3 truncate">
          {promptPreview}
        </p>

        {/* Lane-specific body */}
        {state.lane === "v2" ? (
          <V2SessionCardBody
            sessionId={sessionId}
            goal={goal}
            status={state.status}
            progress={state.progress}
            repo={state.repo}
            branch={state.branch}
            prUrl={state.prUrl}
            deployUrl={state.deployUrl}
            deployState={state.deployState}
            v2DirectUrl={state.v2DirectUrl}
            files={state.files}
            model={state.model}
            elapsed={elapsedStr}
          />
        ) : state.lane === "vps" ? (
          <VpsSessionCardBody
            sessionId={sessionId}
            goal={goal}
            status={state.status}
            progress={state.progress}
            dispatchId={state.dispatchId}
            steps={state.steps}
            toolCalls={state.toolCalls}
            currentStep={state.currentStep}
            slackThreadTs={state.slackThreadTs}
            turnsUsed={state.turnsUsed}
            maxTurns={state.maxTurns}
            elapsed={elapsedStr}
            result={state.result}
            model={state.model}
          />
        ) : (
          /* Routing state — show spinner only */
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Determining optimal lane...</span>
          </div>
        )}

        {/* Error display */}
        {state.status === "failed" && state.error && (
          <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-1 text-xs text-destructive mb-1">
              <AlertTriangle className="size-3" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-xs text-destructive/80">{state.error}</p>
          </div>
        )}

        {/* Actions */}
        <SessionActions
          lane={state.lane || "vps"}
          status={state.status}
          v2DirectUrl={state.v2DirectUrl}
          slackThreadTs={state.slackThreadTs}
          onExpand={() => setIsExpanded(true)}
          onCancel={handleCancel}
          onRetry={handleRetry}
          isCancelling={isCancelling}
        />
      </div>

      {/* Expanded overlay */}
      <SessionCardExpanded
        open={isExpanded}
        onClose={() => setIsExpanded(false)}
        lane={state.lane || "vps"}
        sessionId={sessionId}
        goal={goal}
        status={state.status}
        progress={state.progress}
        model={state.model}
        repo={state.repo}
        branch={state.branch}
        prUrl={state.prUrl}
        deployUrl={state.deployUrl}
        deployState={state.deployState}
        v2DirectUrl={state.v2DirectUrl}
        slackThreadTs={state.slackThreadTs}
        files={state.files}
        logs={state.logs}
        elapsed={elapsedStr}
        error={state.error}
        result={state.result}
      />
    </>
  );
}
