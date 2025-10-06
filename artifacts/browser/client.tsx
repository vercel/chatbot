import { Artifact } from '@/components/create-artifact';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonitorX, Loader2, RefreshCwIcon, Monitor, Camera, Hand, Bot, MousePointerClick, Eye } from 'lucide-react';
import { toast } from 'sonner';

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
}

export const browserArtifact = new Artifact<'browser', BrowserArtifactMetadata>({
  kind: 'browser',
  description: 'Live browser automation display with real-time streaming',
  
  initialize: async ({ documentId, setMetadata }) => {
    // Initialize with a unique session ID based on document ID
    const sessionId = `browser-${documentId}-${Date.now()}`;

    setMetadata({
      sessionId,
      isConnected: false,
      isConnecting: false,
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

  content: ({ metadata, setMetadata, isCurrentVersion, status }) => {
    const [lastFrame, setLastFrame] = useState<string | null>(null);
  
    const wsRef = useRef<WebSocket | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameCountRef = useRef(0);
    const lastFrameTimeRef = useRef(Date.now());
    const lastMoveEventRef = useRef<number>(0);

    const connectToBrowserStream = async () => {
      if (!metadata?.sessionId) return;
      
      try {
        setMetadata({
          ...metadata,
          isConnecting: true,
          error: undefined,
        });

        // Get WebSocket connection info from our API
        const response = await fetch(`/api/browser-stream?sessionId=${metadata.sessionId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const connectionInfo = await response.json();

        if (connectionInfo.error) {
          throw new Error(connectionInfo.error);
        }

        // Connect to the browser streaming WebSocket
        const ws = new WebSocket(connectionInfo.url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to browser streaming service');
          setMetadata({
            ...metadata,
            isConnected: true,
            isConnecting: false,
          });
          
          // Request streaming to start
          ws.send(JSON.stringify({
            type: 'start-streaming',
            sessionId: metadata.sessionId
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
          setMetadata({
            ...metadata,
            isConnected: false,
            isConnecting: false,
          });
          wsRef.current = null;
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setMetadata({
            ...metadata,
            error: 'WebSocket connection error',
            isConnecting: false,
          });
        };

      } catch (err) {
        console.error('Failed to connect to browser stream:', err);
        setMetadata({
          ...metadata,
          error: err instanceof Error ? err.message : 'Connection failed',
          isConnecting: false,
        });
      }
    };

    const disconnectFromBrowserStream = () => {
      if (wsRef.current) {
        // Request streaming to stop
        wsRef.current.send(JSON.stringify({
          type: 'stop-streaming',
          sessionId: metadata?.sessionId
        }));
        
        wsRef.current.close();
        wsRef.current = null;
      }
      
      if (metadata) {
        setMetadata({
          ...metadata,
          isConnected: false,
          error: undefined,
        });
      }
      setLastFrame(null);
    };

    const switchControlMode = (mode: 'agent' | 'user') => {
      if (!metadata?.sessionId || !wsRef.current) {
        toast.error('Not connected to browser session');
        console.error('Cannot switch control mode - missing sessionId or WebSocket connection');
        return;
      }

      console.log(`Switching control mode to: ${mode} for session: ${metadata.sessionId}`);
      console.log('WebSocket readyState:', wsRef.current.readyState);

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

      // Automatically enable fullscreen when switching to user mode
      if (mode === 'user') {
        setMetadata(prev => ({
          ...prev,
          controlMode: mode,
          isFocused: true,
          isFullscreen: true
        }));
      } else {
        setMetadata(prev => ({
          ...prev,
          controlMode: mode,
          isFocused: false,
          isFullscreen: false
        }));
      }

      console.log(`Control mode switch message sent for ${mode}`);
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

    const handleCanvasInteraction = (event: React.MouseEvent | React.KeyboardEvent | React.WheelEvent) => {
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

      // Get the mouse position relative to the canvas
      const mouseX = (event as React.MouseEvent).clientX - rect.left;
      const mouseY = (event as React.MouseEvent).clientY - rect.top;

      // Check if the click is outside the rendered video area
      if (mouseX < offsetX || mouseX > offsetX + renderedWidth || mouseY < offsetY || mouseY > offsetY + renderedHeight) {
        // Click was in the letterboxed/pillarboxed area, so ignore it
        return;
      }

      // Calculate the final coordinates within the browser's viewport
      const finalX = (mouseX - offsetX) * scaleX;
      const finalY = (mouseY - offsetY) * scaleY;

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
    useEffect(() => {
      if (metadata && !metadata.isConnected && !metadata.isConnecting) {
        // Auto-connect when artifact is visible and not already connected
        connectToBrowserStream();
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

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        disconnectFromBrowserStream();
      };
    }, []);

    if (!metadata) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="size-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-muted-foreground">Initializing browser artifact...</p>
          </div>
        </div>
      );
    }

    // Fullscreen mode when in user control mode
    if (metadata.controlMode === 'user' && metadata.isFullscreen) {
      return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
          {/* Fullscreen header with controls */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-black/90 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 text-white">
                <span className="text-sm font-medium">YOU ARE CONTROLLING THE BROWSER</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchControlMode('agent')}
                  className="px-4 py-2.5 rounded text-sm font-medium leading-5 border-0 hover:bg-custom-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-custom-purple"
                >
                  <div className="flex items-center gap-2 text-white">
                    Hand Back Control
                  </div>
                </Button>
              </div>
            </div>
          </div>

          {/* Fullscreen browser canvas */}
          <div className="absolute inset-0 pt-20 pb-12 px-12 bg-black/80">
            {metadata.error ? (
              <div className="flex items-center justify-center h-full bg-red-900/20 text-red-300">
                <div className="text-center">
                  <MonitorX className="size-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Connection Error</p>
                  <p className="text-xs opacity-75">{metadata.error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-white border-white/20 hover:bg-white/10"
                    onClick={connectToBrowserStream}
                  >
                    <RefreshCwIcon className="size-4 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : !metadata.isConnected ? (
              <div className="flex items-center justify-center h-full text-white/70">
                <div className="text-center">
                  {metadata.isConnecting ? (
                    <>
                      <Loader2 className="size-8 mx-auto mb-2 animate-spin" />
                      <p className="text-sm">Connecting to browser...</p>
                    </>
                  ) : (
                    <>
                      <Monitor className="size-8 mx-auto mb-2" />
                      <p className="text-sm">No browser connection</p>
                      <p className="text-xs opacity-75">Browser display will appear here during automation</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border-4 border-black">
                <div
                  className="relative h-full max-h-[calc(100vh-12rem)] rounded-lg overflow-hidden shadow-2xl bg-white"
                  tabIndex={0}
                  onKeyDown={handleKeyboardInput}
                  onKeyUp={handleKeyboardInput}
                >
                  <canvas
                    ref={canvasRef}
                    id="browser-artifact-canvas"
                    width={1920}
                    height={1080}
                    className="h-full object-contain bg-white cursor-pointer"
                    onClick={handleCanvasInteraction}
                    onMouseMove={handleCanvasInteraction}
                    onWheel={handleCanvasInteraction}
                    onContextMenu={(e) => {
                      e.preventDefault(); // Allow right-click handling
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

          return (
        <div className="h-full flex flex-col">
          {/* Connection status indicator */}
          {metadata.isConnecting && (
            <div className="flex items-center justify-center py-2 text-sm text-muted-foreground bg-muted/30">
              <Loader2 className="size-4 mr-2 animate-spin" />
              Connecting to browser...
            </div>
          )}
           
          {/* Control mode indicator */}
          {metadata.isConnected && (
            <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
              <div className="flex items-center gap-3 text-sm">
                {metadata.controlMode === 'user' ? (
                  <>
                    <span className="text-blue-600 font-medium">You are controlling the browser</span>
                    <span className="text-xs text-muted-foreground">Click and type to interact</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">Agent is controlling the browser</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={metadata.controlMode === 'user' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => switchControlMode('user')}
                  className="px-4 py-2.5 rounded text-sm font-medium leading-5 border-0 hover:bg-custom-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-custom-purple"
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
          <div className="flex-1 relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-inner border border-gray-200/50 m-4">
            {metadata.error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600">
                <div className="text-center">
                  <MonitorX className="size-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Connection Error</p>
                  <p className="text-xs opacity-75">{metadata.error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={connectToBrowserStream}
                  >
                    <RefreshCwIcon className="size-4 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : !metadata.isConnected ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-500">
                <div className="text-center">
                  {metadata.isConnecting ? (
                    <>
                      <Loader2 className="size-8 mx-auto mb-2 animate-spin" />
                      <p className="text-sm">Connecting to browser...</p>
                    </>
                  ) : (
                    <>
                      <Monitor className="size-8 mx-auto mb-2" />
                      <p className="text-sm">No browser connection</p>
                      <p className="text-xs opacity-75">Browser display will appear here during automation</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-6 rounded-lg">
                <div
                  className="relative rounded-md overflow-hidden shadow-lg ring-1 ring-black/5 bg-white w-11/12 h-11/12 max-w-6xl max-h-5xl"
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
                    <div className="absolute inset-0 flex items-center justify-center text-white z-10 pointer-events-none bg-[#B1409299]">
                      <h2 className="text-4xl font-bold">Click to activate browser control</h2>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    id="browser-artifact-canvas"
                    width={1920}
                    height={1080}
                    className={`size-full object-contain bg-white ${metadata.controlMode === 'user' ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={handleCanvasInteraction}
                    onMouseMove={handleCanvasInteraction}
                    onWheel={handleCanvasInteraction}
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
          
          {/* Status footer */}
          {metadata.isConnected && (
            <div className="px-4 pb-4 text-xs text-gray-500 flex justify-between">
              {/* <span>Session: {metadata.sessionId}</span> */}
              <span className="flex items-center gap-1">
                <div className="size-2 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            </div>
          )}
        </div>
    );
  },

  actions: [
    {
      icon: <RefreshCwIcon size={18} />,
      description: 'Refresh browser session',
      onClick: ({ metadata, setMetadata }) => {
        // Reset connection state to trigger reconnection
        if (metadata) {
          setMetadata({
            ...metadata,
            isConnected: false,
            isConnecting: false,
            error: undefined,
          });
        }
      },
    },
    {
      icon: <Camera size={18} />,
      description: 'Take screenshot',
      onClick: () => {
        // Find the canvas element and trigger screenshot
        const canvas = document.querySelector('#browser-artifact-canvas') as HTMLCanvasElement;
        if (!canvas) {
          toast.error('No browser view available for screenshot');
          return;
        }

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error('Failed to capture screenshot');
            return;
          }

          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `browser-screenshot-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success('Screenshot saved!');
        }, 'image/png');
      },
    },
  ],

  toolbar: [],
});
