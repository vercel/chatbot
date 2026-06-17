# NewLeaf → Twenty CRM Data Model — Field Mapping & Object Design

**Phase:** 27 | **Date:** 2026-06-17  
**Source:** Base44 CustomerProfile (256 fields) + related entities  
**Target:** Twenty CRM v2.14.0 (self-hosted at crm.newleaf.financial)

---

## 1. OBJECT ARCHITECTURE (7 Objects)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Twenty CRM Workspace                        │
│                                                                  │
│  ┌─────────────┐  1:N  ┌──────────────┐  1:N  ┌──────────────┐ │
│  │   Person ◄──┼───────┤ Subscription  ├───────┤ PaymentRecord │ │
│  │  (extended) │       │   (custom)    │       │   (custom)    │ │
│  └──────┬──────┘       └──────────────┘       └──────────────┘ │
│         │                                                       │
│         │ 1:N  ┌──────────────┐  1:N  ┌──────────────────────┐ │
│         ├──────┤ CreditDispute ├───────┤ DisputeItem (inline) │ │
│         │      │   (custom)    │       └──────────────────────┘ │
│         │      └──────────────┘                                  │
│         │                                                       │
│         │ 1:1  ┌──────────────┐                                 │
│         ├──────┤  Enrollment   │                                │
│         │      │   (custom)    │                                │
│         │      └──────────────┘                                 │
│         │                                                       │
│         │ 1:N  ┌──────────────┐                                 │
│         ├──────┤   Activity    │                                │
│         │      │   (custom)    │                                │
│         │      └──────────────┘                                 │
│         │                                                       │
│         │ 1:N  ┌──────────────┐                                 │
│         └──────┤ SupportTicket │                                │
│                │   (custom)    │                                │
│                └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Relationship Summary

| Parent | Child | Type | Foreign Key |
|---|---|---|---|
| Person | Subscription | 1:N | `personId` on Subscription |
| Person | PaymentRecord | 1:N | `personId` on PaymentRecord |
| Person | CreditDispute | 1:N | `personId` on CreditDispute |
| Person | Enrollment | 1:1 | `personId` on Enrollment |
| Person | Activity | 1:N | `personId` on Activity |
| Person | SupportTicket | 1:N | `personId` on SupportTicket |
| Subscription | PaymentRecord | 1:N | `subscriptionId` on PaymentRecord |
| CreditDispute | DisputeItem | 1:N | Embedded JSON array |

---

## 2. PERSON (Extends built-in Twenty Person via defineField)

### 2.1 Built-in Twenty Person fields (already available)

| Twenty Field | Type | Description |
|---|---|---|
| `name.firstName` | FULL_NAME | First name |
| `name.lastName` | FULL_NAME | Last name |
| `emails.primaryEmail` | EMAILS | Primary email |
| `phones.primaryPhoneNumber` | PHONES | Primary phone |
| `city` | ADDRESS | City |
| `avatarUrl` | URL | Avatar link |
| `jobTitle` | TEXT | Job title |
| `linkedinLink.url` | LINKS | LinkedIn profile |

### 2.2 Custom Fields Added via defineField()

| Twenty Field Name | Type | Base44 Source | Transform |
|---|---|---|---|
| `base44Id` | TEXT | `CustomerProfile.id` | Direct — external_id for sync |
| `status` | SELECT | `CustomerProfile.status` | Enum: New/Active/Inactive/Cancelled |
| `enrollmentStatus` | SELECT | `CustomerProfile.enrollmentStatus` | Enum: not_enrolled/pending/active/cancelled |
| `agentEmail` | EMAILS | `CustomerProfile.agentEmail` | Direct |
| `phone` | PHONES | `CustomerProfile.phone` | Direct (secondary phone) |
| `dob` | DATE | `CustomerProfile.dob` | Parse ISO date |
| `source` | SELECT | `CustomerProfile.source` | Enum: Organic/Referral/Paid/Other |
| `engagementTier` | SELECT | `CustomerProfile.engagementTier` | Enum: healthy/at_risk/needs_attention |
| `creditScore` | NUMBER | `CustomerProfile.creditScore` | Direct |
| `negativeItemCount` | NUMBER | `CustomerProfile.negativeItemCount` | Direct |
| `unsecuredDebtAmount` | CURRENCY | `CustomerProfile.unsecuredDebtAmount` | Direct |
| `annualIncome` | CURRENCY | `CustomerProfile.annualIncome` | Direct |
| `debtToIncomeRatio` | NUMBER | `CustomerProfile.debtToIncomeRatio` | Direct |
| `conversationSentiment` | SELECT | `CustomerProfile.conversationSentiment` | Enum: positive/neutral/negative |
| `timezone` | TEXT | `CustomerProfile.timezone` | Direct |
| `company` | TEXT | `CustomerProfile.company` | Direct |
| `lastContactAt` | DATE_TIME | `CustomerProfile.lastEmailSentAt` OR `lastSmsSentAt` | Max of both |
| `isTestProfile` | BOOLEAN | `CustomerProfile.isTestProfile` | Direct |
| `disputeStatus` | SELECT | `CustomerProfile.disputeStatus` | Enum: not_started/active/paused/completed |
| `notes` | RICH_TEXT | `CustomerProfile.notes` | Direct |
| `createdAt` (base) | DATE_TIME | Auto by Twenty | — |
| `updatedAt` (base) | DATE_TIME | Auto by Twenty | — |

### 2.3 Fields DELIBERATELY NOT MIGRATED

| Base44 Field | Reason |
|---|---|
| `cardNumber` | NMI Vault sacred (memory 6a1f118b) |
| `cardCvv` | NMI Vault sacred |
| `cardExpiry` | NMI Vault sacred |
| `routingNumber` | PII — banking data |
| `bankAccountNumber` | PII — banking data |
| `ssn` | PII — sensitive |
| `dob` | Migrated but marked as sensitive |
| `otpCode` | Ephemeral auth data |
| `portalSessionToken` | Ephemeral session data |
| `billingActionToken` | Ephemeral auth data |
| `signatureData` | Heavy binary data |
| `bridgeData` | Internal processing data |
| `legacyData` | Deprecated |
| `aiMemory` | Gemini-managed, not CRM data |
| `aiMemoryUpdatedAt` | Gemini-managed |

---

## 3. SUBSCRIPTION (Custom Object)

### 3.1 Object Definition

| Property | Value |
|---|---|
| `nameSingular` | `subscription` |
| `namePlural` | `subscriptions` |
| `labelSingular` | `Subscription` |
| `labelPlural` | `Subscriptions` |
| `icon` | `IconCreditCard` |

### 3.2 Fields

| Field Name | Type | Base44 Source | Transform | Required |
|---|---|---|---|---|
| `name` (base) | TEXT | Auto-generated: "Sub {nmiSubscriptionId}" | Format string | ✅ |
| `base44Id` | TEXT | `CustomerProfile.id` | Direct (parent person FK) | ✅ |
| `nmiSubscriptionId` | TEXT | `CustomerProfile.nmiSubscriptionId` | Direct | ✅ |
| `nmiVaultId` | TEXT | `CustomerProfile.nmiVaultId` | Direct | — |
| `nmiBillingId` | TEXT | `CustomerProfile.nmiBillingId` | Direct | — |
| `paymentAmount` | CURRENCY | `CustomerProfile.paymentAmount` | Direct | ✅ |
| `paymentFrequency` | SELECT | `CustomerProfile.paymentFrequency` | Enum: monthly/biweekly/weekly | — |
| `billingStatus` | SELECT | `CustomerProfile.billingStatus` | Enum: active/past_due/cancelled/no_payment_method/trial | ✅ |
| `subscriptionHealth` | SELECT | `CustomerProfile.subscriptionHealth` | Enum: healthy/at_risk/failed/none | — |
| `nextPaymentDate` | DATE | `CustomerProfile.nextPaymentDate` | Parse ISO date | — |
| `lastRetryDate` | DATE | `CustomerProfile.lastRetryDate` | Parse ISO date | — |
| `nextRetryDate` | DATE | `CustomerProfile.nextRetryDate` | Parse ISO date | — |
| `consecutiveSuccessCount` | NUMBER | `CustomerProfile.consecutiveSuccessCount` | Direct | — |
| `consecutiveDeclineCount` | NUMBER | `CustomerProfile.consecutiveDeclineCount` | Direct | — |
| `lastDeclineCode` | TEXT | `CustomerProfile.lastDeclineCode` | Direct | — |
| `lastDeclineReason` | TEXT | `CustomerProfile.lastDeclineReason` | Direct | — |
| `paymentMethod` | TEXT | `CustomerProfile.paymentMethod` | Direct (last4 only, NO full PAN) | — |
| `paymentSourceType` | SELECT | `CustomerProfile.paymentSourceType` | Enum: card/ach/unknown | — |
| `vaultHealth` | SELECT | `CustomerProfile.vaultHealth` | Enum: healthy/stale/missing/none | — |
| `payFrequency` | TEXT | `CustomerProfile.payFrequency` | Direct (employment pay frequency) | — |
| `recoveryStatus` | SELECT | `CustomerProfile.recoveryStatus` | Enum: not_needed/pending/in_progress/recovered/abandoned | — |
| `nmiDayZeroTransactionId` | TEXT | `CustomerProfile.nmiDayZeroTransactionId` | Direct | — |
| `nmiDayZeroDate` | DATE | `CustomerProfile.nmiDayZeroDate` | Parse ISO date | — |
| `billingStatusUpdatedAt` | DATE_TIME | `CustomerProfile.billingStatusUpdatedAt` | Parse ISO date | — |

### 3.3 Relations

| Direction | Target | Type | FK Field |
|---|---|---|---|
| MANY_TO_ONE | Person | Person has many Subscriptions | `personId` |
| ONE_TO_MANY | PaymentRecord | Subscription has many PaymentRecords | `subscriptionId` on PaymentRecord |

---

## 4. PAYMENT RECORD (Custom Object)

### 4.1 Object Definition

| Property | Value |
|---|---|
| `nameSingular` | `paymentRecord` |
| `namePlural` | `paymentRecords` |
| `labelSingular` | `Payment Record` |
| `labelPlural` | `Payment Records` |
| `icon` | `IconCash` |

### 4.2 Fields

| Field Name | Type | Source Entity | Base44 Field | Transform |
|---|---|---|---|---|
| `name` (base) | TEXT | PaymentLog | Auto: "Payment {nmiTransactionId}" | Format |
| `base44Id` | TEXT | PaymentLog | `id` | Direct |
| `nmiTransactionId` | TEXT | PaymentLog | `nmiTransactionId` | Direct |
| `amount` | CURRENCY | PaymentLog | `amount` | Direct |
| `success` | BOOLEAN | PaymentLog | `success` | Direct |
| `actionType` | SELECT | PaymentLog | `actionType` | Enum: sale/auth/credit/validate/refund |
| `responseText` | TEXT | PaymentLog | `response_text` | Direct |
| `responseCode` | TEXT | PaymentLog | `response_code` | Direct |
| `transactionDate` | DATE_TIME | PaymentLog | `created_date` | Parse ISO |
| `subscriptionId` (FK) | RELATION | PaymentLog | `nmiSubscriptionId` | Link to Subscription |
| `last4` | TEXT | PaymentLog | `last4` (derived) | Last 4 only — sacred |
| `retryCount` | NUMBER | PaymentLog | `retryCount` | Direct |
| `isRecovery` | BOOLEAN | PaymentLog | `isRecovery` | Direct |

### 4.3 Relations

| Direction | Target | Type |
|---|---|---|
| MANY_TO_ONE | Person | Person has many PaymentRecords |
| MANY_TO_ONE | Subscription | Subscription has many PaymentRecords |

### 4.4 Source: PaymentLog Entity

Pull from Base44 `PaymentLog` records filtered by `customerId`. Each PaymentLog becomes one PaymentRecord. Use `nmiTransactionId` as the external_id for idempotent sync.

---

## 5. CREDIT DISPUTE (Custom Object)

### 5.1 Object Definition

| Property | Value |
|---|---|
| `nameSingular` | `creditDispute` |
| `namePlural` | `creditDisputes` |
| `labelSingular` | `Credit Dispute` |
| `labelPlural` | `Credit Disputes` |
| `icon` | `IconFileCheck` |

### 5.2 Fields

| Field Name | Type | Base44 Source | Transform |
|---|---|---|---|
| `name` (base) | TEXT | Auto: "Dispute Round {roundNumber}" | Format |
| `base44CustomerId` | TEXT | `CustomerProfile.id` | Direct |
| `roundNumber` | NUMBER | `CustomerProfile.currentDisputeRound` | Direct |
| `status` | SELECT | `CustomerProfile.disputeStatus` | Enum: not_started/active/paused/completed |
| `bureau` | MULTI_SELECT | Derived from DisputeLetter | Enum: Experian/Equifax/TransUnion |
| `responseDate` | DATE | `CustomerProfile.disputeResponseDeadline` | Parse ISO |
| `negativeItemCount` | NUMBER | `CustomerProfile.negativeItemCount` | Direct |
| `urgency` | SELECT | `CustomerProfile.disputeUrgency` | Enum: normal/elevated/critical |
| `urgencyReason` | TEXT | `CustomerProfile.disputeUrgencyReason` | Direct |
| `lastActionAt` | DATE_TIME | `CustomerProfile.lastDisputeActionAt` | Parse ISO |
| `creditReportUrl` | LINKS | `CustomerProfile.creditReportUrl` | Direct |
| `items` | RAW_JSON | `NegativeItem[]` | Serialized array of dispute items |
| `recoveryAgent` | TEXT | `CustomerProfile.recoveryAgent` | Direct |

### 5.3 Dispute Items (Inline — RAW_JSON)

Each dispute record may contain an `items` array with:
```json
[
  {
    "accountName": "Capital One",
    "accountNumber": "XXXX-1234",
    "bureau": "Experian",
    "disputeReason": "Account not mine",
    "status": "pending",
    "dateSubmitted": "2026-06-01"
  }
]
```

Alternative: Create a separate `DisputeItem` custom object with a MANY_TO_ONE relation to CreditDispute.

### 5.4 Relations

| Direction | Target | Type |
|---|---|---|
| MANY_TO_ONE | Person | Person has many CreditDisputes |

---

## 6. ENROLLMENT (Custom Object)

### 6.1 Object Definition

| Property | Value |
|---|---|
| `nameSingular` | `enrollment` |
| `namePlural` | `enrollments` |
| `labelSingular` | `Enrollment` |
| `labelPlural` | `Enrollments` |
| `icon` | `IconUserCheck` |

### 6.2 Fields

| Field Name | Type | Base44 Source | Transform |
|---|---|---|---|
| `name` (base) | TEXT | Auto: "Enrollment {base44Id}" | Format |
| `base44Id` | TEXT | `CustomerProfile.id` | Direct |
| `status` | SELECT | `CustomerProfile.enrollmentStatus` | Enum: not_enrolled/pending/active/cancelled |
| `journeyStatus` | SELECT | `CustomerProfile.journeyStatus` | Enum: not_started/in_progress/completed |
| `journeyStep` | NUMBER | `CustomerProfile.journeyStep` | Direct |
| `onboardingStatus` | SELECT | `CustomerProfile.onboardingStatus` | Enum: not_started/in_progress/completed |
| `onboardingStep` | NUMBER | `CustomerProfile.onboardingStep` | Direct |
| `agreementStatus` | SELECT | `CustomerProfile.agreementStatus` | Enum: Not Generated/Sent/Signed/Expired |
| `agreementUrl` | LINKS | `CustomerProfile.agreementUrl` | Direct |
| `signedAt` | DATE_TIME | `CustomerProfile.signedAt` | Parse ISO |
| `enrolledAt` | DATE_TIME | `CustomerProfile.enrolledAt` | Parse ISO |
| `enrolledBy` | TEXT | `CustomerProfile.enrolledBy` | Direct |
| `onboardedAt` | DATE_TIME | `CustomerProfile.onboardedAt` | Parse ISO |
| `onboardedBy` | TEXT | `CustomerProfile.onboardedBy` | Direct |
| `programType` | SELECT | `CustomerProfile.programType` | Enum: standard/accelerated/premium |
| `programTermMonths` | NUMBER | `CustomerProfile.programTermMonths` | Direct |
| `qualificationPath` | TEXT | `CustomerProfile.qualificationPath` | Direct |
| `termsAccepted` | BOOLEAN | `CustomerProfile.termsAccepted` | Direct |
| `enrollmentRecapSent` | BOOLEAN | `CustomerProfile.enrollmentRecapSent` | Direct |
| `welcomeEmailSent` | BOOLEAN | `CustomerProfile.welcomeEmailSent` | Direct |
| `agreementEmailSent` | BOOLEAN | `CustomerProfile.agreementEmailSent` | Direct |
| `enrollmentNotes` | RICH_TEXT | `CustomerProfile.enrollmentNotes` | Direct |

### 6.3 Relations

| Direction | Target | Type |
|---|---|---|
| MANY_TO_ONE | Person | Person has one Enrollment (1:1 effectively) |

---

## 7. ACTIVITY (Custom Object — Timeline Events)

### 7.1 Object Definition

| Property | Value |
|---|---|
| `nameSingular` | `activity` |
| `namePlural` | `activities` |
| `labelSingular` | `Activity` |
| `labelPlural` | `Activities` |
| `icon` | `IconTimeline` |

### 7.2 Fields

| Field Name | Type | Source | Transform |
|---|---|---|---|
| `name` (base) | TEXT | Auto: "{type}: {summary}" | Format |
| `activityType` | SELECT | Derived | Enum: sms/email/call/note/system_event/agent_action |
| `summary` | TEXT | Varies | Truncated content (max 500 chars) |
| `direction` | SELECT | Derived | Enum: inbound/outbound/internal |
| `occurredAt` | DATE_TIME | Source timestamp | Parse ISO |
| `content` | RICH_TEXT | Source body | Full content (if available) |
| `source` | TEXT | Source system | e.g., 'ghl', 'sendgrid', 'vapi', 'base44' |
| `sourceId` | TEXT | Source record ID | For cross-reference |
| `agentEmail` | ACTOR | `CustomerProfile.agentEmail` | Agent who performed action |
| `metadata` | RAW_JSON | Source metadata | Flexible JSON |

### 7.3 Activity Sources

| Source | Events | Pull From |
|---|---|---|
| **GHL/SMS** | SMS sent, SMS received | `GhlMessage` entity |
| **Email** | Email sent, opened, clicked, replied | `EmailMessage` entity |
| **Vapi** | Call placed, completed, voicemail | `VapiCallEvent` entity |
| **Base44** | Agent notes, status changes, system events | `CustomerProfile` change log |
| **Slack** | Agent discussions | `SlackSubmission` entity |
| **NMI** | Payment success, decline, refund | `PaymentLog` entity |

### 7.4 Relations

| Direction | Target | Type |
|---|---|---|
| MANY_TO_ONE | Person | Person has many Activities |

---

## 8. SUPPORT TICKET (Custom Object — Linear Integration Target)

### 8.1 Object Definition

| Property | Value |
|---|---|
| `nameSingular` | `supportTicket` |
| `namePlural` | `supportTickets` |
| `labelSingular` | `Support Ticket` |
| `labelPlural` | `Support Tickets` |
| `icon` | `IconHelpCircle` |

### 8.2 Fields

| Field Name | Type | Source | Transform |
|---|---|---|---|
| `name` (base) | TEXT | SupportTicket | `title` or `subject` |
| `ticketNumber` | TEXT | SupportTicket | Auto-generated or from Linear |
| `status` | SELECT | SupportTicket | Enum: open/in_progress/resolved/closed |
| `priority` | SELECT | SupportTicket | Enum: low/medium/high/critical |
| `description` | RICH_TEXT | SupportTicket | Full description |
| `category` | SELECT | SupportTicket | Enum: billing/technical/disputes/enrollment/general |
| `assignedTo` | TEXT | SupportTicket.assigned_agent | Agent email |
| `source` | SELECT | Derived | Enum: slack/email/phone/portal |
| `slackThreadTs` | TEXT | SlackSubmission | Slack message timestamp for linking |
| `linearIssueId` | TEXT | Linear integration | Linear issue ID (Phase 30) |
| `linearIssueUrl` | LINKS | Linear integration | Linear issue URL |
| `resolution` | RICH_TEXT | SupportTicket.resolution | Resolution notes |
| `resolvedAt` | DATE_TIME | SupportTicket.resolvedAt | Parse ISO |
| `createdAt` (base) | DATE_TIME | Auto | — |

### 8.3 Relations

| Direction | Target | Type |
|---|---|---|
| MANY_TO_ONE | Person | Person has many SupportTickets |

---

## 9. MIGRATION RULES

### 9.1 Sacred Boundaries (ABSOLUTE)

1. **NMI Vault (memory 6a1f118b):** NEVER migrate `cardNumber`, `cardCvv`, `cardExpiry`, `routingNumber`, `bankAccountNumber`
2. **PII Sensitivity:** `ssn` NEVER migrated. `dob` marked sensitive.
3. **Auth Tokens:** NEVER migrate `otpCode`, `portalSessionToken`, `billingActionToken`
4. **NMI is Source of Truth:** Subscription billing state lives in NMI; Twenty mirrors but does not override

### 9.2 Transform Rules

| Rule | Description |
|---|---|
| **Base44 ID** | Always stored as `base44Id` or `external_id` text field on every object |
| **ISO Dates** | All dates parsed to ISO 8601, `null` for empty |
| **Booleans** | `"True"/"False"` strings converted to actual booleans |
| **Enums** | Normalized to UPPER_CASE (e.g., `Active` → `ACTIVE`) |
| **Phone** | Stored as E.164 where possible, raw if not |
| **Currency** | Stored as numeric values (cents or dollars, TBD) |
| **Null Fields** | Map to `null` / not set — don't use placeholder values |

### 9.3 Idempotent Sync Strategy

- Every object has a `base44Id` field (external_id)
- Sync checks: if `base44Id` exists → UPDATE, else → CREATE
- Bulk sync uses GraphQL batch upsert (60 records/batch)
- Sync timestamp tracked per object type for incremental syncs

---

## 10. FIELD COUNT SUMMARY

| Object | Custom Fields | Relations |
|---|---|---|
| Person (extended) | 20 custom fields | 0 (built-in) |
| Subscription | 22 fields | 2 relations |
| PaymentRecord | 12 fields | 2 relations |
| CreditDispute | 12 fields | 1 relation |
| Enrollment | 19 fields | 1 relation |
| Activity | 10 fields | 1 relation |
| SupportTicket | 14 fields | 1 relation |
| **TOTAL** | **~109 custom fields** | **8 relations** |

---

**Data model designed:** 2026-06-17 02:04 UTC  
**Status:** ✅ Complete — ready for Stream 2 (Connector Skill)
