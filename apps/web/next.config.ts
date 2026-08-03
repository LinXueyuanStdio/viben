import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Skip ESLint during build - run separately due to ESLint 9.x + eslint-config-next compatibility issue
  // See: https://github.com/vercel/next.js/issues/64409
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 客户端路由缓存：页面在浏览器端缓存 5 分钟
  staleTimes: {
    dynamic: 300,
    static: 300,
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
