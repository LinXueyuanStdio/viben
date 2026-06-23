# Web 社区发布页目录化与统计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已发布页面具备社区目录、公开作者页、社区阅读壳、分类、封面元信息和统计基础。

**Architecture:** 保持 `/page/{user_slug}/{page_id}` HTML 直出不变，新增 `/read/{user_slug}/{page_id}` 社区阅读壳。把公开作者页统一到根级 `/{user_slug}`，先消除现有 `[user_id]` 动态段冲突，再实现目录读取服务和 UI。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Drizzle ORM, Vitest, Testing Library, Tailwind v4.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-page-directory-stats-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Modify: `apps/web/lib/db/types.ts`
- Modify: `apps/web/lib/db/published-pages.ts`
- Create: `apps/web/lib/services/community/page-visibility.ts`
- Create: `apps/web/lib/services/community/pages.ts`
- Create: `apps/web/lib/utils/reserved-slugs.ts`
- Modify: `apps/web/app/api/auth/register/route.ts`
- Modify: `apps/web/app/api/auth/callback/github/route.ts`
- Modify: `apps/web/app/api/auth/github/callback/route.ts`
- Create: `apps/web/app/api/pages/route.ts`
- Create: `apps/web/app/api/page-directory/[user_slug]/[page_id]/route.ts`
- Create: `apps/web/app/api/page-directory/[user_slug]/[page_id]/metadata/route.ts`
- Create: `apps/web/app/api/page-categories/route.ts`
- Create: `apps/web/app/api/community/stats/route.ts`
- Modify or move: `apps/web/app/[user_id]/page/page.tsx`
- Create: `apps/web/app/[user_slug]/page.tsx`
- Create: `apps/web/app/read/[user_slug]/[page_id]/page.tsx`
- Modify: `apps/web/app/page/[user_slug]/[page_id]/route.ts`
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/app/web/page.tsx`
- Create: `apps/web/app/landing/page.tsx`
- Create UI: `apps/web/components/community/public-site-shell.tsx`
- Create UI: `apps/web/components/community/community-home-page.tsx`
- Create UI: `apps/web/components/community/author-profile-page.tsx`
- Create UI: `apps/web/components/community/reader-shell.tsx`
- Create UI: `apps/web/components/community/page-preview-card.tsx`
- Test: `apps/web/lib/services/community/pages.test.ts`
- Test: `apps/web/app/api/community-page-directory-routes.test.ts`
- Test: `apps/web/app/read/[user_slug]/[page_id]/page.test.tsx`
- Test: `apps/web/app/[user_slug]/page.test.tsx`

## Required Data Contract

- Extend `published_pages` with `category_id`, `cover_asset_id`, `tags`, `visibility`, `moderation_status`, `published_at`, `last_published_at`, `view_count`, `unique_view_count`, `read_count`, `like_count`, `favorite_count`, `comment_count`, `share_count`, `repost_count`, `subscriber_count`, `version_count`, `stats_updated_at`.
- Extend `published_page_versions` with `category_id`, `cover_asset_id`, `tags`, `visibility`, `moderation_status`, `published_at`.
- Add `page_categories` with `slug`, `name`, `description`, `icon`, `sort_order`, `is_active`, timestamps.
- Add `media_assets` with `owner_user_id`, `kind`, `source`, `url`, `thumbnail_url`, `mime_type`, `width`, `height`, `size_bytes`, `alt_text`, `metadata`, timestamps.
- Add `entity_stats_daily` with `entity_type`, `entity_id`, `stat_date`, all count fields from the spec, timestamps, and unique key `entity_type + entity_id + stat_date`.
- Directory API responses must include `items`, `next_cursor`, `has_more`; each item includes `id`, `uid`, `title`, `description`, `user_slug`, `read_url`, `html_url`, `category_id`, `cover_url`, `tags`, `visibility`, `moderation_status`, count fields, `published_at`, `last_published_at`.
- Publish API compatibility must preserve old request bodies and add `html_url = /page/{user_slug}/{page_id}` and `read_url = /read/{user_slug}/{page_id}` to successful responses.
- Stats read/write routes must accept only `snake_case` fields and must not reveal private, hidden, or rejected page metadata to unauthorized viewers.
- Page detail APIs use `/api/page-directory/{user_slug}/{page_id}` and `/api/page-directory/{user_slug}/{page_id}/metadata`; `page_id` is `published_pages.uid` scoped by author slug.
- Do not create dynamic detail routes under the `/api/pages` namespace because existing static routes such as `/api/pages/publish` must keep priority and page uid values may collide with those names.
- `/read/{user_slug}/{page_id}` must render published HTML through a sandboxed iframe without `allow-same-origin`; the iframe cannot access main-site cookies, localStorage, or parent DOM. The reader shell links or embeds `/page/{user_slug}/{page_id}` but never injects raw HTML into the shell DOM.
- `/page/{user_slug}/{page_id}` remains raw HTML output but must use `canViewPublishedPage`: public approved allowed, unlisted direct allowed, private owner only, hidden/rejected return `404` for non-owner and never reveal moderation state.
- User slug creation/update paths must reject reserved public slugs. Initial reserved set includes all current top-level app routes: `admin`, `analytics`, `api`, `code-stats`, `collections`, `components`, `landing`, `leaderboard`, `login`, `mcp`, `moment`, `my-packages`, `page`, `profile`, `publish`, `read`, `register`, `settings`, `skills`, `subscription`, `web`.
- Migration must detect existing `users.user_slug` values that are now reserved. The migration or repair script writes a deterministic non-reserved replacement and records the mapping for redirects or audit.
- Migration must backfill existing rows: `published_at = created_at`, `last_published_at = updated_at`, count fields `0`, `tags = []`, `visibility = public`, `moderation_status = approved`, and version-table metadata from the current page where historical values are unavailable.
- Count fields have non-negative checks at the schema or service boundary. `entity_stats_daily.stat_date` uses UTC dates.

## Tasks

### Task 1: Resolve Public Route Preconditions

- [ ] **Step 1: Confirm current conflict**

Run:

```bash
find apps/web/app -maxdepth 3 -type d | sort | grep -E 'app/\\[[^]]+\\]$|app/page|app/read|app/web|app/landing'
```

Expected: output includes `apps/web/app/[user_id]` and no root `apps/web/app/[user_slug]`.

- [ ] **Step 2: Move root dynamic route to a single slug segment**

Move `apps/web/app/[user_id]` to `apps/web/app/[user_slug]`. Preserve existing behavior under that tree while changing params names in code from `user_id` to `user_slug`. Do not create a second root dynamic segment.

- [ ] **Step 3: Add redirect test for old author page list alias**

Add a route test asserting `GET /{user_slug}/page` redirects to `/page/{user_slug}`. This preserves the old dynamic tree's author page-list alias while making `/{user_slug}` the public author profile.

- [ ] **Step 4: Add reserved slug tests**

Create `apps/web/lib/utils/reserved-slugs.test.ts` with cases for every slug listed in Required Data Contract, plus case-insensitive and whitespace normalization cases.

- [ ] **Step 5: Run reserved slug test**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/utils/reserved-slugs.test.ts
```

Expected: FAIL because `reserved-slugs.ts` does not exist.

- [ ] **Step 6: Implement `reserved-slugs.ts`**

Export `RESERVED_PUBLIC_SLUGS`, `isReservedPublicSlug(slug: string)`, and `assertPublicSlugAllowed(slug: string)`. Normalize by trimming and lowercasing.

- [ ] **Step 7: Re-run reserved slug test**

Run the command from Step 5.

Expected: PASS.

- [ ] **Step 8: Add reserved slug integration tests**

Extend auth register and GitHub callback tests to assert reserved slugs are rejected or normalized away before writing `users.user_slug`.

- [ ] **Step 9: Wire reserved slug validation into user creation**

Call `assertPublicSlugAllowed()` in register and GitHub callback slug generation/update paths. Keep existing `normalizeUserSlug()` behavior, but retry or fail when the normalized slug is reserved.

### Task 2: Add Schema And Migration

- [ ] **Step 1: Write schema export test**

Create `apps/web/lib/db/community-schema.test.ts` asserting exports exist for `pageCategories`, `mediaAssets`, `entityStatsDaily`, and that `publishedPages` contains the new public directory fields.

- [ ] **Step 2: Run schema export test**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL on missing exports or missing columns.

- [ ] **Step 3: Update Drizzle schema**

Add the fields and tables listed in Required Data Contract. Keep table and column names snake_case at the database layer. Use default values from the spec: `visibility = public`, `moderation_status = approved`, count fields `0`.

- [ ] **Step 4: Generate migration**

Run:

```bash
pnpm --filter @viben/web db:generate
```

Expected: a new migration SQL file and matching migration meta updates are generated under `apps/web/lib/db/migrations`.

- [ ] **Step 5: Add explicit backfill SQL to the generated migration**

Edit the generated migration to include the backfill rules from Required Data Contract. Keep Drizzle migration meta filenames and journal entries intact; do not rename generated migration files manually.

- [ ] **Step 6: Update compatibility DDL**

Modify `apps/web/lib/db/published-pages.ts` so `ensurePublishedPagesTable()` only adds missing published page columns as compatibility protection. It must not define the full community schema.

- [ ] **Step 7: Re-run schema tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts apps/web/lib/db/published-pages.test.ts
```

Expected: PASS.

### Task 3: Implement Visibility And Page Services

- [ ] **Step 1: Write visibility tests**

Create tests for public approved, public pending, public hidden, unlisted direct access, private owner access, private non-owner denial, rejected denial, and HTML direct route permission decisions using the same helper.

- [ ] **Step 2: Run visibility tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/pages.test.ts
```

Expected: FAIL because service files do not exist.

- [ ] **Step 3: Implement services**

Create `page-visibility.ts` with `canViewPublishedPage(page, viewer)` and `canDiscoverPublishedPage(page, viewer)`. Create `pages.ts` with `getCommunityPageBySlugs`, `listDiscoverablePages`, `listAuthorPublicPages`, `getCommunityHomeData`, `getAuthorProfileData`.

- [ ] **Step 4: Re-run service tests**

Run the command from Step 2.

Expected: PASS.

### Task 4: Implement Public UI Routes

- [ ] **Step 1: Write route tests**

Create tests for `/`, `/web`, `/landing`, `/{user_slug}`, `/{user_slug}/page` redirect, `/page/{user_slug}`, `/page/{user_slug}/{page_id}` raw HTML permission filtering, and `/read/{user_slug}/{page_id}` sandboxed iframe rendering. Quote dynamic paths in commands.

- [ ] **Step 2: Run route tests**

Run:

```bash
pnpm --filter @viben/web test:run 'apps/web/app/[user_slug]/page.test.tsx' 'apps/web/app/read/[user_slug]/[page_id]/page.test.tsx'
```

Expected: FAIL until routes and components exist.

- [ ] **Step 3: Implement components and pages**

Render community home in `/` and `/web`, move existing marketing homepage to `/landing`, render public author profile at `/{user_slug}`, and render `ReaderShell` at `/read/{user_slug}/{page_id}`. Keep `apps/web/app/page/[user_slug]/[page_id]/route.ts` as raw HTML, but apply `canViewPublishedPage` before returning HTML.

- [ ] **Step 4: Implement reader HTML isolation**

In `ReaderShell`, render the direct HTML route inside an iframe using `sandbox="allow-scripts allow-forms allow-popups allow-downloads"` and no `allow-same-origin`. Add test assertions that the iframe exists, points at `/page/{user_slug}/{page_id}`, and does not include `allow-same-origin`.

- [ ] **Step 5: Validate public routes**

Run:

```bash
pnpm --filter @viben/web test:run 'apps/web/app/[user_slug]/page.test.tsx' 'apps/web/app/read/[user_slug]/[page_id]/page.test.tsx' 'apps/web/app/page/[user_slug]/[page_id]/route.test.ts'
pnpm --filter @viben/web type-check
```

Expected: PASS.

### Task 5: Implement Directory And Stats APIs

- [ ] **Step 1: Implement directory and stats API route tests**

Create `apps/web/app/api/community-page-directory-routes.test.ts`. Cover `GET /api/pages`, `GET /api/page-directory/[user_slug]/[page_id]`, `GET /api/page-directory/[user_slug]/[page_id]/metadata`, static `/api/pages/publish*` routes still winning over similarly named page uid values, `GET /api/page-categories`, `GET /api/community/stats`, stats write, category/tag/author filters, author public-state filtering, latest/recently_updated/most_viewed/trending sorts, stable cursor pagination, publish response URLs, new publish fields, `moderation_status` default, `published_at` first write, `last_published_at` update, `version_count`, version table metadata snapshot, and non-owner `cover_asset_id` rejection.

- [ ] **Step 2: Run directory and stats API route tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/app/api/community-page-directory-routes.test.ts
```

Expected: FAIL until API routes exist and publish response includes both URLs.

- [ ] **Step 3: Implement directory and stats API routes**

Create the route files listed in Files. Use `getCommunityPageBySlugs` and visibility helpers for every read. Add `read_url` and `html_url` to the existing publish response without removing old response fields. Publish accepts `category_id`, `cover_asset_id`, `tags`, and `visibility`, sets default `moderation_status = approved`, updates `published_at`, `last_published_at`, `version_count`, snapshots directory metadata to `published_page_versions`, and validates that `media_assets.owner_user_id` matches the publishing user.

- [ ] **Step 4: Implement stats idempotency and aggregation**

Stats write must use a request or event id when present, perform view/read dedupe for the configured window, update both cumulative counters and `entity_stats_daily`, and treat stats failures as non-blocking for `/read` and `/page` rendering.

- [ ] **Step 5: Re-run directory and stats API route tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/app/api/community-page-directory-routes.test.ts
```

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Review diff**

Run:

```bash
git diff -- apps/web/lib/db apps/web/lib/services/community apps/web/lib/utils apps/web/app apps/web/components/community
```

Expected: only page directory, statistics, public shell, route migration, and tests are changed.

- [ ] **Step 2: Commit**

Run:

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/lib/utils apps/web/app apps/web/components/community
git commit -m "feat(web): add community page directory and reader shell"
```
