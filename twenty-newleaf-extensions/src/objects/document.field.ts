/**
 * Document — Twenty Custom Object
 * Phase 42: Twenty Wave 6 — Customer Portal v2
 *
 * General document storage (agreements, letters, reports, receipts).
 */

import { defineObject } from "@twenty-crm/api";

export const document = defineObject({
  nameSingular: "Document", namePlural: "Documents",
  labelSingular: "Document", labelPlural: "Documents",
  description: "Customer document", icon: "IconFile",
  fields: {
    title: { type: "text", label: "Title" },
    category: { type: "select", label: "Category",
      options: [
        { value: "agreement", label: "Agreement", color: "blue" },
        { value: "dispute_letter", label: "Dispute Letter", color: "purple" },
        { value: "credit_report", label: "Credit Report", color: "orange" },
        { value: "payment_receipt", label: "Payment Receipt", color: "green" },
        { value: "identity", label: "Identity Document", color: "teal" },
        { value: "other", label: "Other", color: "gray" },
      ],
    },
    fileUrl: { type: "url", label: "File URL" },
    fileType: { type: "text", label: "File Type (pdf, png, etc.)" },
    fileSize: { type: "number", label: "File Size (bytes)" },
    uploadedAt: { type: "datetime", label: "Uploaded At" },
    uploadedBy: { type: "text", label: "Uploaded By (agent or customer)" },
    isCustomerVisible: { type: "boolean", label: "Visible to Customer", defaultValue: false },
    // Relations: person
  },
});
