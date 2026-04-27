'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, ClipboardCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import type { ReviewField, ReviewSection } from '@/lib/types/form-cards';
import {
  CardShell,
  FieldSourceBadge,
  Modal,
  ModalNavBar,
  SectionHeader,
} from './form-card-shared';

const PAGE_FIELD_LIMIT = 5;

type ReviewPage = {
  key: string;
  sectionTitle: string;
  fields: ReviewField[];
  hasMissingRequired: boolean;
};

function paginate(sections: ReviewSection[]): ReviewPage[] {
  const pages: ReviewPage[] = [];
  for (const section of sections) {
    const chunkInto = (chunk: ReviewField[], pageIndex: number) => {
      pages.push({
        key: `${section.id}-${pageIndex + 1}`,
        sectionTitle: section.title,
        fields: chunk,
        hasMissingRequired: chunk.some((f) => f.source === 'missing' && f.required),
      });
    };
    if (section.fields.length <= PAGE_FIELD_LIMIT) {
      chunkInto(section.fields, 0);
      continue;
    }
    const total = Math.ceil(section.fields.length / PAGE_FIELD_LIMIT);
    for (let p = 0; p < total; p++) {
      chunkInto(section.fields.slice(p * PAGE_FIELD_LIMIT, (p + 1) * PAGE_FIELD_LIMIT), p);
    }
  }
  return pages;
}

interface FormSummaryCardProps {
  formName?: string;
  clientName?: string;
  sections: ReviewSection[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isArtifactVisible?: boolean;
  className?: string;
}

export function FormSummaryCard({
  formName,
  clientName,
  sections,
  sendMessage,
  isArtifactVisible = true,
  className,
}: FormSummaryCardProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [current, setCurrent] = useState(0);

  const pages = useMemo(() => paginate(sections), [sections]);
  const firstIssuePageIndex = useMemo(
    () => pages.findIndex((p) => p.hasMissingRequired),
    [pages],
  );
  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);
  const missingRequiredCount = sections.reduce(
    (n, s) => n + s.fields.filter((f) => f.source === 'missing' && f.required).length,
    0,
  );
  const hasIssues = firstIssuePageIndex >= 0;
  const hasData = sections.some((s) => s.fields.some((f) => f.value));
  const disabled = skipped || !isArtifactVisible;

  function setEdit(name: string, value: string) {
    setEditValues((prev) => ({ ...prev, [name]: value }));
  }

  function valueFor(field: ReviewField) {
    return editValues[field.field] ?? field.value ?? '';
  }

  function openEditable(at: number) {
    setReadOnly(false);
    setCurrent(Math.max(0, at));
    setExpanded(true);
  }

  function openReadOnly(at = 0) {
    setReadOnly(true);
    setCurrent(Math.max(0, at));
    setExpanded(true);
  }

  function collapse() {
    setExpanded(false);
  }

  function handleSkip() {
    setSkipped(true);
  }

  function handleConfirm() {
    if (sendMessage) {
      const changes: string[] = [];
      for (const section of sections) {
        for (const field of section.fields) {
          const next = editValues[field.field];
          if (next !== undefined && next !== (field.value ?? '') && next.trim() !== '') {
            changes.push(`- ${field.field}: ${next}`);
          }
        }
      }
      const formContext = formName ? ` for ${formName}` : '';
      const text =
        changes.length > 0
          ? `Please update the following form fields${formContext}:\n${changes.join('\n')}\n\nOnce updated, please ask the user to click the "Take control" button to take control and submit the form.`
          : `The form${formContext} looks good. The form is complete, please ask the user to click the "Take control" button to take control and submit the form.`;
      sendMessage({ role: 'user', parts: [{ type: 'text', text }] });
    }
    setConfirmed(true);
    collapse();
  }

  function renderEditableField(field: ReviewField) {
    const value = valueFor(field);
    const onChange = (v: string) => setEdit(field.field, v);
    const isMissingRequired = field.source === 'missing' && field.required;
    const inputClass = cn(
      'mt-1 h-9 text-sm bg-background',
      isMissingRequired && !value && 'border-[hsl(6_65%_60%)] bg-[hsl(6_80%_98%)]',
    );

    switch (field.inputType) {
      case 'select':
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder={isMissingRequired ? 'Required — select an option' : 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={value} onValueChange={onChange} className="mt-2 flex flex-col gap-1.5">
            {(field.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.field}-${opt}`} />
                <Label htmlFor={`${field.field}-${opt}`} className="text-sm font-normal cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox': {
        const selected = value ? value.split(',').map((s) => s.trim()) : [];
        const toggle = (opt: string) => {
          const next = selected.includes(opt)
            ? selected.filter((s) => s !== opt)
            : [...selected, opt];
          onChange(next.join(', '));
        };
        return (
          <div className="mt-2 flex flex-col gap-1.5">
            {(field.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.field}-${opt}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={() => toggle(opt)}
                />
                <Label htmlFor={`${field.field}-${opt}`} className="text-sm font-normal cursor-pointer">
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
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isMissingRequired ? 'Required — enter a value' : ''}
            className={inputClass}
          />
        );
    }
  }

  function renderRow(field: ReviewField) {
    const value = valueFor(field);
    const isMissingRequired = field.source === 'missing' && field.required;
    return (
      <div key={field.field} className="px-5 py-3 border-b border-border last:border-b-0">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="font-source-serif text-[15px] font-semibold text-foreground">
            {field.field}
            {field.required && <span className="text-red-700 ml-0.5">*</span>}
          </span>
          <FieldSourceBadge source={field.source} required={field.required} />
        </div>
        {readOnly ? (
          value ? (
            <p className="text-sm text-foreground font-inter">{value}</p>
          ) : (
            <p className={cn('text-sm font-inter', isMissingRequired ? 'text-red-700' : 'text-muted-foreground')}>
              Not provided
            </p>
          )
        ) : (
          renderEditableField(field)
        )}
      </div>
    );
  }

  // CTA stays mounted in the chat thread regardless of modal state.
  let ctaContent: ReactNode;
  if (confirmed) {
    ctaContent = (
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <div className="flex items-center gap-1.5 mb-3 text-[hsl(142_55%_28%)]">
            <Check className="w-3.5 h-3.5" />
            <p className="font-bold">Application submitted</p>
          </div>
          <p className="mb-4 text-foreground">
            {clientName ? <>{clientName}&rsquo;s</> : <>The</>} {formName ? `${formName} ` : ''}application has been submitted.
          </p>
        </div>
        {hasData && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReadOnly(0)}
            disabled={expanded}
            className="gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            View submitted
          </Button>
        )}
      </div>
    );
  } else if (skipped) {
    ctaContent = (
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <p className="font-bold mb-3 text-muted-foreground">Review skipped</p>
          <p className="mb-4 text-foreground">
            You can come back to review {clientName ? `${clientName}'s ` : ''}application before submitting.
          </p>
        </div>
        {hasData ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReadOnly(0)}
            disabled={expanded}
            className="gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            View submitted
          </Button>
        ) : (
          <Button size="sm" disabled className="gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Start review
          </Button>
        )}
      </div>
    );
  } else if (disabled && hasData) {
    ctaContent = (
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <p className="font-bold mb-3">Application ready for review</p>
          <p className="mb-4 text-foreground">
            {hasIssues
              ? <>I filled in {totalFields - missingRequiredCount} of {totalFields} fields{clientName ? <> for {clientName}</> : null}. {missingRequiredCount} required field{missingRequiredCount === 1 ? ' is' : 's are'} still missing.</>
              : <>I filled in all {totalFields} fields{clientName ? <> for {clientName}</> : null}.</>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openReadOnly(firstIssuePageIndex >= 0 ? firstIssuePageIndex : 0)}
          disabled={expanded}
          className="gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          View submitted
        </Button>
      </div>
    );
  } else {
    ctaContent = (
      <div className={cn('p-5', className)}>
        <div className="font-source-serif text-[14px]">
          <p className="font-bold mb-3">Application ready for review</p>
          <p className="mb-4 text-foreground">
            {hasIssues
              ? <>I filled in {totalFields - missingRequiredCount} of {totalFields} fields{clientName ? <> for {clientName}</> : null}. {missingRequiredCount} required field{missingRequiredCount === 1 ? ' is' : 's are'} still missing — review and fill them in before submitting.</>
              : <>I filled in all {totalFields} fields{clientName ? <> for {clientName}</> : null}. Review the answers before submitting.</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => openEditable(hasIssues ? firstIssuePageIndex : 0)}
            disabled={disabled || expanded || pages.length === 0}
            className="gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            {hasIssues ? 'Start review' : 'Review & submit'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkip}
            disabled={disabled || expanded}
          >
            Skip for now
          </Button>
        </div>
      </div>
    );
  }

  const page = expanded ? pages[current] : undefined;
  const isLast = page ? current === pages.length - 1 : false;
  const submitButton =
    readOnly || disabled ? null : (
      <button
        type="button"
        onClick={handleConfirm}
        className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Submit updates
      </button>
    );

  return (
    <>
      <CardShell variant="cta">{ctaContent}</CardShell>
      {expanded && page && (
        <Modal onCollapse={collapse}>
          <SectionHeader
            title={page.sectionTitle || formName || 'Review'}
            eyebrow={pages.length > 1 ? `Step ${current + 1} of ${pages.length}` : undefined}
            onClose={collapse}
          />
          <div>
            {page.fields.map((f) => renderRow(f))}
            {page.fields.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">No fields in this section.</p>
            )}
          </div>
          <ModalNavBar
            current={current}
            sectionIds={pages.map((p) => p.key)}
            onPrev={() => (current === 0 ? collapse() : setCurrent((c) => Math.max(0, c - 1)))}
            onNext={() => setCurrent((c) => Math.min(pages.length - 1, c + 1))}
            onJump={setCurrent}
            isLast={isLast}
            rightSlot={submitButton}
          />
        </Modal>
      )}
    </>
  );
}
