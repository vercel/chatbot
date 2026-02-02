'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { toast } from '@/components/toast';
import { signIn } from 'next-auth/react';
import { MicrosoftLogo } from '@/components/icons/MicrosoftLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';

// Feature flag for guest login in preview environments
const useGuestLogin = process.env.NEXT_PUBLIC_USE_GUEST_LOGIN === 'true';

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
  const [loadingMethod, setLoadingMethod] = useState<'microsoft' | 'google' | 'guest' | null>(null);
  const [hasAutoSignedIn, setHasAutoSignedIn] = useState(false);

  // Use callbackUrl from URL params, default to /home
  // Make it absolute to ensure redirect goes to the correct host
  const callbackUrlParam = searchParams.get('callbackUrl') || '/home';
  const callbackUrl = typeof window !== 'undefined' && callbackUrlParam.startsWith('/')
    ? `${window.location.origin}${callbackUrlParam}`
    : callbackUrlParam;

  // Auto sign-in as guest when feature flag is enabled
  useEffect(() => {
    if (useGuestLogin && !hasAutoSignedIn) {
      setHasAutoSignedIn(true);
      setLoadingMethod('guest');
      signIn('guest', { callbackUrl });
    }
  }, [callbackUrl, hasAutoSignedIn]);

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

  // Show loading state when auto-signing in as guest
  if (useGuestLogin) {
    return (
      <div className="bg-chat-background relative size-full min-h-screen">
        <div className="absolute bg-card border border-border border-solid left-1/2 rounded-[10px] top-[257px] -translate-x-1/2 w-[414px] h-[180px]">
          <div className="content-stretch flex flex-col gap-[18px] items-center px-[32px] pt-[32px] w-full">
            <p className="font-source-serif leading-normal min-w-full not-italic relative shrink-0 text-[32px] text-center text-card-foreground tracking-[0.16px]">
              Welcome
            </p>
            <p className="font-inter font-normal leading-normal min-w-full not-italic relative shrink-0 text-[14px] text-center text-muted-foreground tracking-[0.07px]">
              Signing you in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-chat-background relative size-full min-h-screen">
      <div className="absolute bg-card border border-border border-solid left-1/2 rounded-[10px] top-[257px] -translate-x-1/2 w-[414px] h-[260px]">
        <div className="content-stretch flex flex-col gap-[18px] items-center px-[32px] pt-[32px] w-full">
          <p className="font-source-serif leading-normal min-w-full not-italic relative shrink-0 text-[32px] text-center text-card-foreground tracking-[0.16px]">
            Welcome
          </p>
          <p className="font-inter font-normal leading-normal min-w-full not-italic relative shrink-0 text-[14px] text-center text-muted-foreground tracking-[0.07px]">
            Sign in to access the Form-Filling Assistant
          </p>

          {/* Microsoft Login Button */}
          <button
            type="button"
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
            type="button"
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
