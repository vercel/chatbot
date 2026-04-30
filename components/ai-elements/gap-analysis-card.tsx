'use client';

import { useState } from 'react';
import { AlertTriangle, MinusCircle } from 'lucide-react';
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
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import type { GapField, GapSection } from '@/lib/types/form-cards';
import {
  CardShell,
  CheckCircleFilled,
  Modal,
  SectionFooter,
  SectionHeader,
} from './form-card-shared';

interface GapAnalysisCardProps {
  formName?: string;
  clientName?: string;
  sections: GapSection[];
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  isSubmitted?: boolean;
  isSkipped?: boolean;
  isReadonly?: boolean;
  // True only when this message is the last in the chat. In a read-only
  // replay, a non-last assistant message containing a gap analysis
  // implies the user already answered (or skipped) — we render the
  // "Information submitted" recap. If it IS the last message, the user
  // never answered and we keep the disabled CTA.
  isLastMessage?: boolean;
  className?: string;
}

type ModalView = null | 'detail' | 'readonly';

export function GapAnalysisCard({
  formName,
  clientName,
  sections,
  sendMessage,
  isSubmitted = false,
  isSkipped = false,
  isReadonly = false,
  isLastMessage = false,
  className,
}: GapAnalysisCardProps) {
  const assumeSubmitted = isReadonly && !isLastMessage;
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(isSubmitted || assumeSubmitted);
  const [skipped, setSkipped] = useState(isSkipped);
  const [modalView, setModalView] = useState<ModalView>(null);
  const [current, setCurrent] = useState(0);

  const firstName = clientName?.split(' ')[0];

  // Replays / read-only chats lock the inline buttons. Submitted state
  // still allows opening the read-only "View responses" modal.
  const interactionDisabled = isReadonly;

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

  function openDetail(at = 0) {
    setCurrent(at);
    setModalView('detail');
  }

  function openReadonly(at = 0) {
    setCurrent(at);
    setModalView('readonly');
  }

  function closeModal() {
    setModalView(null);
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
    closeModal();
  }

  function renderEditableField(field: GapField) {
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

  function renderReadonlyAnswer(field: GapField) {
    const value = answers[field.field];
    const display = Array.isArray(value) ? value.join(', ') : value;
    return (
      <div key={field.field} className="px-5 py-2">
        <div className="font-source-serif text-[15px] font-semibold mb-1">{field.field}</div>
        <div className="text-[14px] text-muted-foreground font-inter">
          {display ? display : <span className="italic">Not provided</span>}
        </div>
      </div>
    );
  }

  // ── Inline chat card ──────────────────────────────────────────────────────
  let chatCard: JSX.Element;
  if (submitted) {
    chatCard = (
      <CardShell variant="detail" className={className}>
        <div className="p-5">
          <div className="font-source-serif text-[14px]">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleFilled size={16} className="text-primary flex-shrink-0" />
              <p className="font-bold">Information submitted</p>
            </div>
            <p className="mb-4">
              Your responses have been submitted and will be applied to {clientName ?? 'the'}&rsquo;s application as it&rsquo;s filled out.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openReadonly(0)}
            className="border border-border text-sm font-medium px-4 py-2 rounded-md hover:bg-muted"
          >
            View responses
          </button>
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
              <p className="font-bold">Skipped for now</p>
            </div>
            <p className="mb-4">
              You can come back to fill in {firstName ? `${firstName}'s ` : ''}missing fields anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSkipped(false); openDetail(0); }}
            disabled={interactionDisabled}
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Provide answers
          </button>
        </div>
      </CardShell>
    );
  } else {
    chatCard = (
      <CardShell variant="cta" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-primary flex-shrink-0" />
            <p className="font-source-serif text-[14px] font-bold">
              Some fields couldn&rsquo;t be auto-filled
            </p>
          </div>
          <p className="font-source-serif text-[14px] mb-4">
            Answering these now means the AI won&rsquo;t need to pause and check in later.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openDetail(0)}
              disabled={interactionDisabled || !sendMessage || sections.length === 0}
              className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Provide answers
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={interactionDisabled || !sendMessage}
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
  let modalContent: JSX.Element | null = null;
  if (modalView && sections.length > 0) {
    const section = sections[current];
    const isLast = current === sections.length - 1;
    const sectionIds = sections.map((s) => s.id);
    const baseEyebrow = `Page ${current + 1} of ${sections.length}`;
    const eyebrow = modalView === 'readonly' ? `${baseEyebrow} · Read only` : baseEyebrow;

    modalContent = (
      <CardShell variant="detail" className="h-[70vh] flex flex-col">
        <SectionHeader title={section.title || formName || 'Missing information'} eyebrow={eyebrow} onClose={closeModal} />
        <div className="flex-1 overflow-y-auto py-3">
          {section.fields.map((f) =>
            modalView === 'readonly' ? (
              renderReadonlyAnswer(f)
            ) : (
              <div key={f.field} className="px-5 py-2">
                {renderEditableField(f)}
              </div>
            ),
          )}
        </div>
        <SectionFooter
          current={current}
          sectionIds={sectionIds}
          onPrev={() => (current === 0 ? closeModal() : setCurrent((c) => Math.max(0, c - 1)))}
          onNext={() => setCurrent((c) => Math.min(sections.length - 1, c + 1))}
          isLast={isLast}
          rightSlot={
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
                onClick={handleSubmit}
                className="text-[14px] font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Submit
              </button>
            )
          }
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
