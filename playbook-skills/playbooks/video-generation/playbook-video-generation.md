---
name: Video Generation Playbook
description: AI video generation, NotebookLM studio workflows, YouTube research, and multimedia content pipelines.
domain: video-generation
connectors: [notebooklm-mcp, youtube-research]
version: "1.0"
updated: 2026-06-22
---

# Video Generation Playbook

## Purpose
Manage AI video generation workflows, NotebookLM studio integration, YouTube research, and multimedia content pipelines.

## Safeguards
- Video generation requires explicit user approval
- YouTube content must respect copyright
- Audio/video artifacts are studio-only, not production APIs
- NotebookLM rate limits must be respected

## Routines

### Routine: Create Audio Overview
1. Create or select NotebookLM notebook
2. Add source materials (URLs, documents, text)
3. Configure audio format (deep_dive, explainer)
4. Generate audio via studio_create(artifact_type=audio)
5. Poll studio_status until complete
6. Download and present audio artifact

### Routine: Create Video Overview
1. Add visual-rich sources to notebook (PDFs, images, charts)
2. Configure video format and style
3. Generate video via studio_create(artifact_type=video)
4. Poll for completion
5. Download and present video

### Routine: YouTube Research
1. Search YouTube for topic via youtube-research connector
2. Extract transcripts from relevant videos
3. Summarize key findings
4. Add to NotebookLM notebook as source
5. Generate research report

### Routine: Slide Deck Generation
1. Compile sources into notebook
2. Configure slide format (detailed_deck)
3. Generate slides via studio_create(artifact_type=slide_deck)
4. Poll for completion
5. Download PDF or PPTX

### Routine: Multimedia Content Pipeline
1. Accept topic and research depth
2. Search web + YouTube for sources
3. Add all sources to notebook
4. Generate audio, video, and slide deck in parallel
5. Present all artifacts

## Workflows
- **content-pipeline**: Full research → audio → video → slides pipeline
- **youtube-deep-dive**: YouTube transcript extraction and synthesis
- **studio-batch**: Batch artifact generation across notebooks

## Anti-Patterns
- Do NOT generate content without source attribution
- Do NOT exceed NotebookLM rate limits
- Do NOT use studio for production-critical content
