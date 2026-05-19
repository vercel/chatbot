"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import type { UIArtifact } from "@/components/chat/artifact";

export const initialArtifactData: UIArtifact = {
  documentId: "init",
  content: "",
  kind: "text",
  title: "",
  status: "idle",
  isVisible: false,
  boundingBox: { top: 0, left: 0, width: 0, height: 0 },
};

type Selector<T> = (state: UIArtifact) => T;

const SWR_OPTIONS = { fallbackData: initialArtifactData };

export function useArtifact() {
  // Main artifact SWR
  const { data: artifact = initialArtifactData, mutate: setArtifactData } =
    useSWR<UIArtifact>("artifact", null, SWR_OPTIONS);

  // Setter function for artifact
  const setArtifact = useCallback(
    (updater: UIArtifact | ((current: UIArtifact) => UIArtifact)) =>
      setArtifactData((current = initialArtifactData) =>
        typeof updater === "function" ? updater(current) : updater
      ),
    [setArtifactData]
  );

  // Metadata per documentId
  const { data: metadata, mutate: setMetadata } = useSWR(
    artifact.documentId ? `artifact-metadata-${artifact.documentId}` : null,
    null,
    { fallbackData: null }
  );

  // Selector helper
  const selectArtifact = useCallback(
    <Selected>(selector: Selector<Selected>) => selector(artifact),
    [artifact]
  );

  return useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata,
      setMetadata,
      selectArtifact, // function to select from artifact
    }),
    [artifact, setArtifact, metadata, setMetadata, selectArtifact]
  );
}
