/**
 * Agreement — Twenty Custom Object
 * Phase 38: Twenty Wave 2 — Sales Workflow
 *
 * Tracks signed agreements and enrollment documents.
 */

import { defineObject } from "@twenty-crm/api";

export const agreement = defineObject({
  nameSingular: "Agreement",
  namePlural: "Agreements",
  labelSingular: "Agreement",
  labelPlural: "Agreements",
  description: "Customer agreement / contract",
  icon: "IconFileText",
  fields: {
    type: { type: "select", label: "Type",
      options: [
        { value: "enrollment", label: "Enrollment Agreement", color: "blue" },
        { value: "payment_auth", label: "Payment Authorization", color: "green" },
        { value: "credit_pull", label: "Credit Pull Authorization", color: "purple" },
        { value: "cancellation", label: "Cancellation", color: "red" },
      ],
    },
    status: { type: "select", label: "Status",
      options: [
        { value: "draft", label: "Draft", color: "gray" },
        { value: "sent", label: "Sent for Signature", color: "yellow" },
        { value: "signed", label: "Signed", color: "green" },
        { value: "expired", label: "Expired", color: "red" },
        { value: "voided", label: "Voided", color: "orange" },
      ],
      defaultValue: "draft",
    },
    documentUrl: { type: "url", label: "Document URL" },
    signedAt: { type: "datetime", label: "Signed At" },
    expiresAt: { type: "datetime", label: "Expires At" },
    esignatureId: { type: "text", label: "E-Signature ID" },
    ipAddress: { type: "text", label: "Signer IP Address" },
    termsHash: { type: "text", label: "Terms Hash" },
    version: { type: "text", label: "Template Version" },
    // Relations: person
  },
});
