---
type: index
name: "Base44 Entity Migration Playbooks"
description: "OKF concept docs for every Base44 entity and function — single source of truth for migration"
version: "1.0.0"
updated: "2026-06-17"
domain: customer-enrollment
priority: P0
access: internal
---

# Base44 Entity Migration Playbooks

Each Base44 entity and function has an OKF concept doc for migration planning.

## Base44 Entities (12)

| Entity | OKF Concept | Description |
|--------|-----------|-------------|
| CustomerProfile | customer:profile | Core customer record |
| PaymentLog | billing:payment_log | Payment transaction history |
| SupportTicket | support:ticket | Support ticket tracking |
| CallLog | support:call_log | Agent call records |
| AdminNotification | system:notification | System alerts |
| CreditReport | disputes:credit_report | Credit report storage |
| Agreement | enrollment:agreement | Customer agreements |
| NmiTransaction | billing:nmi_txn | NMI gateway transactions |
| Subscription | billing:subscription | Recurring billing |
| DisputeRound | disputes:round | Dispute processing rounds |
| NegativeItem | disputes:negative_item | Credit report negative items |
| RecoveryItem | billing:recovery | Payment recovery queue |

## Base44 Functions (16)

| Function | OKF Concept | Description |
|----------|-----------|-------------|
| reportingHubQuery | reporting:hub | Aggregate operational reports |
| nmiMcpBridge | billing:nmi_bridge | NMI payment operations |
| slackMcpBridge | comms:slack_bridge | Slack messaging |
| jarvisTaskManager | ops:task_manager | Task creation/completion |
| entity CRUD | data:crud | Base entity operations |
| customer360 | customer:360 | Full customer dossier |
| crossSystemLookup | data:cross_system | Multi-system lookup |
| emitFinding | ops:finding | Audit finding emission |
| emitAction | ops:action | Action queue emission |
| queryWarehouse | data:warehouse | Historical data queries |
| validatedQuery | data:validated | Safe SQL queries |
| webSearch | research:search | Web search |
| jarvisBrainRelay | ai:brain | Cognitive operations |
| sessionDeposit | data:session | Session vault |
| rcAddItem | data:context | Rolling context |
| rcRead | data:context_read | Context retrieval |

## Migration Notes

- All entities map to Twenty CRM custom objects
- All functions map to Neptune connector skills or Twenty Code Nodes
- Migration playbook serves as SINGLE SOURCE OF TRUTH
- Auto-generated from Base44 schema via scripts/migrate-base44-batch.ts
