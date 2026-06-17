/**
 * Email Message — Twenty Custom Object
 * Phase 41: Twenty Wave 5 — Support + Communications
 */

import { defineObject } from "@twenty-crm/api";

export const emailMessage = defineObject({
  nameSingular: "EmailMessage", namePlural: "EmailMessages",
  labelSingular: "Email", labelPlural: "Emails",
  description: "Email sent/received via Resend", icon: "IconMail",
  fields: {
    direction: { type: "select", label: "Direction",
      options: [
        { value: "inbound", label: "Inbound", color: "blue" },
        { value: "outbound", label: "Outbound", color: "green" },
      ],
    },
    subject: { type: "text", label: "Subject" },
    body: { type: "text", label: "Body (plain text)" },
    fromAddress: { type: "email", label: "From" },
    toAddress: { type: "email", label: "To" },
    status: { type: "select", label: "Status",
      options: [
        { value: "sent", label: "Sent", color: "green" },
        { value: "delivered", label: "Delivered", color: "blue" },
        { value: "opened", label: "Opened", color: "purple" },
        { value: "clicked", label: "Clicked", color: "teal" },
        { value: "bounced", label: "Bounced", color: "red" },
        { value: "spam", label: "Spam", color: "orange" },
      ],
    },
    resendId: { type: "text", label: "Resend Message ID" },
    campaignId: { type: "text", label: "Campaign ID" },
    templateUsed: { type: "text", label: "Template Used" },
    // Relations: person, supportTicket
  },
});
