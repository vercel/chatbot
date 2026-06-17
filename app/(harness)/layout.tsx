/**
 * (harness) Route Group Layout
 *
 * Phase 29: Neptune Command Center UI
 * Full-bleed layout — NO sidebar, NO top nav, NO chat layout.
 * All chrome is inside the /command-center page itself.
 *
 * Auth: This layout does NOT wrap children in auth providers.
 * Each page handles its own auth gating.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Command Center — Neptune",
  description: "Neptune Command Center with embedded Twenty CRM + AI Chat",
};

export default function HarnessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      id="harness-root"
      className="h-dvh w-full overflow-hidden bg-background"
    >
      {children}
    </div>
  );
}
