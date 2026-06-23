# Web 社区关注订阅与通知 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持关注作者、订阅页面、页面更新事件、订阅追更流和站内通知。

**Architecture:** 关注和页面订阅是用户关系事实表，`page_update_events` 是发布流程产出的不可变追更事实，`notifications` 是按关系派生的用户收件箱。订阅读取必须复用发布页可见性服务，不从事件快照直接暴露内容。

**Tech Stack:** Next.js Route Handlers, TypeScript, Drizzle ORM, Vitest, Testing Library.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-subscription-notification-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Modify: `apps/web/app/api/pages/publish/route.ts`
- Modify UI: `apps/web/components/community/author-profile-page.tsx`
- Modify UI: `apps/web/components/community/reader-shell.tsx`
- Create: `apps/web/lib/services/community/subscriptions.ts`
- Create: `apps/web/app/api/users/[username]/follow/route.ts`
- Create: `apps/web/app/api/read/[user_slug]/[page_id]/subscription/route.ts`
- Create: `apps/web/app/api/feed/subscriptions/route.ts`
- Create: `apps/web/app/api/notifications/route.ts`
- Create: `apps/web/app/api/notifications/[notification_id]/read/route.ts`
- Create: `apps/web/app/api/notifications/read/route.ts`
- Create UI: `apps/web/components/community/subscription-page.tsx`
- Create page: `apps/web/app/subscription/page.tsx`
- Test: `apps/web/lib/services/community/subscriptions.test.ts`
- Test: `apps/web/app/api/community-subscriptions-routes.test.ts`
- Test: `apps/web/components/community/subscription-page.test.tsx`

## Required Data Contract

- `user_follows`: `id`, `follower_user_id`, `followee_user_id`, `notify_level`, `created_at`, `updated_at`, unique `follower_user_id + followee_user_id`, DB-level self-follow check where supported, indexes for `followee_user_id + created_at` and `follower_user_id + created_at`.
- `page_subscriptions`: `id`, `user_id`, `published_page_id`, `notify_level`, `last_seen_version`, `created_at`, `updated_at`, unique `user_id + published_page_id`, indexes for `user_id + updated_at` and `published_page_id + created_at`.
- `page_update_events`: `id`, `published_page_id`, `user_id`, `user_slug`, `page_id`, `version`, `event_type`, `importance`, `title`, `description`, `change_summary`, `visibility`, `created_at`, unique `published_page_id + version + event_type`.
- `notifications`: `id`, `recipient_user_id`, `actor_user_id`, `type`, `page_update_event_id`, `published_page_id`, `title`, `body`, `read_at`, `created_at`, unique `recipient_user_id + page_update_event_id + type`.
- `users.followers_count` and `published_pages.subscriber_count` are denormalized counters.
- Follow route must reuse the existing `apps/web/app/api/users/[username]` dynamic segment. Route code maps `params.username` to service argument `user_slug`; do not create a sibling slug-named dynamic segment under `apps/web/app/api/users`.
- Subscription feed item response must include `event_id`, `published_page_id`, `user_slug`, `page_id`, `version`, `event_type`, `importance`, `title`, `description`, `change_summary`, `created_at`, `source_reasons`, `is_seen`, `url`.
- Notifications batch read must support both `before_cursor` and explicit `notification_ids`.
- Notification creation must honor `notify_level = all | major | none`, dedupe users who match both followed author and subscribed page, skip the actor, skip recipients who cannot currently view the page, and never create notifications for `notify_level = none`.
- `GET /api/notifications` must support `unread_only`, stable `created_at + id` cursor pagination, and return `unread_count`.
- PATCH follow and subscription APIs must be tested: `PATCH /api/users/[username]/follow` updates `notify_level`; `PATCH /api/read/[user_slug]/[page_id]/subscription` updates `notify_level` and only advances `last_seen_version`.
- `page_update_events` must have indexes `published_page_id + created_at`, `user_id + created_at`, and `created_at + id`.
- Migration must backfill `users.followers_count` from `user_follows` and `published_pages.subscriber_count` from `page_subscriptions`; tests verify counters match relation counts.
- `/{user_slug}` author profile renders follow/unfollow, `followers_count`, own-profile no self-follow control, and public page permission filtering. `/read/{user_slug}/{page_id}` renders follow author, subscribe page, `subscriber_count`, `notify_level`, and login prompts for anonymous actions.

## Tasks

### Task 1: Add Schema

- [ ] **Step 1: Write schema tests**

Assert the four tables and two counter fields exist with the exact field names above, including `created_at`, `updated_at`, unique constraints, self-follow rejection, the exact `page_update_events` indexes listed above, and counter backfill/consistency checks.

- [ ] **Step 2: Run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL until schema exists.

- [ ] **Step 3: Implement schema and migration**

Add tables and counters. Generate migration with `pnpm --filter @viben/web db:generate`.

- [ ] **Step 4: Re-run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: PASS.

### Task 2: Implement Follow And Subscription Services

- [ ] **Step 1: Write service tests**

Cover follow, unfollow, self-follow rejection, notify level patch, subscribe, unsubscribe, private page rejection for non-owner, `last_seen_version` monotonic update, counter clamping, notification generation for `all/major/none`, followed-author plus subscribed-page dedupe, actor skip, and current permission filtering.

- [ ] **Step 2: Run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/subscriptions.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 3: Implement services**

Create functions `followUser`, `unfollowUser`, `updateFollowNotifyLevel`, `subscribePage`, `unsubscribePage`, `updatePageSubscription`, `createPageUpdateEvent`, `createNotificationsForPageUpdate`, `listSubscriptionFeed`, `listNotifications`, `markNotificationRead`, `markNotificationsReadBefore`, `markNotificationsReadByIds`.

- [ ] **Step 4: Re-run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/subscriptions.test.ts
```

Expected: PASS.

### Task 3: Attach Page Update Events To Publish Flow

- [ ] **Step 1: Write publish integration test**

Assert first publish creates `event_type = published`, next version creates `event_type = updated`, title/description/visibility changes create `updated`, identical content does not create a duplicate event, retry does not create duplicate event, `importance` defaults to `normal`, explicit `major` is preserved, old publish request body still succeeds, publish flow invokes notification generation, `notify_level` filtering is honored end-to-end, and followed-author plus subscribed-page recipients are deduped.

- [ ] **Step 2: Run publish integration test**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/pages/publish/route.test.ts
```

Expected: FAIL until publish flow calls subscription service.

- [ ] **Step 3: Update publish route**

After a successful page version write, call `createPageUpdateEvent` and `createNotificationsForPageUpdate`. Do not notify the author.

- [ ] **Step 4: Re-run publish test**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/pages/publish/route.test.ts
```

Expected: PASS.

### Task 4: Implement API Routes And UI

- [ ] **Step 1: Write route and UI tests**

Test `/api/users/[username]/follow` using `username` as `user_slug`, PATCH follow notify level, `/api/read/[user_slug]/[page_id]/subscription`, PATCH subscription notify level and forward-only `last_seen_version`, `/api/feed/subscriptions`, feed hiding an event after viewer loses private-page access, `/api/notifications` with `unread_only`, `unread_count`, stable cursor, explicit `notification_ids` batch read, `before_cursor` batch read, notification hiding after viewer loses private-page access, current-user-only read protection, `/{user_slug}` follow UI, author `followers_count`, self-profile no follow button, author public-page filtering, `/read` follow author UI, subscribe page UI, `subscriber_count`, `notify_level`, `/subscription` empty state, logged-out state, unread marker, `next_cursor/has_more` load more, followed-author source, subscribed-page source, mobile layout, long title wrapping, focus-visible controls, and list rendering.

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @viben/web test:run 'apps/web/app/api/community-subscriptions-routes.test.ts' apps/web/components/community/subscription-page.test.tsx
```

Expected: FAIL until routes and UI exist.

- [ ] **Step 3: Implement routes and page**

Use `requireAuth` for relationship writes and feed reads. Use cursor pagination with `next_cursor` and `has_more`. Feed and notification reads must re-check current page visibility before returning items. Update author profile and reader shell components with follow/subscribe state. UI renders "我的订阅", page cards, source reasons, unread state, load more, and login guidance.

- [ ] **Step 4: Re-run tests**

```bash
pnpm --filter @viben/web test:run 'apps/web/app/api/community-subscriptions-routes.test.ts' apps/web/components/community/subscription-page.test.tsx
```

Expected: PASS.

### Task 5: Commit

- [ ] **Step 1: Verify**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/subscriptions.test.ts
pnpm --filter @viben/web type-check
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/app/api apps/web/app/subscription apps/web/components/community
git commit -m "feat(web): add subscriptions and notifications"
```
