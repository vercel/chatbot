'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, ChevronDown } from 'lucide-react';
import type { ChatMessage, Attachment } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Dispatch, SetStateAction } from 'react';
import type { Session } from 'next-auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PROGRAMS = [
  { id: 'benefits-cal', name: 'Benefits Cal', website: 'https://benefitscal.com/' },
  { id: 'wic', name: 'WIC', website: 'https://www.ruhealth.org/appointments/apply-4-wic-form' },
  { id: 'ihss', name: 'IHSS', website: 'https://www.riversideihss.org/Home/IHSSApply' },
];

interface BenefitApplicationsLandingProps {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isReadonly: boolean;
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  session: Session | null;
}

export function BenefitApplicationsLanding({
  input,
  setInput,
  chatId,
  sendMessage,
  session,
}: BenefitApplicationsLandingProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [program, setProgram] = useState<(typeof PROGRAMS)[number] | null>(null);
  const [query, setQuery] = useState('');
  const [isComboOpen, setIsComboOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = !!session;

  const isUrl = (s: string) => {
    try { new URL(s); return true; } catch { return false; }
  };

  const filteredPrograms = PROGRAMS.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  // Use a ref so the click-outside handler always sees the latest query value.
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setIsComboOpen(false);
        if (!isUrl(queryRef.current)) {
          setQuery(program?.name ?? '');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [program]);

  const submitMessage = (text: string) => {
    window.history.replaceState({}, '', `/chat/${chatId}`);
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text }],
    });
  };

  const handleStartAutoFilling = () => {
    if (!isLoggedIn || !clientId || (!program && !isUrl(query))) return;
    const target = program ? `${program.name} at ${program.website}` : query;
    submitMessage(`Retrieve ID #${clientId} and apply for ${target}`);
  };

  const handleCustomPrompt = () => {
    if (!isLoggedIn || !input.trim()) return;
    submitMessage(input.trim());
    setInput('');
  };

  const loginAlert = (
    <Alert className="border-primary/30 bg-primary/10">
      <AlertDescription className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 font-inter">
          <span className="text-base font-medium">Log in to get started</span>
          <span className="text-sm text-muted-foreground">
            You&apos;ll be able to complete applications once you&apos;re logged in.
          </span>
        </div>
        <Button
          onClick={() => router.push('/login')}
          className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Log in
        </Button>
      </AlertDescription>
    </Alert>
  );

  return (
    <div className="flex flex-1 flex-col bg-chat-background md:flex-row">
      {/* Left panel — desktop only */}
      <div className="hidden md:flex md:w-[38%] md:flex-col md:justify-start md:px-12 md:pt-24 lg:px-16 xl:w-[40%] xl:px-20">
        <h1 className="font-source-serif text-4xl leading-[1.15] text-foreground">
          Let&apos;s start a<br />
          new application.
        </h1>
        {!isLoggedIn && <div className="mt-6">{loginAlert}</div>}
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-start gap-6 overflow-y-auto px-4 py-8 sm:px-6 md:px-8 md:pb-10 md:pt-20">
        {/* Mobile: title + alert */}
        <div className="flex w-full max-w-[648px] flex-col gap-4 md:hidden">
          <h1 className="font-source-serif text-3xl leading-[1.15] text-foreground">
            Let&apos;s start a new application.
          </h1>
          {!isLoggedIn && loginAlert}
        </div>

        {/* Form card */}
        <div className="w-full max-w-[648px] rounded-lg bg-white px-8 py-10 shadow-sm">
          {/* Client ID */}
          <div className="mb-10">
            <p className="font-source-serif text-xl font-bold text-foreground">Client ID</p>
            <p className="font-source-serif text-xl text-[#787878]">
              Enter the client&apos;s Apricot 360 ID.
            </p>
            <input
              type="text"
              placeholder="00000"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={!isLoggedIn}
              className="mt-5 h-[52px] w-[129px] rounded-[10px] border border-[#b5b5b5] px-4 font-inter text-2xl placeholder:text-[#e1e1e1] focus:border-primary focus:shadow-[0px_0px_8px_0px_rgba(177,64,146,0.25)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>

          {/* Program */}
          <div className="mb-12">
            <p className="font-source-serif text-xl font-bold text-foreground">Program</p>
            <p className="font-source-serif text-xl text-[#787878]">
              Select the program or paste an application URL.
            </p>
            <div ref={comboRef} className="relative mt-5">
              <div
                className={`flex h-[52px] w-full items-center rounded-[10px] border bg-white px-4 transition-colors ${
                  isComboOpen ? 'border-primary ring-2 ring-primary/20' : 'border-[#b5b5b5]'
                } ${!isLoggedIn ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    if (isUrl(val)) {
                      setIsComboOpen(false);
                      if (program) setProgram(null);
                    } else {
                      setIsComboOpen(true);
                      if (program && val !== program.name) setProgram(null);
                    }
                  }}
                  onFocus={() => { if (!isUrl(query)) setIsComboOpen(true); }}
                  placeholder="Select a program"
                  disabled={!isLoggedIn}
                  className="flex-1 bg-transparent font-inter text-2xl text-foreground placeholder:text-[#b5b5b5] focus:outline-none disabled:cursor-not-allowed"
                />
                {query ? (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setProgram(null);
                      setQuery('');
                    }}
                    aria-label="Clear selection"
                    className="shrink-0 text-[#8e8e8e] hover:text-foreground"
                  >
                    &#x2715;
                  </button>
                ) : (
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#8e8e8e] transition-transform ${isComboOpen ? 'rotate-180' : ''}`}
                  />
                )}
              </div>
              {isComboOpen && (
                <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-[10px] border border-[#b5b5b5] bg-white shadow-md">
                  {filteredPrograms.length === 0 ? (
                    <p className="px-4 py-3 font-inter text-md text-muted-foreground">
                      No matching programs found. <br />
                      <span className="text-md text-muted-foreground">You can paste an application URL instead.</span>
                    </p>
                  ) : (
                    filteredPrograms.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setProgram(p);
                          setQuery(p.name);
                          setIsComboOpen(false);
                        }}
                        className={`w-full px-2 py-1 text-left font-inter text-xl hover:bg-primary/10 ${
                          program?.id === p.id ? 'bg-primary/5 text-primary' : 'text-foreground'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Start auto-filling */}
          <button
            onClick={handleStartAutoFilling}
            disabled={!isLoggedIn || !clientId || (!program && !isUrl(query))}
            className="rounded-lg bg-primary px-4 py-2 font-inter text-base font-semibold tracking-[0.08px] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start auto-filling
          </button>
        </div>

        {/* Custom prompt */}
        <div className="w-full max-w-[648px]">
          <p className="mb-2 font-inter text-[15px] text-foreground">
            Or, write your own prompt:
          </p>
          <div className="flex h-14 items-center gap-2 rounded-2xl border-2 border-input bg-card px-4">
            <input
              type="text"
              placeholder="Retrieve ID #XXXXX and apply for WIC"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCustomPrompt()}
              disabled={!isLoggedIn}
              className="flex-1 bg-transparent font-inter text-base placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
            <button
              onClick={handleCustomPrompt}
              disabled={!isLoggedIn || !input.trim()}
              className="flex items-center bg-primary gap-1 rounded-full px-3 py-1.5 font-inter text-sm font-medium text-white transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <CornerDownLeft className="h-4 w-4 text-white" />
              <span className="text-white">Submit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
