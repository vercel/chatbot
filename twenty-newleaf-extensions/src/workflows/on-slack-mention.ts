/**
 * onSlackMention — Twenty Workflow Code Node (NEW)
 * Phase 39 Stream 3: Auto-open Customer 360 on Slack mention.
 *
 * Trigger: slack.mention (custom webhook from Slack event)
 * Actions: Open Customer 360 in Twenty, log mention, update activity feed.
 *
 * When a customer is mentioned in Slack, this workflow:
 * 1. Finds the matching Person in Twenty
 * 2. Creates an Activity record linking the Slack message
 * 3. Opens the Customer 360 view for rapid agent access
 * 4. Posts a summary to the Slack thread
 */
export const onSlackMention = {
  id: "neptune-on-slack-mention",
  name: "On Slack Mention",
  trigger: "slack.mention",
  description: "Auto-opens Customer 360 when a customer is mentioned in Slack",

  async execute({ record, api }: { record: any; api: any }) {
    const actions: string[] = [];
    const errors: string[] = [];

    const {
      channelId,
      channelName,
      messageTs,
      messageText,
      userId,
      userName,
      extractedCustomerId,
      extractedPhone,
      extractedEmail,
    } = record;

    // 1. Find matching Person in Twenty
    let person: any = null;
    try {
      if (extractedCustomerId) {
        person = await api.get(`/api/twenty/people/${extractedCustomerId}`);
      } else if (extractedPhone) {
        const searchRes = await api.post("/api/twenty/people/search", {
          filter: { phone: { eq: extractedPhone } },
        });
        person = searchRes?.edges?.[0]?.node;
      } else if (extractedEmail) {
        const searchRes = await api.post("/api/twenty/people/search", {
          filter: { email: { eq: extractedEmail } },
        });
        person = searchRes?.edges?.[0]?.node;
      }

      if (person) {
        actions.push(`person-found: ${person.id}`);
      } else {
        actions.push("person-not-found: no match in Twenty");
      }
    } catch (err: any) {
      errors.push(`person-search: ${err.message}`);
    }

    // 2. Create Activity record for the Slack mention
    if (person) {
      try {
        await api.post("/api/twenty/objects/activity", {
          personId: person.id,
          type: "slack_mention",
          title: `Slack mention in #${channelName}`,
          body: messageText?.slice(0, 500) || "Slack mention",
          source: "slack",
          sourceId: `${channelId}:${messageTs}`,
          actor: userName || userId,
          timestamp: messageTs ? new Date(parseFloat(messageTs) * 1000).toISOString() : new Date().toISOString(),
        });
        actions.push("activity: created");
      } catch (err: any) {
        errors.push(`activity: ${err.message}`);
      }

      // 3. Post summary to Slack thread
      try {
        const summary = `🔍 *Customer 360*: ${person.name?.firstName || ""} ${person.name?.lastName || ""}\n` +
          `• Status: ${person.enrollmentStatus || "N/A"}\n` +
          `• Billing: ${person.billingStatus || "N/A"}\n` +
          `• Last Payment: ${person.lastPaymentDate || "N/A"}\n` +
          `• Open Tickets: ${person.openTickets || 0}\n` +
          `• View in CRM: ${process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial"}/people/${person.id}`;

        await api.post("/api/slack/message", {
          channel: channelId,
          threadTs: messageTs,
          text: summary,
        });
        actions.push("slack-summary: posted");
      } catch (err: any) {
        errors.push(`slack-summary: ${err.message}`);
      }
    }

    // 4. Log to change log
    try {
      await api.post("/api/twenty/objects/changeLog", {
        entityType: "SlackMention",
        entityId: `${channelId}:${messageTs}`,
        action: "created",
        fieldName: "mention",
        newValue: person?.id || "no-match",
        changedBy: userName || userId,
        source: "slack",
      });
      actions.push("changelog: recorded");
    } catch (err: any) {
      errors.push(`changelog: ${err.message}`);
    }

    return {
      success: errors.length === 0,
      actions,
      errors: errors.length > 0 ? errors : undefined,
      personId: person?.id,
      customerFound: !!person,
    };
  },
};
