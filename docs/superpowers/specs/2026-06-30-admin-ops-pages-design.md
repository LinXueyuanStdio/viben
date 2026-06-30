# 运营管理后台页面完善

## 概述

为 apps/web 的管理后台新增五个运营管理页面：分类管理、话题/标签管理、榜单管理、运营位管理、页面审核管理。所有页面遵循现有 admin 页面的客户端组件模式，支持完整 CRUD 操作。

## 路由规划

| 路由 | 页面 | 数据表 |
|------|------|--------|
| `/admin/categories` | 分类管理 | `pageCategories` |
| `/admin/topics` | 话题/标签管理 | `momentTopics` |
| `/admin/rankings` | 榜单管理 | `rankingSnapshots` + `rankingItems` |
| `/admin/operations` | 运营位管理 | `operationSlots` + `operationItems` + `operationRevisions` |
| `/admin/pages` | 页面审核管理 | `publishedPages` |

## 权限扩展

新增以下权限到 `AdminPermission` 类型：
- `categories.manage` — 管理分类
- `topics.manage` — 管理话题/标签
- `rankings.view` / `rankings.manage` — 查看/管理榜单
- `operations.manage` — 管理运营位
- `pages.review` — 审核页面

权限分配：super_admin/admin 拥有全部权限，moderator 拥有 `pages.review` + `rankings.view`，support 拥有 `rankings.view`。

## 各页面功能说明

### 1. 分类管理 (`/admin/categories`)

**数据表：** `pageCategories`（id, slug, name, description, icon, sortOrder, isActive, createdAt, updatedAt）

**功能：**
- 列表展示：名称、slug、描述、排序、状态（启用/禁用）
- 状态筛选：全部 / 启用 / 禁用
- 新建分类：弹窗表单（name, slug, description, icon, sortOrder, isActive）
- 编辑分类：弹窗表单，预填现有数据
- 删除分类：确认弹窗
- 排序支持：拖拽或手动输入 sortOrder

**API 路由：**
- `GET /api/admin/categories` — 列表查询（支持 status 筛选）
- `POST /api/admin/categories` — 新建分类（权限：categories.manage）
- `PATCH /api/admin/categories/[id]` — 编辑分类
- `DELETE /api/admin/categories/[id]` — 删除分类

### 2. 话题/标签管理 (`/admin/topics`)

**数据表：** `momentTopics`（id, slug, displayName, description, momentCount, lastMomentAt, isFeatured, isBlocked, createdAt, updatedAt）

**功能：**
- 列表展示：名称、slug、描述、动态数、精选/屏蔽状态
- 筛选：全部 / 精选 / 已屏蔽
- 新建话题：弹窗表单（slug, displayName, description, isFeatured）
- 编辑话题：弹窗表单
- 切换精选/屏蔽状态
- 删除话题

**API 路由：**
- `GET /api/admin/topics` — 列表查询
- `POST /api/admin/topics` — 新建话题（权限：topics.manage）
- `PATCH /api/admin/topics/[id]` — 编辑话题
- `DELETE /api/admin/topics/[id]` — 删除话题

### 3. 榜单管理 (`/admin/rankings`)

**数据表：** `rankingSnapshots` + `rankingItems`

**功能：**
- 快照列表：rankingKey、时间窗口、状态、条目数、生成时间
- 状态筛选：building / ready / failed / expired
- 点击快照查看排名条目详情（rank, entityType, title, score, author 等）
- 手动触发榜单重建（POST /api/admin/rankings/rebuild）

**API 路由：**
- `GET /api/admin/rankings` — 榜单快照列表
- `GET /api/admin/rankings/[id]` — 快照详情 + 条目
- `POST /api/admin/rankings/rebuild` — 触发重建（权限：rankings.manage）

### 4. 运营位管理 (`/admin/operations`)

**数据表：** `operationSlots` + `operationItems` + `operationRevisions`

**功能：**
- Slot 列表：surface、slotKey、名称、布局类型、区域、状态
- 新建/编辑 Slot：弹窗表单
- 点击 Slot 进入 Items 子管理：Item 列表（标题、类型、排序、可见性）
- Item CRUD：新建/编辑/删除 Item
- 发布修订：将当前配置发布为一个 revision

**API 路由：**
- `GET /api/admin/operations/slots` — Slot 列表
- `POST /api/admin/operations/slots` — 新建 Slot（权限：operations.manage）
- `PATCH /api/admin/operations/slots/[id]` — 编辑 Slot
- `DELETE /api/admin/operations/slots/[id]` — 删除 Slot
- `GET /api/admin/operations/slots/[id]/items` — Item 列表
- `POST /api/admin/operations/slots/[id]/items` — 新建 Item
- `PATCH /api/admin/operations/items/[id]` — 编辑 Item
- `DELETE /api/admin/operations/items/[id]` — 删除 Item

### 5. 页面审核管理 (`/admin/pages`)

**数据表：** `publishedPages`（筛选 moderationStatus = 'pending'）

**功能：**
- 待审核页面列表：标题、作者、发布时间、封面
- 审核筛选：待审核 / 已通过 / 已拒绝 / 已隐藏
- 查看页面详情：标题、描述、作者信息、内容预览
- 审批操作：通过 / 拒绝 / 隐藏
- 拒绝时填写原因

**API 路由：**
- `GET /api/admin/pages` — 页面审核列表（支持 moderation_status 筛选）
- `GET /api/admin/pages/[id]` — 页面详情
- `PATCH /api/admin/pages/[id]` — 审核操作（权限：pages.review）

## 文件结构

```
apps/web/
├── app/api/admin/
│   ├── categories/
│   │   ├── route.ts              # GET (list) + POST (create)
│   │   └── [id]/route.ts         # PATCH (update) + DELETE (delete)
│   ├── topics/
│   │   ├── route.ts              # GET (list) + POST (create)
│   │   └── [id]/route.ts         # PATCH (update) + DELETE (delete)
│   ├── rankings/
│   │   ├── route.ts              # GET (list snapshots)
│   │   ├── rebuild/route.ts      # POST (trigger rebuild)
│   │   └── [id]/route.ts         # GET (snapshot detail with items)
│   ├── operations/
│   │   ├── slots/
│   │   │   ├── route.ts          # GET (list) + POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts      # PATCH (update) + DELETE (delete)
│   │   │       └── items/route.ts # GET (list items) + POST (create item)
│   │   └── items/
│   │       └── [id]/route.ts     # PATCH (update) + DELETE (delete)
│   └── pages/
│       ├── route.ts              # GET (list pages for review)
│       └── [id]/route.ts         # GET (detail) + PATCH (moderate)
├── app/(admin)/admin/
│   ├── categories/page.tsx
│   ├── topics/page.tsx
│   ├── rankings/page.tsx
│   ├── operations/page.tsx
│   └── pages/page.tsx
├── components/admin/
│   ├── categories/
│   │   ├── index.ts
│   │   └── category-management.tsx
│   ├── topics/
│   │   ├── index.ts
│   │   └── topic-management.tsx
│   ├── rankings/
│   │   ├── index.ts
│   │   ├── ranking-management.tsx
│   │   └── ranking-detail.tsx
│   ├── operations/
│   │   ├── index.ts
│   │   ├── operation-management.tsx
│   │   ├── slot-form-dialog.tsx
│   │   └── items-management.tsx
│   └── pages/
│       ├── index.ts
│       ├── page-review-management.tsx
│       └── page-review-detail.tsx
├── lib/
│   └── types/admin.ts            # 补充新权限
└── lib/navigation/
    └── route-registry.ts         # 补充新路由
```

## 实现模式

所有页面遵循与现有 `reports` 页面一致的客户端组件模式：
- 页面文件：薄壳 server component，仅设置 metadata 并渲染客户端组件
- 管理组件：`'use client'` 组件，自行 fetch API、管理列表状态
- API 路由：使用 `requirePermission` 做权限校验，zod 做参数校验
- UI 组件：使用项目已有的 shadcn/ui 组件（Card, Badge, Button, Dialog, Table 等）

## 不做什么

- 不修改现有数据库 schema
- 不添加新的数据库表
- 不修改现有页面的行为
- 运营位的拖拽排序留到后续迭代
