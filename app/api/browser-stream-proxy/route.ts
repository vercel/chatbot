// Server-side WebSocket proxy for browser streaming
// Solves security issue: browsers block ws:// connections from HTTPS pages
// This proxy accepts secure wss:// connections from the frontend and forwards to ws:// backend


export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  // Require sessionId to prevent session collision
  if (!sessionId) {
    return new Response(
      JSON.stringify({
        error: 'Missing required sessionId query parameter'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Get browser streaming configuration from environment (runtime)
  const streamingPort = process.env.BROWSER_STREAMING_PORT || '8933';
  const streamingHost = process.env.BROWSER_STREAMING_HOST || 'localhost';
  const backendUrl = `ws://${streamingHost}:${streamingPort}`;

  console.log(`[Browser Stream Proxy] New connection request for session: ${sessionId}`);
  console.log(`[Browser Stream Proxy] Backend URL: ${backendUrl}`);

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade request', { status: 426 });
  }

  try {
    // Get the underlying socket from the request
    // @ts-ignore - Next.js doesn't expose this in types but it exists
    const { socket, response } = Deno.upgradeWebSocket(request);

    // Connect to the backend browser-streaming service
    const backendWs = new WebSocket(backendUrl);

    // Forward messages from client to backend
    socket.addEventListener('message', (event: MessageEvent) => {
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.send(event.data);
      }
    });

    // Forward messages from backend to client
    backendWs.addEventListener('message', (event: MessageEvent) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    });

    // Handle client disconnect
    socket.addEventListener('close', () => {
      console.log(`[Browser Stream Proxy] Client disconnected for session: ${sessionId}`);
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.close();
      }
    });

    // Handle backend disconnect
    backendWs.addEventListener('close', () => {
      console.log(`[Browser Stream Proxy] Backend disconnected for session: ${sessionId}`);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });

    // Handle errors
    socket.addEventListener('error', (error: Event) => {
      console.error(`[Browser Stream Proxy] Client error:`, error);
      if (backendWs.readyState === WebSocket.OPEN) {
        backendWs.close();
      }
    });

    backendWs.addEventListener('error', (error: Event) => {
      console.error(`[Browser Stream Proxy] Backend error:`, error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });

    return response;
  } catch (error) {
    console.error('[Browser Stream Proxy] Error setting up WebSocket proxy:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to establish WebSocket proxy',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
