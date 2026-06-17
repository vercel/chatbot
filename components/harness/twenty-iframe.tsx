"use client";

/**
 * TwentyIframe — Wrapped iframe for embedding Twenty CRM
 *
 * Phase 29: Neptune Command Center UI
 * Phase 33 Stream 1: Auth bridge integration (2026-06-17)
 *
 * Features:
 *  - Ref-based iframe with loading/error states
 *  - Auth bridge integration via /api/twenty-auth
 *  - Accepts className for styling
 */

import { forwardRef, useEffect, useState } from "react";

interface TwentyIframeProps {
  src?: string;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  title?: string;
}

export const TwentyIframe = forwardRef<HTMLIFrameElement, TwentyIframeProps>(
  function TwentyIframe({ src, onLoad, onError, className, title = "Twenty CRM" }, ref) {
    const [authUrl, setAuthUrl] = useState<string>("");

    useEffect(() => {
      // Fetch authenticated session from auth bridge
      fetch("/api/twenty-auth")
        .then((res) => res.json())
        .then((data) => {
          if (data.iframeUrl) {
            setAuthUrl(data.iframeUrl);
          } else if (src) {
            setAuthUrl(src);
          } else {
            setAuthUrl(process.env.NEXT_PUBLIC_TWENTY_URL || "https://crm.newleaf.financial");
          }
        })
        .catch(() => {
          // Fallback to direct URL
          setAuthUrl(src || process.env.NEXT_PUBLIC_TWENTY_URL || "https://crm.newleaf.financial");
        });
    }, [src]);

    if (!authUrl) {
      return (
        <div className={`flex items-center justify-center bg-gray-50 ${className || ""}`}>
          <div className="animate-pulse text-gray-400 text-sm">Loading Twenty CRM...</div>
        </div>
      );
    }

    return (
      <iframe
        ref={ref}
        src={authUrl}
        title={title}
        className={className}
        onLoad={onLoad}
        onError={onError}
        allow="camera; microphone; clipboard-read; clipboard-write; autoplay"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
        loading="eager"
      />
    );
  }
);
