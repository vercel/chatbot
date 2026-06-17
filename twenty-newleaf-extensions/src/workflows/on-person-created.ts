/**
 * onPersonCreated — Twenty Workflow Code Node
 * Phase 39 Stream 3: Welcome email + SMS on new person creation.
 *
 * Trigger: person.created
 * Actions: Sync to Base44, send welcome email via Resend, send SMS via GHL,
 *          Slack notification, log to audit trail.
 */
export const onPersonCreated = {
  id: "neptune-on-person-created",
  name: "On Person Created",
  trigger: "person.created",
  description: "Runs when a new person record is created in Twenty CRM",

  async execute({ record, api }: { record: any; api: any }) {
    const actions: string[] = [];
    const errors: string[] = [];
    const personName = `${record.name?.firstName || "Unknown"} ${record.name?.lastName || ""}`.trim();

    // 1. Sync to Base44 (bidirectional bridge)
    try {
      await api.post("/api/twenty-sync", {
        customerIds: [record.base44Id || record.externalId],
        objects: ["person"],
      });
      actions.push("base44-sync: completed");
    } catch (err: any) {
      errors.push(`base44-sync: ${err.message}`);
    }

    // 2. Send welcome email via Resend
    if (record.emails?.primaryEmail) {
      try {
        await api.post("/api/email/send", {
          to: record.emails.primaryEmail,
          subject: "Welcome to NewLeaf Financial!",
          template: "welcome-email",
          data: {
            firstName: record.name?.firstName || "there",
            enrollmentStatus: record.enrollmentStatus || "pending",
          },
        });
        actions.push("welcome-email: sent");
      } catch (err: any) {
        errors.push(`welcome-email: ${err.message}`);
      }
    }

    // 3. Send welcome SMS via GHL
    if (record.phones?.primaryPhoneNumber) {
      try {
        await api.post("/api/sms/send", {
          to: record.phones.primaryPhoneNumber,
          message: `Welcome to NewLeaf Financial, ${record.name?.firstName || "there"}! We're excited to help you improve your credit. Reply STOP to opt out.`,
        });
        actions.push("welcome-sms: sent");
      } catch (err: any) {
        errors.push(`welcome-sms: ${err.message}`);
      }
    }

    // 4. Slack notification to #jarvis-admin
    try {
      await api.post("/api/slack/message", {
        channel: "C0AQDDC3HAB",
        text: `🆕 New person created in Twenty: *${personName}* — ${record.emails?.primaryEmail || "no email"} — Status: ${record.status || "NEW"}`,
      });
      actions.push("slack-notification: sent");
    } catch (err: any) {
      errors.push(`slack-notification: ${err.message}`);
    }

    // 5. If enrollment active → trigger enrollment workflow
    if (record.enrollmentStatus === "ACTIVE" || record.enrollmentStatus === "active") {
      try {
        await api.post("/api/twenty/workflows/trigger", {
          workflowId: "neptune-on-enrollment-active",
          recordId: record.id,
        });
        actions.push("enrollment-workflow: triggered");
      } catch (err: any) {
        errors.push(`enrollment-workflow: ${err.message}`);
      }
    }

    // 6. If Haley AI lead source → log conversion
    if (record.leadSource === "haley_ai") {
      try {
        await api.post("/api/reporting/hub", {
          event: "haley_lead_converted",
          personId: record.id,
        });
        actions.push("haley-conversion: tracked");
      } catch (err: any) {
        errors.push(`haley-conversion: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      actions,
      errors: errors.length > 0 ? errors : undefined,
      personId: record.id,
      personName,
    };
  },
};
