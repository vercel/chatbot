/**
 * onEnrollmentActive — Twenty Workflow Code Node
 * Phase 39 Stream 3: Enrollment completion → create subscription + agreement.
 *
 * Trigger: person.updated.enrollmentStatus = "active"
 * Actions: Create NMI subscription, generate agreement, send welcome sequence,
 *          create 7-day follow-up task, update lead status, Slack celebration.
 */
export const onEnrollmentActive = {
  id: "neptune-on-enrollment-active",
  name: "On Enrollment Active",
  trigger: "person.updated.enrollmentStatus",
  condition: "record.enrollmentStatus === 'active' || record.enrollmentStatus === 'ACTIVE'",
  description: "Runs when a customer completes enrollment",

  async execute({ record, previousRecord, api }: {
    record: any;
    previousRecord: any;
    api: any;
  }) {
    const actions: string[] = [];
    const errors: string[] = [];
    const personName = `${record.name?.firstName || "Customer"} ${record.name?.lastName || ""}`.trim();

    // 1. Create NMI subscription (if vault exists)
    if (record.nmiVaultId) {
      try {
        await api.post("/api/nmi/subscription/create", {
          vaultId: record.nmiVaultId,
          amount: record.paymentAmount || record.monthlyCharge || 149.00,
          frequency: record.paymentFrequency || "MONTHLY",
          startDate: new Date().toISOString(),
          description: `NewLeaf ${record.subscriptionPlan || "Standard"} Plan - ${personName}`,
        });
        actions.push("nmi-subscription: created");
      } catch (err: any) {
        errors.push(`nmi-subscription: ${err.message}`);
      }
    } else {
      actions.push("nmi-subscription: skipped (no vault ID)");
    }

    // 2. Generate enrollment agreement
    try {
      await api.post("/api/documents/generate", {
        template: "enrollment-agreement",
        personId: record.id,
        data: {
          name: personName,
          plan: record.subscriptionPlan || "Standard",
          amount: record.paymentAmount || 149.00,
          signedAt: new Date().toISOString(),
          ipAddress: record.ipAddress || "0.0.0.0",
        },
      });
      actions.push("agreement: generated");
    } catch (err: any) {
      errors.push(`agreement: ${err.message}`);
    }

    // 3. Send welcome email
    if (record.emails?.primaryEmail) {
      try {
        await api.post("/api/email/send", {
          to: record.emails.primaryEmail,
          template: "welcome-enrolled-email",
          data: { firstName: record.name?.firstName, planName: record.subscriptionPlan },
        });
        actions.push("welcome-email: sent");
      } catch (err: any) {
        errors.push(`welcome-email: ${err.message}`);
      }
    }

    // 4. Send welcome SMS
    if (record.phones?.primaryPhoneNumber) {
      try {
        await api.post("/api/sms/send", {
          to: record.phones.primaryPhoneNumber,
          message: `🎉 Congratulations ${record.name?.firstName}! Your enrollment is complete. We'll start working on your credit right away.`,
        });
        actions.push("welcome-sms: sent");
      } catch (err: any) {
        errors.push(`welcome-sms: ${err.message}`);
      }
    }

    // 5. Create 7-day follow-up agent task
    try {
      const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await api.post("/api/twenty/objects/agentTask", {
        title: `7-day follow-up: ${personName}`,
        description: "Check in with newly enrolled customer. Verify:\n- Welcome email received\n- Payment method working\n- No questions or concerns",
        status: "todo",
        priority: "medium",
        dueDate: followUpDate.toISOString(),
        assignedTo: record.enrollmentAgentId || record.agentEmail,
        source: "auto",
      });
      actions.push("follow-up-task: created");
    } catch (err: any) {
      errors.push(`follow-up-task: ${err.message}`);
    }

    // 6. Update lead status to enrolled
    try {
      await api.post("/api/twenty/leads/update-by-person", {
        personId: record.id,
        update: {
          status: "enrolled",
          pipelineStage: "enrolled",
          enrolledAt: new Date().toISOString(),
        },
      });
      actions.push("lead-status: updated to enrolled");
    } catch (err: any) {
      // Lead may not exist — not critical
      actions.push("lead-status: skipped (no lead found)");
    }

    // 7. Slack celebration
    try {
      await api.post("/api/slack/message", {
        channel: "C0AQDDC3HAB",
        text: `🎉 *${personName}* JUST ENROLLED! 🎉\nPlan: ${record.subscriptionPlan || "Standard"} | Amount: $${record.paymentAmount || "149.00"}/mo\nAgent: ${record.enrollmentAgentId || "N/A"}`,
      });
      actions.push("slack-celebration: sent");
    } catch (err: any) {
      errors.push(`slack-celebration: ${err.message}`);
    }

    // 8. Sync enrollment to Base44
    try {
      await api.post("/api/twenty-sync", {
        customerIds: [record.base44Id || record.externalId],
        objects: ["person", "subscription"],
      });
      actions.push("base44-sync: completed");
    } catch (err: any) {
      errors.push(`base44-sync: ${err.message}`);
    }

    return {
      success: errors.length === 0,
      actions,
      errors: errors.length > 0 ? errors : undefined,
      personId: record.id,
      enrollmentDate: new Date().toISOString(),
    };
  },
};
