"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm({
  isEntraConfigured,
}: {
  isEntraConfigured: boolean;
}) {
  const router = useRouter();
  const { status } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [router, status]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        {isEntraConfigured
          ? "Use your Microsoft Entra ID account to continue"
          : "Microsoft Entra ID is not configured for this environment."}
      </p>
      <Button
        className="h-10 w-full"
        disabled={isRedirecting || !isEntraConfigured}
        onClick={() => {
          if (!isEntraConfigured) {
            return;
          }
          setIsRedirecting(true);
          signIn("microsoft-entra-id", { callbackUrl: "/" });
        }}
        type="button"
      >
        <LogIn />
        {isRedirecting ? "Redirecting..." : "Continue with Microsoft"}
      </Button>
    </>
  );
}
