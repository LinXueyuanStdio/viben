# Web 移动端响应式适配 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 apps/web 布局框架添加移动端响应式支持，768px 以下侧边栏变为 overlay 抽屉，Topbar 自适应，UserMenu 整合导航入口。

**Architecture:** 在 AppShell 中添加 `isMobile` 状态（matchMedia 监听），统一管理桌面/移动端行为切换。侧边栏从 inline flex 改为 fixed overlay，桌面端默认展开、移动端默认隐藏。Topbar 在移动端隐藏面包屑和多余操作按钮，搜索框自适应宽度。UserMenu 在移动端额外显示创建/通知/动态/历史入口。

**Tech Stack:** React 19, Next.js, Tailwind CSS v4, matchMedia API

## Global Constraints

- 断点：768px（Tailwind `md`），<768px 为移动端，>=768px 为桌面端
- 桌面端行为完全不变
- 仅涉及布局框架 4 个文件：app-shell.tsx、sidebar.tsx、topbar.tsx、user-menu.tsx
- 移动端侧边栏 overlay 状态不持久化（每次加载默认关闭）
- 桌面端侧边栏 collapsed 状态持久化到 localStorage（保留现有逻辑）
- Tailwind v4 CSS 变量为 oklch 格式，不要用 `hsl()` 包裹

---

### Task 1: 提取创建菜单项为共享常量

**Files:**
- Create: `apps/web/lib/navigation/create-menu-items.tsx`
- Modify: `apps/web/components/layout/create-dropdown.tsx`

**Interfaces:**
- Produces: `CREATE_MENU_ITEMS: { icon: LucideIcon, labelKey: string, href: string }[]`

- [ ] **Step 1: 创建共享常量文件**

```tsx
// apps/web/lib/navigation/create-menu-items.tsx
import { FilePlus2, MessageSquareText, Package, Wand } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface CreateMenuItem {
  icon: LucideIcon
  labelKey: string
  href: string
}

export const CREATE_MENU_ITEMS: CreateMenuItem[] = [
  { icon: MessageSquareText, labelKey: "nav.postMoment", href: "/moment" },
  { icon: FilePlus2, labelKey: "nav.createPage", href: "/pages/new" },
  { icon: Package, labelKey: "nav.publishMcp", href: "/publish?type=mcp" },
  { icon: Wand, labelKey: "nav.createSkill", href: "/publish?type=skill" },
]
```

- [ ] **Step 2: 修改 CreateDropdown 使用共享常量**

将 `apps/web/components/layout/create-dropdown.tsx` 中的内联菜单项替换为 `CREATE_MENU_ITEMS` 循环渲染：

```tsx
// 替换原有的 4 个 DropdownMenuItem（行 28-44）为：
{CREATE_MENU_ITEMS.map((item, idx) => {
  const isFirst = idx === 0
  const isAfterMoment = item.labelKey === "nav.publishMcp"
  return (
    <React.Fragment key={item.labelKey}>
      {isAfterMoment && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={() => router.push(item.href)}>
        <item.icon className="mr-2 h-4 w-4" />
        {t(item.labelKey)}
      </DropdownMenuItem>
    </React.Fragment>
  )
})}
```

并在顶部添加 import：
```tsx
import { CREATE_MENU_ITEMS } from "@/lib/navigation/create-menu-items"
```

删除不再需要的 import：`FilePlus2`, `MessageSquareText`, `Package`, `Wand`, `DropdownMenuSeparator` 中不再需要的部分。

**注意**：原代码中 "发布动态" 和 "新建页面" 在上半部分，"发布 MCP" 和 "创建 Skill" 在下半部分（有分隔线）。直接用 `CREATE_MENU_ITEMS` 数组渲染需保留这个分界——判断 `idx === 2` 时插入 `DropdownMenuSeparator`。

- [ ] **Step 3: 验证 CreateDropdown 功能不变**

运行 typecheck 确认编译通过：

```bash
cd apps/web && pnpm typecheck
```

预期：无类型错误。

- [ ] **Step 4: 提交**

```bash
git add apps/web/lib/navigation/create-menu-items.tsx apps/web/components/layout/create-dropdown.tsx
git commit -m "refactor: 提取创建菜单项为共享常量，供 UserMenu 复用"
```

---

### Task 2: AppShell 添加 isMobile 检测 + 侧边栏 overlay 布局

**Files:**
- Modify: `apps/web/components/layout/app-shell.tsx`

**Interfaces:**
- Produces: `AppShellContextType` 新增 `isMobile: boolean`, `sidebarOpen: boolean`, `openSidebar: () => void`, `closeSidebar: () => void`
- Consumes: (none from prior tasks, self-contained)

- [ ] **Step 1: 改写 AppShell 布局和状态**

当前 `app-shell.tsx` 的行 37-88 需要替换。以下是完整的替换内容：

```tsx
// ===== AppShell Context =====
interface AppShellContextType {
  session: Session | null
  // desktop
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  // mobile
  isMobile: boolean
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
}

const AppShellContext = createContext<AppShellContextType>({
  session: null,
  sidebarCollapsed: false,
  toggleSidebar: () => {},
  isMobile: false,
  sidebarOpen: false,
  openSidebar: () => {},
  closeSidebar: () => {},
})

export function useAppShell() {
  return useContext(AppShellContext)
}

// ===== AppShell Component =====
interface AppShellProps {
  children: React.ReactNode
  session: Session | null
  adminStats?: { pendingPackagesCount: number }
}

export function AppShell({
  children,
  session,
  adminStats,
}: AppShellProps) {
  const pathname = usePathname()
  const { isPage: isRead } = isPublishedPageRoute(pathname)

  // ---- isMobile ----
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 767px)").matches
  })

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handle)
    return () => mql.removeEventListener("change", handle)
  }, [])

  // ---- desktop sidebar ----
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("viben-sidebar-collapsed") === "true"
  })

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) return // mobile uses open/close, not toggle
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("viben-sidebar-collapsed", String(next))
      return next
    })
  }, [isMobile])

  // ---- mobile sidebar overlay ----
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const openSidebar = React.useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = React.useCallback(() => setSidebarOpen(false), [])

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const contextValue = React.useMemo<AppShellContextType>(
    () => ({
      session,
      sidebarCollapsed,
      toggleSidebar,
      isMobile,
      sidebarOpen,
      openSidebar,
      closeSidebar,
    }),
    [session, sidebarCollapsed, toggleSidebar, isMobile, sidebarOpen, openSidebar, closeSidebar]
  )

  // Determine sidebar visibility for desktop/mobile
  const showDesktopSidebar = !isMobile && !sidebarCollapsed
  const showMobileSidebar = isMobile && sidebarOpen

  return (
    <AppShellContext.Provider value={contextValue}>
      <DrawerProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <Topbar
            session={session}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
            isMobile={isMobile}
            onOpenSidebar={openSidebar}
          />
          <div className="relative flex-1 overflow-hidden">
            {/* Sidebar — always fixed overlay */}
            <Sidebar
              collapsed={sidebarCollapsed}
              session={session}
              pendingPackagesCount={adminStats?.pendingPackagesCount}
              isMobile={isMobile}
              open={sidebarOpen}
              onClose={closeSidebar}
            />
            {/* Backdrop for mobile overlay (desktop never shows backdrop) */}
            {isMobile && sidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40"
                onClick={closeSidebar}
                aria-hidden="true"
              />
            )}
            <main
              className={cn(
                "h-full",
                isRead ? "overflow-hidden" : "overflow-y-auto"
              )}
            >
              <div
                className={cn(
                  isRead
                    ? "p-0 max-w-none"
                    : "w-[min(1280px,100%)] mx-auto px-4 py-4"
                )}
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </DrawerProvider>
    </AppShellContext.Provider>
  )
}
```

**关键改动说明**：
- 添加 `isMobile` 状态（行 63-69），通过 `matchMedia("(max-width: 767px)")` 检测
- 添加 `sidebarOpen`/`openSidebar`/`closeSidebar` 移动端 overlay 控制
- 路由变化时自动关闭移动端侧边栏（行 86-88）
- 布局从 `flex` 并排改为 `relative` 容器 + fixed sidebar + 独立 backdrop
- Sidebar 始终 fixed 定位，通过 props 控制显隐
- Backdrop 仅在移动端 + sidebarOpen 时显示
- Topbar 新增 `isMobile` 和 `onOpenSidebar` props

- [ ] **Step 2: 类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：此时会有类型错误（Topbar 和 Sidebar 的 props 接口尚未更新），这些将在后续任务中修复。

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/layout/app-shell.tsx
git commit -m "feat: AppShell 添加 isMobile 检测 + 侧边栏 fixed overlay 布局"
```

---

### Task 3: Sidebar 支持 overlay 模式

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `isMobile: boolean`, `open: boolean`, `onClose: () => void` (新增 props)
- The sidebar is always `fixed` positioned; visibility controlled by `collapsed` (desktop) or `open` (mobile)

- [ ] **Step 1: 更新 Sidebar props 和渲染逻辑**

修改 `apps/web/components/layout/sidebar.tsx`：

**Props 接口更新**（替换行 76-80）：

```tsx
interface SidebarProps {
  collapsed: boolean
  session?: { role?: string; username?: string; email?: string; avatarUrl?: string; userSlug?: string } | null
  pendingPackagesCount?: number
  isMobile: boolean
  open: boolean
  onClose: () => void
}
```

**Sidebar 函数签名**（替换行 91-95）：

```tsx
export function Sidebar({
  collapsed,
  session,
  pendingPackagesCount = 0,
  isMobile,
  open,
  onClose,
}: SidebarProps) {
```

**返回的 JSX 替换**（替换行 168-341，即整个 `<aside>` 及其内容）：

关键是 `<aside>` 的 className 和结构改为：

```tsx
// Determine visibility
const visible = isMobile ? open : !collapsed

return (
  <>
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background transition-transform duration-200 ease-out",
        "w-[var(--sidebar-w)]",
        visible ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Close button — mobile only */}
      {isMobile && (
        <div className="flex items-center justify-end p-2">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="size-[18px]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10" />
              <path d="M14 4l-10 10" />
            </svg>
          </button>
        </div>
      )}

      {/* Navigation — existing content, unchanged */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {/* ... 保持现有导航内容不变 ... */}
      </nav>
    </aside>
  </>
)
```

**注意**：
- `<aside>` 从 `flex flex-col border-r bg-background transition-[width]` 改为 `fixed inset-y-0 left-0 z-50 ... transition-transform`
- 可见性从 `collapsed ? "w-0" : "w-[var(--sidebar-w)]"` 改为 `visible ? "translate-x-0" : "-translate-x-full"`
- 新增移动端关闭按钮（X），位于侧边栏顶部右上角
- 导航内容（`<nav>` 及其所有子元素）完全不变
- 移除旧的 backdrop 逻辑（backdrop 现在在 AppShell 中）

- [ ] **Step 2: 类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：Sidebar 类型错误消失，Topbar 仍可能有错误（下一任务修复）。

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat: Sidebar 支持 fixed overlay 模式 + 移动端关闭按钮"
```

---

### Task 4: Topbar 移动端响应式布局

**Files:**
- Modify: `apps/web/components/layout/topbar.tsx`

**Interfaces:**
- Consumes: `isMobile: boolean`, `onOpenSidebar: () => void` (新增 props)

- [ ] **Step 1: 更新 Topbar props 和移动端渲染**

修改 `apps/web/components/layout/topbar.tsx`：

**Props 接口更新**（替换行 28-34）：

```tsx
interface TopbarProps {
  session: Session | null
  onToggleSidebar: () => void
  sidebarCollapsed?: boolean
  isMobile?: boolean
  onOpenSidebar?: () => void
  centerContent?: React.ReactNode
  rightContent?: React.ReactNode
}
```

**函数签名更新**（替换行 45-51）：

```tsx
export function Topbar({
  session,
  onToggleSidebar,
  sidebarCollapsed = false,
  isMobile = false,
  onOpenSidebar,
  centerContent,
  rightContent,
}: TopbarProps) {
```

**左区域汉堡按钮逻辑更新**（替换行 172-199 中汉堡按钮的 onClick）：

移动端点击打开 overlay，桌面端点击切换 collapsed：

```tsx
{/* 侧边栏切换按钮 — 动画汉堡图标 */}
<button
  aria-label={t("community.toggleSidebar")}
  onClick={() => {
    if (isMobile) {
      onOpenSidebar?.()
    } else {
      onToggleSidebar()
    }
  }}
  className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
>
  {/* 汉堡图标 SVG — 移动端始终显示汉堡，桌面端根据 collapsed 动画 */}
  <svg className="size-[18px]" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    {isMobile ? (
      <>
        <path d="M3 5h12" />
        <path d="M3 9h12" />
        <path d="M3 13h12" />
      </>
    ) : (
      <>
        <path
          className="transition-all duration-300 ease-out"
          d={sidebarCollapsed ? "M3 5h12" : "M4 4l10 10"}
          style={{ transformOrigin: sidebarCollapsed ? "9px 5px" : "9px 9px" }}
        />
        <path
          className="transition-all duration-200 ease-out"
          d="M3 9h12"
          style={{ opacity: sidebarCollapsed ? 1 : 0, transform: sidebarCollapsed ? "scaleX(1)" : "scaleX(0)" }}
        />
        <path
          className="transition-all duration-300 ease-out"
          d={sidebarCollapsed ? "M3 13h12" : "M4 14l10-10"}
          style={{ transformOrigin: sidebarCollapsed ? "9px 13px" : "9px 9px" }}
        />
      </>
    )}
  </svg>
</button>
```

**面包屑**（紧随汉堡按钮之后）：

```tsx
{/* 面包屑 — 移动端隐藏 */}
{!isMobile && <BreadcrumbNav variant={isRead ? "read" : "global"} />}
```

**中区域搜索框**（替换行 206-238 中的 center 区域）：

```tsx
{/* ===== Center ===== */}
<div
  className={cn(
    "flex items-center",
    isRead
      ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-2 pointer-events-none w-max"
      : cn("justify-center min-w-0", isMobile ? "flex-1" : "")
  )}
>
  {isRead ? (
    // ... 保持现有阅读模式代码不变 ...
    topbarSlots?.centerContent ?? centerContent ?? (
      <div className="pointer-events-auto">
        <VibenTabs value={readActiveTab} onValueChange={(v) => v && handleReadTabChange(v)}>
          <VibenTabsList variant="pill">
            <VibenTabsTrigger value="page" variant="pill"><FileText className="h-4 w-4" /> {t("community.page")}</VibenTabsTrigger>
            {hasSidePage && (
              <VibenTabsTrigger value="side" variant="pill"><Columns2 className="h-4 w-4" /> {t("community.sidePage")}</VibenTabsTrigger>
            )}
            <VibenTabsTrigger value="settings" variant="pill"
              className={cn(!isAuthor && "invisible")}>
              <Settings className="h-4 w-4" />
              <span className="ml-1.5">{t("community.settings")}</span>
            </VibenTabsTrigger>
          </VibenTabsList>
        </VibenTabs>
      </div>
    )
  ) : (
    <GlobalSearch
      recentSearches={lazyRecentSearches}
      hotSearches={lazyHotSearches}
      onFocus={loadSearchData}
    />
  )}
</div>
```

**注意**：搜索框在移动端需要通过 `flex-1` 自动填充空间。`GlobalSearch` 组件内部已有 `w-full`，父容器给 `flex-1 min-w-0` 即可。

**右区域**（替换行 242-271）：

```tsx
{/* ===== Right ===== */}
<div className="flex items-center justify-end gap-1.5 min-w-0">
  {isRead ? (
    // 阅读模式 — 保持不变
    rightContent ?? topbarSlots?.rightContent ?? (
      <>
        <IconButton size="compact" label={t("community.expandDetails")} onClick={() => { toggleDrawer(); trackAnalytics("drawer_open") }}>
          <PanelRight className="h-4 w-4" />
        </IconButton>
        <IconButton size="compact" label={t("community.immersiveReading")} onClick={() => { setImmersive(true); trackAnalytics("immersive_enter") }}>
          <Maximize2 className="h-4 w-4" />
        </IconButton>
        <ReadMoreMenu pageId={urlPageId ?? ""} userSlug={urlUserSlug ?? ""} />
      </>
    )
  ) : isMobile ? (
    // 移动端非阅读模式 — 仅显示用户菜单（整合了创建/通知/动态/历史）
    <>
      {session ? (
        <UserMenu session={session} isMobile />
      ) : (
        <HeaderAuthButtons />
      )}
    </>
  ) : (
    // 桌面端非阅读模式 — 保持不变
    <>
      {session ? (
        <>
          <CreateDropdown />
          <MomentPopover />
          <NotificationPopover />
          <HistoryPopover />
          <UserMenu session={session} />
        </>
      ) : (
        <HeaderAuthButtons />
      )}
    </>
  )}
</div>
```

**Topbar 容器宽度**（替换行 158-164）：

```tsx
<div
  className={cn(
    "relative h-full mx-auto flex items-center",
    isRead
      ? "w-full px-4 grid gap-3"
      : cn(
          "grid gap-3",
          isMobile
            ? "w-full px-3"
            : "w-[min(1280px,calc(100%-28px))]"
        )
  )}
  style={{
    gridTemplateColumns: isRead
      ? "minmax(430px, 1.45fr) minmax(160px, 260px) auto"
      : isMobile
        ? "auto 1fr auto"
        : "minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)",
  }}
>
```

**移动端 grid 说明**：`auto 1fr auto` — 汉堡按钮自适应 + 搜索框占满 + 用户区域自适应。

- [ ] **Step 2: 类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：所有类型错误消失。

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/layout/topbar.tsx
git commit -m "feat: Topbar 移动端响应式 — 隐藏面包屑 + 搜索 flex-1 + 用户菜单整合入口"
```

---

### Task 5: UserMenu 移动端整合导航入口

**Files:**
- Modify: `apps/web/components/layout/user-menu.tsx`

**Interfaces:**
- Consumes: `isMobile?: boolean` (新增 prop)
- Consumes: `CREATE_MENU_ITEMS` from Task 1

- [ ] **Step 1: 更新 UserMenu 接口和移动端菜单项**

**Props 接口更新**（替换行 27-29）：

```tsx
interface UserMenuProps {
  session: Session
  isMobile?: boolean
}
```

**函数签名更新**（替换行 41）：

```tsx
export function UserMenu({ session, isMobile = false }: UserMenuProps) {
```

**Import 添加**（在现有 import 块末尾添加）：

```tsx
import { useRouter } from "next/navigation"
import {
  Bell,
  Clock,
  MessageSquareText,
  FilePlus2,
  Package,
  Wand,
} from "lucide-react"
import { CREATE_MENU_ITEMS } from "@/lib/navigation/create-menu-items"
```

**移动端导航入口**：在 UserMenu dropdown 中，header（头像+用户名）之后、`DropdownMenuSeparator` 之前，添加移动端专属的导航区块。

替换行 91 的 `<DropdownMenuSeparator />`（header 之后的分隔线）为：

```tsx
{/* Mobile-only: navigation entries */}
{isMobile && (
  <>
    <DropdownMenuSeparator />

    {/* 创建子菜单 */}
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex items-center">
        <FilePlus2 className="mr-2 h-4 w-4 shrink-0" />
        <span>{t("nav.create")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-44">
        {CREATE_MENU_ITEMS.map((item) => (
          <DropdownMenuItem
            key={item.labelKey}
            onClick={() => router.push(item.href)}
          >
            <item.icon className="mr-2 h-4 w-4 shrink-0" />
            {t(item.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>

    {/* 通知 — 直接跳转 */}
    <DropdownMenuItem onClick={() => router.push("/notifications")}>
      <Bell className="mr-2 h-4 w-4 shrink-0" />
      {t("nav.notifications")}
    </DropdownMenuItem>

    {/* 动态 — 直接跳转 */}
    <DropdownMenuItem onClick={() => router.push("/moment")}>
      <MessageSquareText className="mr-2 h-4 w-4 shrink-0" />
      {t("nav.moments")}
    </DropdownMenuItem>

    {/* 历史 — 直接跳转 */}
    <DropdownMenuItem onClick={() => router.push("/history")}>
      <Clock className="mr-2 h-4 w-4 shrink-0" />
      {t("nav.history")}
    </DropdownMenuItem>

    <DropdownMenuSeparator />
  </>
)}

{/* 桌面端使用原来的简单分隔线 */}
{!isMobile && <DropdownMenuSeparator />}
```

**注意**：
- `DropdownMenuSub` 和 `DropdownMenuSubTrigger` 已在现有 import 中（行 15-18），无需额外引入
- 创建菜单项复用 Task 1 的 `CREATE_MENU_ITEMS`
- 通知/动态/历史使用 `onClick + router.push`，不出 Popover
- `t("nav.notifications")`、`t("nav.moments")`、`t("nav.history")` 需确认 i18n key 存在。若不存在，先用中文字面量，后续 Task 6 处理

- [ ] **Step 2: 类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：无类型错误。

- [ ] **Step 3: 提交**

```bash
git add apps/web/components/layout/user-menu.tsx
git commit -m "feat: UserMenu 移动端整合创建/通知/动态/历史入口"
```

---

### Task 6: 验证 + i18n 补充

**Files:**
- 可能修改: `apps/web/lib/i18n/messages/*.json`（如有关键翻译缺失）

- [ ] **Step 1: 全局类型检查**

```bash
cd apps/web && pnpm typecheck
```

预期：零错误。

- [ ] **Step 2: 确认 i18n 翻译 key 存在**

检查 UserMenu 中使用的翻译 key 是否存在：

```bash
cd apps/web && grep -r "nav.notifications\|nav.moments\|nav.history\|nav.create" lib/i18n/ --include="*.json"
```

如果不存在，需要在 `zh-CN.json` 和 `en.json` 中添加：
- `nav.create`: "创建" / "Create"
- `nav.notifications`: "通知" / "Notifications"
- `nav.moments`: "动态" / "Moments"
- `nav.history`: "历史" / "History"

**如果已存在则跳过此步骤。**

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: 移动端响应式验证 + i18n 补充"
```

---

## 验证清单

实现完成后，逐项验证：

1. [ ] **桌面端 sidebar collapsed 持久化**：折叠侧边栏 → 刷新页面 → 侧边栏仍折叠
2. [ ] **桌面端 CreateDropdown 正常**：点击创建按钮 → 下拉菜单显示 4 个选项 + 分隔线
3. [ ] **桌面端 Popover 正常**：hover 通知/动态/历史图标 → 弹出 Popover
4. [ ] **桌面端搜索正常**：搜索框在 Topbar 中间，有 `max-w-[520px]`
5. [ ] **移动端侧边栏 overlay**：缩小视口至 <768px → 点击汉堡 → 侧边栏从左侧滑入 + backdrop → 点击蒙层/X 关闭
6. [ ] **移动端 Topbar 布局**：左[汉堡] 中[搜索框填充] 右[用户头像]，面包屑和独立操作按钮隐藏
7. [ ] **移动端 UserMenu**：点击用户头像 → 菜单顶部显示创建子菜单 + 通知/动态/历史跳转项
8. [ ] **移动端搜索**：搜索框可见且自适应宽度
9. [ ] **路由切换关闭侧边栏**：移动端打开侧边栏 → 点击导航链接 → 侧边栏自动关闭
10. [ ] **阅读模式不变**：桌面端阅读模式（pages 查看）Topbar 的 Tab 切换、沉浸模式不受影响

## 自审检查

### Placeholder 扫描
- 无 TBD、TODO、未完成段落
- 每个 Step 有实际代码或明确命令

### 类型一致性
- Task 2 定义的 `AppShellContextType` 新增字段与 Task 3-5 使用的 props 一致
- `isMobile: boolean`, `sidebarOpen: boolean`, `openSidebar: () => void`, `closeSidebar: () => void`
- `SidebarProps` 新增 `isMobile: boolean`, `open: boolean`, `onClose: () => void`
- `TopbarProps` 新增 `isMobile?: boolean`, `onOpenSidebar?: () => void`
- `UserMenuProps` 新增 `isMobile?: boolean`

### Spec 覆盖
- [x] 断点 768px — Task 2 matchMedia
- [x] 侧边栏 fixed overlay — Task 2 布局 + Task 3 Sidebar
- [x] 移动端 Topbar 布局 — Task 4
- [x] 移动端 UserMenu 导航入口 — Task 5
- [x] 创建菜单复用 — Task 1
- [x] 桌面端行为不变 — 所有 task 的条件分支使用 `isMobile` guard
