# Web 社区 Moment 动态流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/moment` 动态流、动态输入框、时间线、动态附件、话题和活动事件。

**Architecture:** `moments` 是动态主体，`moment_attachments` 和 `moment_topic_items` 是关系表，`activity_events` 保存高价值活动。页面更新自动动态来自 `page_update_events`，普通动态和转发动态通过 Moment 服务创建。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Drizzle ORM, Vitest, Testing Library.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-moment-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Create: `apps/web/lib/services/community/moments.ts`
- Modify: `apps/web/lib/services/community/subscriptions.ts`
- Modify: `apps/web/app/api/pages/publish/route.ts`
- Create: `apps/web/app/api/moments/route.ts`
- Create: `apps/web/app/api/moments/feed/route.ts`
- Create: `apps/web/app/api/moments/[moment_id]/route.ts`
- Create: `apps/web/app/api/moment-topics/route.ts`
- Create UI: `apps/web/components/community/moment-page.tsx`
- Create UI: `apps/web/components/community/moment-composer.tsx`
- Create UI: `apps/web/components/community/moment-item.tsx`
- Create UI: `apps/web/components/community/moment-attachment-card.tsx`
- Create page: `apps/web/app/moment/page.tsx`
- Test: `apps/web/lib/services/community/moments.test.ts`
- Test: `apps/web/app/api/moments-routes.test.ts`
- Test: `apps/web/components/community/moment-page.test.tsx`

## Required Data Contract

- `moments`: `id`, `uid`, `author_user_id`, `kind`, `body`, `body_format`, `visibility`, `source_event_id`, `source_page_update_event_id`, `repost_of_moment_id`, `reply_to_moment_id`, `like_count`, `comment_count`, `repost_count`, `attachment_count`, `topic_count`, `is_pinned`, `is_deleted`, `deleted_at`, timestamps.
- `moment_attachments`: `id`, `moment_id`, `attachment_type`, `attachment_id`, `attachment_uid`, snapshots, `metadata`, `sort_order`, `created_at`.
- `moment_topics`: `id`, `slug`, `display_name`, `description`, `moment_count`, `last_moment_at`, `is_featured`, `is_blocked`, timestamps.
- `moment_topic_items`: `id`, `moment_id`, `topic_id`, `source`, `created_at`, unique `moment_id + topic_id`.
- `activity_events`: `id`, `actor_user_id`, `event_type`, `entity_type`, `entity_id`, `target_user_id`, `metadata`, `created_at`.
- Moment creation must call the interactions service to create or update `community_entities(entity_type = "moment", entity_id = moments.id)` with `owner_user_id`, `title`, `canonical_path`, `visibility`, and active status so Moment can receive likes, favorites, and comments.
- Page-update Moment generation must be connected to `page_update_events`: each newly created page update event is consumed once, creates or reuses one `kind = page_update` Moment, binds a `published_page` attachment, uses server-side body templates, and does not expose private or non-approved pages in public Feed.
- Attachment creation/update must validate binding permission for each target. Feed rendering must hide or downgrade attachments that later become private, deleted, hidden, or otherwise inaccessible.

## Tasks

### Task 1: Add Schema

- [ ] **Step 1: Write schema tests**

Assert all fields above exist and that `author_user_id + source_page_update_event_id` is unique for non-null page update events.

- [ ] **Step 2: Run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL until Moment schema exists.

- [ ] **Step 3: Implement schema and migration**

Add Moment tables and activity events. Generate migration with `pnpm --filter @viben/web db:generate`.

- [ ] **Step 4: Re-run schema tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: PASS.

### Task 2: Implement Moment Service

- [ ] **Step 1: Write service tests**

Cover creating text post, creating `community_entities(moment)`, rejecting empty post without attachments, attachment limit `4`, topic limit `5`, topic normalization, attachment permission checks, attachment later-private/deleted feed downgrade, feed `latest`, feed `following` fallback to `recommended`, feed `recommended`, cursor/limit pagination, topic filtering, author_user_slug filtering, invalid feed_type, logged-out following behavior, soft delete, edit own post, reject edit of `page_update` body, page_update idempotent consumption, page_update published_page attachment, page_update server body template, and private page update excluded from public feed.

- [ ] **Step 2: Run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/moments.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 3: Implement `moments.ts`**

Create `createMoment`, `createMomentFromPageUpdate`, `consumePageUpdateEventForMoment`, `listMomentFeed`, `updateMoment`, `deleteMoment`, `listMomentTopics`. Every feed query filters `visibility = public` and `is_deleted = false` for public users and downgrades inaccessible attachments.

- [ ] **Step 4: Re-run service tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/moments.test.ts
```

Expected: PASS.

### Task 3: Connect Page Update Events To Moment Generation

- [ ] **Step 1: Write page update consumption tests**

Extend publish/subscription integration tests to assert first publish and later update create one page-update Moment, repeated event consumption is idempotent, the Moment has a `published_page` attachment, body text is generated server-side, and private or non-approved pages do not appear in public Moment feed.

- [ ] **Step 2: Run page update consumption tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/pages/publish/route.test.ts apps/web/lib/services/community/moments.test.ts
```

Expected: FAIL until publish/page-update event flow invokes Moment consumption.

- [ ] **Step 3: Wire Moment consumption into page update event flow**

After `createPageUpdateEvent` succeeds in the publish flow or subscription service, call `consumePageUpdateEventForMoment`. Preserve event creation idempotency and do not block publishing if Moment generation fails; record an `activity_events` failure metadata entry when applicable.

- [ ] **Step 4: Re-run page update consumption tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/pages/publish/route.test.ts apps/web/lib/services/community/moments.test.ts
```

Expected: PASS.

### Task 4: Implement Moment API

- [ ] **Step 1: Write route tests**

Test `GET /api/moments/feed?feed_type=latest`, `recommended`, following fallback response `fallback_feed_type`, cursor/limit pagination, topic filter, author_user_slug filter, invalid feed_type, logged-out following behavior, `POST /api/moments`, empty body without attachments 400, attachment unauthorized 403/404, topic/attachment limit 400, `PATCH /api/moments/{moment_id}`, non-author edit 403, `DELETE /api/moments/{moment_id}`, non-author delete 403, repeated delete behavior, and `GET /api/moment-topics`.

- [ ] **Step 2: Run route tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/moments-routes.test.ts
```

Expected: FAIL until routes exist.

- [ ] **Step 3: Implement route handlers**

Use optional session for feed reads and `requireAuth` for writes. Do not accept client-submitted `author_user_id`, counters, `kind = page_update`, or source event ids.

- [ ] **Step 4: Re-run route tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/app/api/moments-routes.test.ts
```

Expected: PASS.

### Task 5: Implement `/moment` UI

- [ ] **Step 1: Write UI tests**

Assert composer logged-in state, composer logged-out prompt, topic input, topic entry links, attachment picker flow, attachment preview before publish, new moment prompt, more menu edit/delete/report/hide entries, tabs for Following Latest Recommended, timeline items, attachment cards, empty state, mobile single column, long body wrapping, focus-visible controls, sticky bottom bar non-overlap, and icon button accessible names.

- [ ] **Step 2: Run UI tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/moment-page.test.tsx
```

Expected: FAIL until components exist.

- [ ] **Step 3: Implement components and route**

Create `/moment` page using `MomentPage`. Use compact timeline layout, no nested cards, stable button sizes, and responsive mobile layout.

- [ ] **Step 4: Re-run UI tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/components/community/moment-page.test.tsx
```

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Verify**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/moments.test.ts apps/web/app/api/moments-routes.test.ts apps/web/components/community/moment-page.test.tsx
pnpm --filter @viben/web type-check
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/app/api/moments apps/web/app/api/moment-topics apps/web/app/moment apps/web/components/community
git commit -m "feat(web): add community moments"
```
