# Published Page Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每次发布 static page 时自动记录一条发布版本快照。

**Architecture:** `published_pages` 继续保存最新发布内容；新增 `published_page_versions` 作为 append-only 历史表。发布 API 完成 upsert 后读取当前 published page id 和最新版本号，再插入新版本快照。

**Tech Stack:** Next.js App Route, Drizzle PostgreSQL schema, SQL migration, Vitest.

---

### Task 1: 数据库 Schema 和迁移

**Files:**
- Modify: `apps/web/lib/db/schema.ts`
- Modify: `apps/web/lib/db/migrations/0002_published_pages.sql`
- Modify: `apps/web/lib/db/published-pages.ts`

- [ ] 在 schema 中新增 `publishedPageVersions` 表，字段为 `id`, `publishedPageId`, `uid`, `userId`, `version`, `title`, `icon`, `description`, `html`, `createdAt`。
- [ ] 在迁移 SQL 中创建 `published_page_versions` 表及索引。
- [ ] 在 `ensurePublishedPagesTable` 中补充运行时建表逻辑，保证现有环境无需手动迁移也能发布。

### Task 2: 发布 API 自动写版本

**Files:**
- Modify: `apps/web/app/api/pages/publish/route.test.ts`
- Modify: `apps/web/app/api/pages/publish/route.ts`

- [ ] 先写失败测试，期望发布成功后追加版本记录。
- [ ] 修改 publish route：upsert 当前版本后读取 published page，计算下一个版本号并插入版本快照。
- [ ] 运行发布 API 测试确认通过。

### Task 3: 验证

**Commands:**
- `pnpm --dir apps/web exec vitest run 'app/api/pages/publish/route.test.ts'`
- `pnpm --dir apps/web exec vitest run 'app/api/pages/publish/route.test.ts' 'app/page/[user_slug]/[page_id]/route.test.ts' 'app/page/[user_slug]/page.test.tsx' 'app/[user_id]/page/page.test.tsx' 'components/published-pages/published-page-list.test.tsx' 'lib/validations/__tests__/user.test.ts' 'lib/auth/__tests__/jwe.test.ts'`
- `pnpm --filter @viben/web type-check`

