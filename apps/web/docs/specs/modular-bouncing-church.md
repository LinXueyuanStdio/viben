# 助手页面布局优化：三行变两行

## Context

当前 `/assistant/{sessionId}/{chatId}` 页面在顶栏下方有 **3 行** 头部区域，在笔记本等小屏设备上空间紧张：

```
第 1 行（全局 Topbar）：面包屑 · · · · · · · · · · 空占位 · · · · · · · · · · 用户图标
第 2 行（SessionHeader）： PanelLeft + repo/branch/chatname · · · · · dev 按钮 + Git
第 3 行（ChatTabs）：        chat1 chat2 Changes +
```

**目标**：把 chatname 提升到 Topbar 居中，把 ChatTabs 合并进 SessionHeader，省下第 3 行空间：

```
第 1 行（全局 Topbar）：面包屑 · · · · chatname 居中 · · · · 用户图标
第 2 行（合并后）：    PanelLeft + chat1 chat2 Changes + · · · · · dev 按钮 + Git
```

**核心机制**：复用已有的 `TopbarSlotProvider` / `useTopbarSlots` 模式（`topbar-slots.tsx`），将其集成到 `AppShell` 中，让深层的 chat 页面可以通过 context 向 Topbar 注入居中内容。

---

## 关键发现（代码探索结果）

### Topbar center 列的现有行为

Topbar 的 center 渲染是一个条件链（`topbar.tsx:208-242`）：

```
isProjectRoute → ProjectTabs
isRead → topbarSlots?.centerContent ?? centerContent ?? read tabs
isDashboardNav → HomeTabBar
isTeamRoute → TeamTabs
否则 → null  ← assistant 路由落在这里！
```

**`/assistant` 路由在所有分支中落空**，原因是：
- 路由解析器将 `/assistant` 归为 `type: "dashboard"`（`route-resolver.ts:67-69`）
- 但 `isDashboardNav` 被显式排除：`(rType === "home" || rType === "dashboard") && !isAssistantRoute`
- `topbarSlots?.centerContent` 检查只存在于 `isRead` 分支内，assistant 永远走不到

**结论**：必须为 assistant 添加独立的条件分支。

### TopbarSlotProvider 现状

- `TopbarSlotProvider` / `useTopbarSlots` 在 `topbar-slots.tsx` 中定义完整
- **但从未被任何生产代码实例化** — `useTopbarSlots()` 总是返回 `null`
- 唯一消费点：`topbar.tsx` 的 `isRead` 和 `isReadLike` 分支

### Grid 布局

Assistant 路由使用三列 grid（`topbar.tsx:162-167`）：
```
"minmax(180px, 1fr) minmax(260px, 520px) minmax(180px, 1fr)"
```
中间列 260-520px，即使为空也占据空间。这对居中 chatname 来说是现成的容器。

### SessionHeader + ChatTabs 双重 border

两个组件都有 `border-b border-border`（header 的 `<header>` + tabs 的外层 `<div>`），合并后只需一条。

### ChatTabs wheel 滚动机制

`chat-tabs.tsx:64-79` 拦截 `wheel` 事件，将垂直滚动转为水平滚动。这必须在合并后保持。

### activeChatId 不在 layout context 中

`SessionLayoutContext` 不包含活跃 chat ID 或标题。活跃 chat 的标题必须从 `chats` 数组中查找：`chats.find(c => c.id === activeChatId)?.title`。

---

## 源文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `components/layout/app-shell.tsx` | 修改 | 添加 `topbarCenterContent` state，暴露 setter，用 `TopbarSlotProvider` 包裹 |
| `components/layout/topbar.tsx` | 修改 | 新增 `isAssistantRoute` 分支，读取 `topbarSlots?.centerContent` |
| `components/assistant/session-header.tsx` | 重写 | 移入 ChatTabs，移除 chatname 显示，保留 repo/branch 缩略信息 |
| `components/assistant/chat-tabs.tsx` | 修改 | 去掉外层 `border-b`/`bg-muted/30`，提供 `variant="inline"` 模式 |
| `app/(dashboard)/assistant/[sessionId]/session-layout-shell.tsx` | 修改 | 移除独立 `<ChatTabs />`，通过 `useAppShell()` 将 chatname 注入 Topbar |

---

## 架构图

### 改动前（当前）

```
┌──────────────────────────────────────────────────────────────────┐
│ AppShell                                                         │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Topbar (topbar.tsx)                                          │ │
│ │ ┌──────┐ ┌───────────────┐ ┌────────┐ ┌────────────────────┐ │ │
│ │ │汉堡   │ │面包屑          │ │空占位   │ │搜索 创建 通知 头像  │ │ │
│ │ └──────┘ └───────────────┘ └────────┘ └────────────────────┘ │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ Body                                                         │ │
│ │ ┌─────────┬──────────────────────────────────────────────────┤ │
│ │ │Inbox    │ SessionLayoutShell                                │ │
│ │ │Sidebar  │ ┌──────────────────────────────────────────────┐ │ │
│ │ │(18rem)  │ │ SessionHeader (session-header.tsx)           │ │ │
│ │ │         │ │ ┌────────┬────────────────────────┬─────────┐│ │ │
│ │ │         │ │ │PanelLeft│repo/branch / chatname 🔗│ Git+dev ││ │ │
│ │ │         │ │ └────────┴────────────────────────┴─────────┘│ │ │
│ │ │         │ ├──────────────────────────────────────────────┤ │ │
│ │ │         │ │ ChatTabs (chat-tabs.tsx)                     │ │ │
│ │ │         │ │ border-b bg-muted/30                         │ │ │
│ │ │         │ │ ┌──────┐┌──────┐┌────────┐┌───┐             │ │ │
│ │ │         │ │ │chat1 ││chat2 ││Changes ││ + │             │ │ │
│ │ │         │ │ └──────┘└──────┘└────────┘└───┘             │ │ │
│ │ │         │ ├──────────────────────────────────────────────┤ │ │
│ │ │         │ │ Chat Content (session-chat-content.tsx)      │ │ │
│ │ │         │ │ ┌──────────────────────────────────────────┐ │ │ │
│ │ │         │ │ │ messages...                              │ │ │ │
│ │ │         │ │ └──────────────────────────────────────────┘ │ │ │
│ │ │         │ └──────────────────────────────────────────────┘ │ │
│ │ └─────────┴──────────────────────────────────────────────────┤ │
└──────────────────────────────────────────────────────────────────┘
```

### 改动后（目标）

```
┌──────────────────────────────────────────────────────────────────┐
│ AppShell                                                         │
│ ┌─── TopbarSlotProvider (包裹 Topbar + Body) ──────────────────┐ │
│ │ ┌──────────────────────────────────────────────────────────┐ │ │
│ │ │ Topbar (topbar.tsx)                                      │ │ │
│ │ │ ┌──────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────┐│ │ │
│ │ │ │汉堡   │ │面包屑          │ │ chatname 居中 │ │用户+搜索  ││ │ │
│ │ │ └──────┘ └───────────────┘ └──────────────┘ └──────────┘│ │ │
│ │ ├──────────────────────────────────────────────────────────┤ │ │
│ │ │ Body                                                     │ │ │
│ │ │ ┌─────────┬──────────────────────────────────────────────┤ │ │
│ │ │ │Inbox    │ SessionLayoutShell                            │ │ │
│ │ │ │Sidebar  │ ┌──────────────────────────────────────────┐ │ │ │
│ │ │ │(18rem)  │ │ 合并后的 Header (session-header.tsx)      │ │ │ │
│ │ │ │         │ │ ┌──────┐┌──────────┐┌───┐ ┌────────────┐ │ │ │ │
│ │ │ │         │ │ │Panel ││ chat tabs ││ + │ │ Git+dev     │ │ │ │ │
│ │ │ │         │ │ │Left  ││scroll →   ││   │ │             │ │ │ │ │
│ │ │ │         │ │ └──────┘└──────────┘└───┘ └────────────┘ │ │ │ │
│ │ │ │         │ ├──────────────────────────────────────────┤ │ │ │
│ │ │ │         │ │ Chat Content                              │ │ │ │
│ │ │ │         │ └──────────────────────────────────────────┘ │ │ │
│ │ └─────────┴──────────────────────────────────────────────┤ │ │
└──────────────────────────────────────────────────────────────────┘
```

### 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│ AppShell (app-shell.tsx)                                        │
│                                                                 │
│  const [topbarCenterContent, setTopbarCenterContent] =          │
│    useState<ReactNode>(null)                                     │
│                                                                 │
│  <TopbarSlotProvider value={{ centerContent: topbarCenterContent }}>
│    <Topbar />  ←──── 读取 useTopbarSlots()?.centerContent ──┐  │
│    <Body>                                                     │  │
│      {children}  ← 包含 SessionLayoutShell                   │  │
│    </Body>                                                    │  │
│  </TopbarSlotProvider>                                        │  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                    AppShellContext.Provider    │
                    setTopbarCenterContent ─────┘
                         ↑
                         │ 调用
┌────────────────────────┼────────────────────────────────────────┐
│ SessionLayoutShell (session-layout-shell.tsx)                    │
│                                                                  │
│  const { setTopbarCenterContent } = useAppShell()                │
│                                                                  │
│  useEffect(() => {                                               │
│    const activeChat = chats.find(c => c.id === activeChatId)     │
│    setTopbarCenterContent(                                       │
│      <span className="...">{activeChat?.title ?? session.title}  │
│      </span>                                                     │
│    )                                                             │
│    return () => setTopbarCenterContent(null)  // cleanup         │
│  }, [activeChatId, chats])                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 详细设计方案

### 1. `app-shell.tsx` — 添加 topbarCenterContent 状态管理

**新增 context 字段**：

```typescript
// AppShellContextType 新增:
topbarCenterContent: ReactNode
setTopbarCenterContent: (content: ReactNode) => void
```

**实现**：参考已有的 `readPageMeta` / `setReadPageMeta` 模式：

```typescript
const [topbarCenterContent, setTopbarCenterContent] = useState<ReactNode>(null)
// 放入 AppShellContext.Provider value
// 用 TopbarSlotProvider 包裹 Topbar + Body
```

**关键代码位置**：
- 第 21-34 行：`AppShellContextType` 接口，新增 2 个字段
- 第 36-46 行：默认值，新增 `topbarCenterContent: null, setTopbarCenterContent: () => {}`
- 第 156 行附近：新增 `useState<ReactNode>(null)`
- 第 188-201 行：`contextValue` useMemo，加入新字段
- 第 203-228 行：JSX，用 `TopbarSlotProvider` 包裹

**权衡**：用 `ReactNode` 而非 string，允许未来扩展（如加 icon、badge），但需注意 cleanup 避免内存泄漏。

### 2. `topbar.tsx` — 新增 assistant 路由 center 分支

**现状**（`topbar.tsx:208-242`）：assistant 路由在条件链中落空渲染 `null`。

**精确改动**：在条件链的第 242 行 `) : null}` 之前，插入 assistant 分支：

```tsx
// 第 208 行附近，现有条件链：
{isProjectRoute && resolution ? (
  <ProjectTabs ... />
) : isRead ? (
  topbarSlots?.centerContent ?? centerContent ?? (
    <div className="pointer-events-auto h-full">...read tabs...</div>
  )
) : isDashboardNav ? (
  <HomeTabBar iconOnly={isMobile} />
) : isTeamRoute && resolution ? (
  <TeamTabs teamSlug={resolution.teamSlug!} />
) : isAssistantRoute ? (           // ← 新增
  topbarSlots?.centerContent        // ← 新增：由 SessionLayoutShell 通过 TopbarSlotProvider 注入
) : null}                            // ← 原有 fallthrough
```

**CSS**：中间列已有 `flex items-center justify-center min-w-0 self-stretch`，chatname 天然居中。标题需要 `truncate max-w-[280px]` 防止撑破布局。

**移动端**：`isMobile` 时 Topbar grid 改为 `"auto 1fr auto"` 两列，center 列保留，但内容由 `SessionLayoutShell` 决定是否注入（可选：移动端不注入，避免标题挤占搜索图标空间）。

**注意**：`useTopbarSlots` 已在 `topbar.tsx:60` 被调用（`const topbarSlots = useTopbarSlots()`），无需新增 import。当前返回 `null`，加入 `TopbarSlotProvider` 后即可读到值。

### 3. `session-header.tsx` — 合并 ChatTabs（核心改动）

**现状 DOM 结构**：
```
<header className="border-b border-border px-3 py-1.5">   ← ~36px 高
  <div className="flex items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2">
      [PanelLeft 28×28] [repo/branch/chatname text-sm] [share 🔗]
    </div>
    <div className="flex items-center gap-1">
      [headerActionsRef portal] [Git toggle 28×28]
    </div>
  </div>
</header>
```

**目标 DOM 结构**：
```
<header className="flex items-center gap-2 border-b border-border px-2 py-0">
  <div className="flex min-w-0 flex-1 items-center gap-0">
    [PanelLeft 28×28]
    [repo/branch 缩略 tooltip — hidden on mobile]
    <ChatTabs variant="inline" activeChatId={activeChatId} />
  </div>
  <div className="flex shrink-0 items-center gap-1">
    [share 🔗] [headerActionsRef portal] [Git toggle 28×28]
  </div>
</header>
```

**CSS 变化**：

| 元素 | 改动前 | 改动后 | 原因 |
|------|--------|--------|------|
| `<header>` | `px-3 py-1.5` | `px-2 py-0` | tabs 自带 `py-2`，不需要外层 padding |
| `<header>` | `block`（隐式） | `flex items-center gap-2` | 单行 flex，干掉内部嵌套 div |
| 左侧容器 | `justify-between` + 嵌套 flex | `flex-1 min-w-0` | tabs 自然撑满，右侧 `shrink-0` |
| repo/branch | `text-sm hidden sm:flex` | `text-xs hidden md:flex` + Tooltip | 缩得更小，更高断点隐藏 |
| chatname | `truncate font-medium` 占主位 | **移除**（移至 Topbar） | 省空间 |
| share 🔗 | `ml-1 rounded p-1` | 保留（移至右侧，headerActionsRef 旁） | `setShareRequested` 是 ShareDialog 的触发器，不可移除 |

**保留不变**：
- `headerActionsRef` portal 容器（`<div ref={headerActionsRef} className="flex items-center" />`）
- Git panel toggle（图标 + PR 状态颜色 + 琥珀/蓝色圆点）
- `useSidebar().toggleSidebar` 逻辑
- `useGitPanel()` 的 `handleGitPanelToggle`、快捷键 `⌘⇧B`

**repo/branch 缩略处理**：不再显示为面包屑式的 `repo / branch / title`，而是压缩成一个带 Tooltip 的小标签：

```tsx
{session.repoName && (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
        <FolderGit2 className="h-3 w-3" />
        <span className="max-w-[100px] truncate">{session.repoName}</span>
        {session.branch && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="max-w-[80px] truncate font-mono">{session.branch}</span>
          </>
        )}
      </span>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      {session.repoOwner}/{session.repoName}
      {session.branch && ` · ${session.branch}`}
    </TooltipContent>
  </Tooltip>
)}
```

**SessionHeader 新增 prop**：
```typescript
// 之前: 无 props（全部从 context 读取）
export function SessionHeader()

// 之后: 接受 activeChatId 以传给 ChatTabs
export function SessionHeader({ activeChatId }: { activeChatId: string })
```

### 4. `chat-tabs.tsx` — 添加 `variant` prop

**当前外层结构**（第 414-436 行）：
```tsx
<div className="flex items-center gap-0 border-b border-border bg-muted/30 px-1">
  <div ref={scrollContainerRef}
    className="flex min-w-0 flex-1 items-center overflow-x-auto
      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {tabElements}
    <button onClick={handleNewChat}>  {/* + 按钮 */}
      <Plus className="h-3.5 w-3.5" />
    </button>
  </div>
</div>
```

**改动方案**：添加 `variant` prop 控制外框：

```typescript
type ChatTabsProps = {
  activeChatId: string;
  variant?: "standalone" | "inline";
};
```

| variant | 外框 | 用途 |
|---------|------|------|
| `"standalone"`（默认） | `border-b border-border bg-muted/30 px-1`（现有） | 保持向后兼容（如果未来其他地方复用） |
| `"inline"` | 无外框，纯 `flex min-w-0 flex-1 items-center overflow-x-auto` | SessionHeader 内嵌 |

**`inline` 模式行为**：
- 去掉外层 `<div>`（border/background/padding 交给父级 SessionHeader）
- 保留 `scrollContainerRef` 和 wheel→scroll 拦截（`chat-tabs.tsx:64-79`）
- 保留 tab 的 `border-b-2` active 指示器
- 保留 `+` 按钮（`ml-1 shrink-0`）
- 保留 Changes/File 特殊 tab 的插入逻辑
- 保留 `useIsMobile` 适配

**不拆成两个组件的原因**：tab 渲染逻辑（`tabElements` memo）复杂且与 `ChatTabs` 内部状态深度耦合（rename、delete dialog、scroll behavior）。用 variant 控制外框是最小改动方案。

### 5. `session-layout-shell.tsx` — 移除 ChatTabs 行 + 注入 Topbar

**数据流**：

```
URL params → routeChatId → activeChatId
                                ↓
chats (from useSessionChats) → find(c => c.id === activeChatId)?.title
                                ↓
useEffect → setTopbarCenterContent(<span>{title}</span>)
                                ↓
AppShellContext → TopbarSlotProvider → Topbar 读取
```

**改动点 A — SessionLayoutShell 新增**：

```typescript
import { useAppShell } from "@/components/layout/app-shell";

// 在 SessionLayoutShell 函数体内：
const { setTopbarCenterContent } = useAppShell();

// 推导活跃 chat 标题
const activeChatTitle = useMemo(() => {
  if (!activeChatId) return initialSession.title;
  const chat = chats.find(c => c.id === activeChatId);
  return chat?.title || initialSession.title;
}, [chats, activeChatId, initialSession.title]);

// 注入 Topbar（组件卸载时清除）
useEffect(() => {
  setTopbarCenterContent(
    <span className="truncate max-w-[280px] text-sm font-medium text-foreground">
      {activeChatTitle}
    </span>
  );
  return () => setTopbarCenterContent(null);
}, [activeChatTitle, setTopbarCenterContent]);
```

**注意**：`setTopbarCenterContent` 是由 `useAppShell()` 暴露的，而 `useAppShell` 是 `app-shell.tsx` 中已有的 `useContext(AppShellContext)` hook。这个 setter 与 `setReadPageMeta` 模式一致。

**改动点 B — SessionLayoutInner**：

```tsx
// 之前（第 48-55 行）:
<div className="relative flex h-full overflow-hidden">
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <SessionHeader />
    {activeChatId && <ChatTabs activeChatId={activeChatId} />}
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
  {/* git panel portal... */}
</div>

// 之后:
<div className="relative flex h-full overflow-hidden">
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    <SessionHeader activeChatId={activeChatId} />
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
  {/* git panel portal... */}
</div>
```

**关键细节**：
- `<ChatTabs />` 的条件渲染（`activeChatId &&`）被移到 `SessionHeader` 内部处理 — 当无活跃 chat 时，tabs 区域为空但 header 其他元素仍然渲染
- `activeChatId` 现在作为 prop 传给 `SessionHeader`，而非在 `SessionLayoutInner` 中独立使用

---

## 边界情况处理

### 空 Chat（无 repo）
- chatname 仍然显示在 Topbar 中（使用 session title 或 "New Chat"）
- SessionHeader 中 repo/branch 不显示（已有条件 `session.repoName &&`）
- `headerActionsRef` 依然渲染（可能为空）

### 大量 Chat Tabs
- 现有 `scrollContainerRef` + 横向滚动 + `[scrollbar-width:none]` 保持
- 与 sidebar toggle 和 dev actions 争空间时，tabs 区域会被挤压并出现横向滚动
- **新增保护**：tabs 区域加 `min-w-0 overflow-x-auto`

### Chat 切换
- `activeChatId` 变化 → `useEffect` 触发 → `setTopbarCenterContent` 更新标题
- `useTransition` 已存在，切换时有 optimistic 更新

### Chat 重命名
- `renameChat` 已存在 → SWR mutate 更新 `chats` → `activeChatTitle` 重新计算 → Topbar 更新
- 延迟：依赖 SWR revalidation（毫秒级），可接受

### 移动端
- Topbar 原本就在移动端隐藏大部分内容，chatname 同样隐藏
- SessionHeader 中 tabs 正常显示（移动端已有 `useIsMobile` 适配）
- Git panel 在移动端变为 slideover（现有行为不变）

### 页面卸载（cleanup）
- `useEffect` return 调用 `setTopbarCenterContent(null)` → 离开 assistant 路由时清除
- 防止切换到 settings 等页面时残留 chatname

---

## 细微权衡与取舍

### 1. repo/branch 信息：保留 vs 移除

| 方案 | 描述 | 后果 |
|------|------|------|
| **保留缩略** ✅ | `text-xs hidden md:flex` + Tooltip | 占用 ~100px 横向空间，但保留上下文线索 |
| 移除 | 完全不放 repo 信息 | 用户可能忘记当前在哪个仓库里 |

**选择**：保留缩略。因为 repo/branch 是 session 级别的信息（不随 chat 切换变化），且用户切换 session 时需要知道上下文。缩略到 `text-xs` + `max-w-[100px]` 在视觉上不抢眼。

### 2. share link 图标：保留但移动位置

当前 share 通过 `setShareRequested(true)` 触发 `ShareDialog`（在 `session-chat-content.tsx` 中渲染）。移除 header 中的按钮会导致 share 功能无法触发。

**选择**：保留 share 图标，移动到右侧 `headerActionsRef` 旁边。它不占左侧 tabs 的横向空间，且功能性必需。

### 3. TopbarSlotProvider 集成位置

| 位置 | 优点 | 缺点 |
|------|------|------|
| `AppShell` 内部 ✅ | 与 Topbar 同文件，改动集中 | 增加 AppShell 复杂度 |
| `AppShellWrapper` 中 | 不改动 AppShell | 跨文件跳转，数据流不直观 |
| `SessionsRouteShell` 中 | 不影响全局 Topbar | Topbar 不是 SessionsRouteShell 的子节点，读不到 context |

**选择**：`AppShell` 内部。理由：
- `TopbarSlotProvider` 必须在 Topbar 之上才能被读到
- `setTopbarCenterContent` 需要通过 `AppShellContext` 暴露给深层组件（参考 `setReadPageMeta` 模式）
- 所有改动集中在 `app-shell.tsx` 一个文件中

### 4. ChatTabs 嵌入方式：variant prop vs 拆组件 vs portal

| 方案 | 改动量 | 复杂度 |
|------|--------|--------|
| **`variant` prop** ✅ | +10 行 | 低 — 条件性跳过外框 CSS |
| 拆出 `ChatTabsCore` + `ChatTabsShell` | +50 行 | 中 — 两个组件，额外的 export |
| Portal 到 header | +30 行 | 高 — 需要新的 portal target ref |

**选择**：`variant` prop。`tabElements` memo（~180 行）包含所有核心逻辑，改动一个外层 div 不值得拆组件。

### 5. 移动端 chatname 是否注入 Topbar

| 方案 | 描述 |
|------|------|
| **不注入** ✅ | 移动端 Topbar 空间紧张（面包屑已隐藏，只有汉堡+搜索+头像），chatname 不显示 |
| 注入但截断 | `max-w-[120px]` 勉强放下，但可能与搜索图标冲突 |

**选择**：移动端不注入。通过 `useIsMobile` 在 `useEffect` 中判断，移动端跳过 `setTopbarCenterContent` 调用。chatname 在移动端也不需要在 Topbar 中显示 — 用户已经在具体 session 的页面中，上下文清晰。

### 6. 活跃 chat 标题的数据来源

当前 `ChatTabs` 组件内部通过 `chats.find()` 获取标题，不需要额外 prop。合并后，有两个地方需要活跃 chat 标题：
- **Topbar**（center 列）→ 通过 `setTopbarCenterContent` 注入
- **ChatTabs 内部**（tab 标签）→ 已有，不变

两个地方独立从 `chats` 数组中查找，没有共享状态。这是合理的 — 它们渲染在不同的 React 子树中，共享会导致不必要的耦合。

### 7. 两个 `border-b` 合并为一个

合并前：SessionHeader 的 `<header className="border-b">` + ChatTabs 的 `<div className="border-b">` → 两条边框线。
合并后：只有 header 的 `border-b`，tabs 的 `border-b-2` 是 tab 项上的 active 指示器（`border-transparent` / `border-foreground`），不冲突。

---

## CSS 注意事项（Tailwind v4）

- **禁止 `hsl(var(--...))`**：所有颜色直接用 `var(--border)` 等 oklch CSS 变量
- **`data-*` 变体**：不在 CVA 中使用 `data-[state=active]:`，改用条件 `className`
- ChatTabs 的 `border-b-2 border-transparent` + `border-foreground` active 状态：已用条件 className，安全

---

## 改动汇总

| # | 文件 | 行数影响 | 风险 |
|---|------|----------|------|
| 1 | `app-shell.tsx` | +15 行 | 低 — 增加 context 字段，参考已有模式 |
| 2 | `topbar.tsx` | +5 行 | 低 — 新增一个分支条件 |
| 3 | `session-header.tsx` | 重写 ~200→~120 行 | 中 — 结构调整，但保留所有功能 |
| 4 | `chat-tabs.tsx` | +10 行 (variant prop) | 低 — 向后兼容 |
| 5 | `session-layout-shell.tsx` | +15 / -5 行 | 中 — 新增 context 交互 + 移除 ChatTabs 行 |

---

## 验证步骤

1. **基础渲染**：
   - 打开一个 repo session → 确认 Topbar 居中显示 chatname
   - 确认 SessionHeader 只有一行：PanelLeft + tabs + Git
   - 确认高度减少了约 40px

2. **Chat 切换**：
   - 切换不同 chat → Topbar 标题实时更新
   - 重命名 chat → 标题更新

3. **边界情况**：
   - 空 chat（无 repo）：header 正常渲染，无报错
   - 10+ tabs：横向滚动正常工作
   - 新建 chat → tabs 列表 + Topbar 标题正确

4. **功能回归**：
   - Sidebar 折叠/展开正常
   - Git panel 弹出正常
   - Dev server 按钮 portal 正常显示
   - Code editor 按钮可用
   - Share 功能（如果有替代入口）

5. **响应式**：
   - 移动端：tabs 正常显示，repo 信息隐藏
   - 窄屏：tabs 横向滚动，header 不换行

6. **编译**：
   ```bash
   cd apps/web && pnpm typecheck
   ```

7. **路由切换**：
   - 从 assistant 切换到 settings → Topbar 不再显示 chatname
   - 从 settings 切回 assistant → chatname 恢复显示
