# Published Page Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每次发布 static page 时自动记录一条发布版本快照，并在桌面设置页提供发布历史、版本打开、回退和云版本覆盖本地 HTML。

**Architecture:** `published_pages` 继续保存当前线上内容；`published_page_versions` 保存不可变内容快照；新增 `published_page_records` 保存 append-only 发布记录。正常发布新增版本和发布记录，回退只更新当前线上内容并新增发布记录，不新增版本。桌面端只访问 Gateway，Gateway 通过 `proxyFetch` 调用 viben-web。

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

### Task 3: 发布记录、历史、回退和版本内容 API

**Files:**
- Modify: `apps/web/lib/db/schema.ts`
- Modify: `apps/web/lib/db/migrations/0002_published_pages.sql`
- Modify: `apps/web/lib/db/published-pages.ts`
- Create: `apps/web/app/api/pages/publish-history/route.ts`
- Create: `apps/web/app/api/pages/publish-version/route.ts`
- Create: `apps/web/app/api/pages/publish-rollback/route.ts`
- Create: `apps/web/app/page/[user_slug]/[page_id]/versions/[version]/route.ts`
- Modify: `apps/web/app/api/pages/publish/route.ts`

- [ ] 发布成功后插入 `published_page_records`，记录本次发布使用的新版本号。
- [ ] 历史 API 按发布时间倒序返回发布记录，记录包含版本号、动作、版本 URL 和当前线上版本标记。
- [ ] 版本内容 API 返回指定版本 HTML，用于桌面端下载覆盖本地文件。
- [ ] 回退 API 更新 `published_pages` 为指定版本内容，并追加 rollback 记录；不插入 `published_page_versions`。
- [ ] 版本公共 URL 返回指定版本 HTML，避免用户打开历史版本时看到当前线上内容。

### Task 4: Gateway 和桌面设置页

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/client.ts`
- Modify: `packages/core/src/gateway/routes/page.ts`
- Modify: `apps/desktop/src/lib/gateway/types/page.ts`
- Modify: `apps/desktop/src/lib/gateway/modules/pages.ts`
- Modify: `apps/desktop/src/pages/apps/components/page-setting-panel.tsx`

- [ ] Gateway 新增 publish-history、publish-version、publish-rollback 路由，全部使用 `proxyFetch` 调用 viben-web。
- [ ] 桌面 gateway module 新增对应函数和类型。
- [ ] 设置页自动加载历史列表；用户可选中记录并打开版本 URL、回退到非当前版本、把云版本 HTML 覆盖本地静态入口文件。
- [ ] Toast 保持简短，详细错误写入 console。

### Task 5: 验证

**Commands:**
- `pnpm --dir apps/web exec vitest run 'app/api/pages/publish/route.test.ts'`
- `pnpm --dir apps/web exec vitest run 'app/api/pages/publish/route.test.ts' 'app/page/[user_slug]/[page_id]/route.test.ts' 'app/page/[user_slug]/page.test.tsx' 'app/[user_id]/page/page.test.tsx' 'components/published-pages/published-page-list.test.tsx' 'lib/validations/__tests__/user.test.ts' 'lib/auth/__tests__/jwe.test.ts'`
- `pnpm --filter @viben/web type-check`
