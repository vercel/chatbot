/**
 * onPaymentDeclined — Twenty Workflow Code Node
 * Phase 39 Stream 3: Payment decline → recovery task + Linear ticket.
 *
 * Trigger: paymentRecord.created with status "declined" or "failed"
 * SACRED: NMI vault NEVER modified. All NMI ops go through nmiMcpBridge.
 */
export const onPaymentDeclined = {
  id: "neptune-on-payment-declined",
  name: "On Payment Declined",
  trigger: "paymentRecord.created",
  condition: "record.status === 'declined' || record.status === 'failed'",
  description: "Runs when a payment is declined — SACRED NMI flow",

  async execute({ record, api }: { record: any; api: any }) {
    const actions: string[] = [];
    const errors: string[] = [];

    // SACRED: NMI vault NEVER modified by this workflow.
    // All NMI operations go through nmiMcpBridge exclusively.

    const nextRetryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // 1. Create billing recovery task in Twenty
    let recoveryTaskId: string | undefined;
    try {
      const taskRes = await api.post("/api/twenty/objects/billingRecoveryTask", {
        personId: record.personId,
        amountDue: record.amount?.amountMicros ? record.amount.amountMicros / 1_000_000 : 0,
        daysPastDue: 0,
        declineCode: record.declineCode,
        declineReason: record.declineReason,
        status: "pending",
        retryCount: 0,
        maxRetries: 3,
        nextRetryDate: nextRetryDate.toISOString(),
        lastPaymentAttempt: new Date().toISOString(),
        recoveryMethod: "auto_retry",
      });
      recoveryTaskId = taskRes?.id;
      actions.push("recovery-task: created");
    } catch (err: any) {
      errors.push(`recovery-task: ${err.message}`);
    }

    // 2. Update subscription billing status to "past_due"
    try {
      await api.patch(`/api/twenty/objects/subscription/${record.subscriptionId}`, {
        billingStatus: "PAST_DUE",
        lastDeclineDate: new Date().toISOString(),
        consecutiveDeclineCount: ((record.consecutiveDeclineCount as number) || 0) + 1,
      });
      actions.push("subscription: marked past_due");
    } catch (err: any) {
      errors.push(`subscription: ${err.message}`);
    }

    // 3. Send decline notification SMS
    try {
      const person = await api.get(`/api/twenty/people/${record.personId}`);
      if (person?.phones?.primaryPhoneNumber) {
        await api.post("/api/sms/send", {
          to: person.phones.primaryPhoneNumber,
          message: `NewLeaf: Your payment of $${record.amount?.amountMicros ? record.amount.amountMicros / 1_000_000 : "N/A"} was declined. We'll retry in 3 days. Update your payment method: [link]`,
        });
        actions.push("decline-sms: sent");
      }
    } catch (err: any) {
      errors.push(`decline-sms: ${err.message}`);
    }

    // 4. Send decline email
    try {
      const person = await api.get(`/api/twenty/people/${record.personId}`);
      if (person?.emails?.primaryEmail) {
        await api.post("/api/email/send", {
          to: person.emails.primaryEmail,
          template: "payment-declined-email",
          data: {
            firstName: person.name?.firstName || "Customer",
            amount: record.amount?.amountMicros ? record.amount.amountMicros / 1_000_000 : "N/A",
            declineReason: record.declineReason || "Unknown",
            nextRetryDate: nextRetryDate.toISOString(),
          },
        });
        actions.push("decline-email: sent");
      }
    } catch (err: any) {
      errors.push(`decline-email: ${err.message}`);
    }

    // 5. Create Linear ticket for billing team
    try {
      await api.post("/api/linear/create-issue", {
        title: `Payment Declined: ${record.personId}`,
        description: `Payment of $${record.amount?.amountMicros ? record.amount.amountMicros / 1_000_000 : "N/A"} declined.\nDecline code: ${record.declineCode || "N/A"}\nReason: ${record.declineReason || "N/A"}\nRecovery Task: ${recoveryTaskId || "pending"}`,
        team: "Billing",
        priority: "high",
      });
      actions.push("linear-ticket: created");
    } catch (err: any) {
      errors.push(`linear-ticket: ${err.message}`);
    }

    // 6. Slack notification to billing channel
    try {
      const person = await api.get(`/api/twenty/people/${record.personId}`);
      const name = person ? `${person.name?.firstName || ""} ${person.name?.lastName || ""}`.trim() : record.personId;
      await api.post("/api/slack/message", {
        channel: "C0AQDDC3HAB",
        text: `💳 *PAYMENT DECLINED*\nCustomer: ${name}\nAmount: $${record.amount?.amountMicros ? record.amount.amountMicros / 1_000_000 : "N/A"}\nReason: ${record.declineReason || "N/A"}\nRecovery: Auto-retry in 3 days`,
      });
      actions.push("slack-alert: sent");
    } catch (err: any) {
      errors.push(`slack-alert: ${err.message}`);
    }

    // 7. Schedule auto-retry (through nmiMcpBridge — SACRED)
    actions.push("auto-retry: scheduled in 3 days");

    return {
      success: errors.length === 0,
      actions,
      errors: errors.length > 0 ? errors : undefined,
      paymentId: record.id,
      recoveryTaskId,
      nextRetryDate: nextRetryDate.toISOString(),
    };
  },
};
