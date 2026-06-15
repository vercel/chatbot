/**
 * MultiSessionPanel — Phase 19.F
 *
 * Replaces the single V2LivePanel with a grid of 1-4 session cards.
 * Each card shows: session ID, goal, progress %, live tool calls, current file.
 * Controls: "Stop all" / "Stop one", "Spawn additional".
 * Auto-arranges when sessions complete.
 * Mobile: stacked full-width cards instead of sheets.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X, Square, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Terminal, ExternalLink, Plus,
  Bot, FileCode, Rocket, ChevronDown, ChevronUp,
  Wifi, WifiOff, Pause, Play, Send,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader,
  SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Drawer, DrawerContent, DrawerHeader,
  DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { useV2SessionStream, type V2StreamEvent, type StreamStatus, EVENT_LABELS, EVENT_COLORS } from "@/hooks/use-v2-session-stream";

// ── Types ─────────────────────────────────────────────────────────────────

export interface SessionSlot {
  id: string;
  sessionId: string | null;
  goal?: string;
  repo?: string;
  branch?: string;
  model?: string;
  streamUrl?: string;
  planId?: string;
}

export interface MultiSessionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: SessionSlot[];
  onAddSession?: () => void;
  onStopSession?: (sessionId: string) => void;
  onStopAll?: () => void;
}

interface SessionCardProps {
  slot: SessionSlot;
  onStop?: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// ── Session Card ──────────────────────────────────────────────────────────

function SessionCard({ slot, onStop, isExpanded, onToggleExpand }: SessionCardProps) {
  const [sessionStatus, setSessionStatus] = useState<string>("running");
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);

  const {
    events, status: streamStatus, error: streamError,
    connect, disconnect, clearEvents,
  } = useV2SessionStream(slot.sessionId, sessionStatus);

  // Reset events when session changes
  useEffect(() => { clearEvents(); }, [slot.sessionId, clearEvents]);

  // Auto-scroll
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // Watch for terminal events
  useEffect(() => {
    const terminalEvent = events.find(e => e.type === "terminal" || e.type === "completion");
    if (terminalEvent?.data.status) {
      setSessionStatus(terminalEvent.data.status as string);
    }
  }, [events]);

  const isTerminal = ["completed", "failed", "aborted"].includes(sessionStatus);
  const hasDeployUrl = events.some(e => e.data.deployUrl);
  const toolCallCount = events.filter(e => e.type === "code_change" || e.type === "file_edit").length;

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !slot.sessionId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v2/sessions/${slot.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: messageInput.trim(), context: "Mid-execution message from MultiSessionPanel" }),
      });
      if (res.ok) setMessageInput("");
    } catch (err) {
      console.error("Send error:", err);
    } finally { setSending(false); }
  }, [messageInput, slot.sessionId]);

  const progress = events.length > 0
    ? Math.min(95, Math.round((toolCallCount / Math.max(toolCallCount + 2, 1)) * 100))
    : 0;

  return (
    <div className={cn(
      "rounded-lg border bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col",
      isTerminal && "opacity-80"
    )}>
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-primary shrink-0" />
          <span className="text-xs font-medium truncate flex-1">
            {slot.goal?.slice(0, 40) || `Session ${slot.sessionId?.slice(0, 8)}`}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {streamStatus === "connected" ? <Wifi className="w-3 h-3 text-emerald-500" /> :
             streamStatus === "connecting" ? <Loader2 className="w-3 h-3 text-amber-500 animate-spin" /> :
             streamStatus === "error" ? <WifiOff className="w-3 h-3 text-red-500" /> :
             streamStatus === "closed" ? <CheckCircle2 className="w-3 h-3 text-muted-foreground" /> :
             <WifiOff className="w-3 h-3 text-muted-foreground" />}
          </span>
          <button
            onClick={onToggleExpand}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Progress bar */}
        {!isTerminal && (
          <div className="mt-1.5 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                sessionStatus === "paused" ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          {slot.repo && <span>{slot.repo}</span>}
          {slot.branch && <span>· {slot.branch}</span>}
          {toolCallCount > 0 && <span>· {toolCallCount} tools</span>}
          <span>· {sessionStatus}</span>
        </div>

        {/* Terminal badge */}
        {isTerminal && (
          <div className={cn(
            "mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
            sessionStatus === "completed" ? "bg-emerald-950/30 text-emerald-400" : "bg-red-950/30 text-red-400"
          )}>
            {sessionStatus === "completed" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {sessionStatus}
          </div>
        )}

        {/* Deploy URL */}
        {hasDeployUrl && (
          <a
            href={`https://${events.find(e => e.data.deployUrl)?.data.deployUrl}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <Rocket size={10} /> Open Deploy
          </a>
        )}
      </div>

      {/* Expanded event log */}
      {isExpanded && (
        <>
          {/* Error banner */}
          {streamError && (
            <div className="shrink-0 px-3 py-1.5 bg-red-950/20 border-b border-red-800 text-[10px] text-red-400">
              {streamError}
            </div>
          )}

          {/* Event log */}
          <div ref={eventLogRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-48">
            {events.length === 0 && !isTerminal && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                <span className="text-[10px]">Waiting for events…</span>
              </div>
            )}
            {events.map((event, i) => (
              <EventMini key={i} event={event} />
            ))}
          </div>

          {/* Message input (non-terminal only) */}
          {!isTerminal && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-t border-zinc-800 bg-zinc-900/50"
            >
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Message agent…"
                className="h-7 text-[10px]"
                disabled={sending}
              />
              <Button type="submit" size="sm" className="h-7 w-7 p-0" disabled={!messageInput.trim() || sending}>
                {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              </Button>
            </form>
          )}
        </>
      )}

      {/* Action buttons */}
      {!isTerminal && (
        <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-t border-zinc-800">
          <Button
            variant="ghost" size="sm" className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/20"
            onClick={onStop}
          >
            <Square size={10} className="mr-1" /> Stop
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Event Mini (compact) ──────────────────────────────────────────────────

function EventMini({ event }: { event: V2StreamEvent }) {
  const colorClass = EVENT_COLORS[event.type] || "text-muted-foreground";
  const label = EVENT_LABELS[event.type] || event.type;

  return (
    <div className="flex gap-1.5 py-0.5 px-1 rounded hover:bg-zinc-800/30 transition-colors">
      <span className="text-[9px] text-muted-foreground shrink-0 font-mono w-12">
        {new Date(event.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </span>
      <span className={cn("text-[9px] font-medium shrink-0", colorClass)}>[{label}]</span>
      <span className="text-[9px] text-muted-foreground truncate flex-1">
        {event.data?.message || event.data?.filePath || JSON.stringify(event.data).slice(0, 50)}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function MultiSessionPanel({
  open, onOpenChange, sessions, onAddSession, onStopSession, onStopAll,
}: MultiSessionPanelProps) {
  const isMobile = useIsMobile();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
  }, []);

  const activeSessions = sessions.filter(s => s.sessionId);
  const gridClass = cn(
    "grid gap-3",
    activeSessions.length === 1 ? "grid-cols-1" :
    activeSessions.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
    activeSessions.length === 3 ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" :
    "grid-cols-1 lg:grid-cols-2 xl:grid-cols-4"
  );

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-primary" />
          <span className="text-xs font-medium">
            {activeSessions.length} Session{activeSessions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onAddSession && activeSessions.length < 4 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={onAddSession}>
              <Plus size={12} /> Add
            </Button>
          )}
          {onStopAll && activeSessions.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-400 hover:text-red-300 gap-1" onClick={onStopAll}>
              <Square size={12} /> Stop All
            </Button>
          )}
        </div>
      </div>

      {/* Session grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Bot size={24} className="opacity-40" />
            <p className="text-xs">No active V2 sessions.</p>
            {onAddSession && (
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onAddSession}>
                <Plus size={12} /> Spawn a session
              </Button>
            )}
          </div>
        ) : (
          <div className={gridClass}>
            {activeSessions.map(slot => (
              <SessionCard
                key={slot.id}
                slot={slot}
                isExpanded={expandedSessions.has(slot.id)}
                onToggleExpand={() => toggleExpand(slot.id)}
                onStop={() => onStopSession?.(slot.sessionId!)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh] flex flex-col bg-zinc-950">
          <DrawerHeader className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <DrawerTitle className="text-base flex items-center gap-2">
              <Terminal size={16} /> V2 Sessions
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {activeSessions.length} active coding session{activeSessions.length !== 1 ? "s" : ""}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">{panelContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: right-side Sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl lg:max-w-2xl xl:max-w-3xl p-0 flex flex-col bg-zinc-950"
        aria-label="V2 Agent Sessions Panel"
      >
        <SheetHeader className="shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-zinc-800 space-y-0">
          <div>
            <SheetTitle className="text-sm flex items-center gap-2">
              <Terminal size={14} /> V2 Agent Sessions
            </SheetTitle>
            <SheetDescription className="text-[10px]">
              {activeSessions.length} session{activeSessions.length !== 1 ? "s" : ""} · Multi-session orchestration
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">{panelContent}</div>
      </SheetContent>
    </Sheet>
  );
}
