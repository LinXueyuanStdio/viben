# S4: 作者页合集展示

## 概述

将作者页（`/author/[slug]`）的合集 Tab 从占位状态改为实际展示该作者创建和收藏的合集。复用已有的合集系统和 `favorites` 表。

## 当前状态

`app/(dashboard)/author/[slug]/page.tsx` 中合集 Tab 始终显示 `EmptyState`："更多合集开发中..."。

## 设计

### 数据查询

在 `AuthorPage` server component 中新增两个查询：

**创建的合集：**
```typescript
db.select().from(collections)
  .where(and(
    eq(collections.ownerId, user.id),
    eq(collections.visibility, "public")
  ))
  .orderBy(desc(collections.updatedAt))
  .limit(20)
```

**收藏的合集：**
```typescript
db.select().from(favorites)
  .where(and(
    eq(favorites.userId, user.id),
    eq(favorites.entityType, "collection")
  ))
  .innerJoin(collections, and(
    eq(collections.id, favorites.entityId),
    eq(collections.visibility, "public")
  ))
  .orderBy(desc(favorites.createdAt))
  .limit(20)
```

### 前端

合集 Tab 分为两个区域：

```
┌─────────────────────────────┐
│ 📂 创建的合集               │  ← SectionHead
├─────────────────────────────┤
│ [合集卡片] [合集卡片]       │
│ [合集卡片]                  │
│ 或 "暂无创建的合集"         │
├─────────────────────────────┤
│ ❤️ 收藏的合集              │  ← SectionHead
├─────────────────────────────┤
│ [合集卡片] [合集卡片]       │
│ 或 "暂无收藏的合集"         │
└─────────────────────────────┘
```

- 复用已有 `CollectionCard` 组件
- 空态："暂无创建的合集" / "暂无收藏的合集"

## 涉及文件

| 层 | 文件 | 操作 |
|----|------|------|
| UI | `app/(dashboard)/author/[slug]/page.tsx` | 修改（合集 Tab 内容替换） |

单个文件修改，无需新增 API 路由或数据库迁移。

## 依赖

- 已有 `collections` 表和 `favorites` 表
- 已有 `CollectionCard` 组件
- `favorites.entityType` 已支持 `collection`

## i18n

需要新增的 key（zh-CN）：
- `community.createdCollections` — "创建的合集"
- `community.favoritedCollections` — "收藏的合集"
- `community.noCreatedCollections` — "暂无创建的合集"
- `community.noFavoritedCollections` — "暂无收藏的合集"

需要删除的 key：
- `community.collectionsSoon` — 不再需要
