# ProjectDrawer 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 team project 页面 (`/{team_slug}/{project_slug}`) 添加右侧滑栏，包含详情、评论、笔记三个 tab。

**Architecture:** 新建独立的 `ProjectDrawer` 组件（参照 `ReadDrawer`），通过 `ProjectDrawerClient` 桥接 async server component 和 client drawer context，复用 `CommentsPanel` 和 `NotesPanel`，新增 `ProjectMeta` 详情组件。评论 API 新增 `'project'` entity_type，笔记系统新增 `entity_type` + `entity_id` 支持。

**Tech Stack:** Next.js App Router, React Server Components, Drizzle ORM (PostgreSQL), Radix UI + shadcn/ui, react-i18next, Tailwind v4

## Global Constraints

- 所有 API query 参数和 DB 列名使用 **snake_case**（`entity_type`, `page_id`, `entity_id`）
- TypeScript import 使用显式静态 import，禁止 `import("path").Type` 内联语法
- Tailwind v4：CSS 变量直接使用（不包裹 `hsl()`），`data-*` 变体在 CVA 中不可靠
- 修改 packages 后仅在该包内 typecheck/build，不在根目录跑 `pnpm build`
- DB schema 变更后运行 `cd apps/web && pnpm db:push`（需手动确认）
- Tab 切换使用 `useState`，不依赖 URL search params

---

### Task 1: ProjectMeta 组件

**Files:**
- Create: `apps/web/components/project/project-meta.tsx`
- Modify: `apps/web/lib/i18n/locales/zh-CN.json` (在 `project` 块追加 keys)
- Modify: `apps/web/lib/i18n/locales/en.json` (同)

**Interfaces:**
- Produces: `ProjectMetaData` interface, `ProjectMeta` component
- Consumed by: Task 2 (ProjectDrawer tabs)

- [ ] **Step 1: 在 zh-CN.json 的 `project` 块末尾追加 i18n keys**

在 `"editor": { ... }` 之后（`apps/web/lib/i18n/locales/zh-CN.json:3032` 附近），将：
```json
    "editor": {
      "createPageFor": "为 {{projectSlug}} 创建页面"
    }
```
替换为：
```json
    "editor": {
      "createPageFor": "为 {{projectSlug}} 创建页面"
    },
    "details": {
      "name": "项目名称",
      "slug": "标识",
      "description": "描述",
      "noDescription": "暂无描述",
      "team": "所属团队",
      "createdBy": "创建者",
      "createdAt": "创建时间",
      "pagesCount": "页面数量",
      "url": "地址"
    }
```

然后运行: `cd apps/web && pnpm typecheck` 确认 JSON 有效。

- [ ] **Step 2: 在 en.json 的 `project` 块末尾追加同样的 keys（英文）**

```json
    "editor": {
      "createPageFor": "Create page for {{projectSlug}}"
    },
    "details": {
      "name": "Project Name",
      "slug": "Slug",
      "description": "Description",
      "noDescription": "No description",
      "team": "Team",
      "createdBy": "Created by",
      "createdAt": "Created at",
      "pagesCount": "Pages",
      "url": "URL"
    }
```

运行: `cd apps/web && pnpm typecheck` 确认 JSON 有效。

- [ ] **Step 3: 创建 `apps/web/components/project/project-meta.tsx`**

```tsx
"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FileText, Globe, Hash, User, Users, Calendar, FileEdit } from "lucide-react"

export interface ProjectMetaData {
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

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
}

const metaRowClass = "flex items-center gap-2.5 py-2 text-sm"
const metaIconClass = "size-4 shrink-0 text-muted-foreground"

export function ProjectMeta({ data }: { data: ProjectMetaData }) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-1">
      {/* 项目名称 */}
      <div className={metaRowClass}>
        <FileText className={metaIconClass} />
        <div>
          <div className="font-semibold text-base">{data.name}</div>
          <div className="text-xs text-muted-foreground">{data.projectSlug}</div>
        </div>
      </div>

      {/* 描述 */}
      <div className={metaRowClass}>
        <FileEdit className={metaIconClass} />
        <div>
          <span className="text-xs text-muted-foreground">{t("project.details.description")}</span>
          <p className="text-sm">{data.description || t("project.details.noDescription")}</p>
        </div>
      </div>

      {/* 所属团队 */}
      <div className={metaRowClass}>
        <Users className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.team")}</span>
        <Link
          href={`/${data.team.slug}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {data.team.displayName}
        </Link>
      </div>

      {/* 创建者 */}
      <div className={metaRowClass}>
        <User className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.createdBy")}</span>
        <Avatar className="size-5">
          <AvatarImage src={data.createdBy.avatarUrl ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {data.createdBy.displayName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <Link
          href={`/${data.createdBy.userSlug}`}
          className="text-sm font-medium hover:underline"
        >
          {data.createdBy.displayName}
        </Link>
      </div>

      {/* 创建时间 */}
      <div className={metaRowClass}>
        <Calendar className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.createdAt")}</span>
        <span className="text-sm">{formatDate(data.createdAt)}</span>
      </div>

      {/* Pages 数量 */}
      <div className={metaRowClass}>
        <FileText className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.pagesCount")}</span>
        <span className="text-sm font-medium">{data.stats.pagesCount}</span>
      </div>

      {/* 项目 URL */}
      <div className={metaRowClass}>
        <Globe className={metaIconClass} />
        <span className="text-xs text-muted-foreground">{t("project.details.url")}</span>
        <span className="text-sm font-mono text-xs break-all">
          viben-web.vercel.app/{data.team.slug}/{data.projectSlug}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck 确认编译通过**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/project/project-meta.tsx apps/web/lib/i18n/locales/zh-CN.json apps/web/lib/i18n/locales/en.json
git commit -m "feat: add ProjectMeta component for project drawer details tab"
```

---

### Task 2: ProjectDrawer 组件（仅详情 tab）

**Files:**
- Create: `apps/web/components/project/project-drawer.tsx`

**Interfaces:**
- Consumes: `ProjectMetaData` (from Task 1), `useDrawer()` from `components/layout/drawer-context`, `VibenTabs` from `@/components/ui/viben-tabs`
- Produces: `ProjectDrawerTab` types, `ProjectDrawer` component
- Consumed by: Task 3 (ProjectDrawerClient)

- [ ] **Step 1: 创建 `apps/web/components/project/project-drawer.tsx`**

```tsx
"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils/index"
import { VibenTabs, VibenTabsList, VibenTabsTrigger } from "@/components/ui/viben-tabs"
import { useDrawer } from "@/components/layout/drawer-context"
import { useResizable } from "@/hooks/use-resizable"
import type { ProjectMetaData } from "@/components/project/project-meta"
import type { CommunityComment } from "@/components/content/comments-panel"

// --- Lazy-loaded tab content ---

const loadingSkeleton = (
  <div className="animate-pulse space-y-3">
    <div className="h-5 w-2/3 rounded bg-muted/30" />
    <div className="h-4 w-full rounded bg-muted/30" />
    <div className="h-4 w-4/5 rounded bg-muted/30" />
  </div>
)

const LazyProjectMeta = dynamic(
  () => import("@/components/project/project-meta").then((m) => ({ default: m.ProjectMeta })),
  { loading: () => loadingSkeleton },
)

// --- Typed tabs ---

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

type ProjectDrawerTab =
  | ProjectDrawerDetailsTab
  | ProjectDrawerCommentsTab
  | ProjectDrawerNotesTab

// --- Tab content renderer ---

function TabContent({ tab }: { tab: ProjectDrawerTab }) {
  switch (tab.type) {
    case "details":
      return <LazyProjectMeta data={tab.projectMeta} />
    // comments and notes tabs added in later tasks
    default:
      return null
  }
}

// --- Drawer Header ---

function DrawerHeader({
  tabs,
  activeTab,
  onTabChange,
  isMobile,
}: {
  tabs: ProjectDrawerTab[]
  activeTab: string
  onTabChange: (v: string) => void
  isMobile?: boolean
}) {
  const { setOpen } = useDrawer()

  return (
    <div className="flex items-center gap-2.5 h-[var(--nav-h)] px-3 border-b border-border/52 whitespace-nowrap">
      <VibenTabs value={activeTab} onValueChange={onTabChange} className="flex-1 h-full">
        <VibenTabsList variant="underline" className="h-full">
          {tabs.map((tab) => (
            <VibenTabsTrigger key={tab.value} value={tab.value} variant="underline">
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">{tab.badge}</span>
              )}
            </VibenTabsTrigger>
          ))}
        </VibenTabsList>
      </VibenTabs>

      {/* Close button (mobile only) */}
      {isMobile && (
        <button
          className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors shrink-0"
          aria-label="Close drawer"
          onClick={() => setOpen(false)}
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  )
}

// --- ProjectDrawer component ---

interface ProjectDrawerProps {
  tabs: ProjectDrawerTab[]
  defaultTab?: string
  isMobile?: boolean
}

export function ProjectDrawer({ tabs, defaultTab, isMobile }: ProjectDrawerProps) {
  const { open, setOpen } = useDrawer()
  const [activeTab, setActiveTab] = React.useState(defaultTab || "details")

  // Resizable drawer width (desktop only)
  const { handleProps } = useResizable({
    cssVar: "--drawer-w",
    storageKey: "viben-drawer-w",
    minWidth: 280,
    maxWidth: 600,
    defaultWidth: 420,
    direction: "left",
  })

  // Desktop: auto-open drawer on mount
  React.useEffect(() => {
    if (!isMobile) {
      setOpen(true)
    }
  }, [isMobile, setOpen])

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 transition-opacity duration-[220ms] ease-out bg-black/40",
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          aria-hidden="true"
        />

        {/* Overlay panel */}
        <div
          className={cn(
            "fixed top-0 right-0 z-50",
            "w-full sm:w-[min(420px,100vw)]",
            "grid grid-rows-[auto_1fr]",
            "bg-background/96 backdrop-blur-[16px]",
            "border-l border-border transition-transform duration-[220ms] ease-out",
            open
              ? "translate-x-0 shadow-[-18px_0_36px_rgba(8,91,117,0.14)]"
              : "translate-x-full"
          )}
          style={{ height: "100vh", willChange: "transform" }}
          onClick={(e) => e.stopPropagation()}
        >
          <DrawerHeader
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isMobile
          />

          {/* Content */}
          <div className="overflow-auto p-3">
            {tabs.map((tab) => (
              <div
                key={tab.value}
                className={cn(activeTab === tab.value ? "grid gap-3" : "hidden")}
              >
                <TabContent tab={tab} />
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  // Desktop: portal into AppShell's drawer slot
  const slot = typeof document !== "undefined" ? document.getElementById("viben-drawer-slot") : null
  if (!slot) return null

  return createPortal(
    <div
      className={cn(
        "h-full w-full border-l border-border/52 bg-background/68 backdrop-blur-[18px] saturate-[1.18] relative",
        "grid grid-rows-[auto_1fr]",
        !open && "hidden"
      )}
    >
      {/* Resize handle — left edge */}
      {open && (
        <div
          {...handleProps}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize transition-colors z-10",
            handleProps.className
          )}
        />
      )}
      <DrawerHeader
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="overflow-auto p-3">
        {tabs.map((tab) => (
          <div
            key={tab.value}
            className={cn(activeTab === tab.value ? "grid gap-3" : "hidden")}
          >
            <TabContent tab={tab} />
          </div>
        ))}
      </div>
    </div>,
    slot
  )
}
```

- [ ] **Step 2: Typecheck 确认编译通过**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/project/project-drawer.tsx
git commit -m "feat: add ProjectDrawer component with details tab"
```

---

### Task 3: ProjectDrawerClient + ProjectPage 集成

**Files:**
- Create: `apps/web/components/project/project-drawer-client.tsx`
- Modify: `apps/web/app/(dashboard)/[user_slug]/[page_id]/project-page.tsx` (追加查询 + 渲染 drawer)

**Interfaces:**
- Consumes: `ProjectDrawer` from Task 2, `useAppShell()` from `components/layout/app-shell`
- Produces: `ProjectDrawerClient` component
- No downstream consumers (integration point)

- [ ] **Step 1: 创建 client bridge `apps/web/components/project/project-drawer-client.tsx`**

```tsx
"use client"

import { ProjectDrawer } from "@/components/project/project-drawer"
import { useAppShell } from "@/components/layout/app-shell"
import type { ProjectMetaData } from "@/components/project/project-meta"
import type { CommunityComment } from "@/components/content/comments-panel"

interface ProjectDrawerClientProps {
  projectMeta: ProjectMetaData
  projectDbId: string
  communityEntityId: string
  isAuthenticated: boolean
  sessionUsername?: string
  sessionAvatarUrl?: string
  sessionUserId?: string
  tabs: Array<"details" | "comments" | "notes">
}

export function ProjectDrawerClient({
  projectMeta,
  projectDbId,
  communityEntityId,
  isAuthenticated,
  sessionUsername,
  sessionAvatarUrl,
  sessionUserId,
  tabs,
}: ProjectDrawerClientProps) {
  const { isMobile } = useAppShell()

  const drawerTabs: Array<
    | { value: string; label: string; type: "details"; projectMeta: ProjectMetaData }
    | { value: string; label: string; badge?: number; type: "comments"; communityEntityId: string; projectDbId: string; isAuthenticated: boolean; sessionUsername?: string; sessionAvatarUrl?: string; sessionUserId?: string; initialComments: CommunityComment[]; initialNextCursor: string | null }
    | { value: string; label: string; badge?: number; type: "notes"; entityType: "project"; entityId: string }
  > = []

  if (tabs.includes("details")) {
    drawerTabs.push({ value: "details", label: "详情", type: "details", projectMeta })
  }
  if (tabs.includes("comments")) {
    drawerTabs.push({
      value: "comments",
      label: "评论",
      type: "comments",
      communityEntityId,
      projectDbId,
      isAuthenticated,
      sessionUsername,
      sessionAvatarUrl,
      sessionUserId,
      initialComments: [],
      initialNextCursor: null,
    })
  }
  if (tabs.includes("notes")) {
    drawerTabs.push({ value: "notes", label: "笔记", type: "notes", entityType: "project", entityId: projectDbId })
  }

  if (drawerTabs.length === 0) return null

  return (
    <ProjectDrawer
      tabs={drawerTabs}
      defaultTab="details"
      isMobile={isMobile}
    />
  )
}
```

- [ ] **Step 2: 更新 `project-page.tsx` — 追加 createdAt 到 project queries**

当前 project query 的 columns 不包含 `createdAt`。在 columns 中追加：
```typescript
      createdBy: true,
      createdAt: true,  // 新增
```
同时确保 project 解构中包含 `createdAt`。

- [ ] **Step 3: 更新 `project-page.tsx` — 新增 import**

在文件顶部 import 区域，新增：
```typescript
import { count } from "drizzle-orm"
import { ProjectDrawerClient } from "@/components/project/project-drawer-client"
import type { ProjectMetaData } from "@/components/project/project-meta"
```

- [ ] **Step 4: 更新 `project-page.tsx` — 追加数据查询**

在现有 `const project = ...` 之后、`const defaultPage = ...` 之前，追加：
```typescript
// 新增：pages 数量统计
const pagesCountResult = await db
  .select({ count: count() })
  .from(projectPages)
  .where(eq(projectPages.projectId, project.id))
const pagesCount = pagesCountResult[0]?.count ?? 0

// 新增：创建者信息
const creator = await db.query.users.findFirst({
  where: eq(users.id, project.createdBy),
  columns: { userSlug: true, displayName: true, avatarUrl: true },
})

const isAuthenticated = !!session
const communityEntityId = `project:${project.id}`
```

- [ ] **Step 5: 更新 `project-page.tsx` — 构建 ProjectMetaData 并渲染 drawer**

在 `return` 语句中，将：
```tsx
return (
  <ProjectPageShell
    teamSlug={teamSlug}
    projectSlug={projectSlug}
    projectName={project.name}
  >
    {content}
  </ProjectPageShell>
)
```

替换为：
```tsx
const projectMeta: ProjectMetaData = {
  name: project.name,
  projectSlug: project.projectSlug,
  description: project.description,
  team: {
    slug: teamSlug,
    displayName: team.displayName ?? teamSlug,
  },
  createdBy: {
    userSlug: creator?.userSlug ?? "",
    displayName: creator?.displayName ?? "Unknown",
    avatarUrl: creator?.avatarUrl ?? null,
  },
  createdAt: project.createdAt ?? new Date(),
  stats: { pagesCount },
}

return (
  <>
    <ProjectPageShell
      teamSlug={teamSlug}
      projectSlug={projectSlug}
      projectName={project.name}
    >
      {content}
    </ProjectPageShell>
    <ProjectDrawerClient
      projectMeta={projectMeta}
      projectDbId={project.id}
      communityEntityId={communityEntityId}
      isAuthenticated={isAuthenticated}
      sessionUsername={session?.username}
      sessionAvatarUrl={session?.avatarUrl ?? undefined}
      sessionUserId={session?.userId}
      tabs={["details"]}
    />
  </>
)
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

修复合法的 type errors。

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/project/project-drawer-client.tsx apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/project-page.tsx
git commit -m "feat: integrate ProjectDrawer into ProjectPage (details tab only)"
```

---

### Task 4: 评论 API — 支持 `'project'` entity_type

**Files:**
- Modify: `apps/web/app/api/community/comments/route.ts`

**Interfaces:**
- Consumes: N/A (standalone API change)
- Produces: Comments API now accepts `entity_type=project`
- Consumed by: Task 5 (comments tab in drawer)

- [ ] **Step 1: 修改 GET handler 的 entity_type 验证**

在 `apps/web/app/api/community/comments/route.ts` 第 27 行，将：
```typescript
    (entityType !== 'published_page' && entityType !== 'moment' && entityType !== 'comment') ||
```
改为：
```typescript
    (entityType !== 'published_page' && entityType !== 'moment' && entityType !== 'comment' && entityType !== 'project') ||
```

- [ ] **Step 2: 修改 POST handler 的 entity_type 验证**

同文件，将 POST handler 中的 entity_type 验证条件（约第 67 行）：
```typescript
      (body.entity_type !== 'published_page' && body.entity_type !== 'moment') ||
```
改为：
```typescript
      (body.entity_type !== 'published_page' && body.entity_type !== 'moment' && body.entity_type !== 'project') ||
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/community/comments/route.ts
git commit -m "feat: add 'project' entity_type to community comments API"
```

---

### Task 5: ProjectDrawer — 接入评论 tab

**Files:**
- Modify: `apps/web/components/project/project-drawer.tsx` (TabContent 新增 comments case)
- Modify: `apps/web/components/project/project-drawer-client.tsx` (tabs 包含 comments)

**Interfaces:**
- Consumes: Comments API (Task 4), `CommentsPanel` from `@/components/content/comments-panel`
- No new produced interfaces

- [ ] **Step 1: 在 ProjectDrawer 中添加 LazyCommentsPanel dynamic import**

在 `apps/web/components/project/project-drawer.tsx` 顶部，`LazyProjectMeta` import 之后追加：
```typescript
const LazyCommentsPanel = dynamic(
  () => import("@/components/content/comments-panel").then((m) => ({ default: m.CommentsPanel })),
  { loading: () => loadingSkeleton },
)
```

- [ ] **Step 2: 在 TabContent 中追加 comments case**

在 `TabContent` 函数的 switch 中，在 `case "details"` 的 return 之后、`default` 之前追加：
```typescript
    case "comments":
      return (
        <LazyCommentsPanel
          communityEntityId={tab.communityEntityId}
          pageDbId={tab.projectDbId}
          entityType="project"
          isAuthenticated={tab.isAuthenticated}
          sessionUsername={tab.sessionUsername}
          sessionAvatarUrl={tab.sessionAvatarUrl}
          sessionUserId={tab.sessionUserId}
          initialComments={tab.initialComments}
          initialNextCursor={tab.initialNextCursor}
        />
      )
```

> 注意：`CommentsPanel` 的 `entityType` prop 类型当前为 `"published_page" | "moment"`（在 `comments-panel.tsx` 第 58 行），需要追加 `| "project"`。此改动在下面 Step 3 中操作。

- [ ] **Step 3: 修改 CommentsPanel 的 entityType 类型**

在 `apps/web/components/content/comments-panel.tsx` 第 58 行，将：
```typescript
  entityType?: "published_page" | "moment"
```
改为：
```typescript
  entityType?: "published_page" | "moment" | "project"
```

- [ ] **Step 4: 更新 ProjectDrawerClient — tabs 包含 comments**

在 `apps/web/components/project/project-drawer-client.tsx` 中，找到 `<ProjectDrawerClient ... tabs={["details"]} />` 调用处（即 `project-page.tsx` 中的渲染），将：
```tsx
tabs={["details"]}
```
改为：
```tsx
tabs={["details", "comments"]}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/project/project-drawer.tsx apps/web/components/project/project-drawer-client.tsx apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/project-page.tsx
# 如果修改了 comments-panel.tsx 的类型，也要 add
git commit -m "feat: add comments tab to ProjectDrawer"
```

---

### Task 6: Notes 迁移 + API + NotesPanel + NoteComposer 改造

**Files:**
- Modify: `apps/web/lib/db/schema.ts` (notes 表新增 entityType、entityId)
- Modify: `apps/web/app/api/notes/route.ts` (支持 entity_type + entity_id)
- Modify: `apps/web/components/content/notes-panel.tsx` (新 props)
- Modify: `apps/web/components/content/note-composer.tsx` (新 props)
- Modify: `apps/web/components/layout/read-drawer.tsx` (更新 NotesPanel 调用)

**Interfaces:**
- Consumes: N/A (standalone)
- Produces: Notes system supports entity_type + entity_id; `NotesPanel` / `NoteComposer` accept new props
- Consumed by: Task 7 (notes tab in drawer)

- [ ] **Step 1: 修改 notes schema**

在 `apps/web/lib/db/schema.ts` 的 `notes` 表定义中，在 `pageId` 列之后追加两个新列：

```typescript
    pageId: text('page_id').notNull(),
    // 新增：支持 project 等多实体类型
    entityType: text('entity_type').notNull().default('published_page'),
    entityId: text('entity_id'),
```

- [ ] **Step 2: 运行 DB push 创建新列**

```bash
cd apps/web && pnpm db:push
```

> 需要手动确认。push 完成后，连接 DB 运行回填 SQL（或依赖 default 值）：
> ```sql
> UPDATE notes SET entity_id = page_id WHERE entity_id IS NULL;
> ```

- [ ] **Step 3: 修改笔记 GET API**

在 `apps/web/app/api/notes/route.ts` 中：

将 GET handler 中的参数读取从：
```typescript
  const pageId = searchParams.get("page_id");
  if (!pageId) {
    return NextResponse.json({ error: "missing_page_id" }, { status: 400 });
  }
```
改为：
```typescript
  const entityType = searchParams.get("entity_type") ?? "published_page";
  const entityId = searchParams.get("entity_id") ?? searchParams.get("page_id");
  if (!entityId) {
    return NextResponse.json({ error: "missing_entity_id" }, { status: 400 });
  }
```

将 DB 查询从：
```typescript
      eq(notes.pageId, pageId),
```
改为：
```typescript
      eq(notes.entityType, entityType),
      eq(notes.entityId, entityId),
```

- [ ] **Step 4: 修改笔记 POST API**

将 POST handler 中的 body 字段读取从：
```typescript
    const { page_id, content } = body;
    if (!page_id || typeof page_id !== 'string' || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: "missing_page_id_or_content" }, { status: 400 });
    }
```
改为：
```typescript
    const entityType = body.entity_type ?? "published_page";
    const entityId = body.entity_id ?? body.page_id;
    const { content } = body;
    if (!entityId || typeof entityId !== 'string' || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: "missing_entity_id_or_content" }, { status: 400 });
    }
```

将 INSERT 从：
```typescript
      pageId: page_id,
```
改为：
```typescript
      pageId: entityId,        // 保留向后兼容
      entityType: entityType,
      entityId: entityId,
```

- [ ] **Step 5: 修改 NotesPanel — 新 props**

在 `apps/web/components/content/notes-panel.tsx` 中：

将 export 的 props 从：
```typescript
export function NotesPanel({ pageId }: { pageId: string }) {
```
改为：
```typescript
interface NotesPanelProps {
  entityType?: "published_page" | "project"
  entityId: string
  /** @deprecated 使用 entityId + entityType="published_page" */
  pageId?: string
}

export function NotesPanel({ entityType = "published_page", entityId, pageId }: NotesPanelProps) {
```

将 fetch URL 从：
```typescript
      const res = await fetch(`/api/notes?page_id=${encodeURIComponent(pageId)}`)
```
改为：
```typescript
      const id = entityId || pageId || ""
      const res = await fetch(`/api/notes?entity_type=${entityType}&entity_id=${encodeURIComponent(id)}`)
```

将 `useEffect` 的依赖从 `[pageId]` 改为 `[entityType, entityId, pageId]`。

将 `NoteComposer` 的调用从：
```tsx
<NoteComposer pageId={pageId} ... />
```
改为：
```tsx
<NoteComposer entityType={entityType} entityId={entityId || pageId || ""} ... />
```

- [ ] **Step 6: 修改 NoteComposer — 新 props**

在 `apps/web/components/content/note-composer.tsx` 中：

将 interface 从：
```typescript
interface NoteComposerProps {
  pageId: string
```
改为：
```typescript
interface NoteComposerProps {
  pageId?: string
  entityType?: string
  entityId?: string
```

将 POST body 从：
```typescript
        : JSON.stringify({ page_id: pageId, content: content.trim() })
```
改为：
```typescript
        : JSON.stringify({
            entity_type: entityType ?? "published_page",
            entity_id: entityId || pageId,
            page_id: pageId || entityId,
            content: content.trim(),
          })
```

- [ ] **Step 7: 更新 ReadDrawer 中的 NotesPanel 调用**

在 `apps/web/components/layout/read-drawer.tsx` 中，找到 `NotesPanel` 调用：

```typescript
      return <LazyNotesPanel pageId={tab.pageId} />
```

改为：
```typescript
      return <LazyNotesPanel entityType="published_page" entityId={tab.pageId} />
```

- [ ] **Step 8: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/db/schema.ts apps/web/app/api/notes/route.ts apps/web/components/content/notes-panel.tsx apps/web/components/content/note-composer.tsx apps/web/components/layout/read-drawer.tsx
git commit -m "feat: add entity_type/entity_id to notes for project support"
```

---

### Task 7: ProjectDrawer — 接入笔记 tab

**Files:**
- Modify: `apps/web/components/project/project-drawer.tsx` (TabContent 新增 notes case)
- Modify: `apps/web/app/(dashboard)/[user_slug]/[page_id]/project-page.tsx` (tabs 包含 notes)

**Interfaces:**
- Consumes: Notes API + NotesPanel (Task 6)
- No new produced interfaces

- [ ] **Step 1: 在 ProjectDrawer 中添加 LazyNotesPanel dynamic import**

在 `apps/web/components/project/project-drawer.tsx` 顶部，`LazyCommentsPanel` import 之后追加：
```typescript
const LazyNotesPanel = dynamic(
  () => import("@/components/content/notes-panel").then((m) => ({ default: m.NotesPanel })),
  { loading: () => loadingSkeleton },
)
```

- [ ] **Step 2: 在 TabContent 中追加 notes case**

在 `TabContent` 函数的 switch 中，在 `case "comments"` 的 return 之后、`default` 之前追加：
```typescript
    case "notes":
      return (
        <LazyNotesPanel
          entityType={tab.entityType}
          entityId={tab.entityId}
        />
      )
```

- [ ] **Step 3: 更新 ProjectDrawerClient 调用 — tabs 包含 notes**

在 `project-page.tsx` 的 `<ProjectDrawerClient>` 调用中，将：
```tsx
tabs={["details", "comments"]}
```
改为：
```tsx
tabs={["details", "comments", "notes"]}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/project/project-drawer.tsx apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/project-page.tsx
git commit -m "feat: add notes tab to ProjectDrawer"
```

---

## 验证清单

完成所有 7 个 task 后，手动验证：

1. **桌面端**：访问 `/{team_slug}/{project_slug}`，右侧滑栏应自动展开，默认显示"详情"tab
2. **Tab 切换**：切换详情 → 评论 → 笔记，内容应正确加载
3. **评论**：在评论 tab 中可以发表评论，评论关联到 project
4. **笔记**：在笔记 tab 中可以创建/编辑/删除笔记，笔记关联到 project
5. **移动端**：右侧滑栏应为 overlay 模式，点遮罩关闭
6. **向后兼容**：访问现有阅读页面 `/{user_slug}/{page_id}`，ReadDrawer 评论/笔记功能正常
7. **Resize**：桌面端可拖拽滑栏左边缘调整宽度
