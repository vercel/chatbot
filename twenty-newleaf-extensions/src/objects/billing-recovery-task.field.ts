/**
 * Billing Recovery Task — Twenty Custom Object
 * Phase 39: Twenty Wave 3 — Billing Migration
 */

import { defineObject } from "@twenty-crm/api";

export const billingRecoveryTask = defineObject({
  nameSingular: "BillingRecoveryTask",
  namePlural: "BillingRecoveryTasks",
  labelSingular: "Recovery Task",
  labelPlural: "Recovery Tasks",
  description: "Payment recovery task for declined/failed payments",
  icon: "IconAlertTriangle",
  fields: {
    status: { type: "select", label: "Status",
      options: [
        { value: "pending", label: "Pending", color: "yellow" },
        { value: "in_progress", label: "In Progress", color: "blue" },
        { value: "recovered", label: "Recovered", color: "green" },
        { value: "failed", label: "Failed", color: "red" },
        { value: "canceled", label: "Canceled", color: "gray" },
      ],
      defaultValue: "pending",
    },
    amountDue: { type: "currency", label: "Amount Due" },
    daysPastDue: { type: "number", label: "Days Past Due" },
    retryCount: { type: "number", label: "Retry Count", defaultValue: 0 },
    maxRetries: { type: "number", label: "Max Retries", defaultValue: 3 },
    nextRetryDate: { type: "datetime", label: "Next Retry Date" },
    lastPaymentAttempt: { type: "datetime", label: "Last Attempt" },
    declineCode: { type: "text", label: "Decline Code" },
    declineReason: { type: "text", label: "Decline Reason" },
    recoveryMethod: { type: "select", label: "Method",
      options: [
        { value: "auto_retry", label: "Auto Retry", color: "blue" },
        { value: "sms_reminder", label: "SMS Reminder", color: "green" },
        { value: "email_reminder", label: "Email Reminder", color: "purple" },
        { value: "phone_call", label: "Phone Call", color: "orange" },
        { value: "manual", label: "Manual", color: "gray" },
      ],
    },
    resolution: { type: "text", label: "Resolution Notes" },
    // Relations: person, paymentRecord
  },
});
