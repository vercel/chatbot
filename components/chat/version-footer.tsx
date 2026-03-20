"use client";

import { isAfter } from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon, DiffIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/db/schema";
import { cn, getDocumentTimestampByIndex } from "@/lib/utils";
import { LoaderIcon } from "./icons";

type VersionFooterProps = {
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  documents: Document[] | undefined;
  currentVersionIndex: number;
  mode: "edit" | "diff";
  setMode: Dispatch<SetStateAction<"edit" | "diff">>;
};

export const VersionFooter = ({
  handleVersionChange,
  documents,
  currentVersionIndex,
  mode,
  setMode,
}: VersionFooterProps) => {
  const { artifact } = useArtifact();

  const { mutate } = useSWRConfig();
  const [isMutating, setIsMutating] = useState(false);

  if (!documents) {
    return;
  }

  const isFirst = currentVersionIndex === 0;
  const isLast = currentVersionIndex === documents.length - 1;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="z-50 flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/50 bg-background px-4 py-3"
      exit={{ opacity: 0, transition: { duration: 0 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            disabled={isFirst}
            onClick={() => handleVersionChange("prev")}
            type="button"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <span className="min-w-[4rem] text-center text-xs tabular-nums text-muted-foreground">
            {currentVersionIndex + 1} of {documents.length}
          </span>
          <button
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            disabled={isLast}
            onClick={() => handleVersionChange("next")}
            type="button"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>

        <button
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            mode === "diff" && "bg-muted text-foreground"
          )}
          onClick={() => setMode(mode === "diff" ? "edit" : "diff")}
          title="Show changes"
          type="button"
        >
          <DiffIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-row gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          disabled={isMutating}
          onClick={async () => {
            setIsMutating(true);

            try {
              await mutate(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`,
                await fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}&timestamp=${getDocumentTimestampByIndex(
                    documents,
                    currentVersionIndex
                  )}`,
                  {
                    method: "DELETE",
                  }
                ),
                {
                  optimisticData: documents
                    ? [
                        ...documents.filter((document) =>
                          isAfter(
                            new Date(document.createdAt),
                            new Date(
                              getDocumentTimestampByIndex(
                                documents,
                                currentVersionIndex
                              )
                            )
                          )
                        ),
                      ]
                    : [],
                }
              );
            } finally {
              setIsMutating(false);
            }
          }}
          type="button"
        >
          Restore
          {isMutating && (
            <div className="animate-spin">
              <LoaderIcon size={14} />
            </div>
          )}
        </button>
        <button
          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-muted active:scale-[0.98]"
          onClick={() => {
            setMode("edit");
            handleVersionChange("latest");
          }}
          type="button"
        >
          Latest
        </button>
      </div>
    </motion.div>
  );
};
