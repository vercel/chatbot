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
    <div className={`border-b border-gray-200 dark:border-gray-700 px-4 pb-4 pt-16 md:pt-20 lg:pt-6 bg-white dark:bg-gray-900 min-h-20 md:min-h-24 lg:min-h-28 ${className}`}>
      <h3 className="text-sm font-inter font-bold text-black dark:text-gray-100 mb-2 truncate">
        {artifactTitle || 'Browser:'}
      </h3>
      <p className="font-mono text-[10px] font-normal text-black dark:text-gray-300 pb-2">
        {sessionStartTime ? `Session started ${formatDistance(
          sessionStartTime,
          new Date(),
          { addSuffix: true }
        )}` : 'Session started'}
      </p>
    </div>
  );
}

export const SideChatHeader = memo(PureSideChatHeader);
