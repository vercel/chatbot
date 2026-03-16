'use client';

import { useState } from 'react';
import { CheckIcon, PencilIcon, Sparkles, TriangleAlert, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface SummaryField {
  field: string;
  value: string;
  inputType?: 'text' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required?: boolean;
}

interface FormSummaryCardProps {
  formName?: string;
  fromDatabase: SummaryField[];
  fromCaseworker: SummaryField[];
  inferred: SummaryField[];
  missing?: { field: string; inputType?: 'text' | 'select' | 'radio' | 'checkbox'; options?: string[]; required?: boolean }[];
  notes?: string;
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isArtifactVisible?: boolean;
  className?: string;
}

type FieldWithSource = {
  field: string;
  value: string;
  source: 'database' | 'caseworker' | 'inferred' | 'missing';
  inputType?: 'text' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required?: boolean;
};

function AutofilledBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-[10px] font-medium uppercase tracking-wide font-mono whitespace-nowrap inline-flex items-center gap-1 bg-pink-50 text-pink-600 border border-pink-200 rounded px-2 py-0.5 cursor-default">
            <Sparkles className="w-3 h-3 shrink-0" />
            Auto-filled
          </span>
        </TooltipTrigger>
        <TooltipContent align="end">Filled in automatically by the AI.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SourceLabel({
  label,
  variant = 'default',
  tooltip,
}: {
  label: string;
  variant?: 'default' | 'missing';
  tooltip?: string;
}) {
  if (variant === 'missing' && label === 'Required') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] font-medium uppercase tracking-wide font-mono whitespace-nowrap inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 cursor-default">
              <TriangleAlert className="w-3 h-3 shrink-0" />
              {label}
            </span>
          </TooltipTrigger>
          {tooltip && <TooltipContent align="end">{tooltip}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (label === 'Optional') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] font-medium uppercase tracking-wide font-mono whitespace-nowrap inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 text-foreground cursor-default">
              <Info className="w-3 h-3 shrink-0" />
              {label}
            </span>
          </TooltipTrigger>
          {tooltip && <TooltipContent align="end">{tooltip}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (label === 'Apricot 360') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] font-medium uppercase tracking-wide font-mono whitespace-nowrap inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 text-foreground cursor-default">
              {label}
            </span>
          </TooltipTrigger>
          {tooltip && <TooltipContent align="end">{tooltip}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-[10px] font-medium uppercase tracking-wide font-mono whitespace-nowrap inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 text-foreground cursor-default">
            {label}
          </span>
        </TooltipTrigger>
        {tooltip && <TooltipContent align="end">{tooltip}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
}

export function FormSummaryCard({
  formName,
  fromDatabase,
  fromCaseworker,
  inferred,
  missing,
  notes,
  sendMessage,
  isArtifactVisible = true,
  className,
}: FormSummaryCardProps) {
  const [uiMode, setUiMode] = useState<'view' | 'edit' | 'confirmed'>('view');
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const allFields: FieldWithSource[] = [
    ...fromDatabase.map((f) => ({ ...f, source: 'database' as const })),
    ...fromCaseworker.map((f) => ({ ...f, source: 'caseworker' as const })),
    ...inferred.map((f) => ({ ...f, source: 'inferred' as const })),
    ...(missing ?? []).map((f) =>
      typeof f === 'string'
        ? { field: f, value: '', source: 'missing' as const }
        : { ...f, value: '', source: 'missing' as const },
    ),
  ];

  function renderEditInput(item: FieldWithSource) {
    const currentValue = editValues[item.field] ?? getDisplayValue(item);
    const onChange = (val: string) =>
      setEditValues((prev) => ({ ...prev, [item.field]: val }));

    switch (item.inputType) {
      case 'select':
        return (
          <Select value={currentValue} onValueChange={onChange}>
            <SelectTrigger className="mt-1 h-8 text-sm bg-background">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(item.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={currentValue}
            onValueChange={onChange}
            className="mt-2 flex flex-col gap-1.5"
          >
            {(item.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${item.field}-${opt}`} />
                <Label htmlFor={`${item.field}-${opt}`} className="text-sm font-normal">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox': {
        const selected = currentValue ? currentValue.split(',').map((s) => s.trim()) : [];
        const toggle = (opt: string) => {
          const next = selected.includes(opt)
            ? selected.filter((s) => s !== opt)
            : [...selected, opt];
          onChange(next.join(', '));
        };
        return (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground italic">
              Select all that apply.
            </p>
            {(item.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${item.field}-${opt}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={() => toggle(opt)}
                />
                <Label htmlFor={`${item.field}-${opt}`} className="text-sm font-normal">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      default:
        return (
          <Input
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 h-8 text-sm bg-background"
          />
        );
    }
  }

  function getDisplayValue(item: FieldWithSource) {
    return savedValues[item.field] ?? item.value;
  }

  function isManuallyEdited(item: FieldWithSource) {
    if (uiMode === 'edit') {
      return editValues[item.field] !== undefined && editValues[item.field] !== item.value;
    }
    return savedValues[item.field] !== undefined && savedValues[item.field] !== item.value;
  }

  function handleEditStart() {
    const initial: Record<string, string> = {};
    for (const item of allFields) {
      initial[item.field] = getDisplayValue(item);
    }
    setEditValues(initial);
    setUiMode('edit');
  }

  const hasChanges = allFields.some(
    (item) => editValues[item.field] !== undefined && editValues[item.field] !== getDisplayValue(item),
  );

  function handleCancel() {
    setEditValues({});
    setUiMode('view');
  }

  function handleConfirm() {
    const resolvedValues = { ...savedValues, ...editValues };
    setSavedValues(resolvedValues);

    if (sendMessage) {
      const changes: string[] = [];
      for (const item of allFields) {
        const currentValue = resolvedValues[item.field] ?? item.value;
        if (currentValue !== item.value && currentValue.trim() !== '') {
          changes.push(`- ${item.field}: ${currentValue}`);
        }
      }

      const formContext = formName ? ` for ${formName}` : '';

      if (changes.length > 0) {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `Please update the following form fields${formContext}:\n${changes.join('\n')}\n\nOnce updated, please ask the user to click the "Take control" button to take control and submit the form.`,
            },
          ],
        });
      } else {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `The form${formContext} looks good. The form is complete, please ask the user to click the "Take control" button to take control and submit the form.`,
            },
          ],
        });
      }
    }

    setUiMode('confirmed');
  }

  return (
    <div
      className={cn(
        'rounded-lg border shadow-none bg-background overflow-hidden flex flex-col',
        uiMode === 'edit' ? 'border-[#c85aab]' : 'border-[#f5e4f0]',
        className,
      )}
    >
      
    <div className="px-6 pt-5 pb-3 border-b border-border">
      <p className="text-base font-bold text-foreground font-source-serif">Review and confirm</p>
      <p className="text-sm text-muted-foreground font-source-serif">Verify the details before submitting. Required fields are marked with an asterisk (<span className="text-red-700">*</span>).</p>
    </div>

      <div>
        <div className="px-6">
          {allFields.map((item, i) => (
            <div key={i} className="py-4 border-b border-border last:border-b-0">
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-sm font-bold text-card-foreground leading-snug font-source-serif">
                  {item.field}
                  {item.required && <span className="text-red-700 ml-0.5">*</span>}
                </span>
                {isManuallyEdited(item) ? (
                  <SourceLabel label="Manual" tooltip="Entered by you." />
                ) : item.source === 'missing' && item.required ? (
                  <SourceLabel label="Required" variant="missing" tooltip="Required to submit." />
                ) : item.source === 'missing' && !item.required ? (
                  <SourceLabel label="Optional" tooltip="Not required to submit." />
                ) : item.source === 'inferred' ? (
                  <AutofilledBadge />
                ) : (
                  <SourceLabel
                    label={item.source === 'database' ? 'Apricot 360' : 'Manual'}
                    tooltip={item.source === 'database' ? 'Filled in automatically from Apricot 360.' : 'Entered by you.'}
                  />
                )}
              </div>

              {uiMode === 'edit' ? (
                renderEditInput(item)
              ) : (
                getDisplayValue(item) ? (
                  <p className="text-sm text-foreground font-inter">{getDisplayValue(item)}</p>
                ) : (
                  <p className={cn('text-sm font-inter', item.required ? 'text-red-700' : 'text-muted-foreground')}>Not provided</p>
                )
              )}
            </div>
          ))}

          {allFields.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">No fields to display.</p>
          )}
        </div>
      </div>

      {notes && (
        <p className="text-sm text-muted-foreground italic px-6 py-4 border-t border-border">
          {notes}
        </p>
      )}

      <div className="px-6 py-4 border-t border-border flex flex-col gap-2 font-inter">
        {uiMode === 'edit' ? (
          <>
            <Button size="sm" className="w-full" onClick={handleConfirm} disabled={!isArtifactVisible}>
              <CheckIcon className="w-3 h-3 mr-1.5" />
              Confirm and submit
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleCancel} disabled={!isArtifactVisible}>
              Discard changes
            </Button>
          </>
        ) : (
          <>
            <Button
              className="w-full"
              onClick={handleEditStart}
              disabled={uiMode === 'confirmed' || !isArtifactVisible}
            >
              <PencilIcon className="w-3 h-3 mr-1.5" />
              Edit responses
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleConfirm}
              disabled={uiMode === 'confirmed' || !isArtifactVisible}
            >
              Confirm and submit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}