import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  // Require sessionId to prevent session collision
  if (!sessionId) {
    return new Response(JSON.stringify({
      error: 'Missing required sessionId query parameter'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Return WebSocket connection info for the browser streaming service
    const streamingPort = process.env.BROWSER_STREAMING_PORT || '8933';
    const streamingHost = process.env.BROWSER_STREAMING_HOST || 'localhost';
    
    return new Response(JSON.stringify({
      type: 'websocket-info',
      url: `ws://${streamingHost}:${streamingPort}`,
      sessionId,
      message: 'Connect to this WebSocket URL for browser streaming'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Browser streaming error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to set up browser streaming',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
