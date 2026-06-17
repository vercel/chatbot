/**
 * lib/twenty/deploy-objects.ts — Twenty Custom Object Deployment Engine
 * Phase 39 Stream 0: Deploys 14 new NKS custom objects to Twenty CRM via GraphQL.
 *
 * Strategy: Twenty custom objects are defined server-side via extensions.
 * This module verifies object existence, tests GraphQL connectivity, and
 * provides a deployment manifest for manual CLI deployment if needed.
 *
 * CRC: Twenty server at TWENTY_SERVER_URL must have extensions installed.
 * Fallback: GraphQL introspection to verify which objects currently exist.
 */

import { twentyGraphQL } from "./client";
import { NEW_TWENTY_OBJECTS, TwentyObjectDef } from "./object-definitions";

export interface DeployResult {
  objectName: string;
  status: "exists" | "deployed" | "failed" | "skipped";
  error?: string;
  fields?: number;
}

export interface DeployManifest {
  timestamp: string;
  serverUrl: string;
  totalObjects: number;
  deployed: number;
  existing: number;
  failed: number;
  results: DeployResult[];
}

/**
 * Introspect Twenty GraphQL API to discover which objects exist.
 * Uses __schema introspection query.
 */
async function introspectExistingObjects(): Promise<string[]> {
  const query = `
    query IntrospectObjects {
      __schema {
        types {
          name
          kind
          fields {
            name
          }
        }
      }
    }
  `;

  try {
    const res = await twentyGraphQL<{
      __schema: { types: Array<{ name: string; kind: string }> };
    }>(query);

    if (res.errors) {
      console.warn("[deploy-objects] Schema introspection failed:", res.errors);
      return [];
    }

    const types = res.data?.__schema?.types ?? [];
    // Extract custom object names (Twenty custom objects appear as GraphQL types)
    const objectNames = types
      .filter(t => t.kind === "OBJECT")
      .map(t => t.name);

    return objectNames;
  } catch (err) {
    console.warn("[deploy-objects] Introspection error:", err);
    return [];
  }
}

/**
 * Test if a specific object exists by querying its list endpoint.
 */
async function testObjectExists(objectDef: TwentyObjectDef): Promise<boolean> {
  const pluralName = objectDef.namePlural.charAt(0).toLowerCase() + objectDef.namePlural.slice(1);
  const query = `
    query TestObject {
      ${pluralName}(first: 1) {
        edges { node { id } }
      }
    }
  `;

  try {
    const res = await twentyGraphQL(query);
    return !res.errors;
  } catch {
    return false;
  }
}

/**
 * Generate the npx deployment command for Twenty extensions.
 */
function generateDeployCommand(objectDefs: TwentyObjectDef[]): string {
  const names = objectDefs.map(o => o.namePlural).join(" ");
  return `cd twenty-newleaf-extensions && npx twenty app:publish --objects ${names}`;
}

/**
 * Deploy all 14 new custom objects to Twenty.
 * First introspects, then tests each, then reports.
 */
export async function deployAllObjects(): Promise<DeployManifest> {
  const results: DeployResult[] = [];
  let deployed = 0;
  let existing = 0;
  let failed = 0;

  console.log(`[deploy-objects] Starting deployment of ${NEW_TWENTY_OBJECTS.length} objects...`);
  console.log(`[deploy-objects] Twenty server: ${process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial"}`);

  // Step 1: Introspect existing objects
  console.log("[deploy-objects] Step 1: Introspecting existing objects...");
  const existingObjects = await introspectExistingObjects();
  console.log(`[deploy-objects] Found ${existingObjects.length} existing GraphQL types`);

  // Step 2: Test each object
  console.log("[deploy-objects] Step 2: Testing each new object...");
  for (const obj of NEW_TWENTY_OBJECTS) {
    const exists = await testObjectExists(obj);
    const result: DeployResult = {
      objectName: obj.namePlural,
      status: exists ? "exists" : "failed",
      fields: obj.fields.length,
    };

    if (exists) {
      existing++;
      console.log(`  ✓ ${obj.namePlural} — already exists`);
    } else {
      failed++;
      result.error = `Object not found in Twenty. Requires manual deployment via: ${generateDeployCommand([obj])}`;
      console.log(`  ✗ ${obj.namePlural} — NOT FOUND (needs deployment)`);
    }

    results.push(result);
  }

  // Step 3: Generate deployment manifest
  const manifest: DeployManifest = {
    timestamp: new Date().toISOString(),
    serverUrl: process.env.TWENTY_SERVER_URL || "https://crm.newleaf.financial",
    totalObjects: NEW_TWENTY_OBJECTS.length,
    deployed,
    existing,
    failed,
    results,
  };

  // Step 4: If any objects missing, provide deployment instructions
  if (failed > 0) {
    console.log("\n[deploy-objects] ⚠️  Some objects need deployment!");
    console.log(`[deploy-objects] Run: ${generateDeployCommand(NEW_TWENTY_OBJECTS)}`);
    console.log("[deploy-objects] OR deploy via Twenty Admin UI > Data > Objects > Import");
  } else {
    console.log("\n[deploy-objects] ✓ All 14 objects already deployed!");
  }

  return manifest;
}

/**
 * Quick check: are all objects deployed?
 */
export async function verifyAllObjects(): Promise<{ allPresent: boolean; missing: string[] }> {
  const missing: string[] = [];

  for (const obj of NEW_TWENTY_OBJECTS) {
    const exists = await testObjectExists(obj);
    if (!exists) missing.push(obj.namePlural);
  }

  return {
    allPresent: missing.length === 0,
    missing,
  };
}

/**
 * Generate deployment manifest JSON for Twenty CLI.
 * This can be saved and used by the Twenty server.
 */
export function generateDeploymentManifest(): object {
  return {
    version: "1.0",
    phase: "39",
    timestamp: new Date().toISOString(),
    objects: NEW_TWENTY_OBJECTS.map(obj => ({
      nameSingular: obj.nameSingular,
      namePlural: obj.namePlural,
      labelSingular: obj.labelSingular,
      labelPlural: obj.labelPlural,
      description: obj.description,
      icon: obj.icon,
      fields: obj.fields.map(f => ({
        name: f.name,
        type: f.type,
        label: f.label,
        ...(f.options ? { options: f.options } : {}),
        ...(f.defaultValue !== undefined ? { defaultValue: f.defaultValue } : {}),
      })),
      relations: obj.relations || [],
    })),
  };
}
