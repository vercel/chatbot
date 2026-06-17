---
type: "playbook"
name: "Skill"
description: "Auto-generated description for Skill"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Weather Connector Skill

## Overview
Fetches current weather and forecast data from Open-Meteo API (free, no API key). Supports city name geocoding and direct latitude/longitude queries.

## When to Use
- User asks about current weather at a location
- Need temperature, conditions, or forecast data
- Location-based weather queries

## Available Functions
- `getWeather` — Get current weather by city name or coordinates

## Safeguards
- Uses free Open-Meteo API, no rate limits
- Geocoding via Open-Meteo geocoding API
- Returns standard connector envelope: `{ connectorType, data, schemaVersion }`

## Anti-patterns
- Don't use for historical weather (API is current/forecast only)
- Don't cache beyond 1 hour (weather data is real-time)

## Self-Healing
- If geocoding fails, suggest user provide coordinates directly
- If API times out, retry once after 2 seconds
