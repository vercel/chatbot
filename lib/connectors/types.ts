/**
 * Phase 24: Connector Layout Types
 *
 * Universal connector card type definitions.
 */

import type React from "react";

export interface CardTypeLayout {
  inline: {
    fields: string[];
    badges: string[];
    layout: string;
  };
  expanded: {
    sections: string[];
  };
  canvas: {
    sections: string[];
  };
}

export interface ConnectorLayout {
  connector: string;
  icon: string;
  accentColor: string;
  cardTypes: Record<string, CardTypeLayout>;
}

export interface ConnectorLayoutFile extends ConnectorLayout {
  _path?: string;
}

export type CardState = "inline" | "expanded" | "canvas";

export interface ConnectorEntry {
  id: string;
  name: string;
  manifest: ConnectorManifest;
  status?: string;
  health?: Record<string, unknown>;
  toolCount?: number;
  envCount?: number;
  configuredCount?: number;
}

export interface ConnectorCardData {
  connector: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ConnectorCardProps {
  connector: string;
  type: string;
  data: Record<string, unknown>;
  state?: CardState;
  onStateChange?: (state: CardState) => void;
  className?: string;
}

/** Connector manifest type used by connector manifest.ts files */
export interface ConnectorManifest {
  id: string;
  name: string;
  version?: string;
  description: string;
  icon: string | React.ComponentType<any> | (() => React.ReactNode);
  accentColor?: string;
  brandColor?: string;
  category?: string;
  colorScheme?: Record<string, string>;
  envKeys?: string[];
  capabilities?: Array<{ id: string; label: string; description: string; icon?: string; displayPriority?: number; schema?: Record<string, unknown> }>;
  toolModule?: () => Promise<Record<string, unknown>>;
  resultRenderers?: Record<string, unknown>;
  playbookPath?: string;
  docs?: string | { official: string; ourGuide?: string };
  surface?: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (...args: unknown[]) => unknown;
  }>;
  actions?: Record<string, (...args: unknown[]) => unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  getStatus?: () => { connected: boolean; message?: string };
  health?: Record<string, unknown>;
  [key: string]: unknown;
}
