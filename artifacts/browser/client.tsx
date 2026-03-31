import { Artifact, type ChatContext } from '@/components/create-artifact';
import { useState } from 'react';
import { BrowserLoadingState } from './browser-states';
import { closeArtifact, useArtifact } from '@/hooks/use-artifact';
import { KernelBrowserClient } from './client-kernel';
import { useRouter } from 'next/navigation';
import { ExitWarningModal } from '@/components/exit-warning-modal';

interface BrowserArtifactMetadata {
  sessionId: string;
  isConnected: boolean;
  isConnecting: boolean;
  controlMode: 'agent' | 'user';
  isFocused: boolean;
  isFullscreen: boolean;
}

export const browserArtifact = new Artifact<'browser', BrowserArtifactMetadata>({
  kind: 'browser',
  description: 'Live browser automation display via Kernel',

  initialize: async ({ documentId, setMetadata, chatContext }) => {
    let sessionId: string;

    if (chatContext?.chatId && chatContext?.resourceId) {
      sessionId = `${chatContext.chatId}-${chatContext.resourceId}`;
      console.log(`[Browser Artifact] Using chat session ID: ${sessionId}`);
    } else {
      sessionId = `browser-${documentId}-${Date.now()}`;
      console.warn(`[Browser Artifact] No chat context available, using document-based session ID: ${sessionId}`);
    }

    setMetadata({
      sessionId,
      isConnected: false,
      isConnecting: true,
      controlMode: 'agent',
      isFocused: false,
      isFullscreen: false,
    });
  },

  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === 'data-kind' && streamPart.data === 'browser') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },

  content: ({
    metadata,
    setMetadata,
    chatStatus,
    stop,
    sendMessage,
  }) => {
    const router = useRouter();
    const { setArtifact } = useArtifact();
    const [showBackModal, setShowBackModal] = useState(false);

    if (!metadata?.sessionId) {
      return <BrowserLoadingState />;
    }

    return (
      <>
        <KernelBrowserClient
          sessionId={metadata.sessionId}
          controlMode={metadata.controlMode}
          onControlModeChange={(mode) => {
            setMetadata((prev) => ({
              ...prev,
              controlMode: mode,
              isFocused: mode === 'user',
            }));
          }}
          onConnectionChange={(connected) => {
            setMetadata((prev) => ({
              ...prev,
              isConnected: connected,
              isConnecting: false,
            }));
          }}
          chatStatus={chatStatus}
          stop={stop}
          isFullscreen={metadata.isFullscreen}
          onFullscreenChange={(fullscreen) => {
            setMetadata((prev) => ({
              ...prev,
              isFullscreen: fullscreen,
            }));
          }}
          sendMessage={sendMessage}
        />
        <ExitWarningModal
          open={showBackModal}
          onOpenChange={setShowBackModal}
          onLeaveSession={() => {
            setShowBackModal(false);
            closeArtifact(setArtifact);
            router.push('/home');
          }}
        />
      </>
    );
  },

  actions: [],

  toolbar: [],
});
