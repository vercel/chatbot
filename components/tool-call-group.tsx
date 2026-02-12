'use client';

import { useState } from 'react';
import { ChevronDown, Layers, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { getToolDisplayInfo } from './tool-icon';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { cn } from '@/lib/utils';

// --- Types ---

type MessagePart = {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: any;
  output?: any;
  text?: string;
  [key: string]: any;
};

export type ProcessedPart =
  | { kind: 'tool-group'; parts: MessagePart[]; startIndex: number }
  | { kind: 'passthrough'; part: MessagePart; index: number };

// --- Constants ---

// Special tools that get their own custom rendering — never grouped
const EXCLUDED_TOOL_TYPES = new Set([
  'tool-getWeather',
  'tool-createDocument',
  'tool-updateDocument',
  'tool-requestSuggestions',
  'tool-gapAnalysis',
]);

// Tools that are hidden or have special rendering via CollapsibleWrapper
const HIDDEN_DISPLAY_NAMES = new Set([
  'Updated working memory',
  'Executed JavaScript',
  'Retrieved participant data',
]);

// Short narration text threshold — text parts shorter than this that appear
// between tool calls get absorbed into the group instead of breaking it.
const NARRATION_MAX_LENGTH = 80;

// Map present-participle verbs from getToolDisplayInfo → noun forms for summary
const VERB_TO_NOUN: Record<string, string> = {
  'clicking': 'click',
  'clicked': 'click',
  'filling': 'fill',
  'filled': 'fill',
  'selecting': 'select',
  'selected': 'select',
  'scrolling': 'scroll',
  'scrolling to': 'scroll',
  'navigating': 'navigate',
  'navigated': 'navigate',
  'typing': 'type',
  'typed': 'type',
  'pressing': 'press',
  'pressed': 'press',
  'hovering': 'hover',
  'hovered': 'hover',
  'waiting': 'wait',
  'waited': 'wait',
  'opening': 'navigate',
  'reading page': 'snapshot',
  'captured': 'snapshot',
  'took': 'screenshot',
  'taking screenshot': 'screenshot',
  'double-clicking': 'click',
  'focusing': 'focus',
  'dragging': 'drag',
  'performed': 'drag',
  'uploading': 'upload',
  'uploaded': 'upload',
  'running script': 'evaluate',
  'executed': 'evaluate',
  'going back': 'navigate',
  'going forward': 'navigate',
  'reloading': 'navigate',
  'closing': 'close',
  'closed': 'close',
  'resized': 'resize',
  'managed': 'tabs',
  'retrieved': 'retrieve',
  'handled': 'dialog',
  'installed': 'install',
  'getting': 'get',
  'searched': 'search',
  'browser': 'action',
};

// --- Grouping function ---

function isGroupableTool(part: MessagePart): boolean {
  if (!part.type.startsWith('tool-')) return false;
  if (EXCLUDED_TOOL_TYPES.has(part.type)) return false;

  const { text: displayName } = getToolDisplayInfo(part.type, part.input);
  if (HIDDEN_DISPLAY_NAMES.has(displayName)) return false;

  return true;
}

// Part types that are invisible/structural and should never break a group
const TRANSPARENT_PART_TYPES = new Set([
  'step-start',
  'step-finish',
  'source',
]);

/** Parts that should be absorbed into a group without breaking it. */
function isAbsorbable(part: MessagePart): boolean {
  // Structural parts (step-start, step-finish) are always transparent
  if (TRANSPARENT_PART_TYPES.has(part.type)) return true;
  // Short narration text between tool calls gets absorbed
  if (part.type === 'text') {
    const text = (part.text ?? '').trim();
    return text.length > 0 && text.length <= NARRATION_MAX_LENGTH;
  }
  return false;
}

export function groupMessageParts(parts: MessagePart[]): ProcessedPart[] {
  const result: ProcessedPart[] = [];
  // Only tool parts go into the group (text parts are absorbed/skipped, not stored)
  let currentGroupTools: MessagePart[] = [];
  let groupStartIndex = 0;
  // Buffer for text parts that might be absorbed if a tool follows
  let pendingText: { part: MessagePart; index: number } | null = null;

  function flushGroup() {
    if (currentGroupTools.length === 0) return;
    if (currentGroupTools.length === 1) {
      result.push({
        kind: 'passthrough',
        part: currentGroupTools[0],
        index: groupStartIndex,
      });
    } else {
      result.push({
        kind: 'tool-group',
        parts: currentGroupTools,
        startIndex: groupStartIndex,
      });
    }
    currentGroupTools = [];
  }

  function flushPendingText() {
    if (pendingText) {
      result.push({ kind: 'passthrough', part: pendingText.part, index: pendingText.index });
      pendingText = null;
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (isGroupableTool(part)) {
      // A tool follows — absorb any pending text (don't emit it)
      pendingText = null;
      if (currentGroupTools.length === 0) {
        groupStartIndex = i;
      }
      currentGroupTools.push(part);
    } else if (isAbsorbable(part)) {
      if (currentGroupTools.length > 0) {
        // Inside a group — hold text in case a tool follows; skip structural parts
        if (part.type === 'text') {
          pendingText = { part, index: i };
        }
        // step-start/step-finish/source: silently skip
      } else {
        // Not in a group — pass through as normal
        result.push({ kind: 'passthrough', part, index: i });
      }
    } else {
      // Non-absorbable part: flush everything and pass through
      flushGroup();
      flushPendingText();
      result.push({ kind: 'passthrough', part, index: i });
    }
  }

  flushGroup();
  flushPendingText();
  return result;
}

// --- Summary generation ---

function extractVerb(displayText: string): string {
  const lower = displayText.toLowerCase();

  // Try matching the longest prefix first
  const sortedVerbs = Object.keys(VERB_TO_NOUN).sort(
    (a, b) => b.length - a.length,
  );
  for (const verb of sortedVerbs) {
    if (lower.startsWith(verb)) {
      return VERB_TO_NOUN[verb];
    }
  }

  // Fallback: use first word
  const firstWord = lower.split(/\s+/)[0];
  return VERB_TO_NOUN[firstWord] || firstWord;
}

export function generateGroupSummary(parts: MessagePart[]): { noun: string; count: number }[] {
  const counts: Record<string, number> = {};

  for (const part of parts) {
    const { text } = getToolDisplayInfo(part.type, part.input);
    const noun = extractVerb(text);
    counts[noun] = (counts[noun] || 0) + 1;
  }

  return Object.entries(counts).map(([noun, count]) => ({ noun, count }));
}

// --- Stopped detection ---

/** A tool call is "stopped" if the user clicked stop while it was running
 *  (state stuck at input-available with isLoading=false), or if its output
 *  explicitly contains a "stopped by user" error. */
export function isToolStopped(part: MessagePart, isLoading: boolean): boolean {
  // Tool was mid-execution when the stream was aborted
  if (part.state === 'input-available' && !isLoading) return true;
  // Tool completed but with a "stopped" error from the server
  if (
    part.state === 'output-available' &&
    part.output?.error &&
    typeof part.output.error === 'string' &&
    part.output.error.toLowerCase().includes('stopped by user')
  ) {
    return true;
  }
  return false;
}

// --- Component ---

interface ToolCallGroupProps {
  parts: MessagePart[];
  messageId: string;
  startIndex: number;
  isLoading: boolean;
}

export function ToolCallGroup({
  parts,
  messageId,
  startIndex,
  isLoading,
}: ToolCallGroupProps) {
  const [open, setOpen] = useState(false);

  // Deduplicate: keep only the latest state per toolCallId
  const deduped = deduplicateParts(parts);

  // Single part → render as-is (no card wrapper)
  if (deduped.length === 1) {
    return <SingleToolLine part={deduped[0]} />;
  }

  // If the latest tool is still running, show it separately below the summary.
  // Otherwise all tools are done — include everything in the summary counts.
  const lastTool = deduped[deduped.length - 1];
  const isLastRunning = lastTool.state === 'input-available' && isLoading;
  const isLastStopped = isToolStopped(lastTool, isLoading);
  const summaryParts = isLastRunning ? deduped.slice(0, -1) : deduped;

  const summary = generateGroupSummary(summaryParts);

  return (
    <Alert className="rounded-xl border-accent bg-background p-3">
      <AlertDescription>
        <Collapsible open={open} onOpenChange={setOpen}>
          {/* Summary line — always visible, clickable to expand */}
          <CollapsibleTrigger className="flex items-start justify-between w-full cursor-pointer gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Layers size={12} className="text-gray-500 shrink-0 mt-1" />
              <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                {summary.map(({ noun, count }) => (
                  <span
                    key={noun}
                    className="text-[10px] leading-[150%] font-ibm-plex-mono text-muted-foreground whitespace-nowrap border border-border rounded px-1.5 py-0.5"
                  >
                    {count} {count === 1 ? noun : noun + 's'}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="p-1 h-auto text-muted-foreground hover:text-primary hover:bg-accent">
              <ChevronDown
                size={14}
                className={cn(
                  'transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
              <span className="sr-only">Toggle details</span>
            </Button>
          </CollapsibleTrigger>

          {/* Expanded: full sequential list */}
          <CollapsibleContent>
            <div className="flex flex-col gap-0 mt-2 border-t border-border pt-1">
              {(isLastRunning ? summaryParts : deduped).map((part) => (
                <SingleToolLine
                  key={part.toolCallId}
                  part={part}
                  compact
                  isStopped={isToolStopped(part, isLoading)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Current tool — only shown while still running or stopped */}
        {(isLastRunning || isLastStopped) && (
          <div className="mt-1">
            <SingleToolLine
              part={lastTool}
              compact
              isRunning={isLastRunning}
              isStopped={isLastStopped}
            />
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

// --- Helpers ---

function deduplicateParts(parts: MessagePart[]): MessagePart[] {
  const byId = new Map<string, MessagePart>();
  for (const part of parts) {
    const id = part.toolCallId;
    if (!id) {
      byId.set(`__no_id_${byId.size}`, part);
      continue;
    }
    byId.set(id, part);
  }
  return Array.from(byId.values());
}

function SingleToolLine({
  part,
  compact = false,
  isRunning = false,
  isStopped = false,
}: {
  part: MessagePart;
  compact?: boolean;
  isRunning?: boolean;
  isStopped?: boolean;
}) {
  const { text: displayName, icon: Icon } = getToolDisplayInfo(
    part.type,
    part.input,
  );
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-0 rounded-md',
        compact ? 'px-1 py-1.5' : 'p-3',
      )}
    >
      <div className="text-[10px] leading-[150%] font-ibm-plex-mono text-muted-foreground flex items-center gap-2">
        {isRunning ? (
          <Spinner className="size-3 shrink-0 text-primary" />
        ) : isStopped ? (
          <X size={12} className="text-gray-500 shrink-0" />
        ) : (
          Icon && <Icon size={12} className="text-gray-500 shrink-0" />
        )}
        {displayName}
        {isStopped && ' (Stopped)'}
      </div>
    </div>
  );
}
