"use client";

import equal from "fast-deep-equal";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import type { ArtifactKind, UIArtifact } from "./artifact";
import { CodeEditor } from "./code-editor";
import { InlineDocumentSkeleton } from "./document-skeleton";
import {
  CodeIcon,
  FileIcon,
  FullscreenIcon,
  ImageIcon,
  LoaderIcon,
} from "./icons";
import { ImageEditor } from "./image-editor";
import { SpreadsheetEditor } from "./sheet-editor";
import { Editor } from "./text-editor";

type DocumentToolOutput = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content?: string;
};

type DocumentPreviewProps = {
  isReadonly: boolean;
  result?: Partial<DocumentToolOutput>;
  args?: Partial<DocumentToolOutput> & { isUpdate?: boolean };
};

export function DocumentPreview({
  isReadonly: _isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  const document = useMemo<Document | null>(() => {
    if (result?.id && result.title && result.kind) {
      return {
        title: result.title,
        kind: result.kind,
        content: result.content ?? "",
        id: result.id,
        createdAt: new Date(),
        userId: "ui-only",
      };
    }

    if (args?.id && args.title && args.kind) {
      return {
        title: args.title,
        kind: args.kind,
        content: args.content ?? "",
        id: args.id,
        createdAt: new Date(),
        userId: "ui-only",
      };
    }

    return artifact.status === "streaming"
      ? {
          title: artifact.title,
          kind: artifact.kind,
          content: artifact.content,
          id: artifact.documentId,
          createdAt: new Date(),
          userId: "ui-only",
        }
      : null;
  }, [result, args, artifact]);

  if (!document) {
    return <LoadingSkeleton artifactKind={artifact.kind} />;
  }

  return (
    <div className="relative w-full max-w-[450px] cursor-pointer">
      <HitboxLayer
        document={document}
        hitboxRef={hitboxRef}
        setArtifact={setArtifact}
      />
      <DocumentHeader
        isStreaming={artifact.status === "streaming"}
        kind={document.kind}
        title={document.title}
      />
      <DocumentContent document={document} />
    </div>
  );
}

const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="w-full max-w-[450px]">
    <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 px-4 py-3 dark:bg-muted">
      <div className="flex flex-row items-center gap-2.5">
        <div className="size-3.5 animate-pulse rounded bg-muted-foreground/15" />
        <div className="h-3.5 w-24 animate-pulse rounded bg-muted-foreground/15" />
      </div>
      <div className="w-8" />
    </div>
    {artifactKind === "image" ? (
      <div className="overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted">
        <div className="h-[257px] w-full animate-pulse bg-muted-foreground/10" />
      </div>
    ) : (
      <div className="h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted p-6">
        <InlineDocumentSkeleton />
      </div>
    )}
  </div>
);

const PureHitboxLayer = ({
  document,
  hitboxRef,
  setArtifact,
}: {
  document: Document;
  hitboxRef: React.RefObject<HTMLDivElement>;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) => ({
        ...artifact,
        documentId: document.id,
        title: document.title,
        kind: document.kind,
        content: document.content ?? "",
        status: artifact.status === "streaming" ? "streaming" : "idle",
        isVisible: true,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    },
    [setArtifact, document]
  );

  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 z-10 size-full rounded-xl"
      onClick={handleClick}
      ref={hitboxRef}
      role="presentation"
    >
      <div className="flex w-full items-center justify-end p-4">
        <div className="absolute top-[13px] right-[9px] rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.document, nextProps.document)) {
    return false;
  }
  return true;
});

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => (
  <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 px-4 py-3 dark:bg-muted">
    <div className="flex flex-row items-center gap-2.5">
      <div className="text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon size={14} />
          </div>
        ) : kind === "image" ? (
          <ImageIcon size={14} />
        ) : kind === "code" ? (
          <CodeIcon size={14} />
        ) : (
          <FileIcon size={14} />
        )}
      </div>
      <div className="text-sm font-medium">{title}</div>
    </div>
    <div className="w-8" />
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) {
    return false;
  }
  if (prevProps.isStreaming !== nextProps.isStreaming) {
    return false;
  }

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(
    "h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 dark:bg-muted",
    {
      "p-4 sm:px-10 sm:py-10": document.kind === "text",
      "p-0": document.kind === "code",
    }
  );

  const commonProps = {
    content: document.content ?? "",
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: () => null,
    suggestions: [],
  };

  const handleSaveContent = () => null;

  return (
    <div className={cn(containerClassName, "relative")}>
      {document.kind === "text" ? (
        <Editor {...commonProps} onSaveContent={handleSaveContent} />
      ) : document.kind === "code" ? (
        <div className="relative flex w-full flex-1">
          <div className="absolute inset-0">
            <CodeEditor {...commonProps} onSaveContent={handleSaveContent} />
          </div>
        </div>
      ) : document.kind === "sheet" ? (
        <div className="relative flex size-full flex-1 p-4">
          <div className="absolute inset-0">
            <SpreadsheetEditor {...commonProps} />
          </div>
        </div>
      ) : document.kind === "image" ? (
        <ImageEditor
          content={document.content ?? ""}
          currentVersionIndex={0}
          isCurrentVersion={true}
          isInline={true}
          status={artifact.status}
          title={document.title}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-muted to-transparent dark:from-muted" />
      {document.kind === "code" && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-muted to-transparent dark:from-muted" />
      )}
    </div>
  );
};
