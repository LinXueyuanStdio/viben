# Web 社区榜单与推荐排序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/leaderboard`、首页 Feeds、分类推荐和横向列表提供预计算榜单快照读取能力。

**Architecture:** 请求阶段只读取 `ranking_snapshots`、`ranking_items` 和当前实体轻量表，不实时扫描行为大表。公开读取必须再次校验页面当前可见性和审核状态，跳过失效快照项并从后续项补足。

**Tech Stack:** Next.js Route Handlers, React 19, TypeScript, Drizzle ORM, Vitest, Testing Library.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-ranking-recommendation-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Create: `apps/web/lib/services/community/rankings.ts`
- Create: `apps/web/app/api/rankings/route.ts`
- Create: `apps/web/app/api/rankings/[ranking_key]/route.ts`
- Create: `apps/web/app/api/rankings/home/route.ts`
- Create: `apps/web/app/api/rankings/sections/[section_key]/route.ts`
- Create: `apps/web/app/api/admin/rankings/rebuild/route.ts`
- Create UI: `apps/web/components/community/leaderboard-page.tsx`
- Create page: `apps/web/app/leaderboard/page.tsx`
- Test: `apps/web/lib/services/community/rankings.test.ts`
- Test: `apps/web/app/api/rankings-routes.test.ts`
- Test: `apps/web/components/community/leaderboard-page.test.tsx`

## Required Data Contract

- `ranking_snapshots`: `ranking_key`, `entity_type`, `time_window`, `scope_type`, `scope_id`, `algorithm_version`, `status`, `generated_at`, `valid_from`, `valid_until`, `source_from`, `source_until`, `item_count`, `metadata`, timestamps.
- `ranking_items`: `snapshot_id`, `rank`, `entity_type`, `entity_id`, `score`, `raw_score`, `decay_factor`, `reason`, `breakdown`, `title`, `description`, `user_id`, `user_slug`, `page_id`, `category_id`, `cover_asset_id`, `tags`, `published_at`, `last_published_at`, `created_at`.
- `pages_hot` formula: near 7 day `unique_views + likes * 4 + favorites * 6 + comments * 3 + reposts * 8`, then apply time decay.
- `pages_hot_v1` formula uses `raw_score = unique_views + likes * 4 + favorites * 6 + comments * 3 + reposts * 8`; time decay uses a 72-hour half-life, clamps `decay_factor >= 0.15`, treats negative `age_hours` as `0`, and tie-breaks by `raw_score`, `last_published_at`, then `entity_id`.
- `ranking_snapshots` uniqueness must cover `ranking_key + time_window + scope_type + scope_id + algorithm_version + generated_at`. Because Postgres treats `NULL` values as distinct in unique indexes, global snapshots with `scope_id = null` must use a partial unique index, expression index with a sentinel, or non-null sentinel value; schema tests must prove duplicate global snapshots are rejected.
- `ranking_items` must have query indexes for `snapshot_id + rank` and `entity_type + entity_id`.
- Public ranking item DTO must include `rank`, `entity_type`, `entity_id`, `score`, `reason`, `title`, `description`, `user_slug`, `page_id`, `read_url`, `category_id`, `cover_url`, `tags`, `published_at`, `last_published_at`, `stats`; when `include_breakdown = true`, include `breakdown`.
- `GET /api/rankings/home` returns `seed`, `feed_items`, `next_cursor`, `has_more`, `sections`, and `generated_at`; each section returns `section_key`, `title`, `ranking_key`, `items`, `next_cursor`, and `has_more`.
- `POST /api/admin/rankings/rebuild` body supports `ranking_key`, `time_window`, `scope_type`, `scope_id`, `algorithm_version`, `source_from`, `source_until`, `dry_run`, and `force`; `dry_run = true` validates and returns a preview without writing snapshots or items.

## Tasks

### Task 1: Add Ranking Schema

- [ ] **Step 1: Write schema tests**

Assert all snapshot and item fields exist. Assert unique keys for `snapshot_id + entity_type + entity_id` and `snapshot_id + rank`, global snapshot duplicate rejection when `scope_id` is null, and indexes for `snapshot_id + rank` and `entity_type + entity_id`.

- [ ] **Step 2: Run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL until ranking schema exists.

- [ ] **Step 3: Implement schema and migration**

Add ranking tables and generate migration with `pnpm --filter @viben/web db:generate`.

- [ ] **Step 4: Re-run schema tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: PASS.

### Task 2: Implement Ranking Read Service

- [ ] **Step 1: Write service tests**

Cover latest ready snapshot selection, snapshot uniqueness including `scope_id = null`, expired snapshot still usable with warning metadata, invalid item skipped after current visibility check, pagination cursor, seeded section shuffle, empty response when no snapshot exists, `pages_hot_v1` raw score weights, 72-hour half-life, `decay_factor >= 0.15`, negative age clamp, tie-break ordering, `read_url`, `cover_url`, `stats`, `include_breakdown`, home response `feed_items/sections/generated_at`, and section response fields.

- [ ] **Step 2: Run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/rankings.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 3: Implement `rankings.ts`**

Create `getRanking`, `getHomeRankings`, `getRankingSection`, `rebuildRankingSnapshot`. Use DTO fields `ranking_key`, `time_window`, `scope_type`, `scope_id`, `snapshot_id`, `algorithm_version`, `generated_at`, `items`, `next_cursor`, `has_more`, `seed`.

- [ ] **Step 4: Re-run service tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/rankings.test.ts
```

Expected: PASS.

### Task 3: Implement Ranking APIs

- [ ] **Step 1: Write route tests**

Test `GET /api/rankings`, `GET /api/rankings/{ranking_key}`, `GET /api/rankings/home` response fields, `GET /api/rankings/sections/{section_key}` response fields, `include_breakdown=false` default omission, `include_breakdown=true` inclusion, admin rebuild auth rejection for ordinary users, admin rebuild success for admin, rebuild body fields, `dry_run=true` no database writes, and `force` allowing rebuild when an equivalent ready snapshot exists.

- [ ] **Step 2: Run route tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/rankings-routes.test.ts
```

Expected: FAIL until routes exist.

- [ ] **Step 3: Implement route handlers**

Use `snake_case` query parsing. Public routes use optional session. Admin rebuild requires admin or equivalent operation permission.

- [ ] **Step 4: Re-run route tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/app/api/rankings-routes.test.ts
```

Expected: PASS.

### Task 4: Implement `/leaderboard` UI

- [ ] **Step 1: Write UI tests**

Assert "热门榜单" heading, ranking type switch, time window switch, category filter, tags, summary, heat score, generated/updated time, page preview card content, rank number, author info, title, published time, key stats for unique views, likes, favorites, comments, and reposts, empty state, logged-out read affordance, mobile single column, long title wrapping, focus-visible controls, sticky bottom bar non-overlap, and icon button accessible names.

- [ ] **Step 2: Run UI tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/leaderboard-page.test.tsx
```

Expected: FAIL until UI exists.

- [ ] **Step 3: Implement components and route**

Render `/leaderboard` from ranking service. Cards show cover, author, title, summary, category, tags, published time, heat score, generated/updated time, unique view count, like count, favorite count, comment count, repost count, and stable actions. Provide controls for ranking type and time window.

- [ ] **Step 4: Re-run UI tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/components/community/leaderboard-page.test.tsx
```

Expected: PASS.

### Task 5: Commit

- [ ] **Step 1: Verify**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/rankings.test.ts apps/web/app/api/rankings-routes.test.ts apps/web/components/community/leaderboard-page.test.tsx
pnpm --filter @viben/web type-check
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/app/api/rankings apps/web/app/api/admin/rankings apps/web/app/leaderboard apps/web/components/community
git commit -m "feat(web): add community rankings"
```
