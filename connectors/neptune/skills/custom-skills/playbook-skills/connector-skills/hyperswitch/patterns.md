---
type: "playbook"
name: "Patterns"
description: "Auto-generated description for Patterns"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Hyperswitch Patterns — Always-Check Rules

## Pre-Flight
- [ ] Amount matches Base44 agreement
- [ ] High-risk BIN routing decision made
- [ ] Payment link has appropriate expiry
- [ ] Currency set (default USD)
- [ ] Customer notified of payment link

## Pattern: High-Risk BIN Routing
1. Detect high-risk BIN from NMI validation
2. Fall back to Hyperswitch
3. Create payment link
4. Send to customer
5. Track completion
