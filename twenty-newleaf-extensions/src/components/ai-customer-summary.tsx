/**
 * AI Customer Summary — Twenty defineFrontComponent
 * Phase 38+ — Sales Workflow
 *
 * Shows AI-generated customer summary with stats, next best action,
 * and quick links. Appears in Person record sidebar.
 */

import { defineFrontComponent } from "@twenty-crm/frontend";

export const aiCustomerSummary = defineFrontComponent({
  id: "neptune-ai-customer-summary",
  name: "AI Customer Summary",
  description: "AI-generated customer overview with next best action",
  placement: "record-sidebar",
  supportedObjects: ["person"],
  icon: "IconBrain",
  component: async ({ record }) => {
    // SCAFFOLD — Phase 38 fills in:
    // const { data } = await fetch("/api/chat/twenty/query", {
    //   method: "POST",
    //   body: JSON.stringify({ query: "customerSummary", personId: record.id }),
    // });

    return {
      sections: [
        {
          title: "Summary",
          content: `Customer enrolled ${record.enrollmentDate || "N/A"}. Plan: ${record.subscriptionPlan || "None"}.`,
        },
        {
          title: "Quick Stats",
          items: [
            { label: "Credit Score", value: "N/A", trend: "neutral" },
            { label: "Active Disputes", value: "0", trend: "neutral" },
            { label: "Last Payment", value: "N/A", trend: "neutral" },
            { label: "Open Tickets", value: "0", trend: "neutral" },
          ],
        },
        {
          title: "Next Best Action",
          action: {
            label: "Send Payment Reminder",
            type: "sms",
            disabled: true,
            disabledReason: "No payment due",
          },
        },
      ],
    };
  },
});

/* SCAFFOLD — Phase 38 fills in:
 * - Real AI summary from NKS context
 * - Actual customer stats from Twenty + Base44
 * - Dynamic next best action based on customer state
 * - Quick action buttons (Send Payment Link, SMS, Call)
 */
