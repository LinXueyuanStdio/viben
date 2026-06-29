# 作者页合集展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将作者页的合集 Tab 从占位空态改为展示该作者创建和收藏的合集，分两个区域展示。

**Architecture:** 仅在现有 server component 中添加两个数据库查询 + UI 渲染。复用已有 `collections` 表、`favorites` 表和 `CollectionCard` 组件。单个文件修改。

**Tech Stack:** React Server Component, Drizzle ORM, CollectionCard

## Global Constraints

- 单个文件修改：`app/(dashboard)/author/[slug]/page.tsx`
- 无需新增 API 路由或数据库迁移
- 复用已有 `CollectionCard` 组件
- `favorites` 表已支持 `collection` entityType
- 分"创建的合集"和"收藏的合集"两个区域
- 每个区域有空态文案

---

### Task 1: 添加合集数据查询

**Files:**
- Modify: `apps/web/app/(dashboard)/author/[slug]/page.tsx`

**Interfaces:**
- Consumes: `collections`, `favorites` from `@/lib/db/schema`, `CollectionCard` from `@/components/collections/collection-card`

- [ ] **Step 1: 修改 AuthorPage server component**

在 `app/(dashboard)/author/[slug]/page.tsx` 中：

**1a. 在 import 区域添加（约第 6 行附近）：**

```typescript
import { db, publishedPages, users, moments, collections, favorites } from "@/lib/db"
import { and, eq, desc } from "drizzle-orm"
import { CollectionCard } from "@/components/collections/collection-card"
```

注意：`collections` 和 `favorites` 需要从 `@/lib/db/schema` 和 `@/lib/db` 中正确导入。检查现有项目中的实际导出路径。

**1b. 在 `AuthorPage` 函数体中，现有查询之后，添加两个新查询。**

将现有的 `Promise.all` 改为包含合集查询：

```typescript
const [authorPages, authorMoments, pageCountResult, createdCollections, favoritedCollections] = await Promise.all([
  // ... 现有三个查询保持不变

  // 新增：创建的合集
  db.select().from(collections)
    .where(and(
      eq(collections.ownerId, user.id),
      eq(collections.isPublic, true)
    ))
    .orderBy(desc(collections.updatedAt))
    .limit(20),

  // 新增：收藏的合集
  db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      description: collections.description,
      isPublic: collections.isPublic,
      itemCount: collections.itemCount,
      forksCount: collections.forksCount,
      favoritesCount: collections.favoritesCount,
      owner: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(favorites)
    .innerJoin(collections, and(
      eq(collections.id, favorites.entityId),
      eq(collections.isPublic, true)
    ))
    .innerJoin(users, eq(users.id, collections.ownerId))
    .where(and(
      eq(favorites.userId, user.id),
      eq(favorites.entityType, "collection")
    ))
    .orderBy(desc(favorites.createdAt))
    .limit(20),
])
```

**注意：** 以上查询中的字段名需要和实际 schema 匹配。`collections` 表的列名请参考 `lib/db/schema.ts` 中 `collections` 的定义（约第 239 行）。

**1c. 将查询结果转换为 CollectionCard 需要的数据格式：**

```typescript
// 在 pageCards 和 feedCards 定义之后添加：

const createdCollectionCards = createdCollections.map((c) => ({
  collection: {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    isPublic: c.isPublic,
    itemCount: c.itemCount,
    forksCount: c.forksCount,
    favoritesCount: c.favoritesCount,
    owner: {
      id: user.id,
      username: user.username ?? user.userSlug,
      displayName: user.displayName ?? user.userSlug,
      avatarUrl: user.avatarUrl,
    },
  },
}))

const favoritedCollectionCards = favoritedCollections.map((row) => ({
  collection: {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    isPublic: row.isPublic,
    itemCount: row.itemCount,
    forksCount: row.forksCount,
    favoritesCount: row.favoritesCount,
    owner: {
      id: row.owner.id,
      username: row.owner.username,
      displayName: row.owner.displayName ?? row.owner.username,
      avatarUrl: row.owner.avatarUrl,
    },
  },
}))
```

- [ ] **Step 2: 验证类型检查和编译**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。如有，根据实际 schema 字段名调整。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/author/\[slug\]/page.tsx
git commit -m "feat: add collection queries to author page"
```

---

### Task 2: 替换合集 Tab UI

**Files:**
- Modify: `apps/web/app/(dashboard)/author/[slug]/page.tsx`（同一个文件）

- [ ] **Step 1: 替换合集 Tab 内容**

找到 `VibenTabsContent value="合集"`（约第 174-177 行），将：

```tsx
<VibenTabsContent value="合集" className="mt-3">
  <SectionHead title="合集" />
  <EmptyState tKey="community.collectionsSoon" fallback="更多合集开发中..." />
</VibenTabsContent>
```

替换为：

```tsx
<VibenTabsContent value="合集" className="mt-3">
  <div className="grid gap-4">
    {/* 创建的合集 */}
    <div>
      <SectionHead title={/*t("community.createdCollections")*/ "创建的合集"} />
      {createdCollectionCards.length === 0 ? (
        <EmptyState tKey="community.noCreatedCollections" fallback="暂无创建的合集" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
          {createdCollectionCards.map((c, i) => (
            <CollectionCard key={i} collection={c.collection} />
          ))}
        </div>
      )}
    </div>

    {/* 收藏的合集 */}
    <div>
      <SectionHead title={/*t("community.favoritedCollections")*/ "收藏的合集"} />
      {favoritedCollectionCards.length === 0 ? (
        <EmptyState tKey="community.noFavoritedCollections" fallback="暂无收藏的合集" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
          {favoritedCollectionCards.map((c, i) => (
            <CollectionCard key={i} collection={c.collection} />
          ))}
        </div>
      )}
    </div>
  </div>
</VibenTabsContent>
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/author/\[slug\]/page.tsx
git commit -m "feat: replace author collections placeholder with real data"
```

---

### Task 3: 添加 i18n keys

**Files:**
- Modify: `apps/web/lib/i18n/locales/zh-CN.json`
- Modify: `apps/web/lib/i18n/locales/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `zh-CN.json` 的 `community` 对象中添加：

```json
"createdCollections": "创建的合集",
"favoritedCollections": "收藏的合集",
"noCreatedCollections": "暂无创建的合集",
"noFavoritedCollections": "暂无收藏的合集"
```

删除：
```json
"collectionsSoon": "更多合集开发中...",
```

- [ ] **Step 2: 添加英文翻译**

```json
"createdCollections": "Created Collections",
"favoritedCollections": "Favorited Collections",
"noCreatedCollections": "No collections created yet",
"noFavoritedCollections": "No favorited collections yet"
```

删除：
```json
"collectionsSoon": "More collections coming soon...",
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/i18n/locales/zh-CN.json apps/web/lib/i18n/locales/en.json
git commit -m "feat: add i18n keys for author collections"
```

---

### Task 4: 全流程验证

- [ ] **Step 1: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 2: Commit（如有修正）**

```bash
git add -A
git commit -m "chore: final typecheck for author collections"
```
