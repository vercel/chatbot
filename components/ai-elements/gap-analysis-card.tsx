'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface AvailableField {
  field: string;
  value: string;
}

interface MissingField {
  field: string;
  options?: string[];
  inputType?: string;
  multiSelect?: boolean;
  condition?: string;
}

interface GapAnalysisCardProps {
  formName?: string;
  availableFields: AvailableField[];
  missingFields: MissingField[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isSubmitted?: boolean;
  isSkipped?: boolean;
  className?: string;
}

export function GapAnalysisCard({
  formName,
  availableFields,
  missingFields,
  sendMessage,
  isSubmitted: initialSubmitted = false,
  isSkipped: initialSkipped = false,
  className,
}: GapAnalysisCardProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [skipped, setSkipped] = useState(initialSkipped);

  const disabled = submitted || skipped;

  function updateAnswer(field: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCheckbox(field: string, option: string, checked: boolean) {
    setAnswers((prev) => {
      const current = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: checked
          ? [...current, option]
          : current.filter((v) => v !== option),
      };
    });
  }

  function handleSkip() {
    if (!sendMessage) return;

    const name = formName || 'gap analysis';
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Skipped "${name}" for now. Please continue with the next step.`,
        },
      ],
    });
    setSkipped(true);
  }

  function handleSubmit() {
    if (!sendMessage) return;

    const lines: string[] = [];
    if (formName) {
      lines.push(`Answers for ${formName}:`);
    } else {
      lines.push('Answers for gap analysis:');
    }

    for (const field of missingFields) {
      const answer = answers[field.field];
      if (answer !== undefined && answer !== '') {
        const value = Array.isArray(answer) ? answer.join(', ') : answer;
        if (value) {
          const separator = field.field.endsWith('?') ? '' : ':';
          lines.push(`- ${field.field}${separator} ${value}`);
        }
      }
    }

    if (lines.length <= 1) return;

    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: lines.join('\n') }],
    });
    setSubmitted(true);
  }

  function renderField(field: MissingField) {
    const { field: name, options, inputType, multiSelect, condition } = field;

    // multiSelect with options → checkbox group
    if (multiSelect && options && options.length > 0) {
      const selected = (answers[name] as string[]) ?? [];
      return (
        <fieldset key={name} className="space-y-3">
          <Label className="font-semibold text-base">{name}</Label>
          <p className="text-sm text-muted-foreground italic">
            {condition || 'Select all that apply.'}
          </p>
          <div className="flex flex-col gap-3">
            {options.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  id={`${name}-${option}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) =>
                    toggleCheckbox(name, option, !!checked)
                  }
                  disabled={disabled}
                />
                <Label
                  htmlFor={`${name}-${option}`}
                  className="font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
      );
    }

    // boolean → radio Yes/No
    if (inputType === 'boolean') {
      return (
        <div key={name} className="space-y-2">
          <Label className="font-semibold">{name}</Label>
          {condition && (
            <p className="text-xs text-muted-foreground italic">{condition}</p>
          )}
          <RadioGroup
            value={(answers[name] as string) ?? ''}
            onValueChange={(value) => updateAnswer(name, value)}
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Yes" id={`${name}-yes`} />
              <Label htmlFor={`${name}-yes`} className="font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="No" id={`${name}-no`} />
              <Label htmlFor={`${name}-no`} className="font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        </div>
      );
    }

    // select (single) with options → dropdown
    if (inputType === 'select' && options && options.length > 0) {
      return (
        <div key={name} className="space-y-2">
          <Label className="font-semibold">{name}</Label>
          {condition && (
            <p className="text-xs text-muted-foreground italic">{condition}</p>
          )}
          <Select
            value={(answers[name] as string) ?? ''}
            onValueChange={(value) => updateAnswer(name, value)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // textarea
    if (inputType === 'textarea') {
      return (
        <div key={name} className="space-y-2">
          <Label className="font-semibold">{name}</Label>
          {condition && (
            <p className="text-xs text-muted-foreground italic">{condition}</p>
          )}
          <Textarea
            value={(answers[name] as string) ?? ''}
            onChange={(e) => updateAnswer(name, e.target.value)}
            placeholder={`Enter ${name.toLowerCase()}`}
            disabled={disabled}
          />
        </div>
      );
    }

    // date
    if (inputType === 'date') {
      return (
        <div key={name} className="space-y-2">
          <Label className="font-semibold">{name}</Label>
          {condition && (
            <p className="text-xs text-muted-foreground italic">{condition}</p>
          )}
          <Input
            type="date"
            value={(answers[name] as string) ?? ''}
            onChange={(e) => updateAnswer(name, e.target.value)}
            disabled={disabled}
          />
        </div>
      );
    }

    // text / default → text input
    return (
      <div key={name} className="space-y-2">
        <Label className="font-semibold">{name}</Label>
        {condition && (
          <p className="text-xs text-muted-foreground italic">{condition}</p>
        )}
        <Input
          type="text"
          value={(answers[name] as string) ?? ''}
          onChange={(e) => updateAnswer(name, e.target.value)}
          placeholder={`Enter ${name.toLowerCase()}`}
          disabled={disabled}
        />
      </div>
    );
  }

  if (skipped) {
    return (
      <Alert
        className={cn(
          'rounded-xl border-border bg-background p-6',
          className,
        )}
      >
        <AlertDescription>
          <p className="font-source-serif text-lg text-muted-foreground">
            {formName || 'Gap Analysis'}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Skipped
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      className={cn(
        'rounded-xl border-accent bg-background p-6',
        className,
      )}
    >
      <AlertDescription>
        <div className="font-source-serif leading-[1.5] text-foreground">
          {formName && (
            <p className="text-lg font-bold mb-1">{formName}</p>
          )}

          {availableFields.length > 0 && (
            <div className="mb-5">
              <p className="text-sm text-muted-foreground italic mb-3">
                Available from Database
              </p>
              {availableFields.map((item, i) => (
                <p key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                  <span>
                    {item.field}: {item.value}
                  </span>
                </p>
              ))}
            </div>
          )}

          {missingFields.length > 0 && (
            <div className="space-y-5">
              {missingFields.map((field) => renderField(field))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            {submitted ? (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                Answers submitted
              </p>
            ) : (
              missingFields.length > 0 &&
              sendMessage && (
                <>
                  <Button onClick={handleSubmit}>
                    Submit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSkip}
                    className="font-semibold"
                  >
                    Skip for now
                  </Button>
                </>
              )
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
