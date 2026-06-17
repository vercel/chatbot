/**
 * Phase 24: Connector Layouts Loader
 *
 * Loads all layout.json files from connector-skills/ at build time.
 * Exports getConnectorLayout(connector, type, state) for universal card rendering.
 *
 * SAFE FOR CLIENT COMPONENTS: uses try-catch for fs imports so it doesn't break
 * when used in the browser. Returns empty defaults when fs is unavailable.
 */

import type { ConnectorLayout, ConnectorLayoutFile, CardTypeLayout, CardState } from "./types";

const CONNECTOR_SKILLS_DIR = "connectors/neptune/skills/custom-skills/playbook-skills/connector-skills";

const DEFAULT_LAYOUT: Partial<ConnectorLayout> = {
  icon: "🔌",
  accentColor: "#6b7280",
  cardTypes: {
    _default: {
      inline: { fields: [], badges: [], layout: "compact-default" },
      expanded: { sections: ["details"] },
      canvas: { sections: ["details"] },
    },
  },
};

// ── Cache ──────────────────────────────────────────────────────────────

let _layoutsCache: Map<string, ConnectorLayout> | null = null;

function getAllLayouts(): Map<string, ConnectorLayout> {
  if (_layoutsCache) return _layoutsCache;

  const layouts = new Map<string, ConnectorLayout>();

  // fs is only available server-side; skip in browser
  if (typeof window !== "undefined") {
    _layoutsCache = layouts;
    return layouts;
  }

  try {
    // Dynamic require to avoid bundling fs in client
    const { readdirSync, existsSync, readFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");

    const skillsDir = join(process.cwd(), CONNECTOR_SKILLS_DIR);

    if (!existsSync(skillsDir)) {
      console.warn("[connector-layouts] connector-skills/ directory not found");
      _layoutsCache = layouts;
      return layouts;
    }

    const entries = readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const layoutPath = join(skillsDir, entry.name, "layout.json");
      if (!existsSync(layoutPath)) {
        console.warn(`[connector-layouts] No layout.json for ${entry.name}`);
        continue;
      }

      try {
        const raw = readFileSync(layoutPath, "utf-8");
        const layout: ConnectorLayoutFile = JSON.parse(raw);
        layout._path = layoutPath;
        layouts.set(layout.connector, layout);
      } catch (err) {
        console.warn(
          `[connector-layouts] Failed to parse ${layoutPath}:`,
          (err as Error).message
        );
      }
    }
  } catch {
    // fs not available (browser) — return empty
    console.warn("[connector-layouts] fs not available, returning empty layouts");
  }

  _layoutsCache = layouts;
  return layouts;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Get the layout for a specific connector.
 * Returns the layout or undefined if not found.
 */
export function getConnectorLayout(
  connector: string
): ConnectorLayout | undefined {
  return getAllLayouts().get(connector);
}

/**
 * Get the card type layout for a specific connector + type.
 * Falls back to _default or returns a minimal fallback.
 */
export function getCardTypeLayout(
  connector: string,
  type: string
): CardTypeLayout {
  const layout = getConnectorLayout(connector);
  if (!layout?.cardTypes[type]) {
    // Try default card type
    const defaultType = layout?.cardTypes._default;
    if (defaultType) return defaultType;
    // Last resort: built-in fallback
    return {
      inline: { fields: Object.keys(layout?.cardTypes ? Object.values(layout.cardTypes)[0]?.inline?.fields || [] : []), badges: [], layout: "compact-default" },
      expanded: { sections: ["details"] },
      canvas: { sections: ["details"] },
    };
  }
  return layout.cardTypes[type];
}

/**
 * Get layout for a specific state.
 */
export function getLayoutForState(
  connector: string,
  type: string,
  state: CardState
): Pick<CardTypeLayout, "inline" | "expanded" | "canvas">[CardState] {
  const ct = getCardTypeLayout(connector, type);
  return ct[state];
}

/**
 * List all available connectors (from layout.json files).
 */
export function listConnectors(): string[] {
  return Array.from(getAllLayouts().keys());
}

/**
 * Get all card types for a connector.
 */
export function getConnectorCardTypes(
  connector: string
): Array<{ type: string; label: string }> {
  const layout = getConnectorLayout(connector);
  if (!layout) return [];
  return Object.entries(layout.cardTypes)
    .filter(([key]) => key !== "_default")
    .map(([type]) => ({ type, label: type }));
}

/**
 * Validate a layout object against the expected schema.
 * Returns array of validation errors (empty = valid).
 */
export function validateLayout(layout: ConnectorLayout): string[] {
  const errors: string[] = [];

  if (!layout.connector) errors.push("Missing 'connector' field");
  if (!layout.icon) errors.push("Missing 'icon' field");
  if (!layout.accentColor) errors.push("Missing 'accentColor' field");
  if (!layout.cardTypes || Object.keys(layout.cardTypes).length === 0) {
    errors.push("Missing or empty 'cardTypes' object");
  }

  for (const [type, ct] of Object.entries(layout.cardTypes)) {
    if (!ct.inline) errors.push(`cardTypes.${type}: missing 'inline'`);
    else {
      if (!Array.isArray(ct.inline.fields))
        errors.push(`cardTypes.${type}.inline: missing 'fields' array`);
      if (!Array.isArray(ct.inline.badges))
        errors.push(`cardTypes.${type}.inline: missing 'badges' array`);
    }
    if (!ct.expanded || !Array.isArray(ct.expanded.sections)) {
      errors.push(`cardTypes.${type}: missing or invalid 'expanded.sections'`);
    }
    if (!ct.canvas || !Array.isArray(ct.canvas.sections)) {
      errors.push(`cardTypes.${type}: missing or invalid 'canvas.sections'`);
    }
  }

  return errors;
}

/**
 * Invalidate cache (for hot module reload scenarios).
 */
export function invalidateLayoutCache(): void {
  _layoutsCache = null;
}
