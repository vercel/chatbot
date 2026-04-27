'use client';

import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
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
import type { GapField, GapSection } from '@/lib/types/form-cards';
import {
  CardShell,
  ModalNavBar,
  SectionHeader,
} from './form-card-shared';

interface GapAnalysisCardProps {
  formName?: string;
  clientName?: string;
  sections: GapSection[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isSubmitted?: boolean;
  isSkipped?: boolean;
  isArtifactVisible?: boolean;
  className?: string;
}

export function GapAnalysisCard({
  formName,
  clientName,
  sections,
  sendMessage,
  isSubmitted = false,
  isSkipped = false,
  isArtifactVisible = true,
  className,
}: GapAnalysisCardProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(isSubmitted);
  const [skipped, setSkipped] = useState(isSkipped);
  const [expanded, setExpanded] = useState(false);
  const [current, setCurrent] = useState(0);

  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);
  const disabled = skipped || !isArtifactVisible;
  const firstName = clientName?.split(' ')[0];

  function updateAnswer(field: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function toggleCheckbox(field: string, option: string, checked: boolean) {
    setAnswers((prev) => {
      const cur = (prev[field] as string[]) ?? [];
      return {
        ...prev,
        [field]: checked ? [...cur, option] : cur.filter((v) => v !== option),
      };
    });
  }

  function openModal(at = 0) {
    setCurrent(at);
    setExpanded(true);
  }

  function collapse() {
    setExpanded(false);
  }

  function handleSkip() {
    if (!sendMessage) return;
    sendMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Skipped adding more data for now. Please continue with filling in with the data you already have.',
        },
      ],
    });
    setSkipped(true);
  }

  function handleSubmit() {
    if (!sendMessage) return;
    const lines: string[] = [];
    lines.push(formName ? `Answers for ${formName}:` : 'Answers for gap analysis:');
    for (const section of sections) {
      for (const field of section.fields) {
        const answer = answers[field.field];
        if (answer === undefined || answer === '') continue;
        const value = Array.isArray(answer) ? answer.join(', ') : answer;
        if (!value) continue;
        const separator = field.field.endsWith('?') ? '' : ':';
        lines.push(`- ${field.field}${separator} ${value}`);
      }
    }
    if (lines.length <= 1) return;
    sendMessage({ role: 'user', parts: [{ type: 'text', text: lines.join('\n') }] });
    setSubmitted(true);
    collapse();
  }

  function renderField(field: GapField) {
    const { field: name, options, inputType, multiSelect, condition, note, placeholder, required } = field;
    const helperText = note ?? condition;

    const fieldLabel = (
      <div className="mb-2">
        <span className="font-source-serif text-[15px] font-semibold">{name}</span>
        {required && <span className="text-red-700 ml-0.5">*</span>}
        {helperText && (
          <div className="text-[13px] text-muted-foreground mt-0.5 font-inter">{helperText}</div>
        )}
      </div>
    );

    if (multiSelect && options && options.length > 0) {
      const selected = (answers[name] as string[]) ?? [];
      return (
        <fieldset>
          {fieldLabel}
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  id={`${name}-${option}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) => toggleCheckbox(name, option, !!checked)}
                />
                <Label htmlFor={`${name}-${option}`} className="text-sm font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
      );
    }
    if (inputType === 'boolean') {
      return (
        <div>
          {fieldLabel}
          <RadioGroup
            value={(answers[name] as string) ?? ''}
            onValueChange={(value) => updateAnswer(name, value)}
            className="flex items-center gap-5"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Yes" id={`${name}-yes`} />
              <Label htmlFor={`${name}-yes`} className="text-sm font-normal cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="No" id={`${name}-no`} />
              <Label htmlFor={`${name}-no`} className="text-sm font-normal cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        </div>
      );
    }
    if (inputType === 'select' && options && options.length > 0) {
      return (
        <div>
          {fieldLabel}
          <Select
            value={(answers[name] as string) ?? ''}
            onValueChange={(value) => updateAnswer(name, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder ?? 'Select an option'} />
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
    if (inputType === 'textarea') {
      return (
        <div>
          {fieldLabel}
          <Textarea
            value={(answers[name] as string) ?? ''}
            onChange={(e) => updateAnswer(name, e.target.value)}
            placeholder={placeholder ?? `Enter ${name.toLowerCase()}`}
          />
        </div>
      );
    }
    if (inputType === 'date') {
      return (
        <div>
          {fieldLabel}
          <Input
            type="date"
            value={(answers[name] as string) ?? ''}
            onChange={(e) => updateAnswer(name, e.target.value)}
          />
        </div>
      );
    }
    return (
      <div>
        {fieldLabel}
        <Input
          type="text"
          value={(answers[name] as string) ?? ''}
          onChange={(e) => updateAnswer(name, e.target.value)}
          placeholder={placeholder ?? `Enter ${name.toLowerCase()}`}
        />
      </div>
    );
  }

  // ---------- Submitted summary state ----------
  if (submitted && !expanded) {
    const filledCount = Object.values(answers).filter(
      (v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ''),
    ).length;
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-1.5 mb-3 text-[hsl(142_55%_28%)]">
              <Check className="w-3.5 h-3.5" />
              <p className="font-bold">Information submitted</p>
            </div>
            <p className="mb-4 text-foreground">
              {filledCount > 0
                ? <>You filled in {filledCount} of {totalFields} field{totalFields === 1 ? '' : 's'}.{clientName ? <> I&rsquo;ll apply these to {clientName}&rsquo;s application.</> : null}</>
                : <>Your responses have been applied{clientName ? <> to {clientName}&rsquo;s application</> : null}.</>}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSubmitted(false); openModal(0); }}
            disabled={disabled}
            className="gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit responses
          </Button>
        </div>
      </CardShell>
    );
  }

  // ---------- Skipped summary state ----------
  if (skipped && !expanded) {
    return (
      <CardShell expanded={false} variant="cta">
        <div className={cn('p-5', className)}>
          <div className="font-source-serif text-[14px]">
            <p className="font-bold mb-3 text-muted-foreground">Skipped for now</p>
            <p className="mb-4 text-foreground">
              {firstName
                ? <>You can come back to fill in {firstName}&rsquo;s {totalFields} missing field{totalFields === 1 ? '' : 's'} anytime.</>
                : <>You can come back to fill in the missing fields anytime.</>}
            </p>
          </div>
          <Button size="sm" disabled className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            Provide info
          </Button>
        </div>
      </CardShell>
    );
  }

  // ---------- Detail modal (expanded) ----------
  if (expanded) {
    const section = sections[current];
    const isLast = current === sections.length - 1;
    return (
      <CardShell expanded variant="detail" onCollapse={collapse}>
        <SectionHeader
          title={section.title || formName || 'Missing information'}
          eyebrow={sections.length > 1 ? `Section ${current + 1} of ${sections.length}` : undefined}
          onClose={collapse}
        />
        <div className="py-3">
          {section.fields.map((f) => (
            <div key={f.field} className="px-5 py-2">
              {renderField(f)}
            </div>
          ))}
        </div>
        <ModalNavBar
          current={current}
          sectionIds={sections.map((s) => s.id)}
          onPrev={() => (current === 0 ? collapse() : setCurrent((c) => Math.max(0, c - 1)))}
          onNext={() => setCurrent((c) => Math.min(sections.length - 1, c + 1))}
          onJump={setCurrent}
          isLast={isLast}
          rightSlot={
            <button
              type="button"
              onClick={handleSubmit}
              className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Submit updates
            </button>
          }
        />
      </CardShell>
    );
  }

  // ---------- Default summary CTA ----------
  return (
    <CardShell expanded={false} variant="cta">
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <p className="font-bold mb-3">Missing information</p>
          <p className="mb-4 text-foreground">
            {firstName ? <>{firstName} has</> : <>You have</>} {totalFields} field{totalFields === 1 ? '' : 's'} I couldn&rsquo;t fill automatically. Add what you know — you can skip sections and come back.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => openModal(0)}
            disabled={disabled || !sendMessage || sections.length === 0}
            className="gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Provide info
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkip}
            disabled={disabled || !sendMessage}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
