/**
 * Change Log — Twenty Custom Object
 * Phase 41: Support + Communications
 *
 * Audit trail of changes to customer records.
 */

import { defineObject } from "@twenty-crm/api";

export const changeLog = defineObject({
  nameSingular: "ChangeLog", namePlural: "ChangeLogs",
  labelSingular: "Change Log", labelPlural: "Change Logs",
  description: "Audit log of record changes", icon: "IconHistory",
  fields: {
    entityType: { type: "text", label: "Entity Type" },
    entityId: { type: "text", label: "Entity ID" },
    action: { type: "select", label: "Action",
      options: [
        { value: "created", label: "Created", color: "green" },
        { value: "updated", label: "Updated", color: "blue" },
        { value: "deleted", label: "Deleted", color: "red" },
        { value: "synced", label: "Synced", color: "purple" },
      ],
    },
    fieldName: { type: "text", label: "Field Changed" },
    oldValue: { type: "text", label: "Old Value" },
    newValue: { type: "text", label: "New Value" },
    changedBy: { type: "text", label: "Changed By (agent/system)" },
    source: { type: "text", label: "Source (chat, twenty, base44, n8n)" },
    // Relations: person
  },
});
