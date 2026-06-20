# Desktop 设置页 Sidebar 重构设计

## 背景

当前 Desktop 设置页由 `SettingsPage` 自己渲染左右两栏：左侧是设置分类列表，右侧是设置详情。外层 `AppLayout` 始终显示工作空间 sidebar，因此进入设置页后会出现“应用 sidebar + 设置页内 sidebar”的双层导航。

目标是让设置页融入 Desktop shell：进入 `/settings` 或 `/settings/:section` 时，左侧 Desktop sidebar 的主体内容切换成设置分类列表，右侧页面只显示设置详情，不再包含设置页内的左侧列表。

## 目标体验

进入设置页时，Desktop sidebar 从上到下显示：

1. 返回入口：`<- 返回`
2. 分隔线
3. 设置分类列表：通用、账号、快捷键、通知、Gateway、Channels、Executors、Model、Agents、MCP、Skills、Sandbox、Environment、Terminal Fonts、Overlay、Voice、Pet、Storage、Developer、About
4. 分隔线
5. Gateway Status
6. Wakeword Button

设置详情区域占据主内容区，保留现有 breadcrumb、tab、深链和 `/settings/:section` URL 语义。

## 范围

本次只重构 Desktop 设置页布局，不修改设置项业务逻辑，不调整 Gateway、Agent、MCP、Skills 等详情页的功能行为。

涉及模块：

- `apps/desktop/src/pages/settings/index.tsx`
- `apps/desktop/src/pages/settings/constants.ts`
- `apps/desktop/src/navigation/settings-sections.ts`
- `apps/desktop/src/components/layout/sidebar.tsx`
- 如有必要，新增 `apps/desktop/src/pages/settings/settings-sidebar-content.tsx`

## 设计方案

### 1. 抽出设置导航组件

从 `SettingsPage` 中抽出 `SettingsSidebarContent`，复用当前 `SECTIONS`、`VALID_SECTIONS`、`DEFAULT_SETTINGS_SECTION` 和 icon 配置。

组件职责：

- 根据当前 `location.pathname` 推导 active section。
- 点击分类时调用 `openSettings(section)`。
- 当切换到 `channels` 时保留现有 `syncChannels()` 预加载逻辑。
- 渲染 expanded 和 collapsed 两种形态，适配现有 `Sidebar` 的折叠/悬停展开机制。
- active 状态样式沿用 sidebar 的导航风格，而不是继续使用设置页内的 `bg-primary text-primary-foreground` 大按钮风格。

### 2. Sidebar 根据路由切换内容

在 `Sidebar` 中使用 `useLocation()` 判断当前是否处于设置路由：

- `location.pathname === "/settings"`
- `location.pathname.startsWith("/settings/")`

处于设置路由时，不渲染工作空间 selector、workspace pages、workspace nav、creator nav、原 bottom drawer。

改为渲染：

- 顶部返回按钮
- 设置分类列表
- 底部 Gateway Status
- 底部 Wakeword Button

返回按钮行为：

- 首选使用当前 tab 的 back 能力返回进入设置页前的位置。
- 如果没有可返回历史，则回到当前 active workspace 的 `chat`。
- 如果没有 active workspace，则回到 dashboard。

返回按钮在 collapsed 状态下显示 icon button 和 tooltip；expanded 状态下显示 icon + 文案。

### 3. SettingsPage 只负责详情

`SettingsPage` 移除左侧 `<motion.nav>`，只保留内容区和 section 渲染逻辑。

详情布局规则：

- `agents`、`mcp`、`skills` 继续使用 `h-full`，不加默认 padding。
- 其他设置详情继续使用 `p-6 max-w-2xl`。
- 保留 `AnimatePresence` 与 reduced motion 处理。
- URL 变化仍同步 active section，深链进入 `/settings/gateway` 等路径时直接显示对应详情。

### 4. 路由与导航不变

不新增 layout route，不修改 `route-registry` 的设置路径语义。

现有入口继续调用：

- `openSettings(section)`
- `/settings/:section`
- `/settings`

这样可以降低对 tab store、breadcrumb builder、global tab bar 和 action system 的影响。

## 数据流

1. 用户从底部抽屉、命令或其他入口打开设置页。
2. `useDesktopRouting().openSettings(section)` 导航到 `/settings/:section`。
3. `Sidebar` 检测到 settings route，切换为设置模式。
4. `SettingsSidebarContent` 根据 URL 高亮当前 section。
5. `SettingsPage` 根据同一个 URL 渲染详情内容。
6. 用户点击设置分类时，sidebar 调用 `openSettings(section)` 更新 URL，详情区随 URL 更新。

## 错误处理与边界

- 未知 section 统一回落到 `general`。
- `/settings` 无 section 时显示 `general`。
- 返回按钮没有历史时，不报错，按 active workspace/dashboard fallback 导航。
- `channels` 数据预加载失败沿用现有 `syncChannels()` 行为，不在布局层新增错误状态。

## 测试计划

单元/组件测试优先覆盖：

- `/settings` 和 `/settings/:section` 下 `Sidebar` 进入设置模式。
- 非设置路由下 `Sidebar` 保持原工作空间模式。
- 设置分类点击调用 `openSettings(section)` 并保持 active 高亮。
- `/settings/unknown` 回落到 general。

手动验证：

- `pnpm --filter @viben/desktop typecheck`
- 如仓库当前脚本要求，运行 `pnpm typecheck` 或 `pnpm build`。
- 在 Desktop dev 环境验证：从工作空间进入设置页、切换分类、返回、折叠 sidebar、悬停展开、Gateway Status 和 Wakeword Button 仍可见。

## 非目标

- 不重设计设置详情页内容。
- 不修改设置数据存储格式。
- 不调整 Gateway API 参数命名。
- 不改 workspace settings dialog。
- 不把设置页改成 modal。
