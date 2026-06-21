"use client";

/**
 * SelfCodeCardBody — Extends PR #16 AgentSessionCard with lane='self'
 *
 * M-N-SELF-CODING (2026-06-21): Card body for the self-coding lane.
 * Shows the self-code workflow progress inline:
 *   planning → coding → PR opened → deploying → complete
 *
 * Reuses the shared SessionProgressBar from PR #16's agent-session components.
 * Designed to render inside AgentSessionCard when lane='self'.
 *
 * This component follows the same interface pattern as V2SessionCardBody and
 * VpsSessionCardBody from PR #16 to ensure seamless integration.
 */

import { CheckCircle2, XCircle, GitBranch, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SelfCodeStep {
  step: string;
  status: "pending" | "running" | "complete" | "failed";
  detail?: string;
  url?: string;
}

export interface SelfCodeCardBodyProps {
  /** Session ID for the self-code task */
  sessionId: string;
  /** Task goal */
  goal: string;
  /** Current card status from parent AgentSessionCard */
  status: string;
  /** Progress percentage 0–100 */
  progress?: number;
  /** Repository being targeted */
  repo?: string;
  /** Created branch name */
  branch?: string;
  /** PR URL if opened */
  prUrl?: string;
  /** Deploy URL if deployed */
  deployUrl?: string;
  /** Committed file paths */
  files?: string[];
  /** Elapsed time string */
  elapsed?: string;
  /** Error message if failed */
  error?: string;
  className?: string;
}

// ── Step Config ────────────────────────────────────────────────────────────

const SELF_CODE_STEPS = [
  { key: "planning", label: "Planning", icon: "🧠" },
  { key: "branching", label: "Creating branch", icon: "🌿" },
  { key: "coding", label: "Applying code", icon: "💻" },
  { key: "pr-opening", label: "Opening PR", icon: "🔀" },
  { key: "deploying", label: "Deploying", icon: "🚀" },
  { key: "complete", label: "Complete", icon: "✅" },
];

function deriveStepStatus(
  stepKey: string,
  status: string,
  error?: string
): SelfCodeStep["status"] {
  const stepOrder = SELF_CODE_STEPS.map((s) => s.key);
  const currentIdx = stepOrder.indexOf(stepKey);
  const statusIdx = (() => {
    switch (status) {
      case "planning": return 0;
      case "spawning": return 1;
      case "running": return 2;
      case "building": return 3;
      case "deploying": return 4;
      case "complete": return 5;
      case "failed":
        // Determine which step failed
        if (error?.includes("branch")) return 1;
        if (error?.includes("commit") || error?.includes("file")) return 2;
        if (error?.includes("PR") || error?.includes("pull request")) return 3;
        if (error?.includes("deploy")) return 4;
        return 2;
      default: return -1;
    }
  })();

  if (status === "failed" && currentIdx === statusIdx) return "failed";
  if (status === "failed" && currentIdx < statusIdx) return "complete";
  if (currentIdx < statusIdx) return "complete";
  if (currentIdx === statusIdx && status !== "failed") return "running";
  return "pending";
}

// ── Component ──────────────────────────────────────────────────────────────

export function SelfCodeCardBody({
  sessionId,
  goal,
  status,
  progress = 0,
  repo = "neptune-chat",
  branch,
  prUrl,
  deployUrl,
  files = [],
  elapsed,
  error,
  className,
}: SelfCodeCardBodyProps) {
  const steps: SelfCodeStep[] = SELF_CODE_STEPS.map((s) => ({
    step: s.label,
    status: deriveStepStatus(s.key, status, error),
    detail: s.key === "branching" && branch
      ? branch
      : s.key === "coding" && files.length > 0
        ? `${files.length} file(s)`
        : s.key === "pr-opening" && prUrl
          ? "PR opened"
          : s.key === "deploying" && deployUrl
            ? "Deployed"
            : undefined,
    url: s.key === "pr-opening" ? prUrl : s.key === "deploying" ? deployUrl : undefined,
  }));

  const isComplete = status === "complete";
  const isFailed = status === "failed";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Step timeline */}
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {/* Status icon */}
            <div className="mt-0.5 shrink-0">
              {step.status === "complete" ? (
                <CheckCircle2 className="size-3.5 text-emerald-400" />
              ) : step.status === "failed" ? (
                <XCircle className="size-3.5 text-red-400" />
              ) : step.status === "running" ? (
                <Loader2 className="size-3.5 text-amber-400 animate-spin" />
              ) : (
                <div className="size-3.5 rounded-full border border-white/10" />
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-xs",
                step.status === "complete" && "text-emerald-300",
                step.status === "failed" && "text-red-400",
                step.status === "running" && "text-amber-300",
                step.status === "pending" && "text-white/20"
              )}>
                {step.step}
                {step.detail && (
                  <span className="text-white/30 ml-1">— {step.detail}</span>
                )}
              </div>
            </div>

            {/* External link */}
            {step.url && (
              <a
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar (inlined compact version) */}
      {!isComplete && !isFailed && (
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}

      {/* Files list (if any) */}
      {files.length > 0 && (isComplete || status === "running") && (
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <GitBranch className="size-3 text-emerald-400" />
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
              Changed Files
            </span>
          </div>
          <div className="space-y-0.5">
            {files.slice(0, 10).map((f, i) => (
              <div key={i} className="text-[10px] font-mono text-emerald-300/70 pl-1">
                {f}
              </div>
            ))}
            {files.length > 10 && (
              <div className="text-[10px] text-white/20 pl-1">
                +{files.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lane badge */}
      <div className="flex items-center gap-2 pt-1">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium
                         bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          SELF
        </span>
        <span className="text-[9px] text-white/20">
          Direct GitHub + Vercel
        </span>
        {elapsed && (
          <span className="text-[9px] text-white/20 ml-auto">{elapsed}</span>
        )}
      </div>
    </div>
  );
}

export default SelfCodeCardBody;
