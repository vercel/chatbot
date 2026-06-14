"use client";
/**
 * StreamingIndicator — small badge showing current AI activity.
 * "Thinking" (reasoning) → "Replying" (text streaming) → "Calling tool" (tool execution)
 * Renders inline below the last assistant message during streaming.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, MessageSquare, Wrench, Loader2 } from "lucide-react";

export type StreamPhase = "thinking" | "replying" | "calling-tool" | "reconnecting" | "idle";

interface StreamingIndicatorProps {
  phase: StreamPhase;
  toolName?: string;
  className?: string;
}

const PHASE_CONFIG: Record<
  StreamPhase,
  { label: string; icon: React.ReactNode; color: string }
> = {
  thinking: {
    label: "Thinking",
    icon: <Brain className="h-3 w-3" />,
    color: "text-violet-500 border-violet-200 dark:border-violet-800",
  },
  replying: {
    label: "Replying",
    icon: <MessageSquare className="h-3 w-3" />,
    color: "text-cyan-500 border-cyan-200 dark:border-cyan-800",
  },
  "calling-tool": {
    label: "Calling tool",
    icon: <Wrench className="h-3 w-3" />,
    color: "text-amber-500 border-amber-200 dark:border-amber-800",
  },
  reconnecting: {
    label: "Reconnecting",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "text-orange-500 border-orange-200 dark:border-orange-800",
  },
  idle: {
    label: "",
    icon: null,
    color: "",
  },
};

export function StreamingIndicator({
  phase,
  toolName,
  className,
}: StreamingIndicatorProps) {
  if (phase === "idle") return null;

  const config = PHASE_CONFIG[phase];
  const isTool = phase === "calling-tool";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2 py-0.5 text-[11px] border animate-in fade-in slide-in-from-bottom-1",
        config.color,
        className
      )}
    >
      {isTool ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        config.icon
      )}
      <span>
        {config.label}
        {isTool && toolName ? `: ${toolName}` : phase === "thinking" ? "…" : "…"}
      </span>
    </Badge>
  );
}

/**
 * Detect the current stream phase from message parts.
 * Used by parent components to determine which StreamPhase to display.
 */
export function detectStreamPhase(parts: Array<{ type: string; state?: string }> | undefined): {
  phase: StreamPhase;
  toolName?: string;
} {
  if (!parts || parts.length === 0) return { phase: "thinking" };

  const hasTextStreaming = parts.some(
    (p) => p.type === "text" || p.type === "reasoning"
  );
  const toolParts = parts.filter((p) => p.type.startsWith("tool-"));
  const hasActiveTool = toolParts.some(
    (p) =>
      p.state === "input-streaming" ||
      p.state === "input-available" ||
      p.state === "approval-requested"
  );

  if (hasActiveTool) {
    const activeTool = toolParts.find(
      (p) =>
        p.state === "input-streaming" ||
        p.state === "input-available"
    );
    const toolName = activeTool
      ? activeTool.type.replace("tool-", "").replace(/([A-Z])/g, " $1").trim()
      : undefined;
    return { phase: "calling-tool", toolName };
  }

  if (hasTextStreaming) {
    return { phase: "replying" };
  }

  return { phase: "thinking" };
}
