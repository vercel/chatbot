import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // cacheComponents disabled to allow runtime env vars in API routes
  // See: https://github.com/vercel/next.js/discussions/84894
  cacheComponents: false,
  // agent-browser uses playwright-core internally (for CDP connection).
  // Must be external so Next.js doesn't try to bundle Playwright's server
  // code (which requires 'electron' and other native modules).
  serverExternalPackages: ['agent-browser', 'playwright-core'],
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
};

export default nextConfig;
