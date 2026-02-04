# T0: Project Setup

> Initialize Next.js full-stack project with Vercel deployment configuration.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T0 |
| Dependencies | None |
| Effort | 3 points |
| Priority | P0 (Critical Path) |

---

## Objectives

1. Create Next.js 15 app with App Router
2. Configure pnpm workspace (monorepo)
3. Set up Vercel deployment
4. Configure development environment

---

## Deliverables

### 1. Project Structure

```
browse-mcp/
├── apps/
│   └── web/                      # New Next.js app
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── drizzle.config.ts
│       ├── vercel.json
│       ├── .env.example
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── api/
│       ├── components/
│       │   └── ui/              # shadcn/ui
│       ├── lib/
│       │   ├── db/
│       │   ├── auth/
│       │   └── utils/
│       └── public/
├── package.json                  # Root workspace
├── pnpm-workspace.yaml
└── turbo.json                    # Turborepo config
```

### 2. Configuration Files

#### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

#### `apps/web/package.json`

```json
{
  "name": "@browse-mcp/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.0",
    "jose": "^5.2.0",
    "bcrypt": "^5.1.0",
    "zod": "^3.22.0",
    "lucide-react": "^0.300.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/bcrypt": "^5.0.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^4.0.0",
    "drizzle-kit": "^0.27.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

#### `apps/web/next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
```

#### `apps/web/vercel.json`

```json
{
  "functions": {
    "app/api/packages/upload/route.ts": {
      "maxDuration": 300
    }
  }
}
```

#### `apps/web/.env.example`

```bash
# Database (Neon PostgreSQL)
POSTGRES_URL="postgresql://user:pass@host/db?sslmode=require"

# Auth
JWE_SECRET="32-byte-secret-key-here-for-sessions"
ENCRYPTION_KEY="32-byte-key-for-data-encryption"

# OAuth - GitHub
NEXT_PUBLIC_GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Storage - HuggingFace
HF_TOKEN="hf_your_token_here"
HF_NAMESPACE="your-username-or-org"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Base Files

#### `apps/web/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Browse MCP Platform',
  description: 'AI Tool Platform - MCP & Skills Marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

#### `apps/web/app/page.tsx`

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Browse MCP Platform</h1>
      <p className="mt-4 text-lg text-gray-600">
        AI Tool Platform - Coming Soon
      </p>
    </main>
  );
}
```

#### `apps/web/lib/utils/index.ts`

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}
```

---

## Acceptance Criteria

- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter @browse-mcp/web dev` starts dev server
- [ ] `pnpm --filter @browse-mcp/web build` produces no errors
- [ ] Homepage renders at `localhost:3000`
- [ ] TypeScript compilation passes
- [ ] ESLint passes with no errors

---

## Commands

```bash
# Initialize
cd browse-mcp
mkdir -p apps/web
cd apps/web

# Create Next.js app
pnpm create next-app . --typescript --tailwind --eslint --app --src-dir=false

# Install dependencies
pnpm add drizzle-orm postgres jose bcrypt zod lucide-react class-variance-authority clsx tailwind-merge
pnpm add -D drizzle-kit @types/bcrypt

# Init shadcn/ui
pnpm dlx shadcn@latest init
```

---

## Notes

- Use `--turbopack` for faster dev builds
- Neon PostgreSQL will be provisioned during Vercel deploy
- shadcn/ui components will be added incrementally as needed
