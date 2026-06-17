---
type: "connector"
name: "Lead Flow Funnel"
description: "Auto-generated description for Lead Flow Funnel"
version: "1.0.0"
updated: "2026-06-17"
access: internal
---

# Vapi Lead Flow Funnel — U2.3.E

## Haley v3 Funnel Discipline

Haley is NewLeaf's Vapi-powered voice AI assistant. The lead flow funnel tracks how inbound and outbound calls convert through the enrollment pipeline.

## Funnel Stages

```
                    ┌──────────────┐
                    │  CALL PLACED  │  Outbound or inbound
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  CONNECTED   │  Call answered by human
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  ENGAGED    │  Customer stays past greeting
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  INTERESTED  │  Expresses interest in services
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  QUALIFIED  │  Meets credit/income criteria
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  CONVERTED  │  Signed up for services
                    └──────────────┘
```

## Call Outcome Categories

| Outcome | Funnel Stage | Description |
|---------|-------------|-------------|
| `voicemail` | Connected | Left voicemail, no human interaction |
| `no_answer` | Call Placed | Ring no answer, call timed out |
| `hangup_early` | Connected | Hung up before greeting complete |
| `not_interested` | Engaged | Explicitly declined |
| `dnc_request` | Engaged | Asked to be placed on Do Not Call |
| `wrong_number` | Connected | Wrong person/number |
| `callback_requested` | Engaged | Asked to call back later |
| `interested` | Interested | Expressed interest |
| `qualified` | Qualified | Passed qualification criteria |
| `transferred_to_agent` | Qualified | Escalated to human agent |
| `enrolled` | Converted | Completed enrollment |
| `payment_collected` | Converted | Made payment |

## Haley v3 Assistant Configuration

```typescript
{
  name: "Haley v3",
  model: { provider: "openai", model: "gpt-4o" },
  voice: { provider: "openai", voiceId: "nova" },
  firstMessage: "Hi, this is Haley with NewLeaf Financial. I'm calling about your credit repair options. Is now a good time?",
  systemPrompt: `You are Haley, a professional credit repair consultant at NewLeaf Financial.
Your goal is to help customers understand their credit repair options and enroll them in the right program.
Be empathetic, knowledgeable, and never pushy.
Follow the qualification script: ask about their credit goals, check eligibility, explain options, and guide to enrollment.
If a customer asks to speak to a human, transfer them immediately.`
}
```

## Lead Funnel Analytics

The `get_lead_funnel` action returns:

```typescript
{
  totalCalls: number,
  connected: number,
  engaged: number,
  interested: number,
  qualified: number,
  converted: number,
  conversionRate: number,       // converted / totalCalls
  connectionRate: number,        // connected / totalCalls
  engagementRate: number,        // engaged / connected
  averageCallDuration: number,   // seconds
  totalCallCost: number,         // USD
  costPerConversion: number,     // totalCallCost / converted
  outcomes: Record<string, number>  // count by outcome
}
```

## Monitoring and Optimization

### Key Metrics
- **Connection Rate** > 40% — if lower, check phone number quality and timing
- **Engagement Rate** > 60% — if lower, review greeting and first message
- **Conversion Rate** > 15% — if lower, review qualification criteria and offer
- **Cost/Conversion** < $5 — Vapi pricing benchmark
- **DNC Rate** < 2% — if higher, review targeting and script

### Haley v3 Guardrails
1. Never make promises about credit score improvements
2. Always disclose that results vary
3. Comply with TCPA regulations (consent + DNC)
4. Transfer to human agent when requested — never argue
5. Record all calls for compliance (disclosed in greeting)
6. Never collect payment info over voice — send text-to-pay link instead

## Integration with Other Connectors

The lead funnel data feeds into:
- **Base44 CRM** — CallLog and CustomerProfile updates
- **NMI** — Payment collection via text-to-pay (`send_txt2pay`)
- **Slack** — Real-time enrollment alerts in `#jarvis-admin`
- **Hyperswitch** — Payment processing for enrollment fees

## Call Lifecycle Integration

```
Vapi creates call → Haley answers → Qualification flow →
  ├─ Qualified → Transfer to human → Agent closes in Base44
  ├─ Payment needed → Vapi sends txt2pay link via NMI
  └─ Not qualified → Warm transfer or callback scheduled
```

All call events are logged to `VapiCallEvent` in Base44 for the `get_lead_funnel` analytics.
