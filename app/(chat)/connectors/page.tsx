/**
 * Connectors Page — dynamic grid of connector cards from registry.
 */
import { auth } from "@/app/(auth)/auth";
import { initConnectors, manifests } from "@/lib/connectors/init";
import { ConnectorsClient } from "./client";

export default async function ConnectorsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="p-8 text-muted-foreground">
        Sign in to manage connectors.
      </div>
    );
  }

  // Ensure registry is populated (server-side)
  initConnectors();

  const connectors = manifests.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    iconName: m.icon.displayName || m.name,
    brandColor: m.brandColor,
    capabilities: m.capabilities.length,
    envKeys: m.envKeys,
    status: m.getStatus(),
  }));

  const counts = {
    total: connectors.length,
    connected: connectors.filter((c) => c.status.connected).length,
    notConfigured: connectors.filter((c) => !c.status.connected).length,
  };

  return <ConnectorsClient connectors={connectors} counts={counts} />;
}
