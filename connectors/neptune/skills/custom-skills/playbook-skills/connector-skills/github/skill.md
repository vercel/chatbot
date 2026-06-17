# GitHub Connector Skill

## What It Does
Provides programmatic access to GitHub repositories — read files, list directories, create PRs, search code, and manage issues.

## When to Use
- Creating pull requests from generated code
- Reading repository files for context
- Searching for existing code patterns
- Listing directory contents
- Getting repository metadata

## Available Functions
See functions.yaml for full catalog.

## Requirements
- GITHUB_TOKEN environment variable
- Repository access (public repos work without token for reads)

## Self-Healing Events
- PR creation failures logged to library_raw_events
- Rate limit hits tracked and alerted
