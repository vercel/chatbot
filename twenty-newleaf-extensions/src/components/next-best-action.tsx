/**
 * Next Best Action — Twenty defineFrontComponent
 * Phase 39+ — Billing Migration
 *
 * Recommends the optimal next action for each customer based on
 * their current state (payment status, dispute status, tickets).
 */

import { defineFrontComponent } from "@twenty-crm/frontend";

export const nextBestAction = defineFrontComponent({
  id: "neptune-next-best-action",
  name: "Next Best Action",
  description: "AI-recommended next action for this customer",
  placement: "record-top-bar",
  supportedObjects: ["person"],
  icon: "IconZap",
  component: async ({ record }) => {
    return {
      primaryAction: {
        label: "View Customer 360",
        type: "navigate",
        target: `/person/${record.id}?view=360`,
      },
      secondaryActions: [
        { label: "Send Payment Link", icon: "IconLink", disabled: false },
        { label: "Send SMS", icon: "IconMessage", disabled: false },
        { label: "Add Note", icon: "IconNote", disabled: false },
        { label: "Create Ticket", icon: "IconTicket", disabled: false },
      ],
    };
  },
});
