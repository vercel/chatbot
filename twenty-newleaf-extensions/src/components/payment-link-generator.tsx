/**
 * Payment Link Generator — Twenty defineFrontComponent
 * Phase 39 — Billing Migration
 *
 * Generates NMI payment links for customers.
 * SACRED: NMI vault referenced but never modified programmatically.
 */

import { defineFrontComponent } from "@twenty-crm/frontend";

export const paymentLinkGenerator = defineFrontComponent({
  id: "neptune-payment-link-generator",
  name: "Payment Link Generator",
  description: "Generate and send NMI payment links (SACRED)",
  placement: "modal",
  supportedObjects: ["person"],
  icon: "IconCurrencyDollar",
  component: async ({ record }) => {
    // SCAFFOLD — Phase 39 fills in real NMI integration
    // SACRED: NMI vault referenced but NEVER modified here
    // Payment links are READ-ONLY references to NMI vault

    return {
      title: "Generate Payment Link",
      fields: [
        {
          name: "amount",
          type: "currency",
          label: "Amount",
          defaultValue: record.monthlyCharge || 149.0,
        },
        {
          name: "description",
          type: "text",
          label: "Description",
          defaultValue: `Payment for ${record.name?.firstName || "customer"}`,
        },
        {
          name: "sendMethod",
          type: "select",
          label: "Send via",
          options: [
            { value: "sms", label: "SMS" },
            { value: "email", label: "Email" },
            { value: "copy", label: "Copy Link Only" },
          ],
          defaultValue: "sms",
        },
      ],
      actions: [
        {
          label: "Generate & Send",
          variant: "primary",
          // onClick: () => generateNmiPaymentLink(record)
          disabled: true,
          disabledReason: "NMI integration pending (Phase 39)",
        },
      ],
    };
  },
});
