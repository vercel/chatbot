/**
 * Agent Task — Twenty Custom Object
 * Phase 41: Support + Communications
 */

import { defineObject } from "@twenty-crm/api";

export const agentTask = defineObject({
  nameSingular: "AgentTask", namePlural: "AgentTasks",
  labelSingular: "Agent Task", labelPlural: "Agent Tasks",
  description: "Task assigned to agent (JarvisTask bridge)", icon: "IconChecklist",
  fields: {
    title: { type: "text", label: "Title" },
    description: { type: "text", label: "Description" },
    status: { type: "select", label: "Status",
      options: [
        { value: "todo", label: "To Do", color: "gray" },
        { value: "in_progress", label: "In Progress", color: "blue" },
        { value: "done", label: "Done", color: "green" },
        { value: "blocked", label: "Blocked", color: "red" },
      ],
      defaultValue: "todo",
    },
    priority: { type: "select", label: "Priority",
      options: [
        { value: "low", label: "Low", color: "gray" },
        { value: "medium", label: "Medium", color: "yellow" },
        { value: "high", label: "High", color: "orange" },
        { value: "urgent", label: "Urgent", color: "red" },
      ],
      defaultValue: "medium",
    },
    dueDate: { type: "datetime", label: "Due Date" },
    completedAt: { type: "datetime", label: "Completed At" },
    resolution: { type: "text", label: "Resolution" },
    jarvisTaskId: { type: "text", label: "JarvisTask ID" },
    source: { type: "select", label: "Source",
      options: [
        { value: "slack", label: "Slack", color: "green" },
        { value: "manual", label: "Manual", color: "blue" },
        { value: "auto", label: "Automated", color: "purple" },
        { value: "mission", label: "Mission", color: "teal" },
      ],
    },
    // Relations: person, assignee (WorkspaceMember)
  },
});
