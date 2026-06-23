# Web 社区首页运营位与后台配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持 `/` 和 `/web` 从可发布、可预览、可回滚的运营配置读取首页内容，并保留 `/landing` 作为营销页。

**Architecture:** 后台编辑 `operation_slots` 和 `operation_items`，发布时生成 `operation_revisions.snapshot` 作为前台读取权威快照。前台读取 active revision 后二次校验引用实体公开状态，不足部分按 slot 兜底策略补足。

**Tech Stack:** Next.js Route Handlers, React 19, TypeScript, Drizzle ORM, Vitest, Testing Library.

---

## Source Spec

- `docs/superpowers/specs/2026-06-23-web-community-operations-design.md`

## Files

- Modify: `apps/web/lib/db/schema.ts`
- Create: `apps/web/lib/services/community/operations.ts`
- Create: `apps/web/app/api/home/config/route.ts`
- Create: `apps/web/app/api/admin/operations/surfaces/route.ts`
- Create: `apps/web/app/api/admin/operations/slots/route.ts`
- Create: `apps/web/app/api/admin/operations/slots/[slot_id]/route.ts`
- Create: `apps/web/app/api/admin/operations/items/route.ts`
- Create: `apps/web/app/api/admin/operations/items/[item_id]/route.ts`
- Create: `apps/web/app/api/admin/operations/validate/route.ts`
- Create: `apps/web/app/api/admin/operations/preview/route.ts`
- Create: `apps/web/app/api/admin/operations/revisions/route.ts`
- Create: `apps/web/app/api/admin/operations/revisions/[revision_id]/publish/route.ts`
- Create: `apps/web/app/api/admin/operations/revisions/[revision_id]/rollback/route.ts`
- Create: `apps/web/app/api/admin/operations/audit_logs/route.ts`
- Create page: `apps/web/app/(admin)/admin/operations/page.tsx`
- Create UI: `apps/web/components/community/admin/operations-console.tsx`
- Create UI: `apps/web/components/community/admin/operation-slot-list.tsx`
- Create UI: `apps/web/components/community/admin/operation-item-editor.tsx`
- Create UI: `apps/web/components/community/admin/operation-revision-panel.tsx`
- Create UI: `apps/web/components/community/admin/operation-audit-log.tsx`
- Modify UI: `apps/web/components/community/community-home-page.tsx`
- Test: `apps/web/lib/services/community/operations.test.ts`
- Test: `apps/web/app/api/operations-routes.test.ts`
- Test: `apps/web/components/community/community-home-page.test.tsx`
- Test: `apps/web/components/community/admin/operations-console.test.tsx`

## Required Data Contract

- `operation_slots`: `uid`, `surface`, `slot_key`, `name`, `description`, `layout_type`, `locale`, `min_items`, `max_items`, `sort_order`, `is_active`, `fallback_strategy`, `metadata`, `created_by`, `updated_by`, timestamps, unique `surface + locale + slot_key`.
- `operation_items`: `uid`, `slot_id`, `item_type`, `target_entity_type`, `target_entity_id`, `target_entity_uid`, `target_url`, `title`, `subtitle`, `description`, `image_asset_id`, `image_url`, `cta_label`, `badge_label`, `locale`, `starts_at`, `ends_at`, `sort_order`, `is_active`, `visibility`, `metadata`, `created_by`, `updated_by`, timestamps.
- `operation_revisions`: `uid`, `surface`, `locale`, `revision_number`, `status`, `snapshot`, `validation_report`, `published_at`, `published_by`, `created_by`, timestamps, unique `surface + locale + revision_number`.
- `operation_items.item_type` enum must include `headline`, `poster`, `published_page`, `moment`, `mcp`, `skill`, `collection`, `category`, and `external_link`. `headline` requires title and a valid internal entity or safe external link target; `published_page`, `moment`, `mcp`, `skill`, `collection`, and `category` require valid entity references; `external_link` requires a safe `target_url`; `poster` requires image/title and target URL or entity reference.
- Service publish logic must enforce one active `status = published` revision per `surface + locale` in a transaction by archiving or rolling back the previous active revision before committing the new one.
- `GET /api/home/config` public response must include `surface`, `locale`, `resolved_locale`, `revision_id`, `revision_number`, `generated_at`, `slots`, `fallback_used`, and `cache_ttl_seconds`. `warnings` may only be returned for preview or authorized admin contexts.
- Operation mutations must write audit records for slot create/update, item create/update/archive, validation, preview, revision create, publish, rollback, and failed publish attempts. Audit records include actor, action, target type/id, timestamp, summary, diff or snapshot reference, and surface/locale.
- Frontend config reads and previews must re-check referenced entity state for `published_page`, `moment`, `mcp`, `skill`, `collection`, `category`, and `external_link`. Invalid entities include private/unlisted where not allowed, hidden, rejected, deleted, unpublished, inactive category, unsafe URL, non-public author for published pages, collections whose visible items are empty after filtering, and expired item windows.
- External URLs must use `https` in production, may use localhost only in local development, must reject `javascript:`, `data:`, `file:`, and other unsafe protocols, and must pass the configured allowed-domain policy.
- Validation must reject unsafe `image_url`, missing poster image/title, and locale text missing for the requested locale.
- Audit log API supports filtering by actor and time range.
- Fallback strategies tested in this plan include `latest_public_pages`, `latest_page_updates`, and `featured_categories`.
- Rollback must not mutate historical revision snapshots. It creates a new active revision copied from the selected historical revision or records an explicit new rollback revision with source revision metadata, then publishes that new revision in the single-active transaction.

## Tasks

### Task 1: Add Operations Schema

- [ ] **Step 1: Write schema tests**

Assert the three operations tables contain every field above. Assert only one active published revision per `surface + locale` can be selected by service tests.

- [ ] **Step 2: Run schema tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: FAIL until operations schema exists.

- [ ] **Step 3: Implement schema and migration**

Add tables and generate migration with `pnpm --filter @viben/web db:generate`.

- [ ] **Step 4: Re-run schema tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/db/community-schema.test.ts
```

Expected: PASS.

### Task 2: Implement Operations Service

- [ ] **Step 1: Write service tests**

Cover active revision read, transactional single active published revision per `surface + locale`, locale fallback to `default`, invalid item skip, fallback strategies `latest_public_pages`, `latest_page_updates`, and `featured_categories`, validate errors for private/unlisted/hidden/rejected/deleted published page, non-public page author, deleted/hidden Moment, unpublished MCP/Skill, hidden collection, empty collection after filtering invisible items, inactive category, unsafe external URL including non-https/file/javascript/data, unsafe `image_url`, missing poster image/title, missing locale text, item_type required-field rules including `headline`, preview draft, publish revision, idempotent publish, rollback creates a new active revision without mutating historical snapshot, audit log writes for all mutation actions, failed publish audit log, audit log actor/time filtering, and audit log read.

- [ ] **Step 2: Run service tests**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/operations.test.ts
```

Expected: FAIL until service exists.

- [ ] **Step 3: Implement `operations.ts`**

Create `getHomeConfig`, `listOperationSlots`, `createOperationSlot`, `updateOperationSlot`, `createOperationItem`, `updateOperationItem`, `archiveOperationItem`, `validateOperationConfig`, `previewOperationConfig`, `createOperationRevision`, `publishOperationRevision`, `rollbackOperationRevision`, `listOperationRevisions`, `listOperationAuditLogs`.

- [ ] **Step 4: Re-run service tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/operations.test.ts
```

Expected: PASS.

### Task 3: Implement API Routes

- [ ] **Step 1: Write route tests**

Test `GET /api/home/config?surface=web_home&locale=zh-CN` response fields `resolved_locale`, `revision_id`, `revision_number`, `fallback_used`, `cache_ttl_seconds`, and no public `warnings`; preview auth rejection; preview response may include `warnings`; admin slot CRUD, item CRUD with every `item_type` rule, validate including external URL/image URL/locale failures, preview, revision create, publish, rollback creating a new revision, revision list, audit log write side effects, and audit log list with actor/time filters.

- [ ] **Step 2: Run route tests**

```bash
pnpm --filter @viben/web test:run apps/web/app/api/operations-routes.test.ts
```

Expected: FAIL until routes exist.

- [ ] **Step 3: Implement route handlers**

Public config route uses optional session. Preview and admin routes require admin or `operations.manage`. External links reject `javascript:` and `data:` protocols.

- [ ] **Step 4: Re-run route tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/app/api/operations-routes.test.ts
```

Expected: PASS.

### Task 4: Connect Home UI

- [ ] **Step 1: Write home UI tests**

Assert `/` and `/web` read the same `surface = web_home` data, show headline, poster, page update shelf, category recommendation, Feed, fallback state, and mobile no-overlap layout.

- [ ] **Step 2: Run UI tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/community-home-page.test.tsx
```

Expected: FAIL until home page consumes operations config.

- [ ] **Step 3: Update home UI**

Render slots by `slot_key` from `getHomeConfig`. Keep old marketing page only at `/landing`.

- [ ] **Step 4: Re-run UI tests**

Run:

```bash
pnpm --filter @viben/web test:run apps/web/components/community/community-home-page.test.tsx
```

Expected: PASS.

### Task 5: Build Admin Operations UI

- [ ] **Step 1: Write admin UI tests**

Create `apps/web/components/community/admin/operations-console.test.tsx`. Assert slot list, item editor for each item type, entity status warnings, validate errors, preview, publish, rollback, revision history, audit log list, audit actor/time filters, and permission-denied state for ordinary users.

- [ ] **Step 2: Run admin UI tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/admin/operations-console.test.tsx
```

Expected: FAIL until admin UI exists.

- [ ] **Step 3: Implement admin operations console**

Create `/admin/operations` and the admin components listed in Files. Wire them to `/api/admin/operations/*` routes. Support slot list, item editing, validate, preview, publish, rollback, revision history, and audit log browsing.

- [ ] **Step 4: Re-run admin UI tests**

```bash
pnpm --filter @viben/web test:run apps/web/components/community/admin/operations-console.test.tsx
```

Expected: PASS.

### Task 6: Commit

- [ ] **Step 1: Verify**

```bash
pnpm --filter @viben/web test:run apps/web/lib/services/community/operations.test.ts apps/web/app/api/operations-routes.test.ts apps/web/components/community/community-home-page.test.tsx apps/web/components/community/admin/operations-console.test.tsx
pnpm --filter @viben/web type-check
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/db apps/web/lib/services/community apps/web/app/api/home apps/web/app/api/admin/operations apps/web/app/\\(admin\\)/admin/operations apps/web/components/community
git commit -m "feat(web): add home operations config"
```
