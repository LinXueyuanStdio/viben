import type { NextConfig } from 'next';
import path from 'path';
import { withWorkflow } from 'workflow/next';

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
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "clsx",
      "class-variance-authority",
      "recharts",
      "framer-motion",
      "swr",
      "sonner",
      "cmdk",
      "vaul",
      "react-day-picker",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-avatar",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-switch",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-progress",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
    ],
  },
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
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
      {
        protocol: 'https',
        hostname: 'vercel.com',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.com',
      },
    ],
  },
};

export default withWorkflow(nextConfig);
