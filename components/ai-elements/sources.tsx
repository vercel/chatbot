"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
} from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";

// ── Context ──────────────────────────────────────────────────────────────────

interface SourcesContextValue {
  sources: SourceItem[];
  totalSources: number;
}

const SourcesContext = createContext<SourcesContextValue | null>(null);

const useSourcesContext = () => {
  const ctx = useContext(SourcesContext);
  if (!ctx) {
    throw new Error("Sources components must be used within <Sources>");
  }
  return ctx;
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface SourceItem {
  id: string;
  title?: string;
  url?: string;
  domain?: string;
  snippet?: string;
  type?: "web" | "document" | "code" | "other";
  metadata?: Record<string, unknown>;
}

export type SourcesProps = ComponentProps<typeof Collapsible> & {
  sources: SourceItem[];
  defaultOpen?: boolean;
};

export type SourcesListProps = HTMLAttributes<HTMLDivElement>;

export type SourceCardProps = HTMLAttributes<HTMLDivElement> & {
  source: SourceItem;
  index: number;
};

export type SourceTitleProps = HTMLAttributes<HTMLSpanElement> & {
  source: SourceItem;
};

export type SourceDomainProps = HTMLAttributes<HTMLSpanElement> & {
  domain?: string;
};

export type SourceSnippetProps = HTMLAttributes<HTMLParagraphElement> & {
  snippet?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const getDomainFromUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const getTypeIcon = (type?: SourceItem["type"]): ReactNode => {
  switch (type) {
    case "web":
      return <GlobeIcon className="size-3.5" />;
    case "document":
      return <FileTextIcon className="size-3.5" />;
    default:
      return <FileTextIcon className="size-3.5" />;
  }
};

// ── Components ───────────────────────────────────────────────────────────────

export const Sources = ({
  sources,
  defaultOpen = false,
  className,
  children,
  ...props
}: SourcesProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const contextValue = useMemo<SourcesContextValue>(
    () => ({ sources, totalSources: sources.length }),
    [sources]
  );

  if (sources.length === 0) return null;

  return (
    <SourcesContext.Provider value={contextValue}>
      <Collapsible
        className={cn("not-prose w-full rounded-md border", className)}
        onOpenChange={setIsOpen}
        open={isOpen}
        {...props}
      >
        {children ?? (
          <>
            <SourcesTrigger />
            <SourcesContent>
              <SourcesList />
            </SourcesContent>
          </>
        )}
      </Collapsible>
    </SourcesContext.Provider>
  );
};

export const SourcesTrigger = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { totalSources } = useSourcesContext();

  return (
    <CollapsibleTrigger asChild>
      <div
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <GlobeIcon className="size-4" />
              <span className="font-medium text-xs">
                {totalSources} {totalSources === 1 ? "source" : "sources"}
              </span>
            </div>
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </>
        )}
      </div>
    </CollapsibleTrigger>
  );
};

export const SourcesContent = ({
  className,
  children,
  ...props
}: CollapsibleContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 border-t data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  >
    {children}
  </CollapsibleContent>
);

type CollapsibleContentProps = HTMLAttributes<HTMLDivElement>;

export const SourcesList = ({
  className,
  children,
  ...props
}: SourcesListProps) => {
  const { sources } = useSourcesContext();

  return (
    <div
      className={cn("divide-y divide-border", className)}
      {...props}
    >
      {children ??
        sources.map((source, i) => (
          <SourceCard index={i} key={source.id} source={source} />
        ))}
    </div>
  );
};

export const SourceCard = ({
  source,
  index,
  className,
  children,
  ...props
}: SourceCardProps) => {
  const domain = source.domain ?? getDomainFromUrl(source.url);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground text-xs tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {getTypeIcon(source.type)}
              <SourceTitle source={source} />
              {domain && <SourceDomain domain={domain} />}
            </div>
            {source.snippet && <SourceSnippet snippet={source.snippet} />}
          </div>
          {source.url && (
            <a
              aria-label={`Open source: ${source.title ?? source.url}`}
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={source.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </>
      )}
    </div>
  );
};

export const SourceTitle = ({
  source,
  className,
  ...props
}: SourceTitleProps) => {
  const title = source.title ?? source.url ?? `Source ${source.id}`;

  if (source.url) {
    return (
      <a
        className={cn(
          "truncate font-medium text-foreground text-xs hover:underline",
          className
        )}
        href={source.url}
        rel="noopener noreferrer"
        target="_blank"
        {...props}
      >
        {title}
      </a>
    );
  }

  return (
    <span
      className={cn("truncate font-medium text-foreground text-xs", className)}
      {...props}
    >
      {title}
    </span>
  );
};

export const SourceDomain = ({
  domain,
  className,
  ...props
}: SourceDomainProps) => {
  if (!domain) return null;

  return (
    <Badge className={cn("shrink-0 text-[10px]", className)} variant="outline">
      {domain}
    </Badge>
  );
};

export const SourceSnippet = ({
  snippet,
  className,
  ...props
}: SourceSnippetProps) => {
  if (!snippet) return null;

  return (
    <p
      className={cn(
        "mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed",
        className
      )}
      {...props}
    >
      {snippet}
    </p>
  );
};
