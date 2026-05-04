import type { NextConfig } from "next";

// Security headers are set in middleware.ts (per-request, with CSP nonce).
// next.config.ts no longer owns the security header layer.

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ["gray-matter"],
};

export default nextConfig;
