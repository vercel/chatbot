# Vercel Connector Skill

## What It Does
Manages Vercel deployments — deploy projects, list deployments, manage domains, check build status, audit environment variables.

## When to Use
- Deploying Next.js applications
- Checking deployment status
- Adding custom domains
- Auditing environment variables
- Rolling back deployments

## Available Functions
See functions.yaml for full catalog.

## Requirements
- VERCEL_TOKEN environment variable
- Project ID (prj_xxx)

## Self-Healing Events
- Deployment failures logged to library_raw_events
- Build timeout patterns tracked
