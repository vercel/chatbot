"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useEffect, useMemo, useState } from "react";
import { ArtifactTab } from "@/components/artifacts/artifact-tab";
import { ChatTab } from "@/components/chat/chat-tab";
import { ContextTab } from "@/components/settings/context-tab";
import { TraceTab } from "@/components/trace/trace-tab";
import { sendBackgroundMessage } from "@/lib/messaging/client";
import { captureActivePageContext } from "@/lib/page-context/capture";
import { useAssistantExternalRuntime } from "@/lib/runtime/assistant-runtime";
import { sessionStore } from "@/lib/stores/session-store";
import { useThreadStore } from "@/lib/stores/thread-store";
import type { AppTab } from "@/lib/types";

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: "chat", label: "Chat" },
  { id: "artifact", label: "Artifact" },
  { id: "trace", label: "Trace" },
  { id: "context", label: "Context" },
];

function useInitialTab(): [AppTab, (tab: AppTab) => void] {
  const [tab, setTabState] = useState<AppTab>("chat");

  const setTab = (nextTab: AppTab) => {
    setTabState(nextTab);
    sessionStore.set({
      openPanels: {
        ...sessionStore.get().openPanels,
        [`tab:${nextTab}`]: true,
      },
    });
  };

  return [tab, setTab];
}

export function AppShell() {
  const runtime = useAssistantExternalRuntime();
  const initialize = useThreadStore((state) => state.initialize);
  const initialized = useThreadStore((state) => state.initialized);
  const activeThreadId = useThreadStore((state) => state.activeThreadId);
  const selectedModel = useThreadStore((state) => state.selectedModel);
  const setSelectedModel = useThreadStore((state) => state.setSelectedModel);
  const pageContexts = useThreadStore((state) => state.pageContexts);
  const addPageContext = useThreadStore((state) => state.addPageContext);
  const usageStats = useThreadStore((state) => state.usageStats);
  const clearLocalStateForSignOut = useThreadStore(
    (state) => state.clearLocalStateForSignOut,
  );
  const [activeTab, setActiveTab] = useInitialTab();

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  const latestContext = useMemo(
    () =>
      [...pageContexts].sort((a, b) =>
        b.capturedAt.localeCompare(a.capturedAt),
      )[0],
    [pageContexts],
  );
  const latestUsage = usageStats[usageStats.length - 1];
  const contextUsage = useMemo(
    () => ({
      usedTokens: latestUsage?.totalTokens ?? 0,
      maxTokens: 128_000,
    }),
    [latestUsage],
  );

  const onCapturePageContext = async () => {
    if (!activeThreadId) return;
    const context = await captureActivePageContext();
    if (!context) return;

    await addPageContext(context);
  };

  const signOut = async () => {
    const response = await sendBackgroundMessage({ type: "auth/clear" });
    if (!response.ok) {
      throw new Error(response.error.message);
    }
    await clearLocalStateForSignOut();
    sessionStore.clear();
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="app-shell">
        <header className="app-header">
          <div className="title-wrap">
            <h1>Helios Assistant</h1>
            <p>Chrome-first local-first agent console</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <nav className="tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? "tab active" : "tab"}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="app-main">
          {activeTab === "chat" ? (
            <ChatTab
              selectedModel={selectedModel}
              onModelChange={(nextModel) => {
                void setSelectedModel(nextModel);
              }}
              usedTokens={contextUsage.usedTokens}
              maxTokens={contextUsage.maxTokens}
            />
          ) : null}
          {activeTab === "artifact" ? <ArtifactTab /> : null}
          {activeTab === "trace" ? <TraceTab threadId={activeThreadId} /> : null}
          {activeTab === "context" ? (
            <ContextTab
              pageUrl={latestContext?.url ?? null}
              pageTitle={latestContext?.title ?? null}
              snippet={latestContext?.selection ?? null}
              onCapturePageContext={onCapturePageContext}
              usedTokens={contextUsage.usedTokens}
              maxTokens={contextUsage.maxTokens}
            />
          ) : null}
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
