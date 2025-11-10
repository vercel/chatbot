'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ConsentModal } from '@/components/consent-modal';

interface ConsentPageProps {
  onConsent: () => void;
  onNavigateHome: () => void;
}

export function ConsentPage({ onConsent, onNavigateHome }: ConsentPageProps) {
  const [consentValue, setConsentValue] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);

  const handleConsent = () => {
    if (consentValue === 'yes') {
      onConsent();
    } else if (consentValue === 'no') {
      setShowModal(true);
    }
  };

  return (
    <div className="bg-background relative min-h-screen w-full">

      {/* Main Content */}
      <div className="flex flex-col items-start justify-center py-8 px-4 sm:py-12 sm:px-6 md:py-16 md:px-8 lg:py-20 lg:px-12 xl:py-24 xl:px-16">
        <div className="w-full max-w-4xl mx-auto text-left">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold text-foreground mb-4 leading-[1.15] font-source-serif">
            Consent for Agentic AI
          </h1>
          
          {/* Description */}
          <p className="text-sm sm:text-base md:text-lg lg:text-[18px] text-left text-foreground mb-6 sm:mb-8 leading-normal max-w-[700px] font-inter">
            This tool uses your personal data to submit for benefit applications using artificial intelligence (AI).
          </p>

          {/* Bullet Points */}
          <div className="max-w-[700px] mb-6 sm:mb-8">
            <ul className="text-sm sm:text-base md:text-lg lg:text-[18px] text-foreground text-left list-disc font-inter space-y-2 sm:space-y-3">
              <li className="ml-4 sm:ml-[27px]">
                <span className="leading-[1.05]">The AI tool is an early research prototype. It may make mistakes.</span>
              </li>
              <li className="ml-4 sm:ml-[27px]">
                <span className="leading-[1.05]">By consenting, you allow the AI to help complete forms and share information you provide.</span>
              </li>
              <li className="ml-4 sm:ml-[27px]">
                <span className="leading-[1.05]">Your data will only be shared with agencies or programs you select.</span>
              </li>
              <li className="ml-4 sm:ml-[27px]">
                <span className="leading-[1.05]">Do not consent if you are uncomfortable with these terms.</span>
              </li>
            </ul>
          </div>

          {/* Terms Link */}
          <p className="text-sm sm:text-base md:text-lg lg:text-[18px] text-left text-foreground mb-6 sm:mb-8 leading-normal max-w-[700px] font-inter">
            To learn more about how your data will be used, read the full{' '}
            <span className="underline hover:no-underline transition-all duration-200">terms & conditions</span>.
          </p>

          {/* Consent Section */}
          <div className="max-w-[700px] bg-muted dark:bg-muted/50 rounded-lg p-4 sm:p-6 border border-border">
            <h3 className="text-lg sm:text-xl lg:text-[20px] font-bold text-foreground mb-3 sm:mb-4 text-left font-inter">
              Consent
            </h3>
            
            <p className="text-sm sm:text-base md:text-lg lg:text-[18px] text-foreground mb-4 sm:mb-6 text-left font-inter">
              You may withdraw consent at any time.
            </p>

            <RadioGroup
              value={consentValue}
              onValueChange={setConsentValue}
              className="space-y-3 sm:space-y-4"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value="yes"
                  id="consent-yes"
                  data-testid="consent-yes"
                  className="mt-1 size-5 sm:size-6"
                />
                <div className="flex-1">
                  <label
                    htmlFor="consent-yes"
                    className="text-sm sm:text-base md:text-lg lg:text-[18px] text-left text-foreground cursor-pointer block leading-[1.2] font-inter"
                  >
                    I consent to the use of AI to complete forms and share my information with partner agencies on my behalf.
                  </label>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value="no"
                  id="consent-no"
                  data-testid="consent-no"
                  className="mt-1 size-5 sm:size-6"
                />
                <div className="flex-1">
                  <label
                    htmlFor="consent-no"
                    className="text-sm sm:text-base md:text-lg lg:text-[18px] text-left text-foreground cursor-pointer block leading-[1.2] font-inter"
                  >
                    I do NOT consent.
                  </label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Confirm Button */}
          <div className="flex justify-start mt-8 sm:mt-10 md:mt-12">
            <Button
              onClick={handleConsent}
              disabled={!consentValue}
              className="px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base lg:text-[16px] font-medium bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground rounded-2xl transition-colors duration-200 font-inter"
            >
              Confirm choices
            </Button>
          </div>
        </div>
      </div>

      {/* Modal for No Consent */}
      <ConsentModal 
        open={showModal} 
        onOpenChange={setShowModal} 
        onContinue={onNavigateHome} 
      />
    </div>
  );
}