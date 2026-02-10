import { Artifact, type ChatContext } from '@/components/create-artifact';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonitorX, Loader2, RefreshCwIcon, Monitor, MousePointerClick, ClockFading, Maximize2, ArrowLeftIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AgentStatusIndicator } from '@/components/agent-status-indicator';
import { BrowserLoadingState, BrowserErrorState, BrowserTimeoutState } from './browser-states';
import { KernelBrowserClient } from './client-kernel';

// Feature flag for AI SDK agent vs Mastra (client-side)
const useAiSdkAgent = process.env.NEXT_PUBLIC_USE_AI_SDK_AGENT === 'true';

interface BrowserFrame {
  type: 'frame';
  data: string; // Base64 encoded image
  timestamp: number;
  sessionId: string;
}

interface BrowserArtifactMetadata {
  sessionId: string;
  isConnected: boolean;
  isConnecting: boolean;
  lastFrameTimestamp?: number;
  connectionUrl?: string;
  error?: string;
  controlMode: 'agent' | 'user';
  isFocused: boolean;
  isFullscreen: boolean;
  isSheetOpen?: boolean;
  setIsSheetOpen?: (open: boolean) => void;
}

export const browserArtifact = new Artifact<'browser', BrowserArtifactMetadata>({
  kind: 'browser',
  description: 'Live browser automation display with real-time streaming',

  initialize: async ({ documentId, setMetadata, chatContext }) => {
    // CRITICAL: Use chat session ID (threadId-resourceId) for browser streaming session isolation
    // This ensures each chat gets its own browser stream, preventing cross-session visibility
    // The sessionId MUST match the format used by Mastra backend: `${threadId}-${resourceId}`
    let sessionId: string;

    if (chatContext?.chatId && chatContext?.resourceId) {
      // Use the same session ID format as Mastra backend for proper correlation
      sessionId = `${chatContext.chatId}-${chatContext.resourceId}`;
      console.log(`[Browser Artifact] Using chat session ID for streaming: ${sessionId}`);
    } else {
      // Fallback to document-based ID (less ideal, but still unique per artifact)
      sessionId = `browser-${documentId}-${Date.now()}`;
      console.warn(`[Browser Artifact] No chat context available, using document-based session ID: ${sessionId}`);
    }

    setMetadata({
      sessionId,
      isConnected: false,
      isConnecting: true, // Start in connecting state since auto-connect will trigger immediately
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    });
  },

  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    // Handle artifact creation - make it visible when streaming starts
    if (streamPart.type === 'data-kind' && streamPart.data === 'browser') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        isVisible: true,
        status: 'streaming',
      }));
    }
    
    // Handle content updates
    if (streamPart.type === 'data-textDelta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: draftArtifact.content + streamPart.data,
        status: 'streaming',
      }));
    }
  },

  content: ({ metadata, setMetadata, isCurrentVersion, status, chatStatus, stop }) => {
    // =====================================================
    // ALL HOOKS MUST BE AT THE TOP - before any conditional returns
    // This is a React requirement - hooks must be called in the same order every render
    // =====================================================
    const [lastFrame, setLastFrame] = useState<string | null>(null);
    const isMobile = useIsMobile();
    const wsRef = useRef<WebSocket | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameCountRef = useRef(0);
    const lastFrameTimeRef = useRef(Date.now());
    const lastMoveEventRef = useRef<number>(0);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

    // Define connectToBrowserStream early so it can be used in useEffect
    // This function is only used in the Mastra/WebSocket path, but must be stable for hooks
    const connectToBrowserStream = async () => {
      if (!metadata?.sessionId) return;

      try {
        setMetadata(prev => ({
          ...prev,
          isConnecting: true,
          error: undefined,
        }));

        // Fetch browser WebSocket proxy config from server (runtime config)
        let wsUrl: string;
        try {
          const configRes = await fetch('/api/browser-ws-config');
          const config = await configRes.json();

          if (config.proxyUrl) {
            // Production: use dedicated proxy service
            const url = new URL(config.proxyUrl);
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${url.host}?sessionId=${metadata.sessionId}`;
          } else {
            // Development: connect directly to localhost
            wsUrl = `ws://localhost:8933?sessionId=${metadata.sessionId}`;
          }
        } catch (err) {
          console.warn('Failed to fetch browser WS config, falling back to localhost:', err);
          wsUrl = `ws://localhost:8933?sessionId=${metadata.sessionId}`;
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const currentSessionId = metadata.sessionId; // Capture for closure
        
        ws.onopen = () => {
          console.log('Connected to browser streaming service');
          setMetadata(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
          }));
          
          // Request streaming to start
          ws.send(JSON.stringify({
            type: 'start-streaming',
            sessionId: currentSessionId
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case 'frame':
                handleBrowserFrame(message as BrowserFrame);
                break;
                
              case 'streaming-started':
                console.log('Browser streaming started:', message.sessionId);
                break;
                
              case 'streaming-stopped':
                console.log('Browser streaming stopped:', message.sessionId);
                break;
                
              case 'control-mode-changed':
                console.log('Control mode changed to:', message.data?.mode);
                const newMode = message.data?.mode || 'agent';
                setMetadata(prev => ({
                  ...prev,
                  controlMode: newMode,
                  isFocused: newMode === 'agent' ? false : prev.isFocused, // Reset focus when switching to agent mode
                }));
                toast.success(`Control switched to ${newMode} mode`);
                break;
                
              case 'error':
                console.error('Browser streaming error:', message.error);
                setMetadata(prev => ({
                  ...prev,
                  error: message.error,
                  isConnecting: false,
                }));
                break;
                
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from browser streaming service');
          setMetadata(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
          }));
          wsRef.current = null;
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setMetadata(prev => ({
            ...prev,
            error: 'WebSocket connection error',
            isConnecting: false,
          }));
        };

      } catch (err) {
        console.error('Failed to connect to browser stream:', err);
        setMetadata(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Connection failed',
          isConnecting: false,
        }));
      }
    };

    const disconnectFromBrowserStream = () => {
      if (wsRef.current) {
        const currentSessionId = metadata?.sessionId;
        
        // Request streaming to stop (but keep Chrome alive)
        if (currentSessionId && wsRef.current.readyState === WebSocket.OPEN) {
          console.log(`Requesting stop-streaming for session: ${currentSessionId} (Chrome remains alive)`);
          wsRef.current.send(JSON.stringify({
            type: 'stop-streaming',
            sessionId: currentSessionId
          }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      
      if (metadata) {
        setMetadata(prev => ({
          ...prev,
          isConnected: false,
          error: undefined,
        }));
      }
      setLastFrame(null);
    };

    const switchControlMode = (mode: 'agent' | 'user') => {
      if (!metadata?.sessionId) {
        toast.error('Not connected to browser session');
        console.error('Cannot switch control mode - missing sessionId');
        return;
      }

      console.log(`Switching control mode to: ${mode} for session: ${metadata.sessionId}`);

      // AI SDK path: Kernel iframe handles input natively, no WebSocket needed
      if (!useAiSdkAgent) {
        if (!wsRef.current) {
          toast.error('Not connected to browser session');
          console.error('Cannot switch control mode - missing WebSocket connection');
          return;
        }

        if (wsRef.current.readyState !== WebSocket.OPEN) {
          toast.error('WebSocket connection is not open');
          console.error('WebSocket is not in OPEN state:', wsRef.current.readyState);
          return;
        }

        wsRef.current.send(JSON.stringify({
          type: 'control-mode',
          sessionId: metadata.sessionId,
          data: { mode }
        }));
      }

      // On mobile, keep the sheet open when switching to user mode
      // On desktop, automatically enable fullscreen when switching to user mode
      if (mode === 'user') {
        // Call stop to send stopChat action to backend when user takes control
        if (stop) {
          stop();
        }
        setMetadata(prev => ({
          ...prev,
          controlMode: mode,
          isFocused: true,
          isFullscreen: isMobile ? false : true
        }));
      } else {
        setMetadata(prev => ({
          ...prev,
          controlMode: mode,
          isFocused: false,
          isFullscreen: false
        }));
      }

      console.log(`Control mode switched to ${mode}`);
    };

    const sendUserInput = (inputData: any) => {
      if (!metadata?.sessionId || !wsRef.current) return;
      if (metadata.controlMode !== 'user') return;

      wsRef.current.send(JSON.stringify({
        type: 'user-input',
        sessionId: metadata.sessionId,
        data: inputData
      }));
    };

    const handleCanvasInteraction = (event: React.MouseEvent | React.KeyboardEvent | React.WheelEvent | React.TouchEvent) => {
      if (metadata?.controlMode !== 'user' || !metadata.isFocused) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      
      // Calculate the actual rendered size of the 16:9 video within the canvas element
      const videoAspectRatio = 16 / 9;
      let renderedWidth = rect.width;
      let renderedHeight = rect.height;

      if (rect.width / rect.height > videoAspectRatio) {
        // Letterboxed (empty space on sides)
        renderedWidth = rect.height * videoAspectRatio;
      } else {
        // Pillarboxed (empty space on top/bottom)
        renderedHeight = rect.width / videoAspectRatio;
      }

      // Calculate the offset of the rendered video within the canvas
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;

      // Calculate scaling factors based on the actual rendered size
      const scaleX = canvas.width / renderedWidth;
      const scaleY = canvas.height / renderedHeight;

      // Get the input position relative to the canvas (works for both mouse and touch)
      let clientX: number;
      let clientY: number;
      
      if (event.type.startsWith('touch')) {
        const touchEvent = event as React.TouchEvent;
        if (event.type === 'touchend') {
          // For touchend, use changedTouches
          const touch = touchEvent.changedTouches[0];
          if (!touch) return;
          clientX = touch.clientX;
          clientY = touch.clientY;
        } else {
          // For touchstart and touchmove, use touches
          const touch = touchEvent.touches[0];
          if (!touch) return;
          clientX = touch.clientX;
          clientY = touch.clientY;
        }
      } else {
        const mouseEvent = event as React.MouseEvent;
        clientX = mouseEvent.clientX;
        clientY = mouseEvent.clientY;
      }

      const inputX = clientX - rect.left;
      const inputY = clientY - rect.top;

      // Check if the input is outside the rendered video area
      if (inputX < offsetX || inputX > offsetX + renderedWidth || inputY < offsetY || inputY > offsetY + renderedHeight) {
        // Input was in the letterboxed/pillarboxed area, so ignore it
        return;
      }

      // Calculate the final coordinates within the browser's viewport
      const finalX = (inputX - offsetX) * scaleX;
      const finalY = (inputY - offsetY) * scaleY;

      if (event.type === 'click') {
        const mouseEvent = event as React.MouseEvent;
        const buttonName = mouseEvent.button === 0 ? 'left' : mouseEvent.button === 2 ? 'right' : 'middle';
        
        sendUserInput({
          type: 'click',
          x: finalX,
          y: finalY,
          button: buttonName
        });
      } else if (event.type === 'mousemove') {
        // Throttle mousemove events to avoid overwhelming the connection
        const now = Date.now();
        if (now - lastMoveEventRef.current > 50) { // Send updates every 50ms
          lastMoveEventRef.current = now;
          sendUserInput({
            type: 'mousemove',
            x: finalX,
            y: finalY
          });
        }
      } else if (event.type === 'wheel') {
        const wheelEvent = event as React.WheelEvent;
        sendUserInput({
          type: 'scroll',
          x: finalX,
          y: finalY,
          deltaX: wheelEvent.deltaX,
          deltaY: wheelEvent.deltaY
        });
      } else if (event.type === 'touchstart') {
        // Store the touch start position and time for scroll detection
        touchStartRef.current = { x: finalX, y: finalY, time: Date.now() };
        lastTouchRef.current = { x: finalX, y: finalY };
        
        sendUserInput({
          type: 'touchstart',
          x: finalX,
          y: finalY
        });
      } else if (event.type === 'touchmove') {
        if (touchStartRef.current && lastTouchRef.current) {
          const deltaX = lastTouchRef.current.x - finalX;
          const deltaY = lastTouchRef.current.y - finalY;
          
          // If the touch has moved more than a threshold, treat it as a scroll
          const scrollThreshold = 10; // Minimum pixels to consider it a scroll
          if (Math.abs(deltaX) > scrollThreshold || Math.abs(deltaY) > scrollThreshold) {
            // Send scroll event instead of touchmove
            sendUserInput({
              type: 'scroll',
              x: finalX,
              y: finalY,
              deltaX: deltaX,
              deltaY: deltaY
            });
            
            lastTouchRef.current = { x: finalX, y: finalY };
          } else {
            // Small movement, treat as regular touch move
            const now = Date.now();
            if (now - lastMoveEventRef.current > 50) {
              lastMoveEventRef.current = now;
              sendUserInput({
                type: 'touchmove',
                x: finalX,
                y: finalY
              });
              lastTouchRef.current = { x: finalX, y: finalY };
            }
          }
        }
      } else if (event.type === 'touchend') {
        // Check if this was a quick tap (not a scroll)
        const touchDuration = touchStartRef.current ? Date.now() - touchStartRef.current.time : 0;
        const isTap = touchDuration < 200; // Less than 200ms is a tap
        
        if (isTap && touchStartRef.current) {
          // Calculate distance moved
          const distanceMoved = Math.sqrt(
            Math.pow(finalX - touchStartRef.current.x, 2) + 
            Math.pow(finalY - touchStartRef.current.y, 2)
          );
          
          // If barely moved, it's a tap/click
          if (distanceMoved < 20) {
            // Send a click event instead of touchend for taps
            sendUserInput({
              type: 'click',
              x: finalX,
              y: finalY,
              button: 'left'
            });
          }
        }
        
        sendUserInput({
          type: 'touchend',
          x: finalX,
          y: finalY
        });
        
        // Reset touch tracking
        touchStartRef.current = null;
        lastTouchRef.current = null;
      }
    };

    const handleKeyboardInput = (event: React.KeyboardEvent) => {
      if (metadata?.controlMode !== 'user' || !metadata.isFocused) return;

      // Handle Escape key to exit fullscreen
      if (event.key === 'Escape' && metadata.isFullscreen) {
        event.preventDefault();
        switchControlMode('agent');
        return;
      }

      sendUserInput({
        type: event.type === 'keydown' ? 'keydown' : 'keyup',
        key: event.key,
        code: event.code,
        text: event.key.length === 1 ? event.key : undefined
      });
    };

    const handleBrowserFrame = (frame: BrowserFrame) => {
      // Update frame rate tracking
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFrameTimeRef.current >= 1000) {
        console.log(`Browser frame rate: ${frameCountRef.current} FPS`);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

      // Update the canvas with the new frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (metadata?.isFullscreen) {
          console.log('Setting touch action to auto');
          canvas.style.touchAction = 'auto';
        }
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            // Clear canvas and draw new frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = `data:image/jpeg;base64,${frame.data}`;
        }
      }
      
      setLastFrame(frame.data);
    };


    // Auto-connect when artifact becomes current version or is first created
    // Skip WebSocket connection when using AI SDK agent (uses Kernel iframe instead)
    useEffect(() => {
      if (useAiSdkAgent) return; // Kernel handles its own connection via iframe

      if (metadata && !metadata.isConnected) {
        // Auto-connect when artifact is visible and not already connected
        // We check !isConnected only, since initialize sets isConnecting: true
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectToBrowserStream();
        }
      }
    }, [isCurrentVersion, metadata?.sessionId]);

    // Redraw canvas when control mode changes (in case canvas was cleared during re-render)
    useEffect(() => {
      if (lastFrame && canvasRef.current && metadata?.controlMode) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = `data:image/jpeg;base64,${lastFrame}`;
        }
      }
    }, [metadata?.controlMode, lastFrame]);

    // Global keyboard listener for fullscreen mode
    useEffect(() => {
      const handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && metadata?.isFullscreen && metadata?.controlMode === 'user') {
          event.preventDefault();
          switchControlMode('agent');
        }
      };

      if (metadata?.isFullscreen && metadata?.controlMode === 'user') {
        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
      }
    }, [metadata?.isFullscreen, metadata?.controlMode]);

    // Cleanup on unmount - only disconnect stream, don't kill Chrome
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
    }, [switchControlMode]);

    useEffect(() => {
      return () => {
        if (wsRef.current) {
          disconnectFromBrowserStream();
        }
        // Chrome stays alive - agent or "Close Browser" button controls its lifecycle
      };
    }, []);

    if (!metadata) {
      return <BrowserLoadingState />;
    }

    // When using AI SDK agent with Kernel.sh, render the Kernel browser client
    // This uses an iframe with Kernel's live-view instead of WebSocket streaming
    if (useAiSdkAgent && metadata?.sessionId) {
      return (
        <KernelBrowserClient
          sessionId={metadata.sessionId}
          controlMode={metadata.controlMode}
          onControlModeChange={(mode) => {
            setMetadata((prev) => ({
              ...prev,
              controlMode: mode,
              isFocused: mode === 'user',
            }));
          }}
          onConnectionChange={(connected) => {
            setMetadata((prev) => ({
              ...prev,
              isConnected: connected,
              isConnecting: false,
            }));
          }}
          chatStatus={chatStatus}
          stop={stop}
          isFullscreen={metadata.isFullscreen}
          onFullscreenChange={(fullscreen) => {
            setMetadata((prev) => ({
              ...prev,
              isFullscreen: fullscreen,
            }));
          }}
        />
      );
    }

    // Fullscreen mode when in user control mode
    if (metadata.controlMode === 'user' && metadata.isFullscreen) {
      return (
        <div className="fixed inset-0 z-50 browser-fullscreen-bg flex flex-col overflow-hidden">
          {/* Fullscreen header with controls */}
          <div className="sticky top-0 left-0 right-0 z-10 browser-fullscreen-bg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-2">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="size-2 bg-red-500 rounded-full animate-pulse status-indicator" />
                  <span className="text-xs sm:text-sm font-medium font-ibm-plex-mono text-white">You're editing manually</span>
                </div>
                <span className="text-xs sm:text-sm text-white font-inter hidden sm:block">The AI will continue with your changes when you give back control.</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchControlMode('agent')}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded text-xs sm:text-sm font-medium leading-5 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                  <div className="flex items-center gap-2 text-white">
                    Give back control
                  </div>
                </Button>
              </div>
            </div>
          </div>

          {/* Fullscreen browser canvas */}
          <div className="flex-1 overflow-hidden browser-fullscreen-bg pt-20 pb-4 sm:pb-12 px-2 sm:px-4 md:px-12">
            {metadata.error ? (
              <BrowserErrorState onRetry={connectToBrowserStream} />
            ) : !metadata.isConnected ? (
              metadata.isConnecting ? <BrowserLoadingState /> : <BrowserTimeoutState onRetry={connectToBrowserStream} />
            ) : !lastFrame ? (
              <BrowserLoadingState />
            ) : (
              <div className="w-full h-full flex items-center justify-center overflow-auto overscroll-contain touch-action:pan-y_pan-x [-webkit-overflow-scrolling:touch]">
                <div
                  className="relative rounded-lg shadow-2xl bg-white min-w-0"
                  tabIndex={0}
                  onKeyDown={handleKeyboardInput}
                  onKeyUp={handleKeyboardInput}
                >
                  <canvas
                    ref={canvasRef}
                    id="browser-artifact-canvas"
                    width={1920}
                    height={1080}
                    className={`block w-full h-auto max-w-full object-contain bg-white ${
                      isMobile ? 'min-w-full' : ''
                    } max-w-[1920px] max-h-[1080px]`}
                    onClick={handleCanvasInteraction}
                    onMouseMove={handleCanvasInteraction}
                    onWheel={handleCanvasInteraction}
                    onTouchStart={handleCanvasInteraction}
                    onTouchMove={handleCanvasInteraction}
                    onTouchEnd={handleCanvasInteraction}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Render browser canvas content (reusable for both desktop and mobile drawer)
    const renderBrowserContent = () => {
      if (metadata.error) {
        return <BrowserErrorState onRetry={connectToBrowserStream} />;
      }
      
      if (!metadata.isConnected) {
        if (metadata.isConnecting) {
          return <BrowserLoadingState />;
        } else {
          return <BrowserTimeoutState onRetry={connectToBrowserStream} />;
        }
      }
      
      // Connected but no frame yet - keep showing loading state
      if (metadata.isConnected && !lastFrame) {
        return <BrowserLoadingState />;
      }
      
      // Connected state with frame - show browser canvas
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative w-full"
            tabIndex={metadata.controlMode === 'user' ? 0 : -1}
            onKeyDown={metadata.controlMode === 'user' ? handleKeyboardInput : undefined}
            onKeyUp={metadata.controlMode === 'user' ? handleKeyboardInput : undefined}
            onClick={() => {
              if (metadata.controlMode === 'user' && !metadata.isFocused) {
                setMetadata(prev => ({ ...prev, isFocused: true }));
              }
            }}
          >
            {metadata.controlMode === 'user' && !metadata.isFocused && (
              <div className="absolute inset-0 flex items-center justify-center text-white z-10 pointer-events-none bg-primary/60">
                <h2 className="text-4xl font-bold">Click to activate browser control</h2>
              </div>
            )}
            <canvas
              ref={canvasRef}
              id="browser-artifact-canvas"
              width={1920}
              height={1080}
              className="size-full object-contain bg-white browser-canvas-regular rounded-lg"
              onClick={handleCanvasInteraction}
              onMouseMove={handleCanvasInteraction}
              onWheel={handleCanvasInteraction}
              onTouchStart={handleCanvasInteraction}
              onTouchMove={handleCanvasInteraction}
              onTouchEnd={handleCanvasInteraction}
              onContextMenu={(e) => {
                if (metadata.controlMode === 'user') {
                  e.preventDefault(); // Allow right-click handling
                }
              }}
            />
          </div>
        </div>
      );
    };

    // Mobile drawer mode - render as portal to not interfere with chat
    if (isMobile) {
      return (
        <div className="pointer-events-none">
          {/* Mobile: Floating button to open browser drawer - uses pointer-events-auto to be clickable */}
          <div className="fixed top-4 right-4 z-[100] pointer-events-auto">
            <Button
              size="lg"
              onClick={() => metadata?.setIsSheetOpen?.(true)}
              className="rounded-full shadow-lg px-4 py-3 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Monitor className="w-5 h-5 mr-2" />
              View Browser
            </Button>
          </div>

          {/* Mobile: Bottom sheet with browser content */}
          <div className="pointer-events-auto">
            <Sheet open={metadata?.isSheetOpen || false} onOpenChange={metadata?.setIsSheetOpen || (() => {})}>
              <SheetContent side="bottom" className="h-[85vh] p-0 overflow-y-scroll flex flex-col z-[100]">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="text-left">Browser View</SheetTitle>
              </SheetHeader>
              
              {/* Control mode indicator */}
              {metadata.isConnected && (
                <div className="flex-shrink-0 flex items-center justify-between py-2 px-4 bg-muted/20">
                  <AgentStatusIndicator
                    chatStatus={chatStatus}
                    controlMode={metadata.controlMode}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      switchControlMode(metadata.controlMode === 'user' ? 'agent' : 'user');
                    }}
                    className="px-3 py-2 rounded text-xs font-medium border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  >
                    {metadata.controlMode === 'user' ? (
                      <div className="flex items-center gap-2 text-white">
                        Give back control
                      </div>
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
                {metadata.error ? (
                  <BrowserErrorState onRetry={connectToBrowserStream} />
                ) : !metadata.isConnected ? (
                  metadata.isConnecting ? <BrowserLoadingState /> : <BrowserTimeoutState onRetry={connectToBrowserStream} />
                ) : !lastFrame ? (
                  <BrowserLoadingState />
                ) : (
                  <div className="flex items-center justify-center">
                    <div
                      className="relative w-full max-w-[768px] bg-white rounded-lg shadow-lg overflow-y-scroll overscroll-contain touch-action:pan-y_pan-x [-webkit-overflow-scrolling:touch]"
                      tabIndex={metadata.controlMode === 'user' ? 0 : -1}
                      onKeyDown={metadata.controlMode === 'user' ? handleKeyboardInput : undefined}
                      onKeyUp={metadata.controlMode === 'user' ? handleKeyboardInput : undefined}
                      onClick={() => {
                        if (metadata.controlMode === 'user' && !metadata.isFocused) {
                          setMetadata(prev => ({ ...prev, isFocused: true }));
                        }
                      }}
                    >
                      <canvas
                        ref={canvasRef}
                        id="browser-artifact-canvas"
                        width={768}
                        height={432}
                        className="object-contain bg-white"
                        onClick={handleCanvasInteraction}
                        onMouseMove={handleCanvasInteraction}
                        onWheel={handleCanvasInteraction}
                        onTouchStart={handleCanvasInteraction}
                        onTouchMove={handleCanvasInteraction}
                        onTouchEnd={handleCanvasInteraction}
                        onContextMenu={(e) => {
                          if (metadata.controlMode === 'user') {
                            e.preventDefault(); // Allow right-click handling
                          }
                        }}
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

    // Desktop mode
    return (
      <div className="h-full flex flex-col">
        {/* Control mode indicator */}
        {metadata.isConnected && (
          <div className="flex-shrink-0 flex items-center justify-between py-2 bg-muted/20">
            <AgentStatusIndicator
              chatStatus={chatStatus}
              controlMode={metadata.controlMode}
              className="text-sm text-black"
            />
            <div className="flex items-center gap-2">
              <Button
                variant={metadata.controlMode === 'user' ? 'default' : 'outline'}
                size="sm"
                onClick={() => switchControlMode('user')}
                className="px-4 py-2.5 rounded text-sm font-medium leading-5 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                <div className="flex items-center gap-2 text-white">
                  <MousePointerClick className="w-5 h-5" />
                  Take control
                </div>
              </Button>
            </div>
          </div>
        )}
        {/* Main browser display area */}
        <div className="flex-1 relative m-4 overflow-hidden min-h-0">
          {renderBrowserContent()}
          </div>
        </div>
    );
  },

  actions: [],

  toolbar: [],
});
