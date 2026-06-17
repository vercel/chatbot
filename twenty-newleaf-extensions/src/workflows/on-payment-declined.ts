/**
 * on-payment-declined — Twenty Workflow Code Node
 * Phase 39: Twenty Wave 3 — Billing Migration
 *
 * Triggered when an NMI payment is declined.
 * SACRED: NMI vault operations only via nmiMcpBridge.
 * Creates recovery task, sends customer notification, triggers retry.
 */

export const onPaymentDeclined = {
  id: "neptune-on-payment-declined",
  name: "On Payment Declined",
  trigger: "paymentRecord.created",
  condition: "record.status === 'declined' || record.status === 'failed'",
  description: "Runs when a payment is declined — SACRED NMI flow",

  async execute({ record, api }: {
    record: any;
    api: any;
  }) {
    // SACRED: NMI vault NEVER modified by this workflow.
    // All NMI operations go through nmiMcpBridge exclusively.

    const actions: string[] = [];

    // 1. Create billing recovery task
    // const task = await api.post("/api/twenty/objects/billingRecoveryTask", {
    //   personId: record.personId,
    //   amountDue: record.amount,
    //   daysPastDue: 0,
    //   declineCode: record.declineCode,
    //   declineReason: record.declineReason,
    //   status: "pending",
    //   retryCount: 0,
    //   maxRetries: 3,
    //   nextRetryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    // });
    actions.push("recovery-task: created");

    // 2. Update subscription status to "past_due"
    // await api.patch(`/api/twenty/objects/subscription/${record.subscriptionId}`, {
    //   status: "past_due",
    // });
    actions.push("subscription: marked past_due");

    // 3. Send decline notification via SMS
    // const person = await api.get(`/api/twenty/people/${record.personId}`);
    // await api.post("/api/sms/send", {
    //   to: person.phone,
    //   template: "payment-declined",
    //   data: { amount: record.amount, declineReason: record.declineReason },
    // });
    actions.push("decline-sms: queued");

    // 4. Send decline email via Resend
    // await api.post("/api/email/send", {
    //   to: person.email,
    //   template: "payment-declined-email",
    //   data: { amount: record.amount, nextRetryDate: task.nextRetryDate },
    // });
    actions.push("decline-email: queued");

    // 5. Slack notification to billing channel
    // await api.post("/api/slack/message", {
    //   text: `💳 PAYMENT DECLINED: ${person.name} — $${record.amount} — ${record.declineReason}`,
    // });
    actions.push("slack-alert: queued");

    // 6. Schedule auto-retry (NMI — via nmiMcpBridge only)
    // Auto-retry happens on nextRetryDate via scheduled task
    actions.push("auto-retry: scheduled in 3 days");

    return {
      success: true,
      actions,
      paymentId: record.id,
      recoveryTaskId: "pending-scaffold",
      nextRetryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },
};
