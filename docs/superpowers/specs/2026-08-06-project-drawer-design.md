# Project Drawer 功能设计

> 状态：设计完成，待评审

## 概述

为 team project 页面（`/{team_slug}/{project_slug}`）添加右侧滑栏（ProjectDrawer），包含详情页、评论页、笔记页三个 tab。

**核心思路**：参照 `ReadDrawer` 的模式，创建独立的 `ProjectDrawer` 组件，复用 `CommentsPanel` 和 `NotesPanel`，新增 `ProjectMeta` 组件，同时对评论和笔记 API 做小幅扩展以支持 `project` entity type。

---

## 1. 组件架构

```
ProjectPage (async server component)
├── ProjectPageShell (layout wrapper)
│   └── {content}  ← Overview / Pages / Settings
└── ProjectDrawerClient ("use client" bridge)
    └── ProjectDrawer (portals → #viben-drawer-slot)
        ├── [详情 Tab] → LazyProjectMeta (新组件)
        ├── [评论 Tab] → LazyCommentsPanel (复用)
        └── [笔记 Tab] → LazyNotesPanel (复用)
```

### 设计决策

- **独立 `ProjectDrawer` 组件**（非泛化 `ReadDrawer`）：`ReadDrawer` 的 tab 类型与 `PageMetaData` 强耦合，独立组件更清晰、改动风险小
- **复用 `CommentsPanel` / `NotesPanel`**：两个面板本身是通用组件，只需传入 project 的 entity ID
- **Tab 切换用 `useState`**：和 `ReadDrawer` 一致，不依赖 URL search params
- **通过 `ProjectDrawerClient` 桥接**：`ProjectPage` 是 async server component，`ProjectDrawer` 需要 client context（`useDrawer()`），用 client wrapper 接收 server props

---

## 2. 新增文件

### 2.1 `components/project/project-drawer.tsx`

参照 `ReadDrawer` 结构，差异点：

| 特性 | ReadDrawer | ProjectDrawer |
|------|-----------|---------------|
| Resizable | ✅ `useResizable` | ✅ 复用 `--drawer-w` CSS 变量 |
| More 菜单 | ✅ 沉浸式/举报/反馈 | ❌ 不需要 |
| Tab schema | `ReadDrawerTab` | `ProjectDrawerTab` |
| Desktop | portal → `#viben-drawer-slot` | 同 |
| Mobile | overlay panel | 同 |
| Auto-open | 桌面端默认展开 | 同 |

```typescript
interface ProjectDrawerDetailsTab {
  value: string
  label: string
  type: "details"
  projectMeta: ProjectMetaData
}

interface ProjectDrawerCommentsTab {
  value: string
  label: string
  badge?: number
  type: "comments"
  communityEntityId: string
  projectDbId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserId?: string
  initialComments: CommunityComment[]
  initialNextCursor: string | null
}

interface ProjectDrawerNotesTab {
  value: string
  label: string
  badge?: number
  type: "notes"
  entityType: "project"
  entityId: string
}

type ProjectDrawerTab = ProjectDrawerDetailsTab | ProjectDrawerCommentsTab | ProjectDrawerNotesTab
```

Props：

```typescript
interface ProjectDrawerProps {
  tabs: ProjectDrawerTab[]
  defaultTab?: string
  isMobile?: boolean
}
```

### 2.2 `components/project/project-meta.tsx`

展示 project 详情信息，纯展示组件。Lazy loaded。

```typescript
interface ProjectMetaData {
  name: string
  projectSlug: string
  description: string | null
  team: {
    slug: string
    displayName: string
  }
  createdBy: {
    userSlug: string
    displayName: string
    avatarUrl: string | null
  }
  createdAt: Date | string
  stats: {
    pagesCount: number
  }
}
```

展示内容：
- 项目名称 + slug
- 描述（如为空则显示占位提示）
- 所属团队（链接到 `/{teamSlug}`）
- 创建者（头像 + 名称，链接到 `/{userSlug}`）
- 创建时间
- Pages 数量统计
- 项目 URL

---

## 3. 修改文件

### 3.1 `app/(dashboard)/[user_slug]/[page_id]/project-page.tsx`

**新增数据查询**：
- `pagesCount`：`SELECT COUNT(*) FROM project_pages WHERE project_id = ?`
- 创建者信息：`SELECT userSlug, displayName, avatarUrl FROM users WHERE id = project.createdBy`
- `communityEntityId`：`"project:{projectDbId}"`

**新增渲染**：
```tsx
// client wrapper — 从 server component 接收 props，内部使用 useAppShell().isMobile
<ProjectDrawerClient
  tabs={[
    { value: "details", label: t("..."), type: "details", projectMeta: {...} },
    { value: "comments", label: t("..."), type: "comments", ... },
    { value: "notes", label: t("..."), type: "notes", ... },
  ]}
  defaultTab="details"
/>
```

### 3.2 `app/api/community/comments/route.ts`

GET（第 27 行）和 POST（第 67 行）的 entity_type 验证中加入 `'project'`：

```typescript
// GET
if ((entityType !== 'published_page' && entityType !== 'moment'
     && entityType !== 'comment' && entityType !== 'project') || !entityId)

// POST
if ((body.entity_type !== 'published_page' && body.entity_type !== 'moment'
     && body.entity_type !== 'project') || ...)
```

### 3.3 `app/api/community/comments/[comment_id]/route.ts`

无需改动。仅处理单条评论的 PATCH/DELETE。

### 3.4 Notes DB Migration

**当前 `notes` 表**（`schema.ts`）：
```
id, uid, page_id, author_user_id, content, content_format, is_pinned, created_at, updated_at
```

**Migration SQL**：
```sql
ALTER TABLE notes ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'published_page';
ALTER TABLE notes ADD COLUMN entity_id TEXT;
UPDATE notes SET entity_id = page_id WHERE entity_id IS NULL;
```

**`schema.ts` 更新**：新增 `entityType`、`entityId` 列，`pageId` 保留。

### 3.5 `app/api/notes/route.ts`

支持 `entity_type` + `entity_id` 参数，保留 `page_id` 兼容：

```typescript
// GET
const entityType = searchParams.get("entity_type") ?? "published_page"
const entityId = searchParams.get("entity_id") ?? searchParams.get("page_id")

// DB 查询
.where(and(
  eq(notes.entityType, entityType),
  eq(notes.entityId, entityId),
  eq(notes.authorUserId, session.userId)
))

// POST — 同样新增 entity_type / entity_id，保留 page_id 兼容
```

### 3.6 `components/content/notes-panel.tsx`

Props 从 `{ pageId: string }` 改为：

```typescript
interface NotesPanelProps {
  entityType?: "published_page" | "project"
  entityId: string
}
```

`ReadDrawer` 中调用更新为 `entityType="published_page"` + `entityId={pageUid}`（向后兼容）。

---

## 4. 实现顺序

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | `ProjectMeta` 组件 | 无 |
| 2 | `ProjectDrawer` 组件（仅详情 tab） | 步骤 1 |
| 3 | `ProjectDrawerClient` + `ProjectPage` 集成 | 步骤 2 |
| 4 | 评论 API 适配 `'project'` entity_type | 无 |
| 5 | `ProjectDrawer` 接入评论 tab | 步骤 4 |
| 6 | Notes DB migration + API 适配 + NotesPanel 改造 | 无 |
| 7 | `ProjectDrawer` 接入笔记 tab | 步骤 6 |
