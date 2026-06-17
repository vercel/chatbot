/**
 * Dispute Letter — Twenty Custom Object
 * Phase 40: Twenty Wave 4 — Disputes
 */

import { defineObject } from "@twenty-crm/api";

export const disputeLetter = defineObject({
  nameSingular: "DisputeLetter",
  namePlural: "DisputeLetters",
  labelSingular: "Dispute Letter",
  labelPlural: "Dispute Letters",
  description: "Credit dispute letter sent to bureaus",
  icon: "IconMail",
  fields: {
    bureau: { type: "select", label: "Bureau",
      options: [
        { value: "equifax", label: "Equifax", color: "red" },
        { value: "experian", label: "Experian", color: "blue" },
        { value: "transunion", label: "TransUnion", color: "orange" },
      ],
    },
    roundNumber: { type: "number", label: "Round Number", defaultValue: 1 },
    status: { type: "select", label: "Status",
      options: [
        { value: "draft", label: "Draft", color: "gray" },
        { value: "review", label: "Ready for Review", color: "yellow" },
        { value: "approved", label: "Approved", color: "blue" },
        { value: "sent", label: "Sent", color: "green" },
        { value: "response_received", label: "Response Received", color: "purple" },
        { value: "resolved", label: "Resolved", color: "teal" },
        { value: "rejected", label: "Rejected", color: "red" },
      ],
      defaultValue: "draft",
    },
    sentDate: { type: "datetime", label: "Sent Date" },
    certifiedMailId: { type: "text", label: "Certified Mail ID" },
    responseDate: { type: "datetime", label: "Response Date" },
    responseDeadline: { type: "datetime", label: "Response Deadline (30 days)" },
    result: { type: "select", label: "Result",
      options: [
        { value: "deleted", label: "Item Deleted", color: "green" },
        { value: "updated", label: "Item Updated", color: "yellow" },
        { value: "verified", label: "Item Verified", color: "red" },
        { value: "no_response", label: "No Response", color: "orange" },
      ],
    },
    templateId: { type: "text", label: "Template Used" },
    documentUrl: { type: "url", label: "Letter PDF URL" },
    fcraCompliant: { type: "boolean", label: "FCRA Compliant", defaultValue: true },
    disputedItems: { type: "text", label: "Disputed Items (comma-separated IDs)" },
    notes: { type: "text", label: "Notes" },
    // Relations: person, disputeRound, negativeItem[]
  },
});
