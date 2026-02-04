# T21: Deploy & Polish

> Deploy to Vercel and finalize the application.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T21 |
| Dependencies | All previous tasks |
| Effort | 5 points |
| Priority | P0 |

---

## Objectives

1. Configure Vercel deployment
2. Set up production database
3. Configure environment variables
4. Implement error monitoring
5. Performance optimization

---

## Deliverables

### 1. Vercel Configuration (`apps/web/vercel.json`)

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "functions": {
    "app/api/packages/upload/route.ts": {
      "maxDuration": 300
    },
    "app/api/auth/github/callback/route.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

### 2. Environment Variables

Create in Vercel dashboard:

```
# Database
POSTGRES_URL=postgresql://...

# Auth
JWE_SECRET=<32-byte-secret>
ENCRYPTION_KEY=<32-byte-key>

# OAuth
NEXT_PUBLIC_GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>

# Storage
HF_TOKEN=<huggingface-token>
HF_NAMESPACE=browse-mcp

# App
NEXT_PUBLIC_APP_URL=https://browse-mcp.vercel.app
NODE_ENV=production
```

### 3. Database Setup Script (`scripts/setup-db.ts`)

```typescript
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function setup() {
  console.log('Setting up database...');

  // Run migrations
  console.log('Running migrations...');
  // drizzle-kit handles this

  // Create indexes
  console.log('Creating indexes...');

  // Seed initial data (optional)
  console.log('Seeding data...');

  console.log('Database setup complete!');
}

setup().catch(console.error);
```

### 4. GitHub Actions CI/CD (`.github/workflows/deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test

  deploy:
    runs-on: ubuntu-latest
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 5. Error Handling Middleware (`apps/web/middleware.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

### 6. API Error Handler (`apps/web/lib/api/error-handler.ts`)

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.errors },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### 7. Performance Optimizations

```typescript
// next.config.ts
const nextConfig = {
  // Enable static exports where possible
  output: 'standalone',

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'huggingface.co' },
    ],
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

---

## Deployment Checklist

### Pre-deployment

- [ ] All tests passing
- [ ] Lint passes
- [ ] Type check passes
- [ ] Environment variables documented
- [ ] Database migrations ready

### Vercel Setup

- [ ] Connect GitHub repository
- [ ] Configure root directory (`apps/web`)
- [ ] Set environment variables
- [ ] Configure custom domain (optional)

### Post-deployment

- [ ] Verify all routes work
- [ ] Test OAuth flow
- [ ] Test package upload/download
- [ ] Check database connectivity
- [ ] Monitor error logs

---

## Monitoring

### Vercel Analytics

```typescript
// apps/web/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Speed Insights

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

---

## Acceptance Criteria

- [ ] App deploys to Vercel successfully
- [ ] Custom domain configured (optional)
- [ ] All API routes work in production
- [ ] OAuth works in production
- [ ] File upload/download works
- [ ] Database migrations applied
- [ ] CI/CD pipeline working
- [ ] Error monitoring in place
- [ ] Analytics enabled

---

## Production URLs

| Environment | URL |
|-------------|-----|
| Production | https://browse-mcp.vercel.app |
| Preview | https://browse-mcp-*.vercel.app |
| API | https://browse-mcp.vercel.app/api |

---

## Rollback Procedure

1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find last working deployment
4. Click "..." → "Promote to Production"

---

## Notes

- Vercel provides automatic HTTPS
- Preview deployments for each PR
- Automatic rollback on failed deploys
- Consider Vercel Pro for higher limits
