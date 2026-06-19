# Static Page Cloud Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cloud publishing for Desktop static pages and render published HTML at `/page/{uid}`.

**Architecture:** Desktop reads local static page HTML through the local gateway, then publishes it to apps/web with the existing logged-in Bearer token. Web stores the HTML in `published_pages` and renders it inside a sandbox iframe on the public page route.

**Tech Stack:** React 19, Vite Desktop, Next.js App Router, Drizzle ORM, Vitest, `@viben/api-client`.

---

### Task 1: Web Publish Contract

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/web/app/api/pages/publish/route.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/web/app/api/pages/publish/route.test.ts`

- [ ] Write tests for create, owner update, non-owner update, and validation of `icon`/`description`.
- [ ] Run `pnpm --filter @viben/web test:run app/api/pages/publish/route.test.ts` and verify the new test fails where the contract is missing.
- [ ] Update the route to return `url: /page/{uid}`, preserve `icon` and `description`, validate field types, and keep owner-only update.
- [ ] Re-run the route test and verify it passes.

### Task 2: Public Page Renderer

**Files:**
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/web/app/page/[uid]/page.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/web/app/page/[uid]/page.test.tsx`

- [ ] Write a failing test that the route renders an iframe with `srcDoc` from `published_pages.html` and a sandbox attribute.
- [ ] Write a failing test that unknown uid calls `notFound()`.
- [ ] Implement the server component route with `db.query.publishedPages.findFirst`.
- [ ] Re-run the route test and verify it passes.

### Task 3: API Client Pages Module

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/api-client/src/types.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/api-client/src/client.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/api-client/src/client.test.ts`

- [ ] Add `PublishPageRequest` and `PublishPageResponse` types.
- [ ] Add failing tests for `client.pages.publish()` request URL, Bearer header, and JSON body.
- [ ] Implement `pages.publish()`.
- [ ] Run `pnpm --filter @viben/api-client typecheck`.

### Task 4: Desktop Static Page Publish UI

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-setting-panel.tsx`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/pages/apps/components/page-setting-panel.test.tsx`

- [ ] Add tests that static pages show a publish button and non-static pages do not.
- [ ] Add a test that clicking publish reads the static entry HTML from gateway and calls `client.pages.publish()`.
- [ ] Implement the publish section using `useAuthStore`, `getApiClient`, `viewPage`, and `getPageServeUrl`.
- [ ] Run the focused desktop test.

### Task 5: Verification

**Files:**
- No code files.

- [ ] Run `pnpm --filter @viben/web test:run`.
- [ ] Run `pnpm --filter @viben/api-client typecheck`.
- [ ] Run `pnpm --filter @viben/desktop test`.
- [ ] Run `pnpm typecheck`.
- [ ] Inspect `git diff --stat` and ensure only planned files changed, ignoring pre-existing ACP modifications.
