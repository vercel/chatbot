/**
 * onAlignmentMisalign — Twenty Workflow Code Node (NEW)
 * Phase 39 Stream 3: Alert agent in Slack when Discovery finds misalignment.
 *
 * Trigger: discovery.alignment.misaligned (from Discovery Engine)
 * Actions: Post detailed alert to Slack #jarvis-admin, create agent task,
 *          update customer record with misalignment flag, log to change log.
 *
 * This closes the loop: Discovery → Insight → Alert → Action.
 */
export const onAlignmentMisalign = {
  id: "neptune-on-alignment-misalign",
  name: "On Alignment Misalignment",
  trigger: "discovery.alignment.misaligned",
  description: "Alerts agents when Discovery finds Slack-CRM-NMI misalignment",

  async execute({ record, api }: { record: any; api: any }) {
    const actions: string[] = [];
    const errors: string[] = [];

    const {
      runId,
      customerId,
      customerName,
      dimension,       // billing | enrollment | agent_promise | documentation
      severity,        // critical | high | medium | low
      score,           // 0.0 - 1.0
      details,         // AlignmentDetail[]
      recommendation,
      evidenceSources, // string[]
    } = record;

    const severityEmoji: Record<string, string> = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🔵",
    };

    const emoji = severityEmoji[severity] || "⚪";

    // 1. Post detailed alert to Slack #jarvis-admin
    try {
      const detailLines = (details || [])
        .slice(0, 5)
        .map((d: any) => `  • ${d.field}: expected "${d.expected}" → got "${d.actual}" (source: ${d.source})`)
        .join("\n");

      const alertText = [
        `${emoji} *MISALIGNMENT DETECTED* — ${severity.toUpperCase()}`,
        `*Customer:* ${customerName || customerId}`,
        `*Dimension:* ${dimension?.replace(/_/g, " ") || "unknown"}`,
        `*Score:* ${score != null ? (score * 100).toFixed(0) + "%" : "N/A"}`,
        "",
        "*Discrepancies:*",
        detailLines || "  No details provided",
        "",
        `*Recommendation:* ${recommendation || "Manual review required"}`,
        "",
        `*Discovery Run:* ${runId || "N/A"}`,
        `*View in CRM:* ${process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial"}/people/${customerId}`,
      ].join("\n");

      await api.post("/api/slack/message", {
        channel: "C0AQDDC3HAB",
        text: alertText,
      });
      actions.push("slack-alert: posted to #jarvis-admin");
    } catch (err: any) {
      errors.push(`slack-alert: ${err.message}`);
    }

    // 2. Create agent task for resolution
    try {
      await api.post("/api/twenty/objects/agentTask", {
        title: `[${severity.toUpperCase()}] Resolve ${dimension} misalignment: ${customerName || customerId}`,
        description: `Discovery run ${runId} found ${dimension} misalignment.\n\n${recommendation || "Review and resolve."}\n\nDetails:\n${JSON.stringify(details?.slice(0, 5), null, 2)}`,
        status: "todo",
        priority: severity === "critical" ? "urgent" : severity === "high" ? "high" : "medium",
        dueDate: severity === "critical"
          ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()  // 4 hours
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        source: "auto",
      });
      actions.push("agent-task: created");
    } catch (err: any) {
      errors.push(`agent-task: ${err.message}`);
    }

    // 3. Update customer record with misalignment flag
    try {
      await api.patch(`/api/twenty/people/${customerId}`, {
        lastMisalignmentAt: new Date().toISOString(),
        lastMisalignmentType: dimension,
        lastMisalignmentSeverity: severity,
        lastDiscoveryRunId: runId,
      });
      actions.push("person-record: updated with misalignment flag");
    } catch (err: any) {
      errors.push(`person-record: ${err.message}`);
    }

    // 4. Create change log entry
    try {
      await api.post("/api/twenty/objects/changeLog", {
        entityType: "Person",
        entityId: customerId,
        action: "updated",
        fieldName: `alignment_${dimension}`,
        oldValue: "aligned",
        newValue: `misaligned (score: ${score}, severity: ${severity})`,
        changedBy: "discovery-engine",
        source: "discovery",
      });
      actions.push("changelog: recorded");
    } catch (err: any) {
      errors.push(`changelog: ${err.message}`);
    }

    // 5. If critical billing misalignment → escalate immediately
    if (severity === "critical" && dimension === "billing") {
      try {
        await api.post("/api/slack/message", {
          channel: "C0AQDDC3HAB",
          text: `🚨 *CRITICAL BILLING ESCALATION*: ${customerName || customerId} — Immediate action required! NMI may still be charging a cancelled customer. Run ID: ${runId}`,
        });
        actions.push("escalation: critical billing alert sent");
      } catch (err: any) {
        errors.push(`escalation: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      actions,
      errors: errors.length > 0 ? errors : undefined,
      customerId,
      runId,
      severity,
      taskCreated: actions.includes("agent-task: created"),
      slackAlerted: actions.includes("slack-alert: posted to #jarvis-admin"),
    };
  },
};
