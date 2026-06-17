/**
 * Phase 24: Connector Layout Types
 *
 * Universal connector card type definitions.
 */

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
