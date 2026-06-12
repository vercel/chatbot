---
connector: ghl
version: 0.2.0
scope: connector
auto_load: true
trigger_tools:
  - ghl:createContact
  - ghl:sendSms
  - ghl:sendEmail
  - ghl:queryConversations
  - ghl:getOpportunity
headline: |
  GoHighLevel CRM via Base44 bridge. SMS requires opt-in + 9am-9pm window.
  Never hardcode GHL API key in Neptune — it lives in Base44. TCPA + CAN-SPAM compliant.
---

# GoHighLevel Connector Playbook

## Operational Knowledge

### Architecture
GHL tools proxy through the Base44 bridge (`BASE44_API/api/ghlBridge`) using a `callBridge("action", payload)` pattern. This keeps GHL API keys on the Base44 backend (VPS), not in Neptune Chat env vars.

### Auth
- `GHL_API_KEY` — API key from GHL subaccount settings
- `GHL_LOCATION_ID` — Location/subaccount ID
- Both must be set in Base44, not in Neptune Chat directly

### Rate Limits
- 100 requests per 10 seconds per location
- SMS: varies by Twilio subaccount linked to GHL
- Email: standard GHL email service limits

### Tools
- `createContact` — Create or update contacts by email/phone
- `sendSms` — Send SMS (max 1600 chars, requires opt-in)
- `sendEmail` — Send email (HTML or plain text)
- `queryConversations` — Search by contact, date range, keyword
- `getOpportunity` — Get pipeline opportunity details

## Business Context

### Why GHL
GoHighLevel is NewLeaf's CRM platform — contacts, SMS, email, pipeline, and automations. This connector enables agents to:
1. Create/update contacts programmatically
2. Send templated SMS and email communications
3. Query conversation history for customer context
4. Track pipeline opportunities for sales enablement

### Use Cases
- **Customer onboarding**: Create contact → send welcome SMS → add to pipeline
- **Billing follow-up**: Query conversations → find payment discussion → send payment link
- **Sales pipeline**: Query opportunities → identify stuck deals → trigger outreach

## Anti-Patterns

### ❌ NEVER:
1. Send SMS without opt-in verification — TCPA compliance
2. Create duplicate contacts — always check by email/phone first
3. Send email without unsubscribe link — CAN-SPAM compliance
4. Query conversations without date bounds — can return massive datasets
5. Hardcode GHL API key in Neptune Chat — it lives in Base44

### ⚠️ DANGEROUS:
- Bulk SMS sends without rate limiting
- Creating contacts with PII not approved for storage
- Modifying pipeline stages without business rule validation

## Safeguards

### SMS Compliance
- Always verify opt-in status before sending
- Include opt-out instructions in every message
- Respect quiet hours (9am-9pm local time)

### Email Compliance
- Include unsubscribe link in every email
- Honor unsubscribe requests immediately
- Don't send marketing email to transactional-only contacts

### Error Handling
- Duplicate contact → return existing contact ID
- Invalid phone → return validation error, don't attempt send
- Rate limited → exponential backoff
- Bridge unreachable → return clear error with troubleshooting steps

## Common Workflows

### Create a Contact
```
createContact({
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+15551234567",
  tags: ["lead", "website-signup"]
})
```

### Send Follow-up SMS
```
sendSms({
  contactId: "abc123",
  message: "Hi John, your payment link is ready: https://pay.newleaf.financial/xyz"
})
```

### Query Customer Conversations
```
queryConversations({
  contactId: "abc123",
  startDate: "2026-06-01",
  limit: 20
})
```

### Check Pipeline Status
```
getOpportunity({ opportunityId: "opp_xyz" })
→ returns name, status, pipeline stage, value
```

## Refinement Notes

- **Version:** 1.0.0
- **Created:** 2026-06-09
- **Last Reviewed:** 2026-06-09
- **Source:** GHL API v2 docs, Base44 GHL Bridge architecture
