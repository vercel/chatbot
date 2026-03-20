"use client";

import type { ArtifactKind } from "./artifact";

export const DocumentSkeleton = ({
  artifactKind,
}: {
  artifactKind: ArtifactKind;
}) => {
  return artifactKind === "image" ? (
    <div className="flex h-[calc(100dvh-60px)] w-full flex-col items-center justify-center gap-4">
      <div className="size-96 animate-pulse rounded-lg bg-muted-foreground/10" />
    </div>
  ) : (
    <div className="flex w-full flex-col gap-4 px-4 py-8 md:px-20 md:py-12">
      <div className="h-8 w-2/5 animate-pulse rounded-md bg-muted-foreground/10" />
      <div className="h-4 w-full animate-pulse rounded-md bg-muted-foreground/8" />
      <div className="h-4 w-full animate-pulse rounded-md bg-muted-foreground/8" />
      <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted-foreground/8" />
      <div className="h-4 w-0 rounded-md" />
      <div className="h-6 w-1/3 animate-pulse rounded-md bg-muted-foreground/10" />
      <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted-foreground/8" />
      <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted-foreground/8" />
    </div>
  );
};

export const InlineDocumentSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="h-3.5 w-48 animate-pulse rounded bg-muted-foreground/10" />
      <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted-foreground/8" />
      <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted-foreground/8" />
      <div className="h-3.5 w-64 animate-pulse rounded bg-muted-foreground/8" />
      <div className="h-3.5 w-40 animate-pulse rounded bg-muted-foreground/8" />
    </div>
  );
};
