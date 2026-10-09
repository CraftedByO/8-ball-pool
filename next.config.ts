import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/Node deploys use the standalone server bundle. The Cloudflare
  // (vinext) build sets VINEXT_CLOUDFLARE and emits a Worker instead.
  ...(process.env.VINEXT_CLOUDFLARE ? {} : { output: "standalone" as const }),
};

export default nextConfig;
