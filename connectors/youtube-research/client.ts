/**
 * youtube-research Connector Client
 *
 * YouTube Data API v3 + youtube-transcript for creator research.
 * 5 actions: searchVideos, getVideoMetadata, getTranscript, summarizeChannel, extractFrameworks
 *
 * Pattern: ActionRequest -> execute() -> ActionResponse
 * Reference: connectors/cat-facts/client.ts for the canonical pattern.
 *
 * Usage:
 *   import { execute } from "@/connectors/youtube-research/client";
 *   const result = await execute({ action: "searchVideos", args: { query: "AI agents 2026" } });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionRequest {
  action: string;
  args?: Record<string, unknown>;
}

export interface ActionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  action?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown, action: string): ActionResponse {
  return { success: true, action, data };
}

function fail(action: string, err: unknown): ActionResponse {
  const msg = err instanceof Error ? err.message : String(err);
  return { success: false, error: `${action} failed: ${msg}` };
}

// ── Configuration ──────────────────────────────────────────────────────────────

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// ── Fetch helper with timeout + error handling ────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Action: searchVideos ──────────────────────────────────────────────────────

async function searchVideos(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    if (!YOUTUBE_API_KEY) return fail("searchVideos", "YOUTUBE_API_KEY not configured");

    const query = String(args?.query || "");
    if (!query) return fail("searchVideos", "query is required");

    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      maxResults: String(args?.maxResults || 10),
      type: "video",
      key: YOUTUBE_API_KEY,
    });

    if (args?.channelId) params.set("channelId", String(args.channelId));

    const url = `${YOUTUBE_API_BASE}/search?${params.toString()}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      const body = await res.text();
      return fail("searchVideos", `HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const videos = (json.items || []).map((item: Record<string, unknown>) => ({
      videoId: (item.id as Record<string, string>)?.videoId,
      title: (item.snippet as Record<string, string>)?.title,
      channelTitle: (item.snippet as Record<string, string>)?.channelTitle,
      publishedAt: (item.snippet as Record<string, string>)?.publishedAt,
      description: (item.snippet as Record<string, string>)?.description?.slice(0, 300),
      thumbnails: (item.snippet as Record<string, unknown>)?.thumbnails,
    }));

    return ok({ videos, totalResults: json.pageInfo?.totalResults, query }, "searchVideos");
  } catch (e) {
    return fail("searchVideos", e);
  }
}

// ── Action: getVideoMetadata ──────────────────────────────────────────────────

async function getVideoMetadata(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    if (!YOUTUBE_API_KEY) return fail("getVideoMetadata", "YOUTUBE_API_KEY not configured");

    const videoId = String(args?.videoId || "");
    if (!videoId) return fail("getVideoMetadata", "videoId is required");

    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: videoId,
      key: YOUTUBE_API_KEY,
    });

    const url = `${YOUTUBE_API_BASE}/videos?${params.toString()}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      const body = await res.text();
      return fail("getVideoMetadata", `HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const item = json.items?.[0];
    if (!item) return fail("getVideoMetadata", `Video not found: ${videoId}`);

    const snippet = item.snippet as Record<string, unknown>;
    const contentDetails = item.contentDetails as Record<string, unknown>;
    const statistics = item.statistics as Record<string, unknown>;

    return ok(
      {
        videoId: item.id,
        title: snippet?.title,
        description: snippet?.description,
        duration: contentDetails?.duration,
        viewCount: statistics?.viewCount,
        likeCount: statistics?.likeCount,
        commentCount: statistics?.commentCount,
        channelId: snippet?.channelId,
        channelTitle: snippet?.channelTitle,
        tags: snippet?.tags || [],
        publishedAt: snippet?.publishedAt,
        thumbnails: snippet?.thumbnails,
      },
      "getVideoMetadata"
    );
  } catch (e) {
    return fail("getVideoMetadata", e);
  }
}

// ── Action: getTranscript ─────────────────────────────────────────────────────

async function getTranscript(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const videoId = String(args?.videoId || "");
    if (!videoId) return fail("getTranscript", "videoId is required");

    // Use youtube-transcript npm package
    let segments: Array<{ text: string; duration: number; offset: number; lang?: string }>;
    try {
      const transcriptModule = await import("youtube-transcript");
      segments = await transcriptModule.YoutubeTranscript.fetchTranscript(videoId);
    } catch (importErr: unknown) {
      const msg = importErr instanceof Error ? importErr.message : String(importErr);
      return fail("getTranscript", `youtube-transcript fetch error: ${msg}`);
    }

    const transcript = segments.map((seg) => ({
      start: seg.offset / 1000,
      duration: seg.duration,
      text: seg.text,
    }));

    const fullText = transcript.map((s) => s.text).join(" ");

    return ok(
      {
        videoId,
        segments: transcript,
        fullText,
        segmentCount: transcript.length,
      },
      "getTranscript"
    );
  } catch (e) {
    return fail("getTranscript", e);
  }
}

// ── Action: summarizeChannel ───────────────────────────────────────────────────

async function summarizeChannel(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    if (!YOUTUBE_API_KEY) return fail("summarizeChannel", "YOUTUBE_API_KEY not configured");

    const channelId = String(args?.channelId || "");
    if (!channelId) return fail("summarizeChannel", "channelId is required");

    const recentVideos = Number(args?.recentVideos || 10);

    // Get channel details
    const channelParams = new URLSearchParams({
      part: "snippet,statistics",
      id: channelId,
      key: YOUTUBE_API_KEY,
    });

    const channelUrl = `${YOUTUBE_API_BASE}/channels?${channelParams.toString()}`;
    const channelRes = await fetchWithTimeout(channelUrl);

    if (!channelRes.ok) {
      const body = await channelRes.text();
      return fail("summarizeChannel", `Channel HTTP ${channelRes.status}: ${body.slice(0, 200)}`);
    }

    const channelJson = await channelRes.json();
    const channel = channelJson.items?.[0];
    if (!channel) return fail("summarizeChannel", `Channel not found: ${channelId}`);

    const channelSnippet = channel.snippet as Record<string, unknown>;
    const channelStats = channel.statistics as Record<string, unknown>;

    // Get recent videos via search
    const searchParams = new URLSearchParams({
      part: "snippet",
      channelId,
      maxResults: String(Math.min(recentVideos, 50)),
      order: "date",
      type: "video",
      key: YOUTUBE_API_KEY,
    });

    const searchUrl = `${YOUTUBE_API_BASE}/search?${searchParams.toString()}`;
    const searchRes = await fetchWithTimeout(searchUrl);

    if (!searchRes.ok) {
      const body = await searchRes.text();
      return fail("summarizeChannel", `Search HTTP ${searchRes.status}: ${body.slice(0, 200)}`);
    }

    const searchJson = await searchRes.json();
    const videos = (searchJson.items || []).map((item: Record<string, unknown>) => ({
      videoId: (item.id as Record<string, string>)?.videoId,
      title: (item.snippet as Record<string, string>)?.title,
      publishedAt: (item.snippet as Record<string, string>)?.publishedAt,
      description: (item.snippet as Record<string, string>)?.description?.slice(0, 200),
    }));

    return ok(
      {
        channelId,
        channelName: channelSnippet?.title,
        description: channelSnippet?.description,
        subscriberCount: channelStats?.subscriberCount,
        videoCount: channelStats?.videoCount,
        viewCount: channelStats?.viewCount,
        recentVideos: videos,
        thumbnails: channelSnippet?.thumbnails,
      },
      "summarizeChannel"
    );
  } catch (e) {
    return fail("summarizeChannel", e);
  }
}

// ── Action: extractFrameworks ─────────────────────────────────────────────────

async function extractFrameworks(args?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const videoId = String(args?.videoId || "");
    if (!videoId) return fail("extractFrameworks", "videoId is required");

    // Step 1: Get transcript
    let fullText: string;
    let segmentCount = 0;
    try {
      const transcriptModule = await import("youtube-transcript");
      const segments = await transcriptModule.YoutubeTranscript.fetchTranscript(videoId);
      fullText = segments.map((s: { text: string }) => s.text).join(" ");
      segmentCount = segments.length;
    } catch (importErr: unknown) {
      const msg = importErr instanceof Error ? importErr.message : String(importErr);
      return fail("extractFrameworks", `Transcript fetch error: ${msg}`);
    }

    const truncatedText = fullText.slice(0, 32_000); // stay within LLM context limits

    // Step 2: Analyze transcript with structured extraction prompt
    // This uses the application's configured LLM router.
    const prompt = `Analyze the following YouTube video transcript and extract:

1. **Key Frameworks**: Named AI/software frameworks, architectures, or methodologies discussed (e.g., "LangChain", "AutoGPT", "assistant-ui", "Vercel AI SDK").
2. **Actionable Techniques**: Specific techniques, patterns, or approaches that can be implemented immediately.
3. **Implementation Notes**: A concise summary of the practical implementation guidance provided.

Respond in JSON format:
{
  "keyFrameworks": ["Framework1", "Framework2"],
  "actionableTechniques": ["Technique1", "Technique2"],
  "implementationNotes": "Concise summary..."
}

Transcript:
${truncatedText}`;

    // Dynamically import the LLM routing layer if available
    let llmResult: { keyFrameworks: string[]; actionableTechniques: string[]; implementationNotes: string };
    try {
      // @ts-ignore - optional AI module, may not exist in all environments
      const aiModule = await import("@/lib/ai/generate-text-hybrid");
      const { generateText } = aiModule as { generateText: (opts: { prompt: string; maxTokens: number; temperature: number }) => Promise<{ text: string }> };
      const result = await generateText({
        prompt,
        maxTokens: 2000,
        temperature: 0.3,
      });

      // Parse JSON from LLM response
      const cleaned = result.text.replace(/```json\n?|\n?```/g, "").trim();
      llmResult = JSON.parse(cleaned);
    } catch {
      // Fallback: keyword-based extraction from transcript
      const frameworkPatterns = [
        "LangChain", "LlamaIndex", "AutoGPT", "CrewAI", "assistant-ui",
        "Vercel AI SDK", "LangGraph", "DSPy", "Semantic Kernel", "Haystack",
        "Claude Agent SDK", "OpenAI Swarm", "OpenAI Agents SDK", "Mastra",
        "Graphify", "NeMo Guardrails", "Flowise", "n8n", "Make",
        "Pydantic AI", "Instructor", "Mirascope",
      ];

      const lowerText = fullText.toLowerCase();
      const foundFrameworks = frameworkPatterns.filter((f) =>
        lowerText.includes(f.toLowerCase())
      );

      llmResult = {
        keyFrameworks: foundFrameworks,
        actionableTechniques: [],
        implementationNotes:
          "LLM analysis unavailable — framework extraction was keyword-based. Install @/lib/ai/generate-text-hybrid for AI-powered extraction.",
      };
    }

    return ok(
      {
        videoId,
        ...llmResult,
        transcriptLength: fullText.length,
        segmentsAnalyzed: segmentCount,
      },
      "extractFrameworks"
    );
  } catch (e) {
    return fail("extractFrameworks", e);
  }
}

// ── Main Action Router ────────────────────────────────────────────────────────

export async function execute(req: ActionRequest): Promise<ActionResponse> {
  const { action, args } = req;

  switch (action) {
    case "searchVideos":
      return searchVideos(args);
    case "getVideoMetadata":
      return getVideoMetadata(args);
    case "getTranscript":
      return getTranscript(args);
    case "summarizeChannel":
      return summarizeChannel(args);
    case "extractFrameworks":
      return extractFrameworks(args);

    default:
      return {
        success: false,
        error: `Unknown action: '${action}'. Available: ${availableActions.join(", ")}`,
      };
  }
}

// ── Available Actions Registry ────────────────────────────────────────────────

export const availableActions: string[] = [
  "searchVideos",
  "getVideoMetadata",
  "getTranscript",
  "summarizeChannel",
  "extractFrameworks",
];

export default { execute, availableActions };
