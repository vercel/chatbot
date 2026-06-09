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
import { useCallback, useState } from "react";
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

interface ChatLayoutClientProps {
  user: User | undefined;
}

function ChatLayoutInner({ user }: ChatLayoutClientProps) {
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const { toggleSidebar } = useSidebar();

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

      {/* Main content: ResizablePanelGroup wrapping chat + context panel */}
      <SidebarInset>
        <ResizablePanelGroup
          autoSave="neptune-chat-layout"
          className="!h-dvh"
          orientation="horizontal"
        >
          {/* Chat area — always visible */}
          <ResizablePanel defaultSize={isPanelOpen ? 65 : 100} minSize={40}>
            <ChatShell />
          </ResizablePanel>

          {/* Context panel — visible when a sidebar item is selected */}
          {isPanelOpen && (
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
    </>
  );
}

export function ChatLayoutClient({ user }: ChatLayoutClientProps) {
  return <ChatLayoutInner user={user} />;
}
