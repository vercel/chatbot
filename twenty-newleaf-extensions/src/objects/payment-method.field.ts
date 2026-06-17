/**
 * Payment Method — Twenty Custom Object
 * Phase 38: Sales Workflow
 *
 * SACRED: Links to NMI vault. NEVER modify payment method data
 * programmatically without explicit human approval.
 */

import { defineObject } from "@twenty-crm/api";

export const paymentMethod = defineObject({
  nameSingular: "PaymentMethod",
  namePlural: "PaymentMethods",
  labelSingular: "Payment Method",
  labelPlural: "Payment Methods",
  description: "Customer payment method (NMI vault link — SACRED)",
  icon: "IconCreditCard",
  fields: {
    type: { type: "select", label: "Type",
      options: [
        { value: "credit_card", label: "Credit Card", color: "blue" },
        { value: "debit_card", label: "Debit Card", color: "green" },
        { value: "ach", label: "ACH / Bank", color: "purple" },
      ],
    },
    lastFour: { type: "text", label: "Last 4 Digits" },
    brand: { type: "text", label: "Card Brand" },
    expiryMonth: { type: "number", label: "Expiry Month" },
    expiryYear: { type: "number", label: "Expiry Year" },
    isDefault: { type: "boolean", label: "Default", defaultValue: false },
    isActive: { type: "boolean", label: "Active", defaultValue: true },
    nmiVaultId: { type: "text", label: "NMI Vault ID (SACRED)" },
    // Relations: person
  },
});
