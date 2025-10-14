'use client';

import { ConsentPage } from '@/components/consent-page';
import { useRouter } from 'next/navigation';

export default function Consent() {
  const router = useRouter();

  const handleConsent = () => {
    // Set cookie to indicate coming from consent flow
    document.cookie = 'from-consent=true; path=/; max-age=60'; // 60 seconds expiry
    // Set the model to web-automation-model for browser automation
    document.cookie = 'chat-model=web-automation-model; path=/; max-age=60'; // 60 seconds expiry
    // Navigate to the main chat page after consent is given
    router.push('/');
  };

  const handleNavigateHome = () => {
    // Navigate to home page
    router.push('/home');
  };

  return <ConsentPage onConsent={handleConsent} onNavigateHome={handleNavigateHome} />;
}
