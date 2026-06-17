# Hostinger VPS Connector Skill

## What It Does
Manages the Hostinger VPS — health checks, service restarts, log inspection, SSL certificate validation, disk usage monitoring.

## When to Use
- Running VPS health checks
- Restarting services (nginx, pm2, postgres)
- Inspecting application logs
- Checking SSL certificate expiry
- Monitoring disk usage

## Available Functions
See functions.yaml for full catalog.

## Requirements
- SSH access to VPS
- HOSTINGER_API_KEY for Hostinger API calls

## Self-Healing Events
- Service outages logged to library_raw_events
- Disk space warnings trigger alerts
