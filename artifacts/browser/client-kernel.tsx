'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MousePointerClick, RefreshCw, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { AgentStatusIndicator } from '@/components/agent-status-indicator';
import { BrowserLoadingState, BrowserErrorState, BrowserTimeoutState } from './browser-states';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ChatStatus } from '@/components/create-artifact';

// =============================================================================
// Types for SSE status events from the message queue
// =============================================================================

interface BrowserStatusEvent {
  type:
    | 'command_queued'
    | 'command_started'
    | 'command_completed'
    | 'command_failed'
    | 'session_expired';
  correlationId: string;
  command: string;
  details: string;
  timestamp: string;
}

// =============================================================================
// Idle timeout: disconnect after 5 minutes of no user interaction.
// The agent idle timeout (server-side, 5 min) covers agent inactivity.
// This covers user inactivity (e.g., user walks away from computer).
// =============================================================================
const USER_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

interface KernelBrowserClientProps {
  sessionId: string;
  controlMode: 'agent' | 'user';
  onControlModeChange: (mode: 'agent' | 'user') => void;
  onConnectionChange?: (connected: boolean) => void;
  onBrowserEvent?: (event: BrowserStatusEvent) => void;
  chatStatus?: ChatStatus;
  stop?: () => void;
  isFullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

export function KernelBrowserClient({
  sessionId,
  controlMode,
  onControlModeChange,
  onConnectionChange,
  onBrowserEvent,
  chatStatus,
  stop,
  isFullscreen = false,
  onFullscreenChange,
}: KernelBrowserClientProps) {
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  // Stable refs to avoid dependency changes triggering re-initialization
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  const onBrowserEventRef = useRef(onBrowserEvent);
  onBrowserEventRef.current = onBrowserEvent;

  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  // Track if we've already initialized for this session
  const initializedSessionRef = useRef<string | null>(null);
  const initInFlightRef = useRef(false);

  const initBrowser = useCallback(async (force = false) => {
    // Skip if already initialized for this session (unless forced)
    if (!force && initializedSessionRef.current === sessionId && liveViewUrl) {
      return;
    }
    // Skip if a request is already in-flight
    if (initInFlightRef.current) {
      return;
    }

    try {
      initInFlightRef.current = true;
      setLoading(true);
      setError(null);

      // force=true (refresh button) → create a new browser directly
      // force=false (normal mount) → poll for the browser the tool creates
      const action = force ? 'create' : 'get';
      const maxAttempts = force ? 1 : 30; // poll up to 30s for tool to create
      let attempts = 0;

      while (attempts < maxAttempts) {
        const response = await fetch('/api/kernel-browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, sessionId, isMobile }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.liveViewUrl) {
            setLiveViewUrl(data.liveViewUrl);
            setIsConnected(true);
            initializedSessionRef.current = sessionId;
            onConnectionChangeRef.current?.(true);
            return;
          }
        } else if (force) {
          // For create, surface error immediately
          const data = await response.json();
          throw new Error(data.error || 'Failed to create browser');
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      throw new Error('Browser session not available yet. Please try again.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    } finally {
      setLoading(false);
      initInFlightRef.current = false;
    }
  }, [sessionId, liveViewUrl, isMobile]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    // Heartbeat now serves only as a TTL refresh fallback — real-time updates
    // come via SSE. Reduced frequency from 30s to 60s.
    heartbeatIntervalRef.current = setInterval(() => {
      void heartbeat();
    }, 60_000);
  }, [heartbeat, stopHeartbeat]);

  // =========================================================================
  // SSE — real-time status events from the message queue
  // =========================================================================

  const stopEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startEventSource = useCallback(() => {
    stopEventSource();

    const url = `/api/kernel-browser/events?sessionId=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as BrowserStatusEvent;
        console.log('[Kernel SSE] Status event:', event.type, event.command);

        // Track the last command for UI display
        if (event.type === 'command_started') {
          setLastCommand(event.command);
        } else if (
          event.type === 'command_completed' ||
          event.type === 'command_failed'
        ) {
          setLastCommand(null);
        }

        if (event.type === 'session_expired') {
          setSessionExpired(true);
          setLiveViewUrl(null);
          setIsConnected(false);
          onConnectionChangeRef.current?.(false);
          stopHeartbeat();
          stopEventSource();
          toast.info('Browser session closed due to inactivity');
        }

        // Forward to parent for custom handling
        onBrowserEventRef.current?.(event);
      } catch {
        // Ignore malformed events
      }
    });

    es.addEventListener('timeout', () => {
      console.log('[Kernel SSE] Stream timed out, reconnecting...');
      // Browser will auto-reconnect EventSource, but we restart cleanly
      stopEventSource();
      // Small delay before reconnect to avoid tight loops
      setTimeout(() => {
        if (isConnectedRef.current) {
          startEventSource();
        }
      }, 1000);
    });

    es.addEventListener('error', () => {
      console.warn('[Kernel SSE] Connection error');
      // EventSource auto-reconnects on error, but if the session is gone
      // we shouldn't keep trying
      if (!isConnectedRef.current) {
        stopEventSource();
      }
    });
  }, [sessionId, stopEventSource, stopHeartbeat]);

  // =========================================================================
  // Browser lifecycle
  // =========================================================================

  const initBrowser = useCallback(
    async (force = false) => {
      // Skip if already initialized for this session (unless forced)
      if (!force && initializedSessionRef.current === sessionId && liveViewUrl) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setSessionExpired(false);

        const response = await fetch('/api/kernel-browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', sessionId, isMobile }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create browser');
        }

        const data = await response.json();
        setLiveViewUrl(data.liveViewUrl);
        setIsConnected(true);
        initializedSessionRef.current = sessionId;
        onConnectionChangeRef.current?.(true);
        startHeartbeat();
        startEventSource();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect';
        setError(message);
        setIsConnected(false);
        onConnectionChangeRef.current?.(false);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, liveViewUrl, isMobile, startHeartbeat],
  );

  // Initialize browser on mount
  useEffect(() => {
    if (initializedSessionRef.current !== sessionId) {
      initBrowser();
    }
  }, [sessionId, initBrowser]);

  // Clean up browser when component unmounts (chat navigation) or page closes.
  // Uses sendBeacon for fire-and-forget cleanup that works in both cases.
  useEffect(() => {
    const cleanup = () => {
      try {
        const payload = JSON.stringify({
          action: 'delete',
          sessionId: sessionIdRef.current,
        });
        navigator.sendBeacon(
          '/api/kernel-browser',
          new Blob([payload], { type: 'application/json' }),
        );
      } catch {
        // Best-effort cleanup
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      // Component unmounting (SPA navigation) — delete the browser immediately
      cleanup();
    };
  }, []);

  // Listen for control mode switch events from confirmation components
  useEffect(() => {
    const handleSwitchControl = (event: CustomEvent) => {
      const { mode } = event.detail;
      if (mode === 'user' || mode === 'agent') {
        switchControlMode(mode);
      }
    };

    window.addEventListener(
      'switch-browser-control',
      handleSwitchControl as EventListener,
    );

    return () => {
      window.removeEventListener(
        'switch-browser-control',
        handleSwitchControl as EventListener,
      );
    };
  }, []);

  // Global keyboard listener for fullscreen mode - Escape to exit
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen && controlMode === 'user') {
        event.preventDefault();
        switchControlMode('agent');
      }
    };

    if (isFullscreen && controlMode === 'user') {
      document.addEventListener('keydown', handleGlobalKeyDown);
      return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }
  }, [isFullscreen, controlMode]);

  // =========================================================================
  // Control mode
  // =========================================================================

  const switchControlMode = (mode: 'agent' | 'user') => {
    if (!isConnectedRef.current) {
      toast.error('Not connected to browser session');
      return;
    }

    console.log(`[Kernel] Switching control mode to: ${mode}`);

    if (mode === 'user') {
      // Stop the AI when user takes control
      if (stop) {
        stop();
      }
      // On desktop, automatically enable fullscreen when switching to user mode
      if (!isMobile) {
        onFullscreenChange?.(true);
      }
    } else {
      // Exit fullscreen when giving back control to agent
      onFullscreenChange?.(false);
    }

    onControlModeChange(mode);
    toast.success(`Control switched to ${mode} mode`);
  };

  const disconnectBrowser = async () => {
    try {
      await fetch('/api/kernel-browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', sessionId }),
      });
      setIsConnected(false);
      setLiveViewUrl(null);
      onConnectionChange?.(false);
    } catch (err) {
      console.error('Failed to disconnect browser:', err);
    }
  };

  // Build the iframe URL with readOnly based on control mode
  // In agent mode: readOnly=true (user cannot interact)
  // In user mode: no readOnly param (user can interact directly)
  const iframeUrl = useMemo(() => {
    if (!liveViewUrl) return null;

    const url = new URL(liveViewUrl);
    if (controlMode === 'agent') {
      url.searchParams.set('readOnly', 'true');
    } else {
      url.searchParams.delete('readOnly');
    }
    return url.toString();
  }, [liveViewUrl, controlMode]);

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return <BrowserLoadingState />;
  }

  if (error) {
    return <BrowserErrorState onRetry={initBrowser} />;
  }

  if (!liveViewUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 text-zinc-400">
        No browser available
      </div>
    );
  }

  // Fullscreen mode when user has control
  if (controlMode === 'user' && isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 browser-fullscreen-bg flex flex-col overflow-hidden">
        {/* Fullscreen header with controls */}
        <div className="sticky top-0 left-0 right-0 z-10 browser-fullscreen-bg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="size-2 bg-red-500 rounded-full animate-pulse status-indicator" />
                <span className="text-xs sm:text-sm font-medium font-ibm-plex-mono browser-fullscreen-text">
                  You're editing manually
                </span>
              </div>
              <span className="text-xs sm:text-sm browser-fullscreen-text font-inter hidden sm:block">
                The AI will continue with your changes when you give back
                control.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => switchControlMode('agent')}
              >
                Give back control
              </Button>
            </div>
          </div>
        </div>

        {/* Fullscreen browser iframe */}
        <div className="flex-1 overflow-hidden browser-fullscreen-bg pt-20 pb-4 sm:pb-12 px-2 sm:px-4 md:px-12">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full max-w-[1920px] max-h-[1080px]" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                key={liveViewUrl}
                src={iframeUrl || undefined}
                className="absolute inset-0 w-full h-full border-0 bg-white rounded-lg shadow-2xl"
                allow="clipboard-read; clipboard-write"
                title="Browser View"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile drawer mode
  if (isMobile) {
    return (
      <div className="pointer-events-none">
        {/* Mobile: Floating button to open browser drawer */}
        <div className="fixed top-4 right-4 z-[100] pointer-events-auto">
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={() => setIsSheetOpen(true)}
            className="rounded-full shadow-lg"
          >
            <Monitor className="w-5 h-5 mr-2" />
            View Browser
          </Button>
        </div>

        {/* Mobile: Bottom sheet with browser content */}
        <div className="pointer-events-auto">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent
              side="bottom"
              className="h-[85vh] p-0 overflow-y-scroll flex flex-col z-[100]"
            >
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="text-left">Browser View</SheetTitle>
              </SheetHeader>

              {/* Loading state */}
              {loading && <BrowserLoadingState />}

              {/* Control mode indicator */}
              {isConnected && (
                <div className="flex-shrink-0 flex items-center justify-between py-2 px-4 bg-muted/20">
                  <AgentStatusIndicator
                    chatStatus={chatStatus}
                    controlMode={controlMode}
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() =>
                      switchControlMode(
                        controlMode === 'user' ? 'agent' : 'user',
                      )
                    }
                  >
                    {controlMode === 'user' ? (
                      'Give back control'
                    ) : (
                      <>
                        <MousePointerClick className="w-4 h-4 mr-1" />
                        Take control
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Browser content */}
              <div className="flex-1 overflow-hidden min-h-0 p-4">
                {error ? (
                  <BrowserErrorState onRetry={initBrowser} />
                ) : !isConnected ? (
                  <BrowserLoadingState />
                ) : (
                  <div className="h-full overflow-hidden bg-black rounded-lg">
                    <iframe
                      key={liveViewUrl}
                      src={iframeUrl || undefined}
                      className="w-full h-full border-0 bg-white shadow-lg"
                      allow="clipboard-read; clipboard-write"
                      title="Browser View"
                    />
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    );
  }

  // Normal (non-fullscreen) desktop mode
  return (
    <div className="h-full flex flex-col">
      {/* Control mode indicator and buttons */}
      {isConnected && (
        <div className="flex-shrink-0 flex items-center justify-between py-2 bg-muted/20">
          <AgentStatusIndicator
            chatStatus={chatStatus}
            controlMode={controlMode}
            className="text-sm text-black"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => initBrowser(true)}
              title="Refresh browser connection"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() =>
                switchControlMode(
                  controlMode === 'user' ? 'agent' : 'user',
                )
              }
            >
              <MousePointerClick className="w-4 h-4" />
              {controlMode === 'user' ? 'Give back control' : 'Take control'}
            </Button>
          </div>
        </div>
      )}

      {/* Browser iframe */}
      <div className="flex-1 relative m-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <iframe
            key={liveViewUrl}
            src={iframeUrl || undefined}
            className="w-full h-full border-0 bg-white"
            allow="clipboard-read; clipboard-write"
            title="Browser View"
          />
        </div>
      </div>
    </div>
  );
}
