import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  // Keep a running dev server isolated from files created by `next build`.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-prod",
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
});

export default nextConfig;
