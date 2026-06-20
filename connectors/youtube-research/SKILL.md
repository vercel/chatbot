---
name: youtube-research-connector
description: YouTube creator research — search videos, extract transcripts, identify AI/agentic frameworks
version: 1.0.0
domain: research
mcp: false
custom_client: true
type: "skill"
access: internal
---
# YouTube Research Integration Pack

## File Capabilities & Paths
- **Custom API Client:** `connectors/youtube-research/client.ts`
- **Manifest:** `connectors/youtube-research/manifest.ts`
- **GRAPH-TAG:** `connectors/youtube-research/GRAPH-TAG.json`

## Available Actions
| Tool | Description |
|------|-------------|
| searchVideos | Search YouTube videos by query with optional channel filter |
| getVideoMetadata | Get detailed metadata for a specific video (title, duration, views, likes, tags) |
| getTranscript | Extract full transcript/captions from a YouTube video |
| summarizeChannel | Get channel info + recent video summaries |
| extractFrameworks | Extract key AI frameworks, actionable techniques, and implementation notes from a video transcript using LLM analysis |

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| YOUTUBE_API_KEY | Yes | YouTube Data API v3 key from Google Cloud Console |
| YOUTUBE_RESEARCH_LLM_MODEL | No | LLM model override for extractFrameworks (default: auto-router) |
