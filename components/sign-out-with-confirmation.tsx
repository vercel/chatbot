"use client";

import { signOut, useSession } from "next-auth/react";

export function SignOutWithConfirmation() {
  const { data: session } = useSession();

  const handleSignOut = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to sign out and choose a different account?"
    );

    if (!confirmed) {
      return;
    }

    try {
      // Clear any client-side storage first
      if (typeof window !== 'undefined') {
        localStorage.removeItem('next-auth.session-token');
        localStorage.removeItem('next-auth.csrf-token');
        sessionStorage.removeItem('next-auth.session-token');
        sessionStorage.removeItem('next-auth.csrf-token');
      }

      // Sign out with forced redirect
      await signOut({
        redirect: true,
        callbackUrl: "/login"
      });
    } catch (error) {
      console.error("Sign out error:", error);
      // Fallback: force redirect to login even if signOut fails
      window.location.href = "/login";
    }
  };

  return (
    <button
      onClick={handleSignOut}
      className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors ml-3"
    >
      {/* Connect another account */}
      Sign in with another account
    </button>
  );
}
