/**
 * GET /api/function-trace?function=<name>
 *
 * U2.4.C — Trace a function through the 4-dimensional DAG.
 * Given a function name, returns:
 *   - The parent connector + skill
 *   - All associated playbooks
 *   - Intent tags for intent matching
 *   - Connected playbooks' routines that reference this function
 *   - Reverse map: which other functions share this playbook
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CWD = process.cwd();

interface FunctionEntry {
  function_name: string;
  execution_signature: string;
  runtime_type: string;
  parent_connector: string;
  parent_skill: string;
  associated_playbooks: string[];
  intent_tags: string[];
  category: string;
}

interface MasterRegistry {
  functions: FunctionEntry[];
}

function loadRegistry(): MasterRegistry | null {
  const p = join(CWD, "functions", "master-registry.json");
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const registry = loadRegistry();
  if (!registry) {
    return NextResponse.json(
      { error: "Master registry not found" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const functionName = searchParams.get("function");

  if (!functionName) {
    return NextResponse.json(
      { error: "Missing required param: function" },
      { status: 400 }
    );
  }

  // Find the function
  const fn = registry.functions.find((f) => f.function_name === functionName);
  if (!fn) {
    return NextResponse.json(
      {
        error: `Function '${functionName}' not found in registry`,
        suggestion: "Use /api/function-registry?search=<term> to find functions",
      },
      { status: 404 }
    );
  }

  // Find sibling functions (same connector)
  const siblings = registry.functions
    .filter((f) => f.parent_connector === fn.parent_connector && f.function_name !== fn.function_name)
    .map((f) => f.function_name);

  // Find functions in other connectors that share playbooks
  const crossConnectorFunctions = registry.functions
    .filter(
      (f) =>
        f.parent_connector !== fn.parent_connector &&
        f.associated_playbooks.some((pb) => fn.associated_playbooks.includes(pb))
    )
    .map((f) => ({
      function_name: f.function_name,
      parent_connector: f.parent_connector,
      shared_playbooks: f.associated_playbooks.filter((pb) =>
        fn.associated_playbooks.includes(pb)
      ),
    }));

  // Try to find playbook routines that reference this function
  const playbookRoutines: Array<{ playbook: string; routineMatch: string }> = [];
  for (const pbRef of fn.associated_playbooks) {
    const pbPath = join(CWD, pbRef, `playbook-${pbRef.split("/")[1]}.md`);
    try {
      if (existsSync(pbPath)) {
        const content = readFileSync(pbPath, "utf-8");
        if (content.includes(fn.function_name)) {
          // Extract routine name containing this reference
          const routineMatch = content.match(
            new RegExp(`### Routine:.*\\n([\\s\\S]*?${fn.function_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)###`, 'm')
          );
          if (routineMatch || content.includes(fn.function_name)) {
            // Find the nearest routine header above the reference
            const idx = content.indexOf(fn.function_name);
            const before = content.substring(0, idx);
            const routineHeaders = [...before.matchAll(/### Routine:\s*(.+)/g)];
            if (routineHeaders.length > 0) {
              const lastRoutine = routineHeaders[routineHeaders.length - 1][1];
              playbookRoutines.push({ playbook: pbRef, routineMatch: lastRoutine.trim() });
            }
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return NextResponse.json({
    function: fn,
    trace: {
      parent_connector: fn.parent_connector,
      parent_skill: fn.parent_skill,
      execution_signature: fn.execution_signature,
      associated_playbooks: fn.associated_playbooks,
      playbook_routines_using_function: playbookRoutines,
      siblings_in_connector: siblings.slice(0, 20),
      sibling_count: siblings.length,
      cross_connector_functions: crossConnectorFunctions.slice(0, 10),
      cross_connector_count: crossConnectorFunctions.length,
      intent_tags: fn.intent_tags,
    },
    graph_version: "4d-v1",
  });
}
