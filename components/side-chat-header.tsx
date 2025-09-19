'use client';

import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';

import { Globe } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { memo } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className={`border-b border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-900 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Apply for Benefits</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="p-2 bg-white dark:bg-gray-800 rounded-full border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            title="New Chat"
          >
            <Globe size={16} className="text-purple-600 dark:text-purple-400" />
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </div>
      <hr className="my-2" />
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 pt-4 mb-2">
        {artifactTitle || 'Browser:'}
      </h3>
      <p className="font-mono text-[10px] font-normal text-black dark:text-gray-300 pb-2">
        {sessionStartTime ? `Session started ${formatDistance(
          sessionStartTime,
          new Date(),
          { addSuffix: true }
        )}` : artifactKind === 'browser' && metadata?.sessionId ? `Session started ${formatDistance(
          new Date(parseInt(metadata.sessionId.split('-').pop() || '0')),
          new Date(),
          { addSuffix: true }
        )}` : 'Session started'}
      </p>
    </div>
  );
}

export const SideChatHeader = memo(PureSideChatHeader);
