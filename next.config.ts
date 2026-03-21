import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export enabled (replaces deprecated `next export` CLI in Next.js 15+)
  output: 'export',
  // Required if using next/image with static export so images are served as-is
  images: {
    unoptimized: true,
  },
  // quickjs-emscripten's emscripten-generated code has require("fs") inside a
  // Node.js-only branch that never executes in the browser. Stub it for both bundlers.
  turbopack: {
    resolveAlias: {
      fs: './src/stubs/empty-module.ts',
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    return config;
  },
};

export default nextConfig;
