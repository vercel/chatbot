'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';

import { register, type RegisterActionState } from '../actions';

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction, isPending] = useActionState<RegisterActionState, FormData>(
    register,
    { status: 'idle' }
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (state.status === 'user_exists') {
      toast({ type: 'error', description: 'Account already exists!' });
    } else if (state.status === 'failed') {
      toast({ type: 'error', description: 'Failed to create account!' });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Invalid email or password (min 6 characters)',
      });
    } else if (state.status === 'success') {
      toast({ type: 'success', description: 'Account created successfully!' });
      setIsSuccessful(true);
      updateSession();
      router.push('/home');
    }
  }, [state, router, updateSession]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formAction(formData);
  };

  return (
    <div className="bg-chat-background relative size-full min-h-screen">
      <div className="absolute bg-card border border-border border-solid left-1/2 rounded-[10px] top-[257px] -translate-x-1/2 w-[414px] h-auto pb-8">
        <div className="content-stretch flex flex-col gap-[18px] items-center px-[32px] pt-[32px] w-full">
          <p className="font-source-serif leading-normal min-w-full not-italic relative shrink-0 text-[32px] text-center text-card-foreground tracking-[0.16px]">
            Create Account
          </p>
          <p className="font-inter font-normal leading-normal min-w-full not-italic relative shrink-0 text-[14px] text-center text-muted-foreground tracking-[0.07px]">
            Sign up with your email and password
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending || isSuccessful}
              className="border border-border rounded-[8px] px-4 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending || isSuccessful}
              className="border border-border rounded-[8px] px-4 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isPending || isSuccessful}
              className="bg-primary text-primary-foreground font-inter font-medium text-[14px] rounded-[8px] px-4 py-2 w-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Creating account...' : isSuccessful ? 'Success!' : 'Create Account'}
            </button>
          </form>

          <p className="text-muted-foreground text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
