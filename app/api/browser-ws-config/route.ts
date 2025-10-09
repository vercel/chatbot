// Server-side API to provide browser WebSocket proxy configuration
// This allows runtime configuration without rebuilding the image

export const runtime = 'nodejs';

export async function GET() {
  // Read from server-side env var (not NEXT_PUBLIC_*)
  const proxyUrl = process.env.BROWSER_WS_PROXY_URL;

  return Response.json({
    proxyUrl: proxyUrl || null,
  });
}
