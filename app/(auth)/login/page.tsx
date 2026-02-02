'use client';

import Link from 'next/link';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingMethod, setLoadingMethod] = useState<'microsoft' | 'google' | 'guest' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Use callbackUrl from URL params, default to /home
  const callbackUrl = searchParams.get('callbackUrl') || '/home';

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        type: 'error',
        description: 'Please enter email and password',
      });
      return;
    }

    setLoadingMethod('guest');
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          type: 'error',
          description: 'Invalid email or password',
        });
        setLoadingMethod(null);
      } else {
        router.push(callbackUrl);
      }
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to sign in',
      });
      setLoadingMethod(null);
    }
  };

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
      <div className={`absolute bg-card border border-border border-solid left-1/2 rounded-[10px] top-[257px] -translate-x-1/2 w-[414px] ${useGuestLogin ? 'h-auto pb-8' : 'h-[260px]'}`}>
        <div className="content-stretch flex flex-col gap-[18px] items-center px-[32px] pt-[32px] w-full">
          <p className="font-source-serif leading-normal min-w-full not-italic relative shrink-0 text-[32px] text-center text-card-foreground tracking-[0.16px]">
            Welcome
          </p>
          <p className="font-inter font-normal leading-normal min-w-full not-italic relative shrink-0 text-[14px] text-center text-muted-foreground tracking-[0.07px]">
            Sign in to access the Form-Filling Assistant
          </p>

          {/* Guest Login Form - Only shown in preview environments */}
          {useGuestLogin && (
            <>
              <form onSubmit={handleGuestLogin} className="flex flex-col gap-3 w-full">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loadingMethod !== null}
                  className="border border-border rounded-[8px] px-4 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loadingMethod !== null}
                  className="border border-border rounded-[8px] px-4 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loadingMethod !== null}
                  className="bg-primary text-primary-foreground font-inter font-medium text-[14px] rounded-[8px] px-4 py-2 w-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMethod === 'guest' ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <p className="text-muted-foreground text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary hover:underline">
                  Create one
                </Link>
              </p>

              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-border" />
                <span className="text-muted-foreground text-xs">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

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
