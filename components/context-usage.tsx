'use client';

import { memo } from 'react';
import { useTokenUsage } from '@/hooks/use-token-usage';
import { isProductionEnvironment } from '@/lib/constants';
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextCacheUsage,
} from '@/components/ai-elements/context';

interface ContextUsageProps {
  className?: string;
  modelId?: string;
  maxTokens?: number;
}

function PureContextUsage({
  className,
  modelId = 'anthropic:claude-sonnet-4-6',
  maxTokens = 200000,
}: ContextUsageProps) {
  const tokenUsage = useTokenUsage();

  if (isProductionEnvironment) return null;
  if (tokenUsage.currentInputTokens <= 0) return null;

  return (
    <Context
      maxTokens={maxTokens}
      usedTokens={tokenUsage.currentInputTokens}
      usage={{
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.inputTokens + tokenUsage.outputTokens,
        cachedInputTokens: tokenUsage.cachedInputTokens,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: tokenUsage.cachedInputTokens || undefined,
          cacheWriteTokens: undefined,
        },
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
      }}
      modelId={modelId}
    >
      <ContextTrigger className={`h-5 px-1.5 text-[10px] gap-1 ${className ?? ''}`} />
      <ContextContent align="end" className="min-w-48">
        <ContextContentHeader className="p-2" />
        <ContextContentBody className="p-2 space-y-1">
          <ContextInputUsage />
          <ContextOutputUsage />
          <ContextCacheUsage />
        </ContextContentBody>
        <ContextContentFooter className="p-2" />
      </ContextContent>
    </Context>
  );
}

export const ContextUsage = memo(PureContextUsage);
