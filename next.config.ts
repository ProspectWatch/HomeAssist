import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photography comes from Wikimedia Commons via Wikipedia's REST
    // API — freely licensed, and the only host allowed here. Locally hosted
    // images under /public are unaffected.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
};

export default nextConfig;
