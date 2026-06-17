---
type: "playbook"
name: "Skill"
description: "Auto-generated description for Skill"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Forth DPP Connector Skill

> **Connector:** forth-dpp | **Priority:** P0 | **Type:** Credit Dispute Processing
> **Dependencies:** Forth DPP API, Base44 dispute_rounds

## Purpose
Generate and manage credit dispute letters via Forth DPP (Dispute Processing Platform). Handles the full dispute lifecycle from letter generation to tracking.

## When to Use
- Generating dispute letters to credit bureaus
- Tracking dispute round status
- Managing dispute evidence packages
- FCRA compliance verification
- Dispute round progression

## Cross-References
- Playbooks: disputes/playbook-disputes.md
- Entity: dispute_rounds (Base44)
