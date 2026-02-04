'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MousePointerClick, RefreshCw, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { AgentStatusIndicator } from '@/components/agent-status-indicator';
import { BrowserLoadingState, BrowserErrorState } from './browser-states';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ChatStatus } from '@/components/create-artifact';

interface KernelBrowserClientProps {
  sessionId: string;
  controlMode: 'agent' | 'user';
  onControlModeChange: (mode: 'agent' | 'user') => void;
  onConnectionChange?: (connected: boolean) => void;
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

  // Use refs to avoid dependency changes triggering re-initialization
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  // Use ref for isConnected to avoid stale closure in event handlers
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  // Track if we've already initialized for this session
  const initializedSessionRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveViewActiveRef = useRef(false);

  const sendLiveViewEvent = useCallback(
    async (event: 'connected' | 'disconnected' | 'heartbeat') => {
      try {
        await fetch('/api/kernel-browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: event === 'disconnected',
          body: JSON.stringify({
            action:
              event === 'connected'
                ? 'liveViewConnected'
                : event === 'disconnected'
                ? 'liveViewDisconnected'
                : 'liveViewHeartbeat',
            sessionId,
          }),
        });
      } catch (error) {
        console.warn(`Failed to send live view ${event} event`, error);
      }
    },
    [sessionId]
  );

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const notifyDisconnected = useCallback(async () => {
    if (!liveViewActiveRef.current) return;
    liveViewActiveRef.current = false;
    stopHeartbeat();
    await sendLiveViewEvent('disconnected');
  }, [sendLiveViewEvent, stopHeartbeat]);

  const startHeartbeat = useCallback(async () => {
    stopHeartbeat();
    await sendLiveViewEvent('connected');
    liveViewActiveRef.current = true;
    heartbeatIntervalRef.current = setInterval(() => {
      if (liveViewActiveRef.current) {
        void sendLiveViewEvent('heartbeat');
      }
    }, 30_000);
  }, [sendLiveViewEvent, stopHeartbeat]);

  const initBrowser = useCallback(async (force = false) => {
    // Skip if already initialized for this session (unless forced)
    if (!force && initializedSessionRef.current === sessionId && liveViewUrl) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

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
      await startHeartbeat();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
      await notifyDisconnected();
    } finally {
      setLoading(false);
    }
  }, [sessionId, liveViewUrl, notifyDisconnected, startHeartbeat]);

  // Keep sessionId in a ref so the beforeunload handler always has the latest value
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Initialize browser on mount
  useEffect(() => {
    if (initializedSessionRef.current !== sessionId) {
      initBrowser();
    }
  }, [sessionId, initBrowser]);

  // Clean up browser only when the user closes/navigates away from the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const payload = JSON.stringify({ action: 'delete', sessionId: sessionIdRef.current });
        navigator.sendBeacon(
          '/api/kernel-browser',
          new Blob([payload], { type: 'application/json' }),
        );
      } catch {
        // Best-effort cleanup
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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

    window.addEventListener('switch-browser-control', handleSwitchControl as EventListener);

    return () => {
      window.removeEventListener('switch-browser-control', handleSwitchControl as EventListener);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopHeartbeat();
      void notifyDisconnected();
    };
  }, [stopHeartbeat, notifyDisconnected]);

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
      await notifyDisconnected();
    } catch (err) {
      console.error('Failed to disconnect browser:', err);
    }
  };

  // Build the iframe URL with readOnly based on control mode
  // In agent mode: readOnly=true (user cannot interact)
  // In user mode: no readOnly param (user can interact directly)
  // Memoize to prevent unnecessary iframe reloads
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
                <span className="text-xs sm:text-sm font-medium font-ibm-plex-mono browser-fullscreen-text">You're editing manually</span>
              </div>
              <span className="text-xs sm:text-sm browser-fullscreen-text font-inter hidden sm:block">
                The AI will continue with your changes when you give back control.
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
                key={liveViewUrl} // Stable key prevents unnecessary remounts
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

  // Mobile drawer mode - matches legacy client.tsx mobile experience
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
            <SheetContent side="bottom" className="h-[85vh] p-0 overflow-y-scroll flex flex-col z-[100]">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="text-left">Browser View</SheetTitle>
              </SheetHeader>

              {/* Loading state */}
              {loading && <BrowserLoadingState />}

              {/* Control mode indicator */}
              {isConnected && (
                <div className="flex items-center justify-between py-2 px-4 bg-muted/20">
                  <AgentStatusIndicator
                    chatStatus={chatStatus}
                    controlMode={controlMode}
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => switchControlMode(controlMode === 'user' ? 'agent' : 'user')}
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
              <div className="flex-1 overflow-y-scroll p-4">
                {error ? (
                  <BrowserErrorState onRetry={initBrowser} />
                ) : !isConnected ? (
                  <BrowserLoadingState />
                ) : (
                  <div className="flex items-center justify-center">
                    <div className="relative w-full max-w-[768px] bg-white rounded-lg shadow-lg">
                      <iframe
                        key={liveViewUrl}
                        src={iframeUrl || undefined}
                        className="w-full border-0 bg-white rounded-lg"
                        style={{ aspectRatio: '4 / 3' }}
                        allow="clipboard-read; clipboard-write"
                        title="Browser View"
                      />
                    </div>
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
        <div className="flex items-center justify-between py-2 bg-muted/20">
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
              onClick={() => switchControlMode(controlMode === 'user' ? 'agent' : 'user')}
            >
              <MousePointerClick className="w-4 h-4" />
              {controlMode === 'user' ? 'Give back control' : 'Take control'}
            </Button>
          </div>
        </div>
      )}

      {/* Browser iframe - matches client.tsx layout: flex-1 relative m-4 with centered content */}
      <div className="flex-1 relative m-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <iframe
            key={liveViewUrl}
            src={iframeUrl || undefined}
            className="w-full border-0 bg-white rounded-lg"
            style={{ aspectRatio: '16 / 9' }}
            allow="clipboard-read; clipboard-write"
            title="Browser View"
          />
        </div>
      </div>
    </div>
  );
}
