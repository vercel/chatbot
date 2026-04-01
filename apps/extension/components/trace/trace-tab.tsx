"use client";

import { useMemo } from "react";
import { useThreadStore } from "@/lib/stores/thread-store";
import type { TraceEventRecord, TraceEventType } from "@/lib/types";

const FILTER_TYPES: TraceEventType[] = [
  "turn-start",
  "turn-end",
  "ttft",
  "tokens-per-second",
  "tool-start",
  "tool-end",
  "retry",
  "artifact-open",
  "auth-refresh",
];

const formatPayload = (event: TraceEventRecord) => {
  if (!event.payload) return "No payload";
  return JSON.stringify(event.payload, null, 2);
};

export function TraceTab({ threadId }: { threadId: string | null }) {
  const traceEvents = useThreadStore((state) => state.traceEvents);
  const filter = useThreadStore((state) => state.traceFilter);
  const setFilter = useThreadStore((state) => state.setTraceFilter);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return traceEvents;
    if (filter === "tool") {
      return traceEvents.filter(
        (event) => event.type === "tool-start" || event.type === "tool-end",
      );
    }
    if (filter === "auth") {
      return traceEvents.filter((event) => event.type === "auth-refresh");
    }
    return traceEvents.filter((event) => event.type === "artifact-open");
  }, [filter, traceEvents]);

  return (
    <section className="trace-tab">
      <header className="trace-header">
        <h2>Trace timeline</h2>
        <p>
          Turn boundaries, timing metrics, tool invocations, retries, artifact
          opens, and auth refreshes.
        </p>
      </header>

      <div className="trace-filter-row">
        <button
          type="button"
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={filter === "tool" ? "active" : ""}
          onClick={() => setFilter("tool")}
        >
          Tools
        </button>
        <button
          type="button"
          className={filter === "auth" ? "active" : ""}
          onClick={() => setFilter("auth")}
        >
          Auth
        </button>
        <button
          type="button"
          className={filter === "artifact" ? "active" : ""}
          onClick={() => setFilter("artifact")}
        >
          Artifacts
        </button>
      </div>

      {threadId ? (
        <small style={{ color: '#94a3b8' }}>
          Active thread: <code>{threadId}</code>
        </small>
      ) : null}

      <div className="trace-types">
        {FILTER_TYPES.map((type) => (
          <span key={type}>{type}</span>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="trace-empty">No trace events recorded for this filter.</div>
      ) : (
        <ol className="trace-list">
          {filteredEvents.map((event) => (
            <li key={event.id} className="trace-item">
              <div className="trace-item-header">
                <strong>{event.type}</strong>
                <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
              </div>
              <pre>{formatPayload(event)}</pre>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
