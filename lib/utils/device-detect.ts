/**
 * device-detect.ts — Server-side device detection via User-Agent headers.
 *
 * PHASE 11: Mobile fix — US-2. Detects isMobile from Next.js headers()
 * to pass as RSC prop. NO runtime layout swaps. NO media query race.
 *
 * Meets Phase 11 requirement: "Use server-side mobile detection via
 * User-Agent headers. Pass isMobile as server prop, NOT runtime state."
 */

import { headers } from "next/headers";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
  userAgent: string | null;
  os: string | null;
  browser: string | null;
}

// ── UA Parsing ─────────────────────────────────────────────────────────────

// Common mobile/tablet patterns
const MOBILE_REGEX = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i;
const TABLET_REGEX = /iPad|Android(?!.*Mobi)|Tablet|PlayBook|Silk/i;
const IOS_REGEX = /iPhone|iPad|iPod/i;
const ANDROID_REGEX = /Android/i;

function detectOS(ua: string): string | null {
  if (IOS_REGEX.test(ua)) {
    const match = ua.match(/OS (\d+_\d+)/);
    return match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS";
  }
  if (ANDROID_REGEX.test(ua)) {
    const match = ua.match(/Android (\d+(\.\d+)?)/);
    return match ? `Android ${match[1]}` : "Android";
  }
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  if (/CrOS/.test(ua)) return "ChromeOS";
  return null;
}

function detectBrowser(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/OPR\//.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Browser";
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect device type from User-Agent header (server-side only).
 * Call in RSC or route handler. Uses Next.js headers().
 *
 * NEVER call this in a client component — it's server-only.
 */
export async function detectDevice(): Promise<DeviceInfo> {
  try {
    const headersList = await headers();
    const ua = headersList.get("user-agent") ?? null;

    if (!ua) {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        deviceType: "desktop",
        userAgent: null,
        os: null,
        browser: null,
      };
    }

    // Check tablet first (tablet UA often also matches mobile patterns)
    const isTablet = TABLET_REGEX.test(ua);
    // Check mobile second, excluding tablets
    const isMobile = !isTablet && MOBILE_REGEX.test(ua);
    const isDesktop = !isMobile && !isTablet;

    return {
      isMobile,
      isTablet,
      isDesktop,
      deviceType: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
      userAgent: ua,
      os: detectOS(ua),
      browser: detectBrowser(ua),
    };
  } catch {
    // headers() throws if not in server context
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      deviceType: "desktop",
      userAgent: null,
      os: null,
      browser: null,
    };
  }
}

/**
 * Synchronous fallback for edge/runtime contexts where headers() isn't available.
 * Returns desktop defaults.
 */
export function getDefaultDeviceInfo(): DeviceInfo {
  return {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: "desktop",
    userAgent: null,
    os: null,
    browser: null,
  };
}
