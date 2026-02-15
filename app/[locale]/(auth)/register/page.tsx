"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type RegisterActionState, register } from "@/app/(auth)/actions";

export default function Page() {
  const router = useRouter();
  const t = useTranslations('auth.signUp');
  const formLabels = useTranslations('auth.form');

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ type: "error", description: t('errors.accountExists') });
    } else if (state.status === "failed") {
      toast({ type: "error", description: t('errors.createFailed') });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: t('errors.validationFailed'),
      });
    } else if (state.status === "success") {
      toast({ type: "success", description: t('success') });

      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">{t('title')}</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            {t('description')}
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email} labels={{
          email: formLabels('email'),
          emailPlaceholder: formLabels('emailPlaceholder'),
          password: formLabels('password'),
        }}>
          <SubmitButton isSuccessful={isSuccessful}>{t('button')}</SubmitButton>
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {t('hasAccount')}{' '}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/login"
            >
              {t('signInLink')}
            </Link>{' '}
            {t('instead')}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}
