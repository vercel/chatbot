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
  className?: string;
}

export function GapAnalysisCard({
  formName,
  availableFields,
  missingFields,
  sendMessage,
  isSubmitted: initialSubmitted = false,
  className,
}: GapAnalysisCardProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(initialSubmitted);

  const disabled = submitted;

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
        <fieldset key={name} className="space-y-2">
          <Label className="font-semibold">{name}</Label>
          {condition && (
            <p className="text-xs text-muted-foreground italic">{condition}</p>
          )}
          <div className="flex flex-col gap-2">
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

  return (
    <Alert
      className={cn(
        'bg-accent/25 border-accent dark:bg-accent/10',
        className,
      )}
    >
      <AlertDescription>
        <div className="flex flex-col gap-px">
          <div className="font-source-serif font-normal leading-[1.5] text-[14px] text-foreground">
            <p className="font-bold mb-[14px]">
              Gap Analysis{formName ? `: ${formName}` : ''}
            </p>

            {availableFields.length > 0 && (
              <div className="mb-[14px]">
                <p className="font-semibold mb-1">Available from Database</p>
                {availableFields.map((item, i) => (
                  <p key={i} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span>
                      {item.field}: {item.value}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {missingFields.length > 0 && (
              <div className="mb-[14px] space-y-4">
                <p className="font-semibold mb-1">Needs Your Input</p>
                {missingFields.map((field) => renderField(field))}
              </div>
            )}

            {submitted ? (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                Answers submitted
              </p>
            ) : (
              missingFields.length > 0 &&
              sendMessage && (
                <Button onClick={handleSubmit} className="mt-2">
                  Submit Answers
                </Button>
              )
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
