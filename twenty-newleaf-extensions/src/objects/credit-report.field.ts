/**
 * Credit Report — Twenty Custom Object
 * Phase 40: Twenty Wave 4 — Disputes
 */

import { defineObject } from "@twenty-crm/api";

export const creditReport = defineObject({
  nameSingular: "CreditReport",
  namePlural: "CreditReports",
  labelSingular: "Credit Report",
  labelPlural: "Credit Reports",
  description: "Credit report pulled from bureaus",
  icon: "IconFileSearch",
  fields: {
    bureau: { type: "select", label: "Bureau",
      options: [
        { value: "equifax", label: "Equifax", color: "red" },
        { value: "experian", label: "Experian", color: "blue" },
        { value: "transunion", label: "TransUnion", color: "orange" },
        { value: "tri_merge", label: "Tri-Merge", color: "purple" },
      ],
    },
    pullDate: { type: "datetime", label: "Pull Date" },
    creditScore: { type: "number", label: "Credit Score" },
    scoreModel: { type: "text", label: "Score Model" },
    totalAccounts: { type: "number", label: "Total Accounts" },
    negativeCount: { type: "number", label: "Negative Items Count" },
    reportUrl: { type: "url", label: "Report PDF URL" },
    reportReference: { type: "text", label: "Report Reference Number" },
    isCurrent: { type: "boolean", label: "Current Report", defaultValue: true },
    // Relations: person, negativeItem[]
  },
});
