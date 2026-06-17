/**
 * Lead — Twenty Custom Object
 * Phase 37: Twenty Wave 1 — Lead + VAPI Call Migration
 *
 * Tracks sales leads from Haley AI, Slack submissions, and manual entry.
 * Links to Person for converted leads.
 */

import { defineObject } from "@twenty-crm/api";

export const lead = defineObject({
  nameSingular: "Lead",
  namePlural: "Leads",
  labelSingular: "Lead",
  labelPlural: "Leads",
  description: "Sales lead before enrollment",
  icon: "IconTarget",
  fields: {
    source: {
      type: "select",
      label: "Source",
      options: [
        { value: "haley_ai", label: "Haley AI", color: "blue" },
        { value: "slack", label: "Slack Submission", color: "green" },
        { value: "referral", label: "Referral", color: "purple" },
        { value: "ads", label: "Ads", color: "orange" },
        { value: "organic", label: "Organic", color: "teal" },
        { value: "manual", label: "Manual", color: "gray" },
      ],
      defaultValue: "manual",
    },
    status: {
      type: "select",
      label: "Status",
      options: [
        { value: "new", label: "New", color: "blue" },
        { value: "contacted", label: "Contacted", color: "yellow" },
        { value: "consultation", label: "Consultation Scheduled", color: "orange" },
        { value: "proposal", label: "Proposal Sent", color: "purple" },
        { value: "negotiation", label: "Negotiation", color: "pink" },
        { value: "enrolled", label: "Enrolled", color: "green" },
        { value: "lost", label: "Lost", color: "red" },
      ],
      defaultValue: "new",
    },
    pipelineStage: {
      type: "select",
      label: "Pipeline Stage",
      options: [
        { value: "new_lead", label: "New Lead", color: "blue" },
        { value: "contacted", label: "Contacted", color: "yellow" },
        { value: "in_progress", label: "In Progress", color: "orange" },
        { value: "enrolled", label: "Enrolled", color: "green" },
        { value: "lost", label: "Lost", color: "red" },
      ],
      defaultValue: "new_lead",
    },
    estimatedValue: {
      type: "currency",
      label: "Estimated Monthly Value",
      defaultValue: null,
    },
    creditScoreRange: {
      type: "select",
      label: "Credit Score Range",
      options: [
        { value: "excellent", label: "Excellent (720+)", color: "green" },
        { value: "good", label: "Good (680-719)", color: "teal" },
        { value: "fair", label: "Fair (620-679)", color: "yellow" },
        { value: "poor", label: "Poor (580-619)", color: "orange" },
        { value: "very_poor", label: "Very Poor (<580)", color: "red" },
      ],
    },
    interestLevel: {
      type: "select",
      label: "Interest Level",
      options: [
        { value: "hot", label: "Hot", color: "red" },
        { value: "warm", label: "Warm", color: "orange" },
        { value: "cold", label: "Cold", color: "blue" },
      ],
      defaultValue: "warm",
    },
    lastContactDate: { type: "datetime", label: "Last Contact Date" },
    nextFollowUpDate: { type: "datetime", label: "Next Follow-up Date" },
    notes: { type: "text", label: "Notes" },
    conversionProbability: {
      type: "number",
      label: "Conversion Probability %",
      defaultValue: 0,
    },
    slaLapsed: {
      type: "boolean",
      label: "SLA Lapsed",
      defaultValue: false,
    },
    // Relations filled by Twenty automagically via relation fields
    // person: relation to Person
    // assignedAgent: relation to WorkspaceMember
  },
});

/* SCAFFOLD — Phase 37 fills in:
 * - Automated status transitions
 * - SLA rules (lead must be contacted within 24h)
 * - Haley AI integration (webhook → lead creation)
 * - Slack submission parser (n8n workflow)
 * - Conversion analytics
 */
