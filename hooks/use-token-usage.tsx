'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface TokenUsage {
  /** Accumulated input tokens across all steps (for cost display) */
  inputTokens: number;
  /** Accumulated output tokens across all steps (for cost display) */
  outputTokens: number;
  /** Accumulated cached input tokens across all steps */
  cachedInputTokens: number;
  /** Latest step's inputTokens — reflects current context-window position */
  currentInputTokens: number;
}

export const defaultTokenUsage: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  currentInputTokens: 0,
};

const TokenUsageContext = createContext<TokenUsage>(defaultTokenUsage);

/** Wrap any subtree that needs to read token usage (e.g. SideChatHeader). */
export function TokenUsageProvider({
  value,
  children,
}: {
  value: TokenUsage;
  children: ReactNode;
}) {
  return (
    <TokenUsageContext.Provider value={value}>
      {children}
    </TokenUsageContext.Provider>
  );
}

/** Read the current accumulated token usage from the nearest provider. */
export function useTokenUsage(): TokenUsage {
  return useContext(TokenUsageContext);
}
