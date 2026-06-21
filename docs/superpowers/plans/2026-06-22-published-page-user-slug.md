# Published Page User Slug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change published page URLs from `/page/{user_id}/{page_id}` to `/page/{user_slug}/{page_id}` and make desktop restore published button state from the slug URL.

**Architecture:** Add `user_slug` to the web users table with database constraints and expose it in auth/session responses. Publish and public page routes resolve users by slug while published page storage continues to use stable `user_id`. Desktop asks the gateway for publish status with `user_slug`; the gateway probes the web route and returns the stored public URL.

**Tech Stack:** Next.js app routes, Drizzle PostgreSQL schema/migrations, Vitest, Fastify gateway routes, React desktop components, Zustand.

---

### Task 1: Web User Slug Contract

**Files:**
- Modify: `apps/web/lib/db/schema.ts`
- Modify: `apps/web/lib/db/migrations/0002_published_pages.sql`
- Modify: `apps/web/lib/validations/user.ts`
- Modify tests under `apps/web/app/api/pages/publish/route.test.ts` and `apps/web/app/page/[user_id]/[page_id]/route.test.ts`

- [ ] Write failing tests expecting publish route URL `/page/alice/demo` from `userSlug`.
- [ ] Write failing tests expecting public route params `{ user_slug: "alice", page_id: "demo" }`.
- [ ] Add `userSlug: text("user_slug").notNull().unique()` to `users`.
- [ ] Add migration SQL that backfills `user_slug`, creates unique index, and adds `CHECK (user_slug ~ '^[A-Za-z_][A-Za-z0-9_-]{2,29}$')`.
- [ ] Update user validation to reuse the same regex for slug-like username rules.

### Task 2: Web Publish And Public Routes

**Files:**
- Modify: `apps/web/app/api/pages/publish/route.ts`
- Modify: `apps/web/app/page/[user_id]/[page_id]/route.ts`
- Rename or add tests for slug-based route behavior.

- [ ] Update publish route to read `session.userSlug` or fetch current user by id and return `/page/${userSlug}/${uid}`.
- [ ] Update public route to resolve `users.userSlug` to `users.id`, then query `publishedPages`.
- [ ] Keep storage unique key `(user_id, uid)` unchanged.
- [ ] Update list links that currently build `/page/${userId}/${uid}` to use slug where available.

### Task 3: Auth Session And API Client Types

**Files:**
- Modify: `apps/web/lib/auth/types.ts`
- Modify: `apps/web/lib/auth/middleware.ts`
- Modify: `apps/web/app/api/auth/login/route.ts`
- Modify OAuth callback routes that return desktop session data.
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/client.ts` if response mapping requires it.

- [ ] Add `userSlug` to session payloads.
- [ ] Ensure login/register/OAuth responses include `userSlug`.
- [ ] Update API client `UserSession` type and desktop auth store compatibility.

### Task 4: Gateway And Desktop Publish Status

**Files:**
- Modify: `packages/core/src/gateway/routes/page.ts`
- Modify: `packages/core/src/gateway/routes/page-publish.test.ts`
- Modify: `apps/desktop/src/lib/gateway/types/page.ts`
- Modify: `apps/desktop/src/lib/gateway/modules/pages.ts`
- Modify: `apps/desktop/src/stores/page-publish-store.ts`
- Modify: `apps/desktop/src/pages/apps/components/page-setting-panel.tsx`
- Modify: `apps/desktop/src/pages/apps/components/page-setting-panel.test.tsx`

- [ ] Add gateway `POST /api/page/publish-status` accepting `access_token`, `user_slug`, and `uid`.
- [ ] Make gateway probe `https://viben-web.vercel.app/page/{user_slug}/{uid}` and return `{ published, url }`.
- [ ] Add desktop client function `getPublishedPageStatus`.
- [ ] Add store action to clear stale publish entries.
- [ ] On static page mount/page switch, load status and update button state.

### Task 5: Verification

**Commands:**
- `pnpm --filter @viben/api-client test -- src/client.test.ts`
- `pnpm --filter @viben/core test -- src/gateway/routes/page-publish.test.ts`
- `pnpm --filter @viben/desktop test -- src/pages/apps/components/page-setting-panel.test.tsx`
- `pnpm --filter @viben/web test -- app/api/pages/publish/route.test.ts app/page/[user_id]/[page_id]/route.test.ts`
- `pnpm typecheck`
