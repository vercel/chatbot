import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { SideChatHeader } from './side-chat-header';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { browserArtifact } from '@/artifacts/browser/client';
import { imageArtifact } from '@/artifacts/image/client';
import { codeArtifact } from '@/artifacts/code/client';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { textArtifact } from '@/artifacts/text/client';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useSession } from 'next-auth/react';

export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
  browserArtifact,
];
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

function PureArtifact({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  sendMessage,
  messages,
  setMessages,
  regenerate,
  votes,
  isReadonly,
  selectedVisibilityType
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: UseChatHelpers<ChatMessage>['stop'];
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  votes: Array<Vote> | undefined;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  selectedVisibilityType: VisibilityType;
  initialChatModel: string;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();
  const { data: session } = useSession();

  // const {
  //   data: documents,
  //   isLoading: isDocumentsFetching,
  //   mutate: mutateDocuments,
  // } = useSWR<Array<Document>>(
  //   artifact.documentId !== 'init' && artifact.status !== 'streaming'
  //     ? `/api/document?id=${artifact.documentId}`
  //     : null,
  //   fetcher,
  // );
  const documents: Array<Document> = [];
  const isDocumentsFetching = false;
  const mutateDocuments = () => {};

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [isBrowserSheetOpen, setIsBrowserSheetOpen] = useState(false);

  const { open: isSidebarOpen } = useSidebar();

  // Sync browser sheet open state to global metadata so other components can access it
  useEffect(() => {
    if (artifact.kind === 'browser') {
      setMetadata((current: any) => ({
        ...current,
        isSheetOpen: isBrowserSheetOpen,
      }));
    }
  }, [artifact.kind, isBrowserSheetOpen, setMetadata]);

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? '',
        }));
      }
    }
  }, [documents, setArtifact]);

  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;

      // mutate<Array<Document>>(
      //   `/api/document?id=${artifact.documentId}`,
      //   async (currentDocuments) => {
      //     if (!currentDocuments) return undefined;

      //     const currentDocument = currentDocuments.at(-1);

      //     if (!currentDocument || !currentDocument.content) {
      //       setIsContentDirty(false);
      //       return currentDocuments;
      //     }

      //     if (currentDocument.content !== updatedContent) {
      //       await fetch(`/api/document?id=${artifact.documentId}`, {
      //         method: 'POST',
      //         body: JSON.stringify({
      //           title: artifact.title,
      //           content: updatedContent,
      //           kind: artifact.kind,
      //         }),
      //       });

      //       setIsContentDirty(false);

      //       const newDocument = {
      //         ...currentDocument,
      //         content: updatedContent,
      //         createdAt: new Date(),
      //       };

      //       return [...currentDocuments, newDocument];
      //     }
      //     return currentDocuments;
      //   },
      //   { revalidate: false },
      // );
    },
    [artifact, mutate],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);

        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return documents[index].content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;

    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1);
      setMode('edit');
    }

    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
    }

    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 1024 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
          // Pass chat context for session isolation (used by browser artifact)
          chatContext: {
            chatId,
            resourceId: session?.user?.id,
          },
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata, chatId, session?.user?.id]);

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid="artifact"
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-40 bg-transparent pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh pointer-events-auto"
              initial={{
                width: (artifact.kind === 'browser' && metadata?.isFullscreen) 
                  ? (windowWidth ? windowWidth : '100vw')
                  : (isSidebarOpen ? (windowWidth ? windowWidth - 265 - 450 : 'calc(100vw - 265px - 450px)') : (windowWidth ? windowWidth - 50 - 450 : 'calc(100vw - 50px - 450px)')),
                left: (artifact.kind === 'browser' && metadata?.isFullscreen) ? 0 : (isSidebarOpen ? 265 + 450 : 50 + 450),
              }}
              animate={{ 
                width: (artifact.kind === 'browser' && metadata?.isFullscreen) 
                  ? (windowWidth ? windowWidth : '100vw')
                  : (isSidebarOpen ? (windowWidth ? windowWidth - 265 - 450 : 'calc(100vw - 265px - 450px)') : (windowWidth ? windowWidth - 50 - 450 : 'calc(100vw - 50px - 450px)')), 
                left: (artifact.kind === 'browser' && metadata?.isFullscreen) ? 0 : (isSidebarOpen ? 265 + 450 : 50 + 450)
              }}
              exit={{
                width: (artifact.kind === 'browser' && metadata?.isFullscreen) 
                  ? (windowWidth ? windowWidth : '100vw')
                  : (isSidebarOpen ? (windowWidth ? windowWidth - 265 - 450 : 'calc(100vw - 265px - 450px)') : (windowWidth ? windowWidth - 50 - 450 : 'calc(100vw - 50px - 450px)')),
                left: (artifact.kind === 'browser' && metadata?.isFullscreen) ? 0 : (isSidebarOpen ? 265 + 450 : 50 + 450),
              }}
            />
          )}

          {!(artifact.kind === 'browser' && metadata?.isFullscreen) && (
            <motion.div
              className={`relative bg-white dark:bg-[#1a0b1a] h-dvh shrink-0 pointer-events-auto ${
                isMobile 
                  ? 'w-full' 
                  : 'w-[450px] min-w-[400px] max-w-[500px]'
              }`}
              initial={
                isMobile
                  ? { opacity: 1, x: 0 }
                  : { 
                      opacity: 0, 
                      x: isSidebarOpen ? 265 + 10 : 50 + 10, 
                      scale: 1 
                    }
              }
              animate={
                isMobile
                  ? { opacity: 1, x: 0 }
                  : {
                      opacity: 1,
                      x: isSidebarOpen ? 265 : 50,
                      scale: 1,
                      transition: {
                        delay: 0.2,
                        type: 'spring',
                        stiffness: 200,
                        damping: 30,
                      },
                    }
              }
              exit={
                isMobile
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x: isSidebarOpen ? 265 : 50,
                      scale: 1,
                      transition: { duration: 0 },
                    }
              }
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[400px] top-0 bg-zinc-900/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full">
                <SideChatHeader
                  title="Chat"
                  artifactTitle={artifact.title}
                  sessionStartTime={document ? new Date(document.createdAt) : undefined}
                  artifactKind={artifact.kind}
                  metadata={metadata}
                />
                <div className="flex-1 overflow-y-scroll">
                  <ArtifactMessages
                    chatId={chatId}
                    status={status}
                    votes={votes}
                    messages={messages}
                    setMessages={setMessages}
                    regenerate={regenerate}
                    isReadonly={isReadonly}
                    artifactStatus={artifact.status}
                  />
                </div>
                <div className="border-t border-gray-200 bg-[#EFD9E9] dark:bg-[#1a0b1a] p-3 sm:p-[18px]">
                  <form className="flex gap-2 w-full">
                    <MultimodalInput
                      chatId={chatId}
                      input={input}
                      setInput={setInput}
                      status={status}
                      stop={stop}
                      attachments={attachments}
                      setAttachments={setAttachments}
                      messages={messages}
                      sendMessage={sendMessage}
                      setMessages={setMessages}
                      selectedVisibilityType={selectedVisibilityType}
                    />

                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {/* On mobile, browser artifacts use a drawer instead of the full artifact container */}
          {!(isMobile && artifact.kind === 'browser' && !metadata?.isFullscreen) && (
            <motion.div
              className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200 pointer-events-auto"
              initial={
                isMobile
                  ? {
                      opacity: 1,
                      x: artifact.boundingBox.left,
                      y: artifact.boundingBox.top,
                      height: artifact.boundingBox.height,
                      width: artifact.boundingBox.width,
                      borderRadius: 50,
                    }
                  : {
                      opacity: 1,
                      x: artifact.boundingBox.left,
                      y: artifact.boundingBox.top,
                      height: artifact.boundingBox.height,
                      width: artifact.boundingBox.width,
                      borderRadius: 50,
                    }
              }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
                : {
                    opacity: 1,
                    x: (artifact.kind === 'browser' && metadata?.isFullscreen) 
                      ? 0
                      : (isSidebarOpen ? 265 + 450 : 50 + 450),
                    y: 0,
                    height: windowHeight,
                    width: (artifact.kind === 'browser' && metadata?.isFullscreen) 
                      ? (windowWidth ? windowWidth : '100vw')
                      : (isSidebarOpen ? (windowWidth ? windowWidth - 265 - 450 : 'calc(100vw - 265px - 450px)') : (windowWidth ? windowWidth - 50 - 450 : 'calc(100vw - 50px - 450px)')),
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: 'spring',
                stiffness: 600,
                damping: 30,
              },
            }}
          >
            {!(artifact.kind === 'browser' && metadata?.isFullscreen) && (
              <div className="p-2 flex flex-row justify-between items-start">
                <div className="flex flex-row gap-4 items-start">
                  <ArtifactActions
                    artifact={artifact}
                    currentVersionIndex={currentVersionIndex}
                    handleVersionChange={handleVersionChange}
                    isCurrentVersion={isCurrentVersion}
                    mode={mode}
                    metadata={metadata}
                    setMetadata={setMetadata}
                  />
                </div>

                {/* <ArtifactCloseButton /> */}
              </div>
            )}

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center p-4">
              <artifactDefinition.content
                title={artifact.title}
                content={
                  isCurrentVersion
                    ? artifact.content
                    : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={artifact.status}
                chatStatus={status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={metadata}
                setMetadata={setMetadata}
                chatId={chatId}
                stop={stop}
              />

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    sendMessage={sendMessage}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
          )}

          {/* Render browser artifact content for mobile (as floating button + drawer) */}
          {isMobile && artifact.kind === 'browser' && !metadata?.isFullscreen && artifactDefinition && (
            <div className="pointer-events-auto overflow-y-scroll">
              <artifactDefinition.content
                title={artifact.title}
                content={artifact.content}
                mode={mode}
                status={artifact.status}
                chatStatus={status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={{
                  ...metadata,
                  isSheetOpen: isBrowserSheetOpen,
                  setIsSheetOpen: setIsBrowserSheetOpen,
                }}
                setMetadata={setMetadata}
                chatId={chatId}
                stop={stop}
              />
            </div>
          )}

        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  return true;
});
