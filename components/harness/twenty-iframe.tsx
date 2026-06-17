"use client";

/**
 * TwentyIframe — Wrapped iframe for embedding Twenty CRM
 *
 * Phase 29: Neptune Command Center UI
 *
 * Features:
 *  - Ref-based iframe with loading/error states handled by parent
 *  - Accepts className for styling
 *  - Reports load/error events to parent via callbacks
 */

import { forwardRef } from "react";

interface TwentyIframeProps {
  src: string;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  title?: string;
}

export const TwentyIframe = forwardRef<HTMLIFrameElement, TwentyIframeProps>(
  function TwentyIframe({ src, onLoad, onError, className, title = "Twenty CRM" }, ref) {
    return (
      <iframe
        ref={ref}
        src={src}
        title={title}
        className={className}
        onLoad={onLoad}
        onError={onError}
        // Allow full Twenty functionality within the iframe
        allow="camera; microphone; clipboard-read; clipboard-write; autoplay"
        // Sandbox with same-origin navigable so Twenty's internal routing works
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        // Identify as Neptune Command Center for Twenty's analytics
        referrerPolicy="no-referrer-when-downgrade"
        loading="eager"
      />
    );
  }
);
