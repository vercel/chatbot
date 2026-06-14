/**
 * /handoff/[sessionId] - Live V2 Session View (Phase 9)
 *
 * Landing page for V2 coding agent sessions spawned from Chat.
 * Shows live SSE event stream, session metadata, and result links.
 * Replaces v2-sessions/[id] as the canonical V2 session surface.
 */

"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Terminal,
  GitBranch,
  FolderGit2,
} from "lucide-react";

interface HandoffSession {
  sessionId: string;
  goal?: string;
  model?: string;
  status: string;
  repo?: string;
  branch?: string;
  prUrl?: string;
  deployUrl?: string;
  error?: string;
  sandboxId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface StreamEvent {
  type: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, string> = {
  connected: "text-blue-400",
  session_started: "text-green-400",
  phase_completed: "text-emerald-400",
  error: "text-red-400",
  completion: "text-purple-400",
  code_change: "text-amber-400",
  deploy: "text-indigo-400",
  tool_use: "text-cyan-400",
  terminal: "text-muted-foreground",
  progress: "text-blue-300",
};

function formatTime(iso: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    case "aborted":
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case "running":
    case "started":
    case "spawning":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
}

export default function HandoffSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<HandoffSession | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState<
    "connecting" | "connected" | "closed"
  >("connecting");
  const eventLogRef = useRef<HTMLDivElement>(null);

  // Fetch session detail from V2 bridge
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(
          `/api/v2-bridge?path=agent-sessions/${sessionId}`
        );
        if (res.ok) {
          const data = await res.json();
          setSession(data);
        } else {
          // Fallback: create minimal session object
          setSession({
            sessionId,
            status: "unknown",
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Failed to load handoff session:", err);
        setSession({
          sessionId,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load",
          createdAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [sessionId]);

  // Connect to SSE stream via proxy
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      setStreamStatus("connecting");
      eventSource = new EventSource(
        `/api/v2-bridge/stream/${sessionId}`
      );

      eventSource.onopen = () => {
        setStreamStatus("connected");
      };

      eventSource.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data);
          setEvents((prev) => [...prev, event]);

          // Update session status on terminal events
          if (
            event.type === "terminal" ||
            event.type === "completion" ||
            event.type === "session_complete"
          ) {
            setStreamStatus("closed");
            eventSource?.close();
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    status:
                      (event.data.status as string) || "completed",
                    completedAt: new Date(
                      event.timestamp
                    ).toISOString(),
                    prUrl:
                      (event.data.prUrl as string) || prev.prUrl,
                    deployUrl:
                      (event.data.deployUrl as string) ||
                      prev.deployUrl,
                  }
                : prev
            );
          }
          if (event.type === "error") {
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: "failed",
                    error:
                      (event.data.message as string) ||
                      prev.error,
                  }
                : prev
            );
          }
        } catch {
          // Ignore parse errors on SSE
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        if (streamStatus !== "closed") {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    }

    // Only connect if session isn't already terminal
    if (
      !session ||
      !["completed", "failed", "aborted"].includes(session.status)
    ) {
      connect();
    }

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [sessionId, session?.status]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Loading session {sessionId.slice(0, 12)}...
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <Link
          href="/chat"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} />
          Back to Chat
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          Session not found
        </div>
      </div>
    );
  }

  const isTerminal = ["completed", "failed", "aborted"].includes(
    session.status
  );
  const isLive = !isTerminal && streamStatus === "connected";

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/chat"
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon status={session.status} />
            <h1 className="text-xl font-bold truncate">
              {session.goal || `Handoff ${sessionId.slice(0, 8)}`}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="capitalize">{session.status}</span>
            {session.repo && (
              <span className="flex items-center gap-1">
                <FolderGit2 size={12} />
                {session.repo}
              </span>
            )}
            {session.branch && (
              <span className="flex items-center gap-1">
                <GitBranch size={12} />
                {session.branch}
              </span>
            )}
            {session.createdAt && (
              <span>{formatTime(session.createdAt)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {session.prUrl && (
            <a
              href={session.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
            >
              <ExternalLink size={14} /> PR
            </a>
          )}
          {session.deployUrl && (
            <a
              href={session.deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ExternalLink size={14} /> Deploy
            </a>
          )}
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium px-2 py-1 rounded-full bg-green-500/10">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Error display */}
      {session.error && (
        <div className="p-4 mb-4 rounded-md bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
            <AlertTriangle size={16} /> Error
          </div>
          <pre className="text-xs text-destructive/80 whitespace-pre-wrap">
            {session.error}
          </pre>
        </div>
      )}

      {/* Live event feed */}
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
          <Terminal size={14} />
          <span className="text-xs font-medium">Event Stream</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {events.length} events
          </span>
        </div>
        <div
          ref={eventLogRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs"
        >
          {events.length === 0 && !isTerminal && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for events...
            </div>
          )}
          {events.length === 0 && isTerminal && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="w-4 h-4" />
              Session complete. No events streamed.
            </div>
          )}
          {events.map((event, i) => (
            <div
              key={i}
              className="flex gap-2 py-0.5 hover:bg-muted/30 px-1 rounded"
            >
              <span className="text-muted-foreground shrink-0">
                {new Date(event.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                })}
              </span>
              <span className={EVENT_COLORS[event.type] || "text-foreground"}>
                [{event.type}]
              </span>
              <span className="text-muted-foreground truncate">
                {Object.entries(event.data)
                  .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 80) : v}`)
                  .join(" ") || "--"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
