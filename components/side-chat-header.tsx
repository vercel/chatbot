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
      <div className="flex flex-col left-[27px] top-[25px] text-[18px] font-bold text-black leading-[1.15] not-italic font-serif mb-2">
        <div>Application</div>
        <div>Assistant</div>
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
