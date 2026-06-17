# Resend Connector Skill

## What It Does
Sends transactional emails via the Resend API — send emails, track delivery status, list sent emails, manage templates.

## When to Use
- Sending customer communications
- Sending billing receipts
- Sending support follow-ups
- Tracking email delivery status
- Managing email templates

## Available Functions
See functions.yaml for full catalog.

## Requirements
- RESEND_API_KEY environment variable
- Verified sending domain

## Self-Healing Events
- Bounce/delivery failures logged to library_raw_events
- Rate limit warnings tracked
