/**
 * Call Log — Twenty Custom Object
 * Phase 41: Support + Communications (Freshcaller + manual)
 */

import { defineObject } from "@twenty-crm/api";

export const callLog = defineObject({
  nameSingular: "CallLog", namePlural: "CallLogs",
  labelSingular: "Call Log", labelPlural: "Call Logs",
  description: "Phone call log (Freshcaller + manual)", icon: "IconPhoneCall",
  fields: {
    direction: { type: "select", label: "Direction",
      options: [
        { value: "inbound", label: "Inbound", color: "blue" },
        { value: "outbound", label: "Outbound", color: "green" },
      ],
    },
    durationSeconds: { type: "number", label: "Duration (seconds)" },
    fromNumber: { type: "phone", label: "From" },
    toNumber: { type: "phone", label: "To" },
    status: { type: "select", label: "Status",
      options: [
        { value: "completed", label: "Completed", color: "green" },
        { value: "missed", label: "Missed", color: "red" },
        { value: "voicemail", label: "Voicemail", color: "blue" },
        { value: "busy", label: "Busy", color: "orange" },
      ],
    },
    disposition: { type: "select", label: "Disposition",
      options: [
        { value: "resolved", label: "Resolved", color: "green" },
        { value: "follow_up", label: "Follow Up Needed", color: "yellow" },
        { value: "transferred", label: "Transferred", color: "blue" },
        { value: "no_action", label: "No Action", color: "gray" },
      ],
    },
    recordingUrl: { type: "url", label: "Recording URL" },
    notes: { type: "text", label: "Call Notes" },
    freshcallerId: { type: "text", label: "Freshcaller Call ID" },
    agentName: { type: "text", label: "Agent Name" },
    // Relations: person, vapiCall, supportTicket
  },
});
