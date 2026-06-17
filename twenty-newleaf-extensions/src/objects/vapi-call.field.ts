/**
 * VAPI Call — Twenty Custom Object
 * Phase 37: Twenty Wave 1 — Lead + VAPI Call Migration
 *
 * Tracks voice AI calls made through VAPI.
 * Links to Person for call history.
 */

import { defineObject } from "@twenty-crm/api";

export const vapiCall = defineObject({
  nameSingular: "VapiCall",
  namePlural: "VapiCalls",
  labelSingular: "VAPI Call",
  labelPlural: "VAPI Calls",
  description: "Voice AI call log via VAPI",
  icon: "IconPhone",
  fields: {
    callType: {
      type: "select",
      label: "Call Type",
      options: [
        { value: "outbound", label: "Outbound", color: "blue" },
        { value: "inbound", label: "Inbound", color: "green" },
      ],
    },
    status: {
      type: "select",
      label: "Status",
      options: [
        { value: "queued", label: "Queued", color: "gray" },
        { value: "ringing", label: "Ringing", color: "blue" },
        { value: "in_progress", label: "In Progress", color: "yellow" },
        { value: "completed", label: "Completed", color: "green" },
        { value: "failed", label: "Failed", color: "red" },
        { value: "no_answer", label: "No Answer", color: "orange" },
        { value: "busy", label: "Busy", color: "red" },
        { value: "canceled", label: "Canceled", color: "gray" },
      ],
    },
    durationSeconds: { type: "number", label: "Duration (seconds)" },
    vapiCallId: { type: "text", label: "VAPI Call ID" },
    fromNumber: { type: "phone", label: "From Number" },
    toNumber: { type: "phone", label: "To Number" },
    transcriptUrl: { type: "url", label: "Transcript URL" },
    recordingUrl: { type: "url", label: "Recording URL" },
    outcome: {
      type: "select",
      label: "Outcome",
      options: [
        { value: "interested", label: "Interested", color: "green" },
        { value: "not_interested", label: "Not Interested", color: "red" },
        { value: "call_back", label: "Call Back", color: "yellow" },
        { value: "voicemail", label: "Voicemail", color: "blue" },
        { value: "wrong_number", label: "Wrong Number", color: "orange" },
        { value: "dnc", label: "Do Not Call", color: "red" },
      ],
    },
    cost: { type: "currency", label: "Cost" },
    sentiment: {
      type: "select",
      label: "Sentiment",
      options: [
        { value: "positive", label: "Positive", color: "green" },
        { value: "neutral", label: "Neutral", color: "gray" },
        { value: "negative", label: "Negative", color: "red" },
      ],
    },
    agentName: { type: "text", label: "Agent Name" },
    campaignId: { type: "text", label: "Campaign ID" },
    retryCount: { type: "number", label: "Retry Count", defaultValue: 0 },
    // Relations: person, assignedAgent
  },
});
