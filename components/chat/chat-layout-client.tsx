"use client";

/**
 * ChatLayoutClient — Client-side layout orchestrator that wraps
 * SidebarProvider children to share panel state between AppSidebar
 * and the main content area.
 *
 * Manages:
 *  - activePanel state (which right panel is open)
 *  - Keyboard shortcuts (Cmd+K, Cmd+B, Cmd+1-7)
 *  - ResizablePanelGroup layout (chat + context panel)
 *
 * Renders INSIDE SidebarProvider in layout.tsx.
 */
import type { User } from "next-auth";
import { useCallback, useState, useEffect } from "react";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { CommandPalette } from "@/components/chat/command-palette";
import type { PanelId } from "@/components/chat/app-sidebar";
import { PanelContainer } from "@/components/chat/panel-container";
import { ChatShell } from "@/components/chat/shell";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SidebarInset } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { MultiSessionPanel, type SessionSlot } from "@/components/v2/multi-session-panel";
import { useV2Session } from "@/hooks/use-v2-session";
import { CanvasShell } from "@/components/canvas/canvas-shell";
import { MobileHeader } from "@/components/mobile-header";
import { useCanvasStore } from "@/lib/canvas/store";
import { useSearchParams } from "next/navigation";

interface ChatLayoutClientProps {
  user: User | undefined;
}

function ChatLayoutInner({ user }: ChatLayoutClientProps) {
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const { toggleSidebar } = useSidebar();
  const { activeSession, isPanelOpen: isV2PanelOpen, closeSession } = useV2Session();

  // ── Canvas state ───────────────────────────────────────────────────
  const canvasOpen = useCanvasStore((s) => s.isOpen);
  const canvasWidth = useCanvasStore((s) => s.width);
  const canvasOpenFn = useCanvasStore((s) => s.open);

  // ── Deep linking: ?canvas=mode&name=NAME ───────────────────────────
  const searchParams = useSearchParams();
  useEffect(() => {
    const mode = searchParams.get("canvas");
    const name = searchParams.get("name");
    if (mode) {
      const validModes = [
        "library-overview", "connector-detail", "skill-detail",
        "function-detail", "playbook-detail", "workflow-canvas",
        "kg-explorer", "wiki-browser", "add-new",
      ];
      if (validModes.includes(mode)) {
        const ctx: Record<string, string> = {};
        if (name) {
          // Infer context key from mode
          if (mode === "connector-detail") ctx.connectorName = name;
          else if (mode === "skill-detail") ctx.skillName = name;
          else if (mode === "function-detail") ctx.functionName = name;
          else if (mode === "playbook-detail") ctx.playbookName = name;
          else if (mode === "workflow-canvas") ctx.workflowName = name;
          else if (mode === "kg-explorer") ctx.kgNode = name;
          else if (mode === "wiki-browser") ctx.wikiPath = name;
        }
        canvasOpenFn(mode as Parameters<typeof canvasOpenFn>[0], ctx);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    activePanel,
    setActivePanel,
    toggleSidebar,
  });

  const handleSelectPanel = useCallback((panel: PanelId) => {
    setActivePanel(panel);
  }, []);

  const handleClosePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const isPanelOpen = activePanel !== null;

  // Calculate panel sizes considering canvas
  const chatSize = canvasOpen ? Math.max(30, 100 - canvasWidth - (isPanelOpen ? 20 : 0)) : (isPanelOpen ? 65 : 100);

  return (
    <>
      {/* Cmd+K command palette */}
      <CommandPalette
        onSelectPanel={handleSelectPanel}
        onToggleSidebar={toggleSidebar}
      />

      {/* AppSidebar — direct child of SidebarProvider, gets panel state */}
      <AppSidebar
        activePanel={activePanel}
        onSelectPanel={handleSelectPanel}
        user={user}
      />

      {/* Main content: MobileHeader + ResizablePanelGroup wrapping chat + canvas + context panel */}
      <SidebarInset>
        <MobileHeader />
        <ResizablePanelGroup
          autoSave="neptune-chat-layout"
          className="!h-dvh"
          id="main-content"
          orientation="horizontal"
        >
          {/* Chat area — always visible */}
          <ResizablePanel defaultSize={chatSize} minSize={25}>
            <ChatShell />
          </ResizablePanel>

          {/* ── Library Canvas — Phase 16 ──────────────────────────── */}
          {canvasOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={canvasWidth} minSize={20} maxSize={60}>
                <CanvasShell>{/* CanvasShell renders canvas content when open */}</CanvasShell>
              </ResizablePanel>
            </>
          )}

          {/* Context panel — visible when a sidebar item is selected */}
          {isPanelOpen && !canvasOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={25}>
                <PanelContainer
                  activePanel={activePanel}
                  onClose={handleClosePanel}
                >
                  <div className="p-4">
                    <p className="text-muted-foreground text-sm">
                      Select an item from the sidebar to view content here.
                    </p>
                  </div>
                </PanelContainer>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </SidebarInset>

      {/* Phase 19: Multi-Session Panel — replaces V2LivePanel with 1-4 session grid */}
      <MultiSessionPanel
        open={isV2PanelOpen}
        onOpenChange={(open) => {
          if (!open) closeSession();
        }}
        sessions={
          activeSession
            ? [{
                id: activeSession.sessionId || "v2-0",
                sessionId: activeSession.sessionId,
                goal: activeSession.goal,
                repo: activeSession.repo,
                branch: activeSession.branch,
                model: activeSession.model,
              }]
            : []
        }
        onStopSession={(sessionId) => {
          closeSession();
        }}
      />
    </>
  );
}

export function ChatLayoutClient({ user }: ChatLayoutClientProps) {
  return <ChatLayoutInner user={user} />;
}
