---
type: "playbook"
name: "Playbook"
description: "Auto-generated description for Playbook"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Weather Playbook

## Overview
Weather data connector using free Open-Meteo API. No API key required.

## When to Use
When the agent needs to provide weather information for any location.

## Available Functions
- `getWeather(latitude?, longitude?, city?)` — Returns current conditions

## Safeguards
- Free API, no billing concerns
- Returns Celsius by default

## Anti-patterns
- Don't use for severe weather alerts (not supported by Open-Meteo)
- Don't hardcode city names without fallback to coordinates

## Self-Healing
- Geocoding failure → suggest coordinates
- API timeout → single retry
