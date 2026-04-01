"use client";

import { ContextDisplay } from "@/components/chat/context-display";

export function ContextTab({
  pageUrl,
  pageTitle,
  snippet,
  onCapturePageContext,
  usedTokens,
  maxTokens,
}: {
  pageUrl: string | null;
  pageTitle: string | null;
  snippet: string | null;
  onCapturePageContext: () => Promise<void>;
  usedTokens: number;
  maxTokens: number;
}) {
  return (
    <section style={{ display: "grid", gap: 12, padding: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>Context</h2>
        <button type="button" onClick={() => void onCapturePageContext()}>
          Capture Current Page
        </button>
      </div>

      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          gap: 8,
          alignItems: "start",
          fontSize: 13,
        }}
      >
        <dt style={{ color: "#94a3b8" }}>Page title</dt>
        <dd style={{ margin: 0 }}>{pageTitle ?? "No page captured yet"}</dd>

        <dt style={{ color: "#94a3b8" }}>Page URL</dt>
        <dd style={{ margin: 0, wordBreak: "break-all" }}>
          {pageUrl ?? "No page captured yet"}
        </dd>

        <dt style={{ color: "#94a3b8" }}>Selection</dt>
        <dd style={{ margin: 0 }}>{snippet ?? "No selection captured yet"}</dd>
      </dl>

      <div>
        <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 13 }}>
          Context window usage
        </h3>
        <ContextDisplay usedTokens={usedTokens} maxTokens={maxTokens} />
      </div>
    </section>
  );
}
