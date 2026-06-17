/**
 * on-person-created — Twenty Workflow Code Node
 * Phase 37+: Twenty Wave 1 — Lead Migration
 *
 * Triggered when a new Person is created in Twenty CRM.
 * Creates Base44 sync, sends Slack notification, queues welcome.
 */

export const onPersonCreated = {
  id: "neptune-on-person-created",
  name: "On Person Created",
  trigger: "person.created",
  description: "Runs when a new person record is created in Twenty",

  async execute({ record, workspace, api }: {
    record: any;
    workspace: any;
    api: any;
  }) {
    // SCAFFOLD — Phase 37 fills in actual implementation

    const actions: string[] = [];

    // 1. Sync to Base44 (bidirectional bridge)
    // await api.post("/api/base44/sync/inbound", {
    //   source: "twenty",
    //   action: "created",
    //   entity: "person",
    //   record,
    // });
    actions.push("base44-sync: queued");

    // 2. If lead source is Haley AI → log conversion
    if (record.leadSource === "haley_ai") {
      // await api.post("/api/reporting/hub", {
      //   event: "haley_lead_converted",
      //   personId: record.id,
      // });
      actions.push("haley-conversion: tracked");
    }

    // 3. Slack notification to #jarvis-admin
    // await api.post("/api/slack/message", {
    //   channel: "C0AQDDC3HAB",
    //   text: `🆕 New person created: ${record.name.firstName} ${record.name.lastName}`,
    // });
    actions.push("slack-notification: queued");

    // 4. If enrollment active → trigger enrollment workflow
    if (record.enrollmentStatus === "active") {
      // await api.post("/api/n8n/trigger/enrollment-active", { personId: record.id });
      actions.push("enrollment-workflow: queued");
    }

    return {
      success: true,
      actions,
      personId: record.id,
    };
  },
};
