'use client';

import { useState } from 'react';
import { CheckIcon, ChevronDown, Globe, Layers, Monitor, MousePointer, Pencil, Search } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { getToolDisplayInfo } from './tool-icon';
import { cn } from '@/lib/utils';
import { Shimmer } from '@/components/ai-elements/shimmer';

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
  'tool-formSummary',
]);

// Tools included in groups but not shown in the expanded list (they're metadata, not actions)
const LABEL_TOOL_TYPES = new Set([
  'tool-actionLabel',
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
    // If the only part is a label tool (no real actions), discard it
    const actionParts = currentGroupTools.filter((p) => !LABEL_TOOL_TYPES.has(p.type));
    if (actionParts.length === 0) {
      currentGroupTools = [];
      return;
    }
    if (currentGroupTools.length === 1 && !LABEL_TOOL_TYPES.has(currentGroupTools[0].type)) {
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

// --- Group title generation ---

const GROUP_TITLE_MAP: Record<string, {
  inProgress: string;
  done: string;
  icon: React.ComponentType<any>;
}> = {
  fill:     { inProgress: 'Filling in form',       done: 'Filled the form',      icon: Pencil },
  navigate: { inProgress: 'Navigating to page',    done: 'Navigated to page',    icon: Globe },
  interact: { inProgress: 'Interacting with page', done: 'Interacted with page', icon: MousePointer },
  read:     { inProgress: 'Reading page',          done: 'Read page',            icon: Monitor },
  search:   { inProgress: 'Searching',             done: 'Search complete',      icon: Search },
  misc:     { inProgress: 'Working on page',       done: 'Completed actions',    icon: Layers },
};

function getGroupTitle(
  parts: MessagePart[],
  isProcessing: boolean,
): { label: string; Icon: React.ComponentType<any> } {
  const labelPart = parts.find((p) => p.type === 'tool-actionLabel');
  const entry = GROUP_TITLE_MAP[labelPart?.input?.category] ?? GROUP_TITLE_MAP.misc;
  return {
    label: isProcessing ? entry.inProgress : entry.done,
    Icon: isProcessing ? entry.icon : CheckIcon,
  };
}

// --- Component ---

interface ToolCallGroupProps {
  parts: MessagePart[];
  isStreaming?: boolean;
}

export function ToolCallGroup({
  parts,
  isStreaming = false,
}: ToolCallGroupProps) {
  const [open, setOpen] = useState(false);

  // Deduplicate: keep only the latest state per toolCallId
  const deduped = deduplicateParts(parts);

  // Single part → render as-is (no card wrapper)
  if (deduped.length === 1) {
    return <SingleToolLine part={deduped[0]} />;
  }

  // Group is "in progress" while the parent signals the agent is still streaming this group.
  const isInProgress = isStreaming;
  const completedParts = deduped.filter((p) => p.state === 'output-available' && !LABEL_TOOL_TYPES.has(p.type));
  const displayParts = (isInProgress ? completedParts : deduped).filter((p) => !LABEL_TOOL_TYPES.has(p.type));

  const { label, Icon: TitleIcon } = getGroupTitle(deduped, isInProgress);

  return (
    <Alert className="rounded-xl border-accent bg-background p-3">
      <AlertDescription>
        <Collapsible open={open} onOpenChange={setOpen}>
          {/* Summary line — always visible, clickable to expand */}
          <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TitleIcon size={12} className="text-gray-500 shrink-0" />
              {isInProgress ? (
                <Shimmer
                  as="span"
                  className="text-[10px] leading-[150%] font-ibm-plex-mono"
                  duration={1.5}
                >
                  {label}
                </Shimmer>
              ) : (
                <span className="text-[10px] leading-[150%] font-ibm-plex-mono text-muted-foreground">
                  {label}
                </span>
              )}
            </div>
            <span className="inline-flex items-center justify-center p-1 h-auto text-muted-foreground">
              <ChevronDown
                size={14}
                className={cn(
                  'transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
              <span className="sr-only">Toggle details</span>
            </span>
          </CollapsibleTrigger>

          {/* Expanded: show completed tools (or all when done) */}
          <CollapsibleContent>
            <div className="flex flex-col gap-0 mt-2 border-t border-border pt-1">
              {displayParts.map((part) => (
                <SingleToolLine
                  key={part.toolCallId}
                  part={part}
                  compact
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
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
}: {
  part: MessagePart;
  compact?: boolean;
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
        {Icon && <Icon size={12} className="text-gray-500 shrink-0" />}
        {displayName}
      </div>
    </div>
  );
}