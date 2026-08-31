import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photography has two sources: Wikimedia Commons via Wikipedia's
    // REST API (freely licensed), and photographs a household takes itself.
    // Nothing else is allowed. Locally hosted images under /public are
    // unaffected.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
      // Photographs the household takes, served from the public
      // product-images bucket. Without this next/image refuses the host and
      // every uploaded photo renders as a broken tile.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
  },
};

export default nextConfig;
