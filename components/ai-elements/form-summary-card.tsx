'use client';

import { useState } from 'react';
import { PencilIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface SummaryField {
  field: string;
  value: string;
}

interface FormSummaryCardProps {
  formName?: string;
  fromDatabase: SummaryField[];
  fromCaseworker: SummaryField[];
  inferred: SummaryField[];
  missing?: string[];
  notes?: string;
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isArtifactVisible?: boolean;
  className?: string;
}

type FieldWithSource = {
  field: string;
  value: string;
  source: 'database' | 'caseworker' | 'inferred' | 'missing';
};

function AutofilledBadge() {
  return (
    <span className="text-[10px] text-primary font-medium bg-accent px-2 py-0.5 rounded-full uppercase tracking-wide font-mono inline-flex items-center gap-1 whitespace-nowrap">
      <svg
        className="w-3 h-3 fill-current shrink-0"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fill="white"
          fontSize="12"
          fontWeight="bold"
        >
          i
        </text>
      </svg>
      Autofilled
    </span>
  );
}

function SourceLabel({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: 'default' | 'missing';
}) {
  return (
    <span
      className={cn(
        'text-[10px] font-medium uppercase tracking-wide font-mono whitespace-nowrap',
        variant === 'missing' ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {label}
    </span>
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
    ...(missing ?? []).map((field) => ({ field, value: '', source: 'missing' as const })),
  ];

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

  function handleSaveChanges() {
    setSavedValues({ ...editValues });
    setUiMode('view');
  }

  const hasChanges = allFields.some(
    (item) => editValues[item.field] !== undefined && editValues[item.field] !== getDisplayValue(item),
  );

  function handleCancel() {
    setEditValues({});
    setUiMode('view');
  }

  function handleLooksGood() {
    if (sendMessage) {
      const changes: string[] = [];
      for (const item of allFields) {
        const currentValue = savedValues[item.field] ?? item.value;
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
        'rounded-xl border-0 shadow-none bg-muted/40 overflow-hidden flex flex-col',
        className,
      )}
    >
      {formName && (
        <div className="px-6 pt-5 pb-3 border-b border-border">
          <p className="text-base font-bold text-foreground font-source-serif">{formName}</p>
        </div>
      )}

      <div className="overflow-y-auto max-h-[500px]">
        <div className="px-6">
          {allFields.map((item, i) => (
            <div key={i} className="py-4 border-b border-border last:border-b-0">
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-sm font-bold text-card-foreground leading-snug">
                  {item.field}
                </span>
                {item.source === 'missing' ? (
                  <SourceLabel label="Missing" variant="missing" />
                ) : isManuallyEdited(item) ? (
                  <SourceLabel label="Manual" />
                ) : item.source === 'inferred' ? (
                  <AutofilledBadge />
                ) : (
                  <SourceLabel label={item.source === 'database' ? 'A360' : 'Manual'} />
                )}
              </div>

              {uiMode === 'edit' && item.source !== 'missing' ? (
                <Input
                  value={editValues[item.field] ?? getDisplayValue(item)}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      [item.field]: e.target.value,
                    }))
                  }
                  className="mt-1 h-8 text-sm bg-background"
                />
              ) : (
                getDisplayValue(item) && (
                  <p className="text-sm text-foreground">{getDisplayValue(item)}</p>
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

      <div className="px-6 py-4 border-t border-border flex items-center gap-2">
        {uiMode === 'edit' ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={!isArtifactVisible}>
              <XIcon className="w-3 h-3 mr-1.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveChanges} disabled={!isArtifactVisible || !hasChanges}>
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditStart}
              disabled={uiMode === 'confirmed' || !isArtifactVisible}
            >
              <PencilIcon className="w-3 h-3 mr-1.5" />
              Edit
            </Button>
            <Button
              size="sm"
              onClick={handleLooksGood}
              disabled={uiMode === 'confirmed' || !isArtifactVisible}
            >
              Looks good
            </Button>
          </>
        )}
      </div>
    </div>
  );
}