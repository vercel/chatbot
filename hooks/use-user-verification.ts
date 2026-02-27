import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useUserVerification(verifyOnlyForLoggedIn?: boolean) {
  const { data: session } = useSession();
  const [isUserVerified, setIsUserVerified] = useState(true); // Default to true to avoid flash

  // Check user verification status
  useEffect(() => {
    const checkVerification = async () => {
      console.log('session?.user.email', session?.user.email)
      if ((!session?.user || (session?.user.email?.includes('guest-') && session.user.type !== "regular"))) {
        setIsUserVerified(verifyOnlyForLoggedIn === true ? true : false);
        return;
      }

      try {
        const response = await fetch("/api/check-user-verified");
        const data = await response.json();
        setIsUserVerified(data.isVerified);
      } catch (error) {
        console.error("Error checking verification status:", error);
        setIsUserVerified(false); 
      }
    };

    checkVerification();
  }, [session]);

  return { isUserVerified };
}
