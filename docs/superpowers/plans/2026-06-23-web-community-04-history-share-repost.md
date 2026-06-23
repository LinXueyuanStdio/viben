# Web 社区浏览历史分享与转发 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持浏览事件、个人浏览历史、可追踪分享链接、分享事件和页面转发到 Moment。

**Architecture:** 浏览和分享事件是 append-only 行为事实；个人历史是登录用户可删除的索引；转发是页面与 Moment 的连接层。repost active 创建必须在 Moment 计划完成后执行，本计划先实现 history/share，再接入 repost。

**Tech Stack:** Next.js Route Handlers, TypeScript, Drizzle ORM, Vitest.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-history-share-repost-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Create: `apps/web/lib/services/community/history.ts`
- Create: `apps/web/lib/services/community/share.ts`
- Create: `apps/web/lib/services/community/reposts.ts`
- Create: `apps/web/app/api/community/views/route.ts`
- Create: `apps/web/app/api/users/me/history/route.ts`
- Create: `apps/web/app/api/community/share-links/route.ts`
- Create: `apps/web/app/api/community/share-events/route.ts`
- Create: `apps/web/app/api/community/reposts/route.ts`
- Create: `apps/web/app/api/community/reposts/[repost_id]/route.ts`
- Create: `apps/web/app/share/[share_uid]/route.ts`
- Modify: `apps/web/app/read/[user_slug]/[page_id]/page.tsx`
- Modify: `apps/web/app/page/[user_slug]/[page_id]/route.ts`
- Test: `apps/web/lib/services/community/history-share-repost.test.ts`
- Test: `apps/web/app/api/community/history-share-repost-routes.test.ts`

## Required Data Contract

- `view_events`: `id`, `entity_type`, `entity_id`, `actor_user_id`, `anonymous_viewer_hash`, `session_id_hash`, `source`, `route`, `referrer_type`, `referrer_url_hash`, `share_link_id`, `repost_id`, `user_agent_hash`, `ip_hash`, `country_code`, `region_code`, `duration_ms`, `scroll_depth`, `created_at`.
- `user_browse_history`: `id`, `user_id`, `entity_type`, `entity_id`, `last_view_event_id`, `last_viewed_at`, `first_viewed_at`, `view_count`, `last_source`, `last_route`, `last_progress`, `snapshot_title`, `snapshot_author_user_id`, `snapshot_cover_asset_id`, `deleted_at`, timestamps, unique `user_id + entity_type + entity_id`.
- `share_links`: `id`, `uid`, `entity_type`, `entity_id`, `created_by_user_id`, `visibility_snapshot`, `channel`, `target_url`, `html_direct_url`, `expires_at`, `revoked_at`, `open_count`, `unique_open_count`, timestamps.
- `share_events`: `id`, `share_link_id`, `entity_type`, `entity_id`, `actor_user_id`, `anonymous_actor_hash`, `event_type`, `channel`, `target`, `source_route`, `viewer_hash`, `ip_hash`, `user_agent_hash`, `created_at`.
- `reposts`: `id`, `entity_type`, `entity_id`, `user_id`, `moment_id`, `comment`, `visibility`, `status`, `failure_reason`, timestamps, `deleted_at`.
- Hash identifiers (`anonymous_viewer_hash`, `anonymous_actor_hash`, `viewer_hash`, `session_id_hash`, `ip_hash`, `user_agent_hash`, `referrer_url_hash`) must be generated with a server-side salt and support salt version metadata. No raw IP, full user agent, full referrer, or directly reusable anonymous id is stored.
- `share_links.uid` is unique, random, non-enumerable, and does not encode `entity_id` or `user_id`.
- The public share-open entrypoint is `/share/{share_uid}`. It resolves `share_links.uid`, re-checks current entity visibility, records `share_events.event_type = link_opened`, records a `view_events` row with `source = share_link` and `share_link_id`, increments `open_count`/`unique_open_count`, then redirects or renders `/read/{user_slug}/{page_id}`.
- `/read/{user_slug}/{page_id}` must record `source = read_shell` view events and upsert logged-in history. `/page/{user_slug}/{page_id}` must record `source = html_direct` view events without blocking raw HTML output if telemetry fails.
- Share creation must reject `private`, `hidden`, `rejected`, deleted, and currently unauthorized entities; existing links must stop opening publicly after an entity becomes non-public or unauthorized.
- Repost creation failure after Moment failure writes `reposts.status = failed`, stores `failure_reason`, and does not increment `repost_count`. Repost deletion is only allowed for the repost owner or moderator and is soft-delete only.

## Tasks

### Task 1: Add Schema

- [ ] **Step 1: Write schema tests**

Assert every field in Required Data Contract exists. Assert no table stores full IP, full user agent, full external referrer URL, or unsalted anonymous identifiers. Assert indexes for `view_events(entity_type, entity_id, created_at)`, unique `share_links.uid`, and active repost dedupe.

- [ ] **Step 2: Run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL until schema exists.

- [ ] **Step 3: Implement schema and migration**

Add tables and constraints. Generate migration with `pnpm --filter @viben/web db:generate`.

- [ ] **Step 4: Re-run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: PASS.

### Task 2: Implement View Events And History

- [ ] **Step 1: Write service tests**

Cover anonymous view event, logged-in history upsert, deleted history restore on new view, permission filtering on history read, `read_shell` and `html_direct` sources, telemetry failure not blocking HTML direct output, and progress update with `scroll_depth` in range `0` to `100`.

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/history-share-repost.test.ts
```

Expected: FAIL until services exist.

- [ ] **Step 3: Implement `history.ts`**

Create `recordViewEvent`, `listUserBrowseHistory`, `deleteBrowseHistoryItem`, `clearBrowseHistory`. Hash session, user agent, IP, and referrer before storage.

- [ ] **Step 4: Re-run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/history-share-repost.test.ts
```

Expected: PASS for history cases.

### Task 3: Implement Share Links And Events

- [ ] **Step 1: Extend service tests**

Cover public page share, private page rejection, hidden/rejected/deleted rejection, current user losing access after link creation, unlisted share allowed by default, revoked link rejection, expired link rejection, `link_created` and `link_copied` event creation, `link_opened` open count increment, and page `share_count` counting policy.

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/history-share-repost.test.ts
```

Expected: FAIL on share cases.

- [ ] **Step 3: Implement `share.ts`**

Create `createOrReuseShareLink`, `recordShareEvent`, `openShareLink`. Return both `target_url = /read/{user_slug}/{page_id}` and `html_direct_url = /page/{user_slug}/{page_id}` for published pages.

- [ ] **Step 4: Re-run service tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/history-share-repost.test.ts
```

Expected: PASS for history and share cases.

### Task 4: Implement Repost After Moment Exists

- [ ] **Step 1: Confirm Moment service availability**

Run:

```bash
test -f apps/web/lib/services/community/moments.ts
```

Expected: command exits `0`.

- [ ] **Step 2: Write repost tests**

Cover login required, private page rejection, hidden/rejected/deleted rejection, unauthorized rejection, active repost creates a Moment, `moment_id` is stored, duplicate active repost is rejected or returned idempotently, Moment creation failure writes `status = failed` and `failure_reason`, failed repost does not increment `repost_count`, owner delete soft-deletes repost and hides linked Moment, and non-owner delete is rejected.

- [ ] **Step 3: Implement `reposts.ts`**

Use Moment service in the same transaction boundary offered by the repository. Do not create active reposts without a linked Moment.

- [ ] **Step 4: Run repost tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/history-share-repost.test.ts
```

Expected: PASS.

### Task 5: Implement API Routes

- [ ] **Step 1: Write route tests**

Test `/api/community/views`, `/api/users/me/history`, `/api/community/share-links`, `/api/community/share-events`, `/api/community/reposts`, `/share/[share_uid]`, `/read` view-event integration, `/page` view-event integration, and snake_case request params such as `entity_type`, `entity_id`, `share_link_id`, and `repost_id`.

- [ ] **Step 2: Run route tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/community/history-share-repost-routes.test.ts
```

Expected: FAIL until routes exist.

- [ ] **Step 3: Implement route handlers**

Use optional session for view and share creation, `requireAuth` for history and repost writes. All response fields use `snake_case`.

- [ ] **Step 4: Integrate route telemetry**

Update `/read/{user_slug}/{page_id}` to call `recordViewEvent` with `source = read_shell`. Update `/page/{user_slug}/{page_id}` to call `recordViewEvent` with `source = html_direct` in a non-blocking path that cannot prevent HTML response.

- [ ] **Step 5: Implement share uid route**

Create `/share/{share_uid}` route. It calls `openShareLink`, records the open event and view event, and redirects to the resolved read URL. It returns `404` for revoked, expired, private, hidden, rejected, deleted, or unauthorized targets.

- [ ] **Step 6: Re-run route tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/app/api/community/history-share-repost-routes.test.ts
```

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Verify**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/history-share-repost.test.ts apps/web/app/api/community/history-share-repost-routes.test.ts
pnpm --filter @viben/web type-check
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/app/api/community apps/web/app/api/users/me
git commit -m "feat(web): add community history sharing and reposts"
```
