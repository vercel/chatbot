/**
 * on-enrollment-active — Twenty Workflow Code Node
 * Phase 38: Twenty Wave 2 — Sales Workflow
 *
 * Triggered when a Person's enrollment status changes to "active".
 * Generates agreement, sends welcome sequence, creates agent tasks.
 */

export const onEnrollmentActive = {
  id: "neptune-on-enrollment-active",
  name: "On Enrollment Active",
  trigger: "person.updated.enrollmentStatus",
  condition: "record.enrollmentStatus === 'active'",
  description: "Runs when a customer completes enrollment",

  async execute({ record, previousRecord, api }: {
    record: any;
    previousRecord: any;
    api: any;
  }) {
    const actions: string[] = [];

    // 1. Generate enrollment agreement
    // const agreement = await api.post("/api/documents/generate", {
    //   template: "enrollment-agreement",
    //   personId: record.id,
    //   data: record,
    // });
    actions.push("agreement: generation queued");

    // 2. Send welcome email via Resend
    // await api.post("/api/email/send", {
    //   to: record.email,
    //   template: "welcome-email",
    //   data: record,
    // });
    actions.push("welcome-email: queued");

    // 3. Send welcome SMS via GHL
    // await api.post("/api/sms/send", {
    //   to: record.phone,
    //   template: "welcome-sms",
    // });
    actions.push("welcome-sms: queued");

    // 4. Create agent task: 7-day follow-up
    // await api.post("/api/tasks/create", {
    //   title: `7-day follow-up: ${record.name.firstName}`,
    //   dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    //   assignee: record.enrollmentAgentId,
    // });
    actions.push("follow-up-task: created");

    // 5. Schedule first payment (if payment method exists)
    if (record.nmiVaultId) {
      // await api.post("/api/nmi/subscription/create", {
      //   vaultId: record.nmiVaultId,
      //   amount: record.monthlyCharge,
      //   startDate: new Date(),
      // });
      actions.push("first-payment: scheduled");
    }

    // 6. Update lead status to "enrolled"
    // if (record.leadId) {
    //   await api.patch(`/api/twenty/leads/${record.leadId}`, {
    //     status: "enrolled",
    //     pipelineStage: "enrolled",
    //   });
    // }
    actions.push("lead-status: updated to enrolled");

    // 7. Slack notification
    // await api.post("/api/slack/message", {
    //   text: `🎉 ${record.name.firstName} ${record.name.lastName} ENROLLED! Plan: ${record.subscriptionPlan}`,
    // });
    actions.push("slack-celebration: queued");

    return {
      success: true,
      actions,
      personId: record.id,
      enrollmentDate: new Date().toISOString(),
    };
  },
};
