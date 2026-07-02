import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Skip ESLint during build - run separately due to ESLint 9.x + eslint-config-next compatibility issue
  // See: https://github.com/vercel/next.js/issues/64409
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'huggingface.co',
      },
    ],
  },
};

export default nextConfig;
