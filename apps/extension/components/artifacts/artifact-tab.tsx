"use client";

import { SafeContentFrame } from "safe-content-frame";
import { useEffect, useMemo, useRef, useState } from "react";
import { useThreadStore } from "@/lib/stores/thread-store";

export function ArtifactTab() {
  const artifacts = useThreadStore((state) => state.artifacts);
  const activeThreadId = useThreadStore((state) => state.activeThreadId);
  const addTraceEvent = useThreadStore((state) => state.addTraceEvent);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<SafeContentFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeArtifact = useMemo(
    () =>
      artifacts.find((artifact) =>
        activeArtifactId ? artifact.id === activeArtifactId : false,
      ) ?? artifacts[artifacts.length - 1] ?? null,
    [activeArtifactId, artifacts],
  );

  useEffect(() => {
    if (!frameRef.current) {
      frameRef.current = new SafeContentFrame("helios-artifacts", {
        sandbox: ["allow-scripts"],
      });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !activeArtifact || !frameRef.current) return;

    const container = containerRef.current;
    container.innerHTML = "";
    setError(null);

    void frameRef.current
      .renderHtml(activeArtifact.html, container)
      .then(async () => {
        await addTraceEvent(
          "artifact-open",
          {
            artifactId: activeArtifact.id,
            title: activeArtifact.title,
          },
          activeArtifact.messageId,
        );
      })
      .catch((artifactError) => {
        setError(String(artifactError));
      });
  }, [activeArtifact, addTraceEvent]);

  return (
    <section style={{ display: "grid", gap: 12, padding: 12, height: "100%" }}>
      <header>
        <h2 style={{ margin: 0 }}>Artifacts</h2>
        <p style={{ margin: "4px 0 0", color: "#64748b" }}>
          Generated HTML is rendered inside a Safe Content Frame sandbox.
        </p>
      </header>

      {artifacts.length === 0 ? (
        <div
          style={{
            border: "1px dashed #334155",
            borderRadius: 10,
            padding: 16,
            color: "#94a3b8",
          }}
        >
          No artifacts yet. Ask the assistant to generate an HTML artifact.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                onClick={() => setActiveArtifactId(artifact.id)}
                style={{
                  border: "1px solid #334155",
                  borderRadius: 999,
                  padding: "4px 10px",
                  cursor: "pointer",
                  background:
                    activeArtifact?.id === artifact.id ? "#0ea5e9" : "#111827",
                  color:
                    activeArtifact?.id === artifact.id ? "#082f49" : "#e2e8f0",
                }}
              >
                {artifact.title}
              </button>
            ))}
          </div>

          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 10,
              overflow: "hidden",
              background: "#020617",
              minHeight: 420,
            }}
          >
            <div ref={containerRef} />
          </div>

          {error ? (
            <p style={{ margin: 0, color: "#fda4af", fontSize: 13 }}>{error}</p>
          ) : null}
        </>
      )}

      {activeThreadId ? (
        <small style={{ color: "#64748b" }}>
          Active thread: <code>{activeThreadId}</code>
        </small>
      ) : null}
    </section>
  );
}
