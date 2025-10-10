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
    <div className="bg-white relative min-h-screen w-full">

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <div className="max-w-[879px] w-full text-center">
          {/* Title */}
          <h1 className="text-[42px] font-bold text-black mb-4 leading-[1.15]">
            Consent for Agentic AI
          </h1>
          
          {/* Description */}
          <p className="text-[18px] text-left text-black mb-8 leading-[1.5] max-w-[552px] mx-auto">
            This tool uses your personal data to submit for benefit applications using artificial intelligence (AI).
          </p>

          {/* Bullet Points */}
          <div className="max-w-[563px] mx-auto mb-8">
            <ul className="text-[18px] text-black text-left list-disc">
              <li className="mb-3 ml-[27px]">
                <span className="leading-[1.05]">The AI tool is an early research prototype. It may make mistakes.</span>
              </li>
              <li className="mb-3 ml-[27px]">
                <span className="leading-[1.05]">By consenting, you allow the AI to help complete forms and share information you provide.</span>
              </li>
              <li className="mb-3 ml-[27px]">
                <span className="leading-[1.05]">Your data will only be shared with agencies or programs you select.</span>
              </li>
              <li className="ml-[27px]">
                <span className="leading-[1.05]">Do not consent if you are uncomfortable with these terms.</span>
              </li>
            </ul>
          </div>

          {/* Terms Link */}
          <p className="text-[18px] text-left text-black mb-8 leading-[1.5] max-w-[552px] mx-auto">
            To learn more about how your data will be used, read the full{' '}
            <span className="underline">terms & conditions</span>.
          </p>

          {/* Consent Section */}
          <div className="max-w-[604px] mx-auto bg-gray-50 rounded-lg p-6">
            <h3 className="text-[20px] font-bold text-black mb-4 text-left">
              Consent
            </h3>
            
            <p className="text-[18px] text-black mb-6 text-left">
              You may withdraw consent at any time.
            </p>

            <RadioGroup
              value={consentValue}
              onValueChange={setConsentValue}
              className="space-y-4"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value="yes"
                  id="consent-yes"
                  data-testid="consent-yes"
                  className="mt-1 h-6 w-6"
                />
                <div className="flex-1">
                  <label
                    htmlFor="consent-yes"
                    className="text-[18px] text-left text-black cursor-pointer block leading-[1.2]"
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
                  className="mt-1 h-6 w-6"
                />
                <div className="flex-1">
                  <label
                    htmlFor="consent-no"
                    className="text-[18px] text-left text-black cursor-pointer block leading-[1.2]"
                  >
                    I do NOT consent.
                  </label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Confirm Button */}
          <div className="flex justify-center mt-12">
            <Button
              onClick={handleConsent}
              disabled={!consentValue}
              className="px-6 py-4 text-[16px] font-medium bg-[#b14092] hover:bg-[#9a3579] disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-2xl transition-colors duration-200"
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