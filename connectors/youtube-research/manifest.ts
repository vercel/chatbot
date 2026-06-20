/**
 * youtube-research Connector Manifest
 *
 * YouTube Data API v3 + youtube-transcript for creator research,
 * framework extraction, and AI/agentic engineering intelligence.
 */
import { Youtube } from "lucide-react";
import { checkConnectorEnv } from "../../lib/connectors/registry";
import type { ConnectorManifest } from "../../lib/connectors/types";

const youtubeResearchManifest: ConnectorManifest = {
  id: "youtube-research",
  name: "YouTube Research",
  description: "YouTube creator research — search videos, extract transcripts, identify AI/agentic frameworks",
  icon: Youtube,
  brandColor: "#FF0000",
  envKeys: ["YOUTUBE_API_KEY"],
  capabilities: [
    {
      id: "searchVideos",
      label: "Search Videos",
      description: "Search YouTube videos by query, optionally filtering by channel",
      icon: "Search",
    },
    {
      id: "getVideoMetadata",
      label: "Video Metadata",
      description: "Get detailed metadata: title, duration, views, likes, tags",
      icon: "Info",
    },
    {
      id: "getTranscript",
      label: "Get Transcript",
      description: "Extract full transcript/captions from any YouTube video",
      icon: "FileText",
    },
    {
      id: "summarizeChannel",
      label: "Summarize Channel",
      description: "Get channel statistics + recent video summaries",
      icon: "User",
    },
    {
      id: "extractFrameworks",
      label: "Extract Frameworks",
      description: "Extract AI frameworks, techniques, and implementation notes via LLM analysis of transcripts",
      icon: "Brain",
    },
  ],
  toolModule: () => import("./client"),
  resultRenderers: {},
  playbookPath: "playbooks/agentic-engineering/youtube-research",
  getStatus: () => {
    const { ok, missing } = checkConnectorEnv(["YOUTUBE_API_KEY"]);
    return {
      connected: ok,
      message: ok
        ? "Connected (YouTube Data API v3)"
        : `Not Configured — missing: ${missing.join(", ")}`,
    };
  },
  docs: { official: "https://developers.google.com/youtube/v3/docs" },
};

export default youtubeResearchManifest;
