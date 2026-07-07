"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { suggestions } from "@/lib/constants";
import { SparklesIcon } from "./icons";

function PreviewSuggestionButton({
  suggestion,
  onAction,
}: {
  suggestion: string;
  onAction: (query?: string) => void;
}) {
  const handleClick = useCallback(() => {
    onAction(suggestion);
  }, [onAction, suggestion]);

  return (
    <button
      className="rounded-xl border border-border/30 bg-card/20 px-3 py-2.5 text-left text-[11px] leading-relaxed text-muted-foreground/70 transition-all duration-200 hover:border-border/60 hover:bg-card/40 hover:text-muted-foreground"
      onClick={handleClick}
      type="button"
    >
      {suggestion}
    </button>
  );
}

export function Preview() {
  const router = useRouter();

  const handleAction = useCallback(
    (query?: string) => {
      const url = query ? `/?query=${encodeURIComponent(query)}` : "/";
      router.push(url);
    },
    [router]
  );

  const handleDefaultAction = useCallback(() => {
    handleAction();
  }, [handleAction]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tl-2xl bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/20 px-5">
        <div className="flex size-5 items-center justify-center rounded bg-muted/60 ring-1 ring-border/50">
          <SparklesIcon size={10} />
        </div>
        <span className="text-[13px] text-muted-foreground">Chatbot</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            What can I help with?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ask a question, write code, or explore ideas.
          </p>
        </div>

        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          {suggestions.map((suggestion) => (
            <PreviewSuggestionButton
              key={suggestion}
              onAction={handleAction}
              suggestion={suggestion}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <button
          className="flex w-full items-center rounded-2xl border border-border/30 bg-card/30 px-4 py-3 text-left text-[13px] text-muted-foreground/40 transition-colors hover:border-border/50 hover:text-muted-foreground/60"
          onClick={handleDefaultAction}
          type="button"
        >
          Ask anything...
        </button>
      </div>
    </div>
  );
}
