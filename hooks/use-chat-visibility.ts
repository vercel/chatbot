"use client";

import { useState } from "react";
import type { VisibilityType } from "@/components/chat/visibility-selector";

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  void chatId;
  const [visibilityType, setLocalVisibility] =
    useState<VisibilityType>(initialVisibilityType);

  const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
    setLocalVisibility(updatedVisibilityType);
  };

  return { visibilityType, setVisibilityType };
}
