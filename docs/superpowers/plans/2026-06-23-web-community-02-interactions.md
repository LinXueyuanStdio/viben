# Web 社区通用互动层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为发布页阅读壳和 Moment 提供独立的评论、点赞、收藏互动层。

**Architecture:** 新互动层使用 `community_entities` 作为目标实体注册表，不改旧 marketplace 的 `comments`、`favorites`、`ratings`。所有写操作在事务内写明细并更新冗余计数，所有 API 位于 `/api/community/*`。

**Tech Stack:** Next.js Route Handlers, TypeScript, Drizzle ORM, Vitest, Testing Library.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-interactions-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Create: `apps/web/lib/services/community/interactions.ts`
- Create: `apps/web/app/api/community/entities/summary/route.ts`
- Create: `apps/web/app/api/community/comments/route.ts`
- Create: `apps/web/app/api/community/comments/[comment_id]/route.ts`
- Create: `apps/web/app/api/community/favorites/route.ts`
- Create: `apps/web/app/api/community/reactions/toggle/route.ts`
- Create: `apps/web/app/api/community/favorites/toggle/route.ts`
- Modify: `apps/web/app/read/[user_slug]/[page_id]/page.tsx`
- Modify: `apps/web/app/page/[user_slug]/[page_id]/route.ts`
- Modify UI: `apps/web/components/community/reader-shell.tsx`
- Create UI: `apps/web/components/community/community-actions.tsx`
- Create UI: `apps/web/components/community/community-comments.tsx`
- Test: `apps/web/lib/services/community/interactions.test.ts`
- Test: `apps/web/app/api/community/interactions-routes.test.ts`

## Required Data Contract

- `community_entities`: `id`, `entity_type`, `entity_id`, `owner_user_id`, `visibility`, `status`, `title`, `canonical_path`, `reactions_count`, `favorites_count`, `comments_count`, timestamps, unique `entity_type + entity_id`.
- `community_reactions`: `id`, `community_entity_id`, `user_id`, `reaction_type`, `created_at`, unique `community_entity_id + user_id + reaction_type`.
- `community_favorites`: `id`, `community_entity_id`, `user_id`, `created_at`, unique `community_entity_id + user_id`.
- `community_comments`: `id`, `community_entity_id`, `parent_comment_id`, `user_id`, `content`, `status`, `depth`, `replies_count`, `reactions_count`, timestamps, `deleted_at`, `deleted_by_user_id`, index `status + created_at`.
- Summary response shape must be `{ entity: { id, entity_type, entity_id, visibility, reactions_count, favorites_count, comments_count }, viewer: { is_authenticated, has_reacted, has_favorited, can_comment, can_moderate } }`.
- Reaction toggle response must use `{ has_reacted, reaction_type, reactions_count }`; favorite toggle response must use `{ has_favorited, favorites_count }`.
- Comment list response must use `{ comments, next_cursor }`; each comment includes `author`, `viewer_has_reacted`, `replies_count`, `reactions_count`, `created_at`, and `updated_at`. Replies are read with `parent_comment_id` and independent pagination, not embedded as `replies`.
- Comment detail route must support `PATCH /api/community/comments/{comment_id}` for editing own active comments and `DELETE` with `mode = delete | hide`. Owner can delete own comment; target entity owner and moderators can delete or hide comments. Deleting or hiding a parent comment also hides visible replies and decrements counts by the affected active comment count.
- Favorites list route must support `GET /api/community/favorites?cursor=&limit=&entity_type=` for the current user's favorite list and returns `items`, `next_cursor`, `has_more`; each item includes entity summary and `canonical_path`.
- `/read/{user_slug}/{page_id}` must map the loaded `published_pages.id` to `community_entities(entity_type = published_page, entity_id = published_pages.id)`, render `CommunityActions` and `CommunityComments`, and refresh viewer state after login-required actions. `/page/{user_slug}/{page_id}` must remain raw HTML and must not include community action/comment markup.
- Reaction toggles for `entity_type = comment` must update both `community_entities.reactions_count` and `community_comments.reactions_count` in the same transaction.
- Add a reconcile service that rebuilds `community_entities` and `community_comments` counters from detail tables for `reactions_count`, `favorites_count`, `comments_count`, `replies_count`, and comment `reactions_count`.

## Tasks

### Task 1: Add Interaction Schema

- [ ] **Step 1: Write schema tests**

Create tests asserting all four tables export the fields listed above, including `owner_user_id`, `title`, `deleted_by_user_id`, and `status + created_at` index coverage.

- [ ] **Step 2: Run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL until schema fields exist.

- [ ] **Step 3: Implement Drizzle schema and migration**

Add the four tables without changing old marketplace social tables. Generate migration with `pnpm --filter @viben/web db:generate`.

- [ ] **Step 4: Re-run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: PASS.

### Task 2: Implement Service Layer

- [ ] **Step 1: Write service tests**

Cover `ensureCommunityEntity`, `getCommunitySummary`, `toggleReaction`, `toggleFavorite`, `listFavorites`, `listComments`, reply list by `parent_comment_id`, `createComment`, `updateComment`, `deleteComment`, `hideComment`, target entity owner delete/hide, moderator delete/hide, parent delete/hide cascading replies, comment-entity reaction count sync, and reconcile counter rebuild. Assert the summary response has nested `entity` and `viewer` objects, including `is_authenticated`, `can_comment`, and `can_moderate`.

- [ ] **Step 2: Run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/interactions.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 3: Implement interactions service**

Use transactions for toggles and comment writes. Clamp decremented counters at `0`. Limit comment depth to `0` and `1`. Return `snake_case` DTO fields.

- [ ] **Step 4: Re-run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/interactions.test.ts
```

Expected: PASS.

### Task 3: Implement API Routes

- [ ] **Step 1: Write route tests**

Test anonymous summary read, authenticated reaction toggle with `reaction_type`, favorite toggle, favorites list item summaries, anonymous comments read DTO, reply pagination via `parent_comment_id`, comment create, owner edit, owner delete, entity-owner delete/hide, moderator delete/hide, parent delete cascading replies, non-owner edit rejection, non-owner delete rejection, and reconcile endpoint or service invocation.

- [ ] **Step 2: Run route tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/community/interactions-routes.test.ts
```

Expected: FAIL until route handlers exist.

- [ ] **Step 3: Implement route handlers**

Create the route files listed in Files. Use `requireAuth` for writes and optional session for summary/comment reads. Reject non-`snake_case` request bodies by parsing only documented fields.

- [ ] **Step 4: Re-run route tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/community/interactions-routes.test.ts
```

Expected: PASS.

### Task 4: Add Reader UI Controls

- [ ] **Step 1: Write component tests**

Assert icon-only buttons have accessible names for like, favorite, share, comment, and more actions. Assert comment form has a label and error live region. Anonymous users can read comments; clicking like, favorite, comment submit, or comment input shows a login prompt without losing scroll state.

- [ ] **Step 2: Run component tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/community-actions.test.tsx apps/web/components/community/community-comments.test.tsx
```

Expected: FAIL until components exist.

- [ ] **Step 3: Implement components**

Use lucide-react icons, `aria-label` for icon-only buttons, stable button dimensions, no card nesting, and responsive single column on mobile.

- [ ] **Step 4: Re-run component tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/community-actions.test.tsx apps/web/components/community/community-comments.test.tsx
```

Expected: PASS.

### Task 5: Integrate Interactions Into Reader Shell

- [ ] **Step 1: Write `/read` integration tests**

Extend the reader route tests to assert `/read/{user_slug}/{page_id}` creates or loads a `published_page` community entity, renders action and comment regions, refreshes viewer state after login-required actions, and calls community APIs with public `entity_type = published_page` and `entity_id = published_pages.id` rather than exposing internal `community_entity_id` to the client contract.

- [ ] **Step 2: Write `/page` non-injection regression test**

Extend `apps/web/app/page/[user_slug]/[page_id]/route.test.ts` to assert raw HTML output does not include `CommunityActions`, comment form labels, or community API bootstrapping markup.

- [ ] **Step 3: Implement reader integration**

Update `ReaderShell` and `/read` page to call `ensureCommunityEntity` for the current published page and render `CommunityActions` and `CommunityComments`. Keep the raw HTML route unchanged except for any permission filtering already required by the page-directory plan.

- [ ] **Step 4: Run reader integration tests**

```bash
pnpm --filter @viben/web test:run 'apps/web/app/read/[user_slug]/[page_id]/page.test.tsx' 'apps/web/app/page/[user_slug]/[page_id]/route.test.ts'
```

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Verify**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/interactions.test.ts apps/web/app/api/community/interactions-routes.test.ts 'apps/web/app/read/[user_slug]/[page_id]/page.test.tsx'
pnpm --filter @viben/web type-check
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/app/api/community apps/web/components/community
git commit -m "feat(web): add community interactions"
```
