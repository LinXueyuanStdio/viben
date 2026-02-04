# Vercel Deployment Guide

> Deploy the Browse MCP web platform (`apps/web`) to Vercel

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Project Configuration](#project-configuration)
4. [Environment Variables](#environment-variables)
5. [Deployment Steps](#deployment-steps)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)
8. [CI/CD Integration](#cicd-integration)

---

## Quick Start

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy from project root (monorepo)
vercel --cwd apps/web

# 4. Deploy to production
vercel --cwd apps/web --prod
```

---

## Prerequisites

### Required Accounts and Services

1. **Vercel Account**
   - Sign up at https://vercel.com
   - Connect your GitHub account (recommended)

2. **Neon Database**
   - PostgreSQL database instance
   - Get connection string from Neon dashboard

3. **GitHub OAuth App**
   - Create at: GitHub Settings → Developer Settings → OAuth Apps
   - Set callback URL: `https://your-domain.vercel.app/api/auth/github/callback`

4. **HuggingFace Account** (for package storage)
   - Create token at: https://huggingface.co/settings/tokens
   - Need write access for uploading packages

### Local Requirements

- Node.js 18+
- pnpm (package manager)
- Vercel CLI: `npm i -g vercel`

---

## Project Configuration

### Project Structure

```
browse-mcp/
├── apps/
│   └── web/              # Next.js app to deploy
│       ├── app/          # Next.js App Router
│       ├── components/   # React components
│       ├── lib/          # Utilities and configs
│       ├── next.config.ts
│       ├── vercel.json   # Vercel configuration
│       └── package.json
├── packages/             # Shared packages (auto-bundled)
└── pnpm-workspace.yaml
```

### Monorepo Detection

Vercel automatically detects:
- **Framework**: Next.js (from `next.config.ts`)
- **Root Directory**: `apps/web` (set in project settings)
- **Build Command**: `pnpm build` (from `vercel.json`)
- **Install Command**: `pnpm install` (from `vercel.json`)

### `vercel.json` Configuration

Located at `apps/web/vercel.json`:

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

**Key Configurations**:
- **Upload route**: 5-minute timeout for large package uploads
- **Auth callback**: 30-second timeout for OAuth flow
- **CORS**: Enabled for all API routes

### `next.config.ts` Configuration

```typescript
{
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'huggingface.co' },
    ],
  },
}
```

**Important**:
- `outputFileTracingRoot`: Enables monorepo support (includes `packages/`)
- `images.remotePatterns`: Whitelist for Next.js Image Optimization

---

## Environment Variables

### Required Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `POSTGRES_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` | Neon Dashboard |
| `JWE_SECRET` | 32-byte secret for session encryption | Generate with `openssl rand -base64 32` | Generate locally |
| `ENCRYPTION_KEY` | 32-byte key for data encryption | Generate with `openssl rand -base64 32` | Generate locally |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | GitHub OAuth client ID | `Iv1.abc123...` | GitHub OAuth App settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | `ghp_abc123...` | GitHub OAuth App settings |
| `HF_TOKEN` | HuggingFace API token | `hf_abc123...` | HuggingFace → Settings → Tokens |
| `HF_NAMESPACE` | HuggingFace username or org | `your-username` | Your HuggingFace profile |
| `NEXT_PUBLIC_APP_URL` | Production URL | `https://your-domain.vercel.app` | Your Vercel domain |
| `NODE_ENV` | Environment mode | `production` | Set automatically by Vercel |

### Generate Secrets

```bash
# Generate JWE_SECRET (32 bytes)
openssl rand -base64 32

# Generate ENCRYPTION_KEY (32 bytes)
openssl rand -base64 32
```

### GitHub OAuth Setup

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Browse MCP Platform
   - **Homepage URL**: `https://your-domain.vercel.app`
   - **Authorization callback URL**: `https://your-domain.vercel.app/api/auth/github/callback`
4. Copy **Client ID** and **Client secret**

### Environment Variable Scopes

Set for all environments (Production, Preview, Development):
- ✅ All variables should be available in all environments
- ⚠️ For Preview deployments, use a separate database (optional but recommended)

---

## Deployment Steps

### Step 1: First-Time Setup

#### Option A: Via Vercel Dashboard (Recommended)

1. **Import Project**
   - Go to: https://vercel.com/new
   - Select your GitHub repository
   - Framework Preset: **Next.js** (auto-detected)

2. **Configure Project**
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm build` (auto-detected from `vercel.json`)
   - **Install Command**: `pnpm install`
   - **Output Directory**: `.next` (auto-detected)

3. **Add Environment Variables**
   - Click "Environment Variables"
   - Add all variables from the table above
   - Select scopes: Production, Preview, Development

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2-5 minutes)

#### Option B: Via CLI

```bash
# From project root
cd apps/web

# Link to Vercel project (first time only)
vercel link

# Set environment variables
vercel env add POSTGRES_URL production
vercel env add JWE_SECRET production
vercel env add ENCRYPTION_KEY production
# ... add all other variables

# Deploy to production
vercel --prod
```

### Step 2: Database Migration

After first deployment, run database migrations:

```bash
# From apps/web directory
pnpm db:push

# Or generate and run migrations
pnpm db:generate
pnpm db:migrate
```

**Note**: For production, consider using Vercel's Postgres or running migrations via a deployment script.

### Step 3: Verify Deployment

Check the following:

- [ ] Homepage loads: `https://your-domain.vercel.app`
- [ ] API health check: `https://your-domain.vercel.app/api/health` (if implemented)
- [ ] GitHub OAuth login works
- [ ] Database connection works (check admin panel)
- [ ] Image optimization works (check avatar images)

---

## Post-Deployment

### Custom Domain Setup

1. **Add Domain**
   - Vercel Dashboard → Settings → Domains
   - Add your custom domain (e.g., `browse-mcp.com`)

2. **Configure DNS**
   - Add CNAME record: `your-domain.com` → `cname.vercel-dns.com`
   - Or A record: `76.76.21.21`

3. **Update Environment Variables**
   ```bash
   # Update NEXT_PUBLIC_APP_URL
   vercel env add NEXT_PUBLIC_APP_URL production
   # Enter: https://your-custom-domain.com
   ```

4. **Update GitHub OAuth**
   - Update callback URL in GitHub OAuth App settings
   - New URL: `https://your-custom-domain.com/api/auth/github/callback`

### Performance Optimization

1. **Enable Edge Functions** (Optional)
   - For API routes with global distribution
   - Add `export const runtime = 'edge'` to route files

2. **Configure Caching**
   - Static assets: Auto-cached by Vercel CDN
   - API routes: Use `Cache-Control` headers

3. **Monitor Performance**
   - Vercel Analytics: Dashboard → Analytics
   - Core Web Vitals tracking

### Security Checklist

- [ ] Environment variables are not committed to Git
- [ ] Secrets are regenerated for production
- [ ] GitHub OAuth app is configured with production URL
- [ ] Database uses SSL connection (`sslmode=require`)
- [ ] CORS is properly configured in `vercel.json`

---

## Troubleshooting

### Build Failures

#### Error: `Module not found` (monorepo packages)

**Cause**: Monorepo packages not included in build

**Fix**: Ensure `outputFileTracingRoot` is set in `next.config.ts`

```typescript
outputFileTracingRoot: path.resolve(__dirname, '../..'),
```

#### Error: `pnpm: command not found`

**Cause**: Wrong package manager detected

**Fix**: Add to `vercel.json`:

```json
{
  "installCommand": "pnpm install"
}
```

### Runtime Errors

#### Error: `Database connection failed`

**Cause**: Invalid `POSTGRES_URL` or database not accessible

**Fix**:
1. Check environment variable in Vercel Dashboard
2. Ensure Neon database allows connections from `0.0.0.0/0`
3. Verify `?sslmode=require` is in connection string

#### Error: `JWE decryption failed`

**Cause**: `JWE_SECRET` or `ENCRYPTION_KEY` mismatch

**Fix**: Regenerate secrets and redeploy

#### Error: `GitHub OAuth redirect URI mismatch`

**Cause**: Callback URL doesn't match GitHub OAuth App settings

**Fix**: Update callback URL in GitHub OAuth App:
```
https://your-actual-domain.vercel.app/api/auth/github/callback
```

### Function Timeouts

#### Error: `Function Execution Timeout (10s)`

**Cause**: Long-running API routes exceed default timeout

**Fix**: Increase timeout in `vercel.json`:

```json
{
  "functions": {
    "app/api/your-route/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Limits**:
- Hobby plan: 10s
- Pro plan: 60s
- Enterprise plan: 900s

---

## CI/CD Integration

### Automatic Deployments

Vercel auto-deploys on:
- **Push to `main`**: Production deployment
- **Pull requests**: Preview deployment (unique URL)

### Disable Auto-Deploy (Manual Control)

If you want manual control:

1. **Vercel Dashboard** → Settings → Git
2. Disable "Production Branch" auto-deploy
3. Deploy manually: `vercel --prod`

### GitHub Actions Integration

For custom build steps before deployment:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test --filter=@browse-mcp/web

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: apps/web
```

**Required Secrets** (GitHub repo settings):
- `VERCEL_TOKEN`: Get from Vercel → Settings → Tokens
- `VERCEL_ORG_ID`: Found in `.vercel/project.json`
- `VERCEL_PROJECT_ID`: Found in `.vercel/project.json`

---

## Monitoring and Maintenance

### Health Checks

Create a health check endpoint:

```typescript
// apps/web/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Check database connection
    await db.execute('SELECT 1');

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: String(error) },
      { status: 503 }
    );
  }
}
```

### Log Monitoring

View logs:
- **Vercel Dashboard**: Deployments → Logs
- **CLI**: `vercel logs your-project-url`

### Performance Monitoring

- **Vercel Analytics**: Auto-enabled for all deployments
- **Vercel Speed Insights**: Add `@vercel/speed-insights` package

---

## Quick Reference

### Common Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment logs
vercel logs <deployment-url>

# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>

# Environment variables
vercel env ls
vercel env add <name> <environment>
vercel env rm <name> <environment>
```

### Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Vercel CLI Docs**: https://vercel.com/docs/cli
- **Next.js on Vercel**: https://vercel.com/docs/frameworks/nextjs
- **Monorepo Support**: https://vercel.com/docs/monorepos

---

## Summary

**Deployment Checklist**:
- [ ] Set up all environment variables
- [ ] Configure GitHub OAuth callback URL
- [ ] Set up Neon PostgreSQL database
- [ ] Configure HuggingFace storage
- [ ] Deploy to Vercel
- [ ] Run database migrations
- [ ] Verify all features work
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring and alerts

**Key Files**:
- `apps/web/vercel.json` - Vercel configuration
- `apps/web/next.config.ts` - Next.js configuration
- `apps/web/.env.example` - Environment variable template

**Support**:
- Vercel Support: https://vercel.com/support
- Browse MCP Issues: GitHub Issues

---

**Last Updated**: 2026-02-05
