import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Listings and bundles upload photos through server actions (default
      // limit 1 MB). Photos are shrunk in the browser first, so real uploads
      // are far smaller; keep in sync with MAX_UPLOAD_BYTES in src/lib/constants.ts.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
