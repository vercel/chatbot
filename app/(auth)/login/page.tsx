'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { toast } from '@/components/toast';
import { signIn } from 'next-auth/react';
import { MicrosoftLogo } from '@/components/icons/MicrosoftLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';

function ErrorHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast({
        type: 'error',
        description: 'Access denied',
      });
      // Clear the error from URL without refresh
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [loadingMethod, setLoadingMethod] = useState<'microsoft' | 'google' | null>(null);

  // Use callbackUrl from URL params, default to /home
  const callbackUrl = searchParams.get('callbackUrl') || '/home';

  const handleGoogleLogin = async () => {
    setLoadingMethod('google');
    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to sign in with Google',
      });
      setLoadingMethod(null);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoadingMethod('microsoft');
    try {
      await signIn('microsoft-entra-id', { callbackUrl });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to sign in with Microsoft',
      });
      setLoadingMethod(null);
    }
  };

  return (
    <div className="bg-chat-background relative size-full min-h-screen">
      <div className="absolute bg-card border border-border border-solid h-[260px] left-1/2 rounded-[10px] top-[257px] -translate-x-1/2 w-[414px]">
        <div className="absolute content-stretch flex flex-col gap-[18px] h-[42px] items-center left-[32px] top-[32px] w-[350px]">
          <p className="font-source-serif leading-normal min-w-full not-italic relative shrink-0 text-[32px] text-center text-card-foreground tracking-[0.16px]">
            Welcome
          </p>
          <p className="font-inter font-normal leading-normal min-w-full not-italic relative shrink-0 text-[14px] text-center text-muted-foreground tracking-[0.07px]">
            Sign in to access the Form-Filling Assistant
          </p>
          
          {/* Microsoft Login Button */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={loadingMethod !== null}
            className="border border-border border-solid box-border content-stretch flex gap-[8px] items-center justify-center min-h-[36px] px-[16px] py-[7.5px] relative rounded-[8px] shrink-0 w-full hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-card"
          >
            <div className="relative shrink-0 size-[13.25px]">
              <MicrosoftLogo size={13.25} className="block max-w-none size-full" />
            </div>
            <div className="flex flex-col font-inter font-medium justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-center text-card-foreground text-nowrap">
              <p className="leading-normal whitespace-pre">
                {loadingMethod === 'microsoft' ? 'Signing in...' : 'Continue with Microsoft'}
              </p>
            </div>
          </button>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loadingMethod !== null}
            className="border border-border border-solid box-border content-stretch flex gap-[8px] items-center justify-center min-h-[36px] px-[16px] py-[7.5px] relative rounded-[8px] shrink-0 w-full hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-card"
          >
            <div className="relative shrink-0 size-[13.25px]">
              <GoogleLogo size={13.25} className="block max-w-none size-full" />
            </div>
            <div className="flex flex-col font-inter font-medium justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-center text-card-foreground text-nowrap">
              <p className="leading-normal whitespace-pre">
                {loadingMethod === 'google' ? 'Signing in...' : 'Continue with Google'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ErrorHandler />
      <LoginContent />
    </Suspense>
  );
}
