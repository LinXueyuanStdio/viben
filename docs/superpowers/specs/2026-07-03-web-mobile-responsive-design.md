# Web 移动端响应式适配设计

## 概述

对 `apps/web` 进行布局框架层面的移动端响应式改造，以 768px（Tailwind `md` 断点）为桌面/移动分界，仅涉及 AppShell 布局框架的 4 个核心组件，桌面端行为不变。

## 范围

**涉及文件**：
- `components/layout/app-shell.tsx` — 侧边栏从 inline flex 改为 fixed overlay
- `components/layout/sidebar.tsx` — 适配 overlay 模式，添加 backdrop
- `components/layout/topbar.tsx` — 响应式三列布局
- `components/layout/user-menu.tsx` — 移动端整合创建/通知/动态/历史入口

**不涉及**：各页面内容区的响应式优化（按需后续进行），auth/admin 布局保持不变。

## 设计决策

### 1. 断点：`md` (768px)

- ≥768px：桌面端，保持现有行为
- <768px：移动端，应用新布局

使用 Tailwind 的 `md:` 前缀 + React 状态管理（`useMediaQuery` 或 `useState` + `resize` 事件），侧边栏 overlay 状态由 React state 控制（`sidebarOpen`），不依赖 CSS 媒体查询切换。

### 2. 侧边栏 → Fixed Overlay 抽屉

**当前**：侧边栏与主内容区 `flex` 并排，宽度由 CSS 变量 `--sidebar-w: 256px` 控制，折叠时宽度变为 0。

**改为**：
- 侧边栏始终 `fixed inset-y-0 left-0 z-50`，宽度 256px
- 主内容区始终全宽（移除并排 flex 布局）
- 桌面端默认展开（`translate-x-0`），折叠时 `translate-x-[-100%]` + 移除 backdrop
- 移动端默认隐藏（`translate-x-[-100%]`），打开时 `translate-x-0` + 显示 backdrop
- Backdrop：`fixed inset-0 bg-black/40 z-40`，点击关闭侧边栏
- 侧边栏左上角保留关闭按钮（X），移动端可见

**状态管理**：
- 桌面端：保留 `sidebarCollapsed` + localStorage 持久化（现有逻辑）
- 移动端：使用 `sidebarOpen`（不持久化，每次页面加载默认关闭）

**过渡动画**：`transition-transform duration-200 ease-out`

### 3. Topbar 响应式

**桌面端（≥md）**：保持现有 3 列 grid 布局不变。

**移动端（<md）**：
- 左区域：汉堡按钮（点击打开侧边栏 overlay）——面包屑隐藏
- 中区域：搜索框 `flex-1`，填充剩余宽度，`max-w` 移除
- 右区域：仅显示用户头像/登录按钮（用户菜单替换原有的 5 个独立入口）

```
桌面端: [汉堡 面包屑] [     搜索框 max-w-520     ] [创建 通知 动态 历史 用户]
移动端: [汉堡]             [   搜索框 flex-1     ] [用户菜单 ▼]
```

**Topbar 宽度**：
- 桌面端：`w-[min(1280px,calc(100%-28px))]`
- 移动端：`w-full px-3`

### 4. 用户菜单（移动端增强）

在桌面端，UserMenu 保持现有结构（头像 + 下拉：个人资料/设置/退出）。

在移动端，UserMenu 下拉菜单在现有基础上，顶部新增导航入口：

```
┌──────────────────┐
│ 👤 用户名         │
│ 📧 邮箱           │
├──────────────────┤
│ 创建              │ ← 展开子菜单
│   ├ 发布包        │
│   ├ 新建页面      │
│   └ …            │
├──────────────────┤
│ 🔔 通知           │ → router.push('/notifications')
│ ⚡ 动态           │ → router.push('/moment')
│ 🕐 历史           │ → router.push('/history')
├──────────────────┤
│ ⚙️ 设置           │
│ ─── 退出登录      │
└──────────────────┘
```

**要点**：
- 创建下拉复用 `CreateDropdown` 的数据源（`createMenuItems` 或等效常量）
- 通知/动态/历史为 `Link` 或 `router.push`，不弹出 Popover
- 通知/动态/历史仅在移动端显示（或在桌面端也被收起时显示），用 `md:hidden` 控制
- 未登录状态在移动端显示登录/注册按钮

### 5. 全局搜索

**移动端调整**：
- 父容器移除 `max-w-[520px]`，改为 `flex-1 min-w-0`
- 搜索框宽度自适应（`w-full`）
- Dropdown 宽度与搜索框一致

**桌面端不变**。

### 6. Breakpoint 检测

在 `app-shell.tsx` 中通过 `matchMedia` 检测断点：

```tsx
// 持久化桌面端侧边栏状态
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  if (typeof window === "undefined") return false
  return localStorage.getItem("viben-sidebar-collapsed") === "true"
})

// 移动端 overlay 开关（不持久化）
const [sidebarOpen, setSidebarOpen] = useState(false)

// 断点检测
const [isMobile, setIsMobile] = useState(() =>
  typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
)
```

- 通过在 `useEffect` 中监听 `matchMedia` 的 `change` 事件更新 `isMobile`
- **不创建全局 hook**（范围限定为布局框架内部使用），后续有需要再提取
- 关闭 sidebar overlay 时重置 `sidebarOpen = false`

## 组件接口变更

### AppShell / AppShellContext

```typescript
interface AppShellContextType {
  session: Session | null
  // 桌面端
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  // 移动端
  isMobile: boolean
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
}
```

### Sidebar

```typescript
interface SidebarProps {
  // 桌面端
  collapsed: boolean
  // 移动端
  isMobile: boolean
  open: boolean
  onClose: () => void
  session?: Session | null
  pendingPackagesCount?: number
}
```

### Topbar

```typescript
interface TopbarProps {
  session: Session | null
  // 桌面端
  onToggleSidebar: () => void
  sidebarCollapsed?: boolean
  // 移动端
  isMobile: boolean
  onOpenSidebar: () => void
  // slots
  centerContent?: React.ReactNode
  rightContent?: React.ReactNode
}
```

### UserMenu

```typescript
interface UserMenuProps {
  session: Session
  // 新增
  isMobile?: boolean  // 移动端时显示额外导航入口
}
```

## 状态流转

```
桌面端:
  侧边栏展开 ──[点击汉堡]──▶ 侧边栏移到屏幕外 + sidebarCollapsed=true (持久化)
  侧边栏隐藏 ──[点击汉堡]──▶ 侧边栏滑入 + sidebarCollapsed=false

移动端:
  侧边栏隐藏 ──[点击汉堡]──▶ 侧边栏 overlay + backdrop + sidebarOpen=true
  侧边栏显示 ──[点击 X / 点击 backdrop]──▶ 侧边栏关闭 + sidebarOpen=false
```

## 非目标

- ~~底部 TabBar~~
- ~~页面内容区的响应式网格~~
- ~~auth layout 改造~~
- ~~PWA / Service Worker~~
- ~~触摸手势（swipe）~~
