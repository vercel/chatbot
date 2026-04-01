import type { UseChatHelpers } from "@ai-sdk/react";
import { formatDistance } from "date-fns";
import equal from "fast-deep-equal";
import { AnimatePresence, m } from "framer-motion";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { useWindowSize } from "usehooks-ts";
import { codeArtifact } from "@/artifacts/code/client";
import { imageArtifact } from "@/artifacts/image/client";
import { sheetArtifact } from "@/artifacts/sheet/client";
import { textArtifact } from "@/artifacts/text/client";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document, Vote } from "@/lib/db/schema";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { ArtifactActions } from "./artifact-actions";
import { ArtifactCloseButton } from "./artifact-close-button";
import { LoaderIcon } from "./icons";
import { Toolbar } from "./toolbar";
import { VersionFooter } from "./version-footer";
import type { VisibilityType } from "./visibility-selector";

export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
];
export type ArtifactKind = (typeof artifactDefinitions)[number]["kind"];

export type UIArtifact = {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: "streaming" | "idle";
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
};

type ArtifactDocState = {
  mode: "edit" | "diff";
  document: Document | null;
  currentVersionIndex: number;
  isContentDirty: boolean;
};

type ArtifactDocAction =
  | { type: "SET_MODE"; mode: "edit" | "diff" }
  | { type: "SET_DOCUMENT"; document: Document; versionIndex: number }
  | { type: "SET_VERSION_INDEX"; index: number }
  | { type: "SET_CONTENT_DIRTY"; dirty: boolean }
  | { type: "RESET" };

function artifactDocReducer(state: ArtifactDocState, action: ArtifactDocAction): ArtifactDocState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_DOCUMENT":
      return { ...state, document: action.document, currentVersionIndex: action.versionIndex };
    case "SET_VERSION_INDEX":
      return { ...state, currentVersionIndex: action.index };
    case "SET_CONTENT_DIRTY":
      return { ...state, isContentDirty: action.dirty };
    case "RESET":
      return { mode: "edit", document: null, currentVersionIndex: -1, isContentDirty: false };
    default:
      return state;
  }
}

function ArtifactHeader({
  artifact,
  document,
  isContentDirty,
  currentVersionIndex,
  documents,
}: {
  artifact: UIArtifact;
  document: Document | null;
  isContentDirty: boolean;
  currentVersionIndex: number;
  documents: Document[] | undefined;
}) {
  return (
    <div className="flex h-[calc(3.5rem+1px)] shrink-0 items-center justify-between border-b border-border/50 px-4">
      <div className="flex items-center gap-3">
        <ArtifactCloseButton />
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold leading-tight tracking-tight">
            {artifact.title}
          </div>
          <div className="flex items-center gap-2">
            {isContentDirty ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                Saving...
              </div>
            ) : document ? (
              <div className="text-xs text-muted-foreground">
                {`Updated ${formatDistance(new Date(document.createdAt), new Date(), { addSuffix: true })}`}
              </div>
            ) : artifact.status === "streaming" ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="animate-spin">
                  <LoaderIcon size={12} />
                </div>
                Generating...
              </div>
            ) : (
              <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/10" />
            )}
            {documents && documents.length > 1 && (
              <div className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                v{currentVersionIndex + 1}/{documents.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactContentArea({
  artifactContentRef,
  onContentScroll,
  artifactDefinition,
  isCurrentVersion,
  artifact,
  getDocumentContentById,
  currentVersionIndex,
  isDocumentsFetching,
  metadata,
  mode,
  saveContent,
  setMetadata,
  isToolbarVisible,
  setIsToolbarVisible,
  setArtifact,
  sendMessage,
  setMessages,
  status,
  stop,
  consoleError,
  handleVersionChange,
  documents,
  dispatchDoc,
}: {
  artifactContentRef: React.MutableRefObject<HTMLDivElement | null>;
  onContentScroll: () => void;
  artifactDefinition: (typeof artifactDefinitions)[number];
  isCurrentVersion: boolean;
  artifact: UIArtifact;
  getDocumentContentById: (index: number) => string;
  currentVersionIndex: number;
  isDocumentsFetching: boolean;
  metadata: any;
  mode: "edit" | "diff";
  saveContent: (updatedContent: string, debounce: boolean) => void;
  setMetadata: any;
  isToolbarVisible: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  setArtifact: Dispatch<SetStateAction<UIArtifact>>;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  consoleError: string | undefined;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  documents: Document[] | undefined;
  dispatchDoc: Dispatch<ArtifactDocAction>;
}) {
  return (
    <>
      <div
        className="relative flex-1 overflow-y-auto bg-background"
        data-slot="artifact-content"
        onScroll={onContentScroll}
        ref={artifactContentRef}
      >
        <artifactDefinition.content
          content={
            isCurrentVersion
              ? artifact.content
              : getDocumentContentById(currentVersionIndex)
          }
          currentVersionIndex={currentVersionIndex}
          getDocumentContentById={getDocumentContentById}
          isCurrentVersion={isCurrentVersion}
          isInline={false}
          isLoading={isDocumentsFetching && !artifact.content}
          metadata={metadata}
          mode={mode}
          onSaveContent={saveContent}
          setMetadata={setMetadata}
          status={artifact.status}
          suggestions={[]}
          title={artifact.title}
        />
        <AnimatePresence>
          {isCurrentVersion && (
            <Toolbar
              artifactActions={
                <ArtifactActions
                  artifact={artifact}
                  currentVersionIndex={currentVersionIndex}
                  handleVersionChange={handleVersionChange}
                  isCurrentVersion={isCurrentVersion}
                  metadata={metadata}
                  mode={mode}
                  setMetadata={setMetadata}
                />
              }
              artifactKind={artifact.kind}
              consoleError={consoleError}
              documentId={artifact.documentId}
              isToolbarVisible={isToolbarVisible}
              onClose={() => {
                setArtifact((prev) => ({ ...prev, isVisible: false }));
              }}
              sendMessage={sendMessage}
              setIsToolbarVisible={setIsToolbarVisible}
              setMessages={setMessages}
              status={status}
              stop={stop}
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
            mode={mode}
            setMode={(m: "edit" | "diff") => dispatchDoc({ type: "SET_MODE", mode: m })}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function useArtifactDocuments(artifact: UIArtifact, setArtifact: Dispatch<SetStateAction<UIArtifact>>) {
  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Document[]>(
    artifact.documentId !== "init" && artifact.status !== "streaming"
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`
      : null,
    fetcher
  );

  const [docState, dispatchDoc] = useReducer(artifactDocReducer, {
    mode: "edit",
    document: null,
    currentVersionIndex: -1,
    isContentDirty: false,
  });
  const { mode, document, currentVersionIndex, isContentDirty } = docState;

  const [prevDocuments, setPrevDocuments] = useState<Document[] | undefined>(undefined);
  if (documents !== prevDocuments) {
    setPrevDocuments(documents);
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);
      if (mostRecentDocument) {
        dispatchDoc({ type: "SET_DOCUMENT", document: mostRecentDocument, versionIndex: documents.length - 1 });
        if (artifact.status === "streaming" || !isContentDirty) {
          setArtifact((currentArtifact) => ({
            ...currentArtifact,
            content: mostRecentDocument.content ?? "",
          }));
        }
      }
    }
  }

  useEffect(() => {
    mutateDocuments();
  }, [mutateDocuments]);

  const { mutate } = useSWRConfig();

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;
      const docUrl = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`;
      mutate<Document[]>(
        docUrl,
        async (currentDocuments) => {
          if (!currentDocuments) return [];
          const currentDocument = currentDocuments.at(-1);
          if (!currentDocument || !currentDocument.content) {
            dispatchDoc({ type: "SET_CONTENT_DIRTY", dirty: false });
            return currentDocuments;
          }
          if (currentDocument.content === updatedContent) {
            dispatchDoc({ type: "SET_CONTENT_DIRTY", dirty: false });
            return currentDocuments;
          }
          await fetch(docUrl, {
            method: "POST",
            body: JSON.stringify({
              title: artifact.title,
              content: updatedContent,
              kind: artifact.kind,
              isManualEdit: true,
            }),
          });
          dispatchDoc({ type: "SET_CONTENT_DIRTY", dirty: false });
          return currentDocuments.map((doc, i) =>
            i === currentDocuments.length - 1 ? { ...doc, content: updatedContent } : doc
          );
        },
        { revalidate: false }
      );
    },
    [artifact, mutate]
  );

  const latestContentRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      latestContentRef.current = updatedContent;
      dispatchDoc({ type: "SET_CONTENT_DIRTY", dirty: true });
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (debounce) {
        saveTimerRef.current = setTimeout(() => {
          handleContentChange(latestContentRef.current);
          saveTimerRef.current = null;
        }, 2000);
      } else {
        handleContentChange(updatedContent);
      }
    },
    [handleContentChange]
  );

  const getDocumentContentById = useCallback(
    (index: number) => documents?.[index]?.content ?? "",
    [documents]
  );

  const handleVersionChange = useCallback(
    (type: "next" | "prev" | "toggle" | "latest") => {
      if (!documents) return;
      if (type === "latest") {
        dispatchDoc({ type: "SET_VERSION_INDEX", index: documents.length - 1 });
        dispatchDoc({ type: "SET_MODE", mode: "edit" });
      }
      if (type === "toggle") {
        dispatchDoc({ type: "SET_MODE", mode: mode === "edit" ? "diff" : "edit" });
      }
      if (type === "prev") {
        if (currentVersionIndex > 0) {
          dispatchDoc({ type: "SET_VERSION_INDEX", index: currentVersionIndex - 1 });
        }
      } else if (type === "next" && currentVersionIndex < documents.length - 1) {
        dispatchDoc({ type: "SET_VERSION_INDEX", index: currentVersionIndex + 1 });
      }
    },
    [documents, mode, currentVersionIndex]
  );

  const isCurrentVersion =
    documents && documents.length > 0 ? currentVersionIndex === documents.length - 1 : true;

  return {
    documents, isDocumentsFetching, docState, dispatchDoc,
    mode, document, currentVersionIndex, isContentDirty,
    saveContent, getDocumentContentById, handleVersionChange, isCurrentVersion,
  };
}

function PureArtifact({
  addToolApprovalResponse: _addToolApprovalResponse,
  chatId: _chatId,
  input: _input,
  setInput: _setInput,
  status,
  stop,
  attachments: _attachments,
  setAttachments: _setAttachments,
  sendMessage,
  messages: _messages,
  setMessages,
  regenerate: _regenerate,
  votes: _votes,
  isReadonly: _isReadonly,
  selectedVisibilityType: _selectedVisibilityType,
  selectedModelId: _selectedModelId,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  input: string;
  setInput: (val: string) => void;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  votes: Vote[] | undefined;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  const {
    documents, isDocumentsFetching, dispatchDoc,
    mode, document, currentVersionIndex, isContentDirty,
    saveContent, getDocumentContentById, handleVersionChange, isCurrentVersion,
  } = useArtifactDocuments(artifact, setArtifact);

  const { state: sidebarState } = useSidebar();
  const artifactContentRef = useRef<HTMLDivElement>(null);
  const userScrolledArtifact = useRef(false);

  useEffect(() => {
    if (artifact.status !== "streaming") {
      userScrolledArtifact.current = false;
      return;
    }
    if (userScrolledArtifact.current) return;
    const el = artifactContentRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [artifact.status]);

  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  useEffect(() => {
    if (artifact.documentId !== "init" && artifactDefinition.initialize) {
      artifactDefinition.initialize({
        documentId: artifact.documentId,
        setMetadata,
      });
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  if (!artifact.isVisible && !isMobile) {
    return (
      <div
        className="h-dvh w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        data-testid="artifact"
      />
    );
  }

  if (!artifact.isVisible) {
    return null;
  }

  const consoleError =
    metadata?.outputs
      ?.filter((o: { status: string }) => o.status === "failed")
      .flatMap((o: { contents: { type: string; value: string }[] }) =>
        o.contents.filter((c) => c.type === "text").map((c) => c.value)
      )
      .join("\n") || undefined;

  const artifactPanel = (
    <>
      {sidebarState !== "collapsed" && (
        <ArtifactHeader
          artifact={artifact}
          currentVersionIndex={currentVersionIndex}
          document={document}
          documents={documents}
          isContentDirty={isContentDirty}
        />
      )}
      <ArtifactContentArea
        artifact={artifact}
        artifactContentRef={artifactContentRef}
        artifactDefinition={artifactDefinition}
        consoleError={consoleError}
        currentVersionIndex={currentVersionIndex}
        dispatchDoc={dispatchDoc}
        documents={documents}
        getDocumentContentById={getDocumentContentById}
        handleVersionChange={handleVersionChange}
        isCurrentVersion={isCurrentVersion}
        isDocumentsFetching={isDocumentsFetching}
        isToolbarVisible={isToolbarVisible}
        metadata={metadata}
        mode={mode}
        saveContent={saveContent}
        sendMessage={sendMessage}
        setArtifact={setArtifact}
        setIsToolbarVisible={setIsToolbarVisible}
        setMessages={setMessages}
        setMetadata={setMetadata}
        status={status}
        stop={stop}
        onContentScroll={() => {
          const el = artifactContentRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          userScrolledArtifact.current = !atBottom;
        }}
      />
    </>
  );

  if (isMobile) {
    return (
      <m.div
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          height: windowHeight,
          width: "100dvw",
          borderRadius: 0,
        }}
        className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-sidebar"
        data-testid="artifact"
        exit={{ opacity: 0, scale: 0.95 }}
        initial={{
          opacity: 1,
          x: artifact.boundingBox.left,
          y: artifact.boundingBox.top,
          height: artifact.boundingBox.height,
          width: artifact.boundingBox.width,
          borderRadius: 50,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {artifactPanel}
      </m.div>
    );
  }

  return (
    <div
      className="flex h-dvh w-[60%] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      data-testid="artifact"
    >
      {artifactPanel}
    </div>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }
  if (prevProps.input !== nextProps.input) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
    return false;
  }

  return true;
});
