'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Info, MinusCircle } from 'lucide-react';
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
  CheckCircleFilled,
  FieldSourceBadge,
  Modal,
  SectionFooter,
  SectionHeader,
} from './form-card-shared';

interface FormSummaryCardProps {
  formName?: string;
  clientName?: string;
  sections: ReviewSection[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isReadonly?: boolean;
  className?: string;
}

type ModalView = null | 'detail' | 'readonly';

export function FormSummaryCard({
  formName,
  clientName,
  sections,
  sendMessage,
  isReadonly = false,
  className,
}: FormSummaryCardProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [modalView, setModalView] = useState<ModalView>(null);
  const [current, setCurrent] = useState(0);

  const issueIndexes = useMemo(
    () =>
      sections
        .map((s, i) => (s.fields.some((f) => f.source === 'missing' && f.required) ? i : -1))
        .filter((i) => i >= 0),
    [sections],
  );
  const firstIssueIndex = issueIndexes[0] ?? 0;
  const hasIssues = issueIndexes.length > 0;
  const hasData = sections.some((s) => s.fields.some((f) => f.value));
  const interactionDisabled = isReadonly;

  function setEdit(name: string, value: string) {
    setEditValues((prev) => ({ ...prev, [name]: value }));
  }

  function valueFor(field: ReviewField) {
    return editValues[field.field] ?? field.value ?? '';
  }

  function openDetail(at: number) {
    setCurrent(Math.max(0, at));
    setModalView('detail');
  }

  function openReadonly(at = 0) {
    setCurrent(Math.max(0, at));
    setModalView('readonly');
  }

  function closeModal() {
    setModalView(null);
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
    closeModal();
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

  function renderRow(field: ReviewField, readOnly: boolean) {
    const value = valueFor(field);
    const isMissingRequired = field.source === 'missing' && field.required;
    return (
      <div key={field.field} className="px-5 py-2">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="font-source-serif text-[15px] font-semibold text-foreground">
            {field.field}
            {field.required && <span className="text-red-700 ml-0.5">*</span>}
          </span>
          <FieldSourceBadge
            source={field.source}
            required={field.required}
            inferredFrom={field.inferredFrom}
          />
        </div>
        {readOnly ? (
          <div className="text-[14px] font-inter text-muted-foreground">
            {value ? value : <span className={cn('italic', isMissingRequired ? 'text-red-700 not-italic' : '')}>Not provided</span>}
          </div>
        ) : (
          renderEditableField(field)
        )}
      </div>
    );
  }

  // ── Inline chat card ──────────────────────────────────────────────────────
  let chatCard: ReactNode;
  if (confirmed) {
    chatCard = (
      <CardShell variant="detail" className={className}>
        <div className="p-5">
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleFilled size={16} className="text-primary flex-shrink-0" />
              <p className="font-bold">Review complete</p>
            </div>
            <p className="mb-4">
              You&rsquo;ve reviewed {clientName ?? 'the'}&rsquo;s application. It&rsquo;s ready to submit.
            </p>
          </div>
          {hasData && (
            <button
              type="button"
              onClick={() => openReadonly(0)}
              className="border border-border text-sm font-medium px-4 py-2 rounded-md hover:bg-muted"
            >
              View responses
            </button>
          )}
        </div>
      </CardShell>
    );
  } else if (skipped) {
    chatCard = (
      <CardShell variant="detail" className={className}>
        <div className="p-5">
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-2 mb-3">
              <MinusCircle size={14} className="text-muted-foreground flex-shrink-0" />
              <p className="font-bold">Review skipped</p>
            </div>
            <p className="mb-4">
              You can come back to review {clientName ? `${clientName}'s ` : ''}application before submitting.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSkipped(false); openDetail(firstIssueIndex); }}
            disabled={interactionDisabled || sections.length === 0}
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start review
          </button>
        </div>
      </CardShell>
    );
  } else if (interactionDisabled && hasData) {
    // Read-only chat (replay) but data exists → read-only access only.
    chatCard = (
      <CardShell variant="detail" className={className}>
        <div className="p-5">
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className="text-primary flex-shrink-0" />
              <p className="font-bold">{hasIssues ? 'Ready to review' : 'Ready to submit'}</p>
            </div>
            <p className="mb-4">
              Confirm each field is accurate before submitting. You&rsquo;ll see how each one was filled.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openReadonly(firstIssueIndex)}
            className="border border-border text-sm font-medium px-4 py-2 rounded-md hover:bg-muted"
          >
            View responses
          </button>
        </div>
      </CardShell>
    );
  } else {
    chatCard = (
      <CardShell variant="cta" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-primary flex-shrink-0" />
            <p className="font-source-serif text-[14px] font-bold">
              {hasIssues ? 'Ready to review' : 'Ready to submit'}
            </p>
          </div>
          <p className="font-source-serif text-[14px] mb-4">
            Confirm each field is accurate before submitting. You&rsquo;ll see how each one was filled.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openDetail(hasIssues ? firstIssueIndex : 0)}
              disabled={interactionDisabled || sections.length === 0}
              className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasIssues ? 'Start review' : 'Review & submit'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={interactionDisabled}
              className="bg-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip for now
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Modal content ─────────────────────────────────────────────────────────
  let modalContent: ReactNode = null;
  if (modalView && sections.length > 0) {
    const section = sections[current];
    const isLast = current === sections.length - 1;
    const sectionIds = sections.map((s) => s.id);
    const baseEyebrow = `Page ${current + 1} of ${sections.length}`;
    const eyebrow = modalView === 'readonly' ? `${baseEyebrow} · Read only` : baseEyebrow;

    const rightSlot =
      modalView === 'readonly' ? (
        <button
          type="button"
          onClick={closeModal}
          className="text-[14px] font-semibold px-5 py-2.5 rounded-full border border-border hover:bg-muted"
        >
          Done
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConfirm}
          className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Submit
        </button>
      );

    modalContent = (
      <CardShell variant="detail" className="h-[70vh] flex flex-col">
        <SectionHeader title={section.title || formName || 'Review'} eyebrow={eyebrow} onClose={closeModal} />
        <div className="flex-1 overflow-y-auto py-3">
          {section.fields.map((f) => renderRow(f, modalView === 'readonly'))}
          {section.fields.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">No fields in this section.</p>
          )}
        </div>
        <SectionFooter
          current={current}
          sectionIds={sectionIds}
          onPrev={() => (current === 0 ? closeModal() : setCurrent((c) => Math.max(0, c - 1)))}
          onNext={() => setCurrent((c) => Math.min(sections.length - 1, c + 1))}
          isLast={isLast}
          rightSlot={rightSlot}
        />
      </CardShell>
    );
  }

  return (
    <>
      {chatCard}
      {modalView && modalContent && <Modal onCollapse={closeModal}>{modalContent}</Modal>}
    </>
  );
}
