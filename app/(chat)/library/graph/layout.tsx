import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge Graph Explorer — Neptune Chat",
  description:
    "Visual exploration of the Neptune Chat knowledge graph — connectors, playbooks, panels, and V2 handoffs.",
};

export default function GraphLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
