/**
 * /sessions - V2 Handoff Session History (Phase 9)
 *
 * Lists all handoff sessions with status, goal, repo, and timing.
 * Fetches from /api/v2-bridge or falls back to client-side state.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
  FolderGit2,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HandoffSessionSummary {
  id: string;
  goal?: string;
  repo?: string;
  status: string;
  v2SessionId?: string;
  v2SandboxId?: string;
  prUrl?: string;
  deployUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  resultSummary?: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  spawning: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  started: <Clock className="w-4 h-4 text-blue-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  aborted: <AlertTriangle className="w-4 h-4 text-amber-500" />,
};

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

function formatTime(iso: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<HandoffSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function fetchSessions() {
      try {
        // Try V2 bridge first for agent sessions
        const res = await fetch(
          `/api/v2-bridge?path=agent-sessions&limit=50${
            statusFilter ? `&status=${statusFilter}` : ""
          }`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawSessions = data.sessions || data || [];
        setSessions(
          Array.isArray(rawSessions)
            ? rawSessions.map((s: Record<string, unknown>) => ({
                id: (s.id as string) || (s.sessionId as string) || "",
                goal: s.goal as string,
                repo: s.repo as string,
                status: (s.status as string) || "unknown",
                v2SessionId: (s.v2_session_id as string) || (s.id as string),
                prUrl: s.prUrl as string,
                deployUrl: s.deployUrl as string,
                createdAt: (s.createdAt as string) || (s.startedAt as string) || new Date().toISOString(),
                completedAt: s.completedAt as string,
                resultSummary: s.resultSummary as string || s.summary as string,
              }))
            : []
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [statusFilter]);

  const filteredSessions = statusFilter
    ? sessions.filter((s) => s.status === statusFilter)
    : sessions;

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Handoff Sessions</h1>
          <p className="text-sm text-muted-foreground">
            {sessions.length} sessions · V2 coding agent history
          </p>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Bot size={16} />
          New Chat
        </Link>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter size={14} className="text-muted-foreground" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-colors",
              statusFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          Error: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bot size={48} className="mb-4" />
          <p className="text-lg font-medium">No handoff sessions yet</p>
          <p className="text-sm">
            Use spawnCodingAgent in Chat to create V2 coding sessions.
          </p>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {filteredSessions.map((session) => (
          <Link
            key={session.id}
            href={`/handoff/${session.id}`}
            className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {STATUS_ICONS[session.status] || (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="font-medium truncate">
                    {session.goal || `Session ${session.id.slice(0, 8)}`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {session.repo && (
                    <span className="flex items-center gap-1">
                      <FolderGit2 size={11} />
                      {session.repo}
                    </span>
                  )}
                  <span>{formatTime(session.createdAt)}</span>
                  {session.resultSummary && (
                    <span className="truncate max-w-[200px]">
                      {session.resultSummary}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {session.prUrl && (
                  <a
                    href={session.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded hover:bg-muted"
                    title="View PR"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                  {session.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
