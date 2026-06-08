/**
 * Vercel Events GET Endpoint — pollable by active sessions.
 *
 * Returns recent Vercel deployment events captured by the webhook handler.
 * Filterable by projectId, eventType, and status.
 *
 * GET /api/vercel/events?projectId=prj_xxx&eventType=deployment.error&limit=20
 */
import { readdir, readFile } from "fs/promises";
import path from "path";

const VERCEL_EVENTS_DIR = process.env.VERCEL_EVENTS_DIR || "/home/hermes/data/vercel-events";

interface ParsedEvent {
  fileName: string;
  timestamp: string;
  eventType: string;
  deploymentId: string;
  projectId: string;
  target: string | null;
  url: string | null;
  fullPayload: unknown;
}

async function loadEvents(): Promise<ParsedEvent[]> {
  try {
    const files = await readdir(VERCEL_EVENTS_DIR);
    const jsonFiles = files
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse(); // newest first

    const events: ParsedEvent[] = [];
    for (const file of jsonFiles.slice(0, 100)) {
      // limit read to 100 files
      try {
        const content = await readFile(
          path.join(VERCEL_EVENTS_DIR, file),
          "utf-8"
        );
        const payload = JSON.parse(content) as {
          type: string;
          createdAt: number;
          payload: {
            deployment?: { id: string; url?: string };
            project?: { id: string };
            target?: string;
          };
        };

        events.push({
          fileName: file,
          timestamp: new Date(payload.createdAt).toISOString(),
          eventType: payload.type,
          deploymentId: payload.payload?.deployment?.id || "unknown",
          projectId: payload.payload?.project?.id || "unknown",
          target: payload.payload?.target || null,
          url: payload.payload?.deployment?.url || null,
          fullPayload: payload,
        });
      } catch {
        // Skip unparseable files
        continue;
      }
    }
    return events;
  } catch {
    // Directory might not exist yet
    return [];
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const eventType = searchParams.get("eventType");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  let events = await loadEvents();

  // Apply filters
  if (projectId) {
    events = events.filter((e) => e.projectId === projectId);
  }
  if (eventType) {
    events = events.filter((e) => e.eventType === eventType);
  }

  // Apply limit
  events = events.slice(0, Math.min(limit, 100));

  return Response.json(
    {
      events: events.map((e) => ({
        fileName: e.fileName,
        timestamp: e.timestamp,
        eventType: e.eventType,
        deploymentId: e.deploymentId,
        projectId: e.projectId,
        target: e.target,
        url: e.url,
      })),
      count: events.length,
      filters: { projectId, eventType, limit },
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, max-age=10",
      },
    }
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
