/**
 * Connector auto-init — registers all connector manifests at import time.
 * Also exports dynamic connector discovery (server-only via init-server.ts).
 *
 * U2.2: Connector folders moved from ./<name>/ to ../../connectors/<name>/
 */

import affyManifest from "../../connectors/affy/manifest";
import base44Manifest from "../../connectors/base44/manifest";
import forthManifest from "../../connectors/forth/manifest";
import ghlManifest from "../../connectors/ghl/manifest";
import githubManifest from "../../connectors/github/manifest";
import hyperswitchManifest from "../../connectors/hyperswitch/manifest";
import linearManifest from "../../connectors/linear/manifest";
import mcpHubManifest from "../../connectors/mcp-hub/manifest";
import nmiManifest from "../../connectors/nmi/manifest";
import { registerConnector } from "./registry";
import slackManifest from "../../connectors/slack/manifest";
import vapiManifest from "../../connectors/vapi/manifest";
import vercelManifest from "../../connectors/vercel/manifest";
import wikiManifest from "../../connectors/wiki/manifest";

const manifests = [
  slackManifest,
  nmiManifest,
  base44Manifest,
  hyperswitchManifest,
  linearManifest,
  githubManifest,
  forthManifest,
  vapiManifest,
  mcpHubManifest,
  wikiManifest,
  ghlManifest,
  affyManifest,
  vercelManifest,
];

let initialized = false;

export function initConnectors(): void {
  if (initialized) return;
  for (const m of manifests) {
    registerConnector(m);
  }
  initialized = true;
}

export { manifests };

/**
 * List ALL connector names — dynamically enriched by server-side scan.
 * In the client, this only returns TypeScript manifest names.
 * The server uses init-server.ts to add skills/connectors/ directory names.
 */
export function getAllConnectorNames(): string[] {
  return manifests.map((m) => m.id);
}
