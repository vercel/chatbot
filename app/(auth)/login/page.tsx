'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { signIn } from 'next-auth/react';
import { MicrosoftLogo } from '@/components/icons/MicrosoftLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/home' });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to sign in with Google',
      });
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    toast({
      type: 'success',
      description: 'Microsoft sign-in coming soon!',
    });
  };

  return (
    <div className="bg-chat-background relative size-full min-h-screen">
      <div className="absolute bg-card border border-border border-solid h-[260px] left-1/2 rounded-[10px] top-[257px] translate-x-[-50%] w-[414px]">
        <div className="absolute content-stretch flex flex-col gap-[18px] h-[42px] items-center left-[32px] top-[32px] w-[350px]">
          <p className="font-source-serif leading-[1.5] min-w-full not-italic relative shrink-0 text-[32px] text-center text-card-foreground tracking-[0.16px]">
            Welcome
          </p>
          <p className="font-inter font-normal leading-[1.5] min-w-full not-italic relative shrink-0 text-[14px] text-center text-muted-foreground tracking-[0.07px]">
            Sign in to access the Form-Filling Assistant
          </p>
          
          {/* Microsoft Login Button */}
          <button
            onClick={handleMicrosoftLogin}
            disabled={true}
            className="border border-border border-solid box-border content-stretch flex gap-[8px] items-center justify-center min-h-[36px] px-[16px] py-[7.5px] relative rounded-[8px] shrink-0 w-full opacity-50 cursor-not-allowed transition-colors bg-card"
          >
            <div className="relative shrink-0 size-[13.25px]">
              <MicrosoftLogo size={13.25} className="block max-w-none size-full" />
            </div>
            <div className="flex flex-col font-inter font-medium justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-center text-card-foreground text-nowrap">
              <p className="leading-[14px] whitespace-pre">
                Continue with Microsoft (Coming Soon)
              </p>
            </div>
          </button>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="border border-border border-solid box-border content-stretch flex gap-[8px] items-center justify-center min-h-[36px] px-[16px] py-[7.5px] relative rounded-[8px] shrink-0 w-full hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-card"
          >
            <div className="relative shrink-0 size-[13.25px]">
              <GoogleLogo size={13.25} className="block max-w-none size-full" />
            </div>
            <div className="flex flex-col font-inter font-medium justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-center text-card-foreground text-nowrap">
              <p className="leading-[14px] whitespace-pre">
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
