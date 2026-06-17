/**
 * Negative Item — Twenty Custom Object
 * Phase 40: Twenty Wave 4 — Disputes
 */

import { defineObject } from "@twenty-crm/api";

export const negativeItem = defineObject({
  nameSingular: "NegativeItem",
  namePlural: "NegativeItems",
  labelSingular: "Negative Item",
  labelPlural: "Negative Items",
  description: "Negative item on credit report",
  icon: "IconExclamationCircle",
  fields: {
    bureau: { type: "select", label: "Bureau",
      options: [
        { value: "equifax", label: "Equifax", color: "red" },
        { value: "experian", label: "Experian", color: "blue" },
        { value: "transunion", label: "TransUnion", color: "orange" },
      ],
    },
    accountType: { type: "select", label: "Account Type",
      options: [
        { value: "collection", label: "Collection", color: "red" },
        { value: "charge_off", label: "Charge Off", color: "orange" },
        { value: "late_payment", label: "Late Payment", color: "yellow" },
        { value: "bankruptcy", label: "Bankruptcy", color: "purple" },
        { value: "foreclosure", label: "Foreclosure", color: "pink" },
        { value: "repossession", label: "Repossession", color: "blue" },
        { value: "inquiry", label: "Hard Inquiry", color: "gray" },
        { value: "other", label: "Other", color: "gray" },
      ],
    },
    accountName: { type: "text", label: "Account Name" },
    accountNumber: { type: "text", label: "Account Number (masked)" },
    originalCreditor: { type: "text", label: "Original Creditor" },
    currentStatus: { type: "text", label: "Current Status" },
    dateOpened: { type: "datetime", label: "Date Opened" },
    dateReported: { type: "datetime", label: "Date Reported" },
    balance: { type: "currency", label: "Balance" },
    disputeStatus: { type: "select", label: "Dispute Status",
      options: [
        { value: "not_disputed", label: "Not Disputed", color: "gray" },
        { value: "disputing", label: "Disputing", color: "yellow" },
        { value: "disputed_removed", label: "Removed", color: "green" },
        { value: "disputed_updated", label: "Updated", color: "blue" },
        { value: "disputed_verified", label: "Verified", color: "red" },
      ],
      defaultValue: "not_disputed",
    },
    disputeRoundId: { type: "text", label: "Dispute Round ID" },
    isEligible: { type: "boolean", label: "Eligible for Dispute", defaultValue: true },
    ineligibilityReason: { type: "text", label: "Ineligibility Reason" },
    // Relations: person, creditReport, disputeLetter
  },
});
