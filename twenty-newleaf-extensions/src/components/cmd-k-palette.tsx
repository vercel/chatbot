/**
 * Cmd+K Palette — Twenty defineFrontComponent
 * Phase 38+ — Global command palette for Twenty CRM
 *
 * Provides instant search across customers, views, and actions.
 * Triggered by Cmd+K (or Ctrl+K).
 */

import { defineFrontComponent } from "@twenty-crm/frontend";

export const cmdKPalette = defineFrontComponent({
  id: "neptune-cmd-k-palette",
  name: "Command Palette (Cmd+K)",
  description: "Global command palette for search and quick actions",
  placement: "global-overlay",
  supportedObjects: ["*"],
  icon: "IconCommand",
  component: async ({ query }) => {
    // SCAFFOLD — Phase 38 fills in actual search implementation

    const results: Array<{
      section: string;
      items: Array<{
        label: string;
        description: string;
        action: { type: string; target: string };
      }>;
    }> = [];

    if (!query || query.length < 2) {
      return {
        placeholder: "Search customers, views, or run actions...",
        emptyState: "Type to search...",
        results: [],
      };
    }

    // Mock results
    results.push({
      section: "Customers",
      items: [
        {
          label: `Search for "${query}" in customers...`,
          description: "Find matching customer records",
          action: { type: "navigate", target: `/people?search=${query}` },
        },
      ],
    });

    results.push({
      section: "Go to...",
      items: [
        { label: "Pipeline", description: "Sales pipeline kanban", action: { type: "navigate", target: "/pipeline" } },
        { label: "Billing Calendar", description: "Payment calendar view", action: { type: "navigate", target: "/billing-calendar" } },
        { label: "Agent Dashboard", description: "Agent metrics", action: { type: "navigate", target: "/agent-dashboard" } },
      ],
    });

    results.push({
      section: "Quick Actions",
      items: [
        { label: "Create Lead", description: "Add new sales lead", action: { type: "create", target: "lead" } },
        { label: "Send Payment Link", description: "Generate NMI payment link", action: { type: "modal", target: "payment-link" } },
      ],
    });

    return { results };
  },
});
