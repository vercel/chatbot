"use client";

/**
 * /command-center — Client Component
 *
 * Phase 29: Neptune Command Center UI
 * Main orchestrator for the iframe harness — manages layout, drawer state,
 * postMessage bus, keyboard shortcuts, and mobile responsive breakpoints.
 *
 * Layout (Desktop ≥768px):
 *   ┌───────────────────────────────────────────────────┐
 *   │  UserBar (top)                                     │
 *   ├───────────────────────────────┬────────────────────┤
 *   │                               │   Chat Drawer       │
 *   │   Twenty CRM Iframe (70%)     │   (30%)            │
 *   │                               │   - Messages       │
 *   │                               │   - Missions       │
 *   │                               │   - Context        │
 *   ├───────────────────────────────┴────────────────────┤
 *   │  QuickActionsToolbar (bottom)                      │
 *   └───────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { DefaultSession } from "next-auth";
import { TwentyIframe } from "@/components/harness/twenty-iframe";
import { ChatDrawer } from "@/components/harness/chat-drawer";
import { QuickActionsToolbar } from "@/components/harness/quick-actions-toolbar";
import { UserBar } from "@/components/harness/user-bar";
import { PostMessageBus, type TwentyEvent } from "@/lib/harness/postmessage-bus";
import { getRoleConfig, type UserRole } from "@/lib/harness/roles";

interface CommandCenterClientProps {
  user: DefaultSession["user"];
}

// Twenty CRM origin — from env or default
const TWENTY_ORIGIN =
  process.env.NEXT_PUBLIC_TWENTY_ORIGIN || "https://app.crm.newleaf.financial";

export function CommandCenterClient({ user }: CommandCenterClientProps) {
  // ── State ──────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false); // Fully collapsed = 0%
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [currentContext, setCurrentContext] = useState<TwentyEvent | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Get role config from user metadata or default to sales_agent
  const userRole: UserRole = (user as Record<string, unknown>)?.role as UserRole || "sales_agent";
  const roleConfig = useMemo(() => getRoleConfig(userRole), [userRole]);

  // ── PostMessage Bus ─────────────────────────────────────────────
  const messageBus = useRef<PostMessageBus | null>(null);

  useEffect(() => {
    messageBus.current = new PostMessageBus(TWENTY_ORIGIN);

    // Listen for events from Twenty
    const unsub = messageBus.current.onEvent((event) => {
      switch (event.type) {
        case "contextChanged":
          setCurrentContext(event);
          break;
        case "recordOpened":
          setCurrentContext(event);
          // Auto-open drawer to show context if collapsed
          if (drawerCollapsed) {
            setDrawerCollapsed(false);
          }
          break;
        case "fieldEdited":
          // Show brief confirmation via the context
          setCurrentContext(event);
          break;
        case "actionRequested":
          // Open drawer to show MissionCard for the action
          setDrawerOpen(true);
          setDrawerCollapsed(false);
          setCurrentContext(event);
          break;
        default:
          break;
      }
    });

    return () => {
      unsub();
    };
  }, [drawerCollapsed]);

  // ── Send commands to Twenty ─────────────────────────────────────
  const sendCommand = useCallback(
    (command: string, payload?: Record<string, unknown>) => {
      messageBus.current?.sendCommand(command, payload);
    },
    []
  );

  // ── Keyboard Shortcuts ──────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+/ or Ctrl+/ toggles drawer
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setDrawerOpen((prev) => !prev);
        if (!drawerOpen) {
          setDrawerCollapsed(false);
        }
      }
      // Escape closes drawer on mobile
      if (e.key === "Escape" && drawerOpen && window.innerWidth < 768) {
        setDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  // ── Iframe Handlers ─────────────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
    setIframeError(false);
    setConnectionLost(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIframeError(true);
    setConnectionLost(true);
  }, []);

  // ── Drawer Controls ─────────────────────────────────────────────
  const toggleDrawer = useCallback(() => {
    if (drawerOpen) {
      setDrawerOpen(false);
      setDrawerCollapsed(false);
    } else {
      setDrawerOpen(true);
      setDrawerCollapsed(false);
    }
  }, [drawerOpen]);

  const collapseDrawer = useCallback(() => {
    setDrawerCollapsed(true);
  }, []);

  const expandDrawer = useCallback(() => {
    setDrawerCollapsed(false);
    setDrawerOpen(true);
  }, []);

  // ── Quick Action Handler ────────────────────────────────────────
  const handleQuickAction = useCallback(
    (action: string, payload?: Record<string, unknown>) => {
      // Open drawer and show action context
      setDrawerOpen(true);
      setDrawerCollapsed(false);
      setCurrentContext({
        type: "actionRequested",
        payload: { action, ...payload },
      } as TwentyEvent);
    },
    []
  );

  // ── Layout Computations ─────────────────────────────────────────
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;
  const [isMobileState, setIsMobileState] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobileState(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* ── Top User Bar ────────────────────────────────────────── */}
      <UserBar
        user={user}
        role={roleConfig}
        onToggleDrawer={toggleDrawer}
        drawerOpen={drawerOpen}
        onSearchFocus={() => {
          // When search is focused, keep drawer accessible
          if (drawerCollapsed) expandDrawer();
        }}
      />

      {/* ── Connection Lost Banner ──────────────────────────────── */}
      {connectionLost && (
        <div className="flex items-center justify-center gap-2 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="i-lucide-wifi-off h-4 w-4" />
          <span>Connection to Twenty CRM lost. </span>
          <button
            type="button"
            className="font-medium underline hover:no-underline"
            onClick={() => {
              setConnectionLost(false);
              setIframeError(false);
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── Twenty CRM Iframe ─────────────────────────────────── */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isMobileState
              ? "w-full"
              : drawerOpen && !drawerCollapsed
                ? "w-[70%]"
                : "w-full"
          }`}
        >
          {/* Iframe Loading Skeleton */}
          {!iframeReady && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/20">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Loading Twenty CRM...
              </p>
            </div>
          )}

          {/* Auth Failure Redirect Screen */}
          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/20">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">
                  Unable to Load Twenty CRM
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The CRM may be unavailable or your session has expired.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setIframeError(false);
                      setConnectionLost(false);
                      if (iframeRef.current) {
                        iframeRef.current.src = `${TWENTY_ORIGIN}/welcome`;
                      }
                    }}
                  >
                    Retry
                  </button>
                  <a
                    href="/"
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Return to Chat
                  </a>
                </div>
              </div>
            </div>
          )}

          <TwentyIframe
            ref={iframeRef}
            src={`${TWENTY_ORIGIN}/welcome`}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            className="h-full w-full border-0"
          />
        </div>

        {/* ── Chat Drawer ────────────────────────────────────────── */}
        <ChatDrawer
          open={drawerOpen}
          collapsed={drawerCollapsed}
          onToggle={toggleDrawer}
          onCollapse={collapseDrawer}
          onExpand={expandDrawer}
          user={user}
          role={roleConfig}
          currentContext={currentContext}
          onSendCommand={sendCommand}
          isMobile={isMobileState}
        />
      </div>

      {/* ── Bottom Quick Actions Toolbar ─────────────────────────── */}
      <QuickActionsToolbar
        role={roleConfig}
        currentContext={currentContext}
        onAction={handleQuickAction}
      />
    </div>
  );
}
