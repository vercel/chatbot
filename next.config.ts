import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const basePath = "/demo";

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: "/demo-assets",
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default withBotId(nextConfig);
