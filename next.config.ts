import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export enabled (replaces deprecated `next export` CLI in Next.js 15+)
  output: 'export',
  // Required if using next/image with static export so images are served as-is
  images: {
    unoptimized: true,
  },
  /* other config options can go here */
};

export default nextConfig;
