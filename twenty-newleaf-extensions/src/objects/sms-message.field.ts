/**
 * SMS Message — Twenty Custom Object
 * Phase 41: Support + Communications (via GHL)
 */

import { defineObject } from "@twenty-crm/api";

export const smsMessage = defineObject({
  nameSingular: "SmsMessage", namePlural: "SmsMessages",
  labelSingular: "SMS", labelPlural: "SMS Messages",
  description: "SMS sent/received via GHL", icon: "IconMessage",
  fields: {
    direction: { type: "select", label: "Direction",
      options: [
        { value: "inbound", label: "Inbound", color: "blue" },
        { value: "outbound", label: "Outbound", color: "green" },
      ],
    },
    body: { type: "text", label: "Message Body" },
    fromNumber: { type: "phone", label: "From" },
    toNumber: { type: "phone", label: "To" },
    status: { type: "select", label: "Status",
      options: [
        { value: "queued", label: "Queued", color: "gray" },
        { value: "sent", label: "Sent", color: "blue" },
        { value: "delivered", label: "Delivered", color: "green" },
        { value: "failed", label: "Failed", color: "red" },
      ],
    },
    ghlId: { type: "text", label: "GHL Message ID" },
    segments: { type: "number", label: "Segments", defaultValue: 1 },
    // Relations: person
  },
});
