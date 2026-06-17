---
title: "Playbook: Video Generation"
domain: video-generation
priority: P2
version: "1.0.0"
date: 2026-06-15
status: STUB
model_routing:
  default: "anthropic/claude-sonnet-4-6"
  vision: "google/gemini-2-flash"
  reasoning_heavy: "anthropic/claude-sonnet-4-6"
type: "playbook"
---

# Playbook: Video Generation

> **Domain:** video-generation | **Priority:** P2 | **Version:** 1.0.0 (STUB)
> **Canonical path:** `connectors/neptune/skills/custom-skills/playbook-skills/playbooks/playbook-video-generation.md`

## Domain Scope

AI-powered video content generation, editing, and production for marketing, training, and customer communications.

## Intent Routing

| Intent | Trigger Keywords | Action |
|--------|-----------------|--------|
| Generate video | create video, make video, generate video, ai video | Video generation pipeline |
| Edit video | edit, trim, cut, add caption, overlay | Video editing tools |
| Video from script | script to video, text to video, convert to video | Script → video pipeline |
| Video for social | social video, reels, shorts, tiktok, instagram | Platform-optimized formats |

## Connectors

- `connectors/vercel/` — Vercel deployment for video hosting
- `connectors/slack/` — #jarvis-admin video completion notifications

## Safeguards

1. **Content review** — all AI-generated video must be reviewed before publishing
2. **Copyright compliance** — verify any source material rights
3. **Brand consistency** — adhere to NewLeaf brand guidelines
4. **NEVER generate unauthorized content** — explicit approval required

## Anti-Patterns

- ❌ Publishing without human review
- ❌ Using copyrighted source material without license
- ❌ Generating customer-facing video without brand approval

---

*STUB — expand with detailed SOPs for each intent route.*
