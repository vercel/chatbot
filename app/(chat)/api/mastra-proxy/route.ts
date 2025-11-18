// Server-side proxy to Mastra backend
// Solves CORS issues and allows dynamic backend URL configuration

export const maxDuration = 300; // 5 minutes for web automation tasks

export async function POST(request: Request) {
  try {
    // Get Mastra server URL from environment (runtime, not build-time)
    // Use MASTRA_SERVER_URL (not NEXT_PUBLIC_*) because this is server-side only
    // NEXT_PUBLIC_* vars are baked in at build time, we need runtime config
    const mastraServerUrl = process.env.MASTRA_SERVER_URL || process.env.NEXT_PUBLIC_MASTRA_SERVER_URL;

    if (!mastraServerUrl) {
      console.error('NEXT_PUBLIC_MASTRA_SERVER_URL is not set');
      return new Response(
        JSON.stringify({ error: 'Mastra backend URL not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying to Mastra at:', mastraServerUrl);

    // Forward the request body to Mastra backend
    const body = await request.json();

    // Check if the request is to stop the chat
    if (body.action === 'stopChat') {
      // Call the Mastra API to stop the chat with threadId and resourceId
      console.log('Stopping chat for thread:', body.threadId, 'and resource:', body.resourceId);
      const stopResponse = await fetch(`${mastraServerUrl}/stop-chat`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              threadId: body.threadId,
              resourceId: body.resourceId,
          }),
      });

      console.log('Stop response:', stopResponse);

      return new Response(stopResponse.body, {
          status: stopResponse.status,
          headers: stopResponse.headers,
      });
  }

    const response = await fetch(`${mastraServerUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Return the response from Mastra as-is
    // This preserves streaming if Mastra is streaming
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Error proxying to Mastra:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to Mastra backend' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
