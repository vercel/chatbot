import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWindowSize } from "usehooks-ts";
import { codeArtifact } from "@/artifacts/code/client";
import { imageArtifact } from "@/artifacts/image/client";
import { sheetArtifact } from "@/artifacts/sheet/client";
import { textArtifact } from "@/artifacts/text/client";
import { useArtifact } from "@/hooks/use-artifact";
import type { Vote } from "@/lib/chat/types";
import type { Attachment, ChatMessage } from "@/lib/types";
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
  setInput: Dispatch<SetStateAction<string>>;
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

  const [mode, setMode] = useState<"edit" | "diff">("edit");
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  const { state: sidebarState } = useSidebar();
  const artifactContentRef = useRef<HTMLDivElement>(null);
  const userScrolledArtifact = useRef(false);
  const [isContentDirty, setIsContentDirty] = useState(false);

  useEffect(() => {
    if (artifact.status !== "streaming") {
      userScrolledArtifact.current = false;
      return;
    }
    if (userScrolledArtifact.current) {
      return;
    }
    const el = artifactContentRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight });
  }, [artifact.status]);

  const latestContentRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      latestContentRef.current = updatedContent;
      setIsContentDirty(true);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const commitContent = () => {
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: latestContentRef.current,
        }));
        setIsContentDirty(false);
      };

      if (debounce) {
        saveTimerRef.current = setTimeout(() => {
          commitContent();
          saveTimerRef.current = null;
        }, 2000);
      } else {
        commitContent();
      }
    },
    [setArtifact]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  function getDocumentContentById(index: number) {
    return index === 0 ? artifact.content : "";
  }

  const handleVersionChange = (type: "next" | "prev" | "toggle" | "latest") => {
    if (type === "latest") {
      setCurrentVersionIndex(0);
      setMode("edit");
    }

    if (type === "toggle") {
      setMode((currentMode) => (currentMode === "edit" ? "diff" : "edit"));
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  const isCurrentVersion = true;

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
                ) : artifact.status === "streaming" ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="animate-spin">
                      <LoaderIcon size={12} />
                    </div>
                    Generating...
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Local draft
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        className="relative flex-1 overflow-y-auto bg-background"
        data-slot="artifact-content"
        onScroll={() => {
          const el = artifactContentRef.current;
          if (!el) {
            return;
          }
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          userScrolledArtifact.current = !atBottom;
        }}
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
          isLoading={false}
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
            documents={undefined}
            handleVersionChange={handleVersionChange}
            mode={mode}
            setMode={setMode}
          />
        )}
      </AnimatePresence>
    </>
  );

  if (isMobile) {
    return (
      <motion.div
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
      </motion.div>
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
