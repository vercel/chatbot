/**
 * Phase 24B: UI Schema Loader
 *
 * Reads connector-skills/<name>/ui-schema.yaml files at build time.
 * Caches in memory. Exposes loadUISchema() and loadAllUISchemas().
 *
 * Universal Connector Card (one component) reads these schemas to render
 * any connector without per-connector React code.
 */

import yaml from "js-yaml";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface UISchemaField {
  field: string;
  type: "currency" | "chip" | "badge" | "text" | "trail";
  format?: string;
  colors?: Record<string, string>;
}

export interface UISchema {
  name: string;
  icon: string;
  accentColor: string;
  keyFields: UISchemaField[];
  expandedLayout: string[];
  functions: string[];
}

const SCHEMA_CACHE = new Map<string, UISchema>();

const CONNECTOR_SKILLS_DIR = join(
  process.cwd(),
  "connectors/neptune/skills/custom-skills/playbook-skills/connector-skills"
);

/**
 * Load UI schema for a single connector.
 */
export function loadUISchema(connectorName: string): UISchema | null {
  if (SCHEMA_CACHE.has(connectorName)) return SCHEMA_CACHE.get(connectorName)!;

  try {
    const schemaPath = join(CONNECTOR_SKILLS_DIR, connectorName, "ui-schema.yaml");
    if (!existsSync(schemaPath)) {
      console.warn(`[ui-schema-loader] No ui-schema.yaml for ${connectorName}`);
      return null;
    }
    const content = readFileSync(schemaPath, "utf-8");
    const schema = yaml.load(content) as UISchema;
    SCHEMA_CACHE.set(connectorName, schema);
    return schema;
  } catch (err) {
    console.warn(`[ui-schema-loader] Failed to load ${connectorName}:`, (err as Error).message);
    return null;
  }
}

/**
 * Load all available UI schemas.
 * Returns Record<connectorName, UISchema>.
 */
export function loadAllUISchemas(): Record<string, UISchema> {
  const schemas: Record<string, UISchema> = {};
  // Only works server-side; in browser use cached individual loads
  if (typeof window !== "undefined") return schemas;

  try {
    const { readdirSync } = require("fs") as typeof import("fs");
    const entries = readdirSync(CONNECTOR_SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const schema = loadUISchema(entry.name);
      if (schema) schemas[entry.name] = schema;
    }
  } catch {
    // fs not available (browser) — return empty
  }

  return schemas;
}

/**
 * Invalidate cache (for HMR during development).
 */
export function invalidateSchemaCache(): void {
  SCHEMA_CACHE.clear();
}
