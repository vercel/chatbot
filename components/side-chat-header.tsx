'use client';

import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { formatDistance } from 'date-fns';
import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useTokenUsage } from '@/hooks/use-token-usage';
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
import { isProductionEnvironment } from '@/lib/constants';

interface SideChatHeaderProps {
  title: string;
  className?: string;
  onLogout?: () => void;
  onNewChat?: () => void;
  artifactTitle?: string;
  sessionStartTime?: Date;
  artifactKind?: string;
  metadata?: any;
}

function PureSideChatHeader({
  title,
  className = '',
  onLogout = () => {},
  onNewChat = () => {},
  artifactTitle,
  sessionStartTime,
  artifactKind,
  metadata,
}: SideChatHeaderProps) {
  const { setArtifact } = useArtifact();
  const router = useRouter();
  const tokenUsage = useTokenUsage();
  const showContext = tokenUsage.currentInputTokens > 0;

  const handleNewChat = () => {
    // Start new chat
    onNewChat();

    // Close the artifact
    setArtifact((currentArtifact) =>
      currentArtifact.status === 'streaming'
        ? {
            ...currentArtifact,
            isVisible: false,
          }
        : { ...initialArtifactData, status: 'idle' },

    );

    // Navigate to home and refresh
    router.push('/');
    router.refresh();
  };

  return (
    <div className={`border-b border-gray-200 dark:border-gray-700 px-4 pb-4 pt-16 md:pt-20 lg:pt-6 bg-white dark:bg-gray-900 min-h-20 md:min-h-24 lg:min-h-28 ${className}`}>
      <h3 className="text-sm font-inter font-bold text-black dark:text-gray-100 mb-2 truncate">
        {artifactTitle || 'Browser:'}
      </h3>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-normal text-black dark:text-gray-300">
          {sessionStartTime ? `Session started ${formatDistance(
            sessionStartTime,
            new Date(),
            { addSuffix: true }
          )}` : 'Session started'}
        </p>
        {showContext && !isProductionEnvironment && (
          <Context
            maxTokens={200000}
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
            modelId="anthropic:claude-sonnet-4-6"
          >
            <ContextTrigger className="h-5 px-1.5 text-[10px] gap-1" />
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
        )}
      </div>
    </div>
  );
}

export const SideChatHeader = memo(PureSideChatHeader);
