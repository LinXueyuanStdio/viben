# Desktop App 代码坏味道审查报告

**审查范围:** `/root/viben/apps/desktop/src` (795 个源文件)
**审查日期:** 2026-05-29
**审查方法:** 5 个并行 agent 分别审查不同方面

---

## 目录

1. [执行摘要](#执行摘要)
2. [高严重性问题](#高严重性问题)
3. [中等严重性问题](#中等严重性问题)
4. [低严重性问题](#低严重性问题)
5. [修复建议](#修复建议)

---

## 执行摘要

| 审查维度 | 高 | 中 | 低 |
|---------|---:|---:|---:|
| 目录结构与模块组织 | 4 | 11 | 6 |
| 组件设计模式 | 14 | 8 | 2 |
| 状态管理与数据流 | 4 | 7 | 4 |
| 导入模式与依赖 | 1 | 2 | 3 |
| 类型定义与接口 | 6 | 13 | 6 |
| **合计** | **29** | **41** | **21** |

### 最关键问题

1. **死代码巨型文件**: `pages/workspace-kanban.tsx` 有 3,338 行，但从未被导入
2. **God Store**: `app-store.ts` 混合了 8+ 个不相关领域 (606 行)
3. **God Hook**: `useWorkspaceChat` 有 41 个 useState，返回 ~60 个值 (1,496 行)
4. **三个并行 Kanban 实现**: `pages/kanban/`, `components/workspace/kanban/`, `lib/kanban/`
5. **16 个文件违反 `await import()` 禁令**: 违反 CLAUDE.md 规定
6. **大量类型重复定义**: 同名类型在多处定义且存在语义偏差

---

## 高严重性问题

### 1. 目录结构

#### 1.1 死代码巨型文件 [DEAD-CODE]
- **文件**: `pages/workspace-kanban.tsx`
- **行数**: 3,338 行
- **问题**: 整个文件从未被导入。`pages/index.ts` 从 `pages/kanban/` 导出 `WorkspaceKanbanPage`，不是从此文件。这是 127KB 的死代码。
- **修复**: 删除此文件

#### 1.2 三个并行 Kanban 实现 [KANBAN-CHAOS]
- **路径**:
  - `pages/kanban/` — 活跃的页面实现
  - `components/workspace/kanban/` — 组件层
  - `lib/kanban/` — 类型和 API
- **问题**: 三处都有自己的 `constants.ts`、`types.ts` 和 hooks。`pages/kanban` 依赖 `components/workspace/kanban`，同时又是独立实现。架构归属完全不清晰。
- **修复**: 统一 kanban 架构，明确 lib (纯数据) → components (可复用UI) → pages (页面组合) 的层次

#### 1.3 组件从 Pages 导入 (反向依赖) [INVERTED-DEPS]
9 处违规:

| 组件文件 | 导入来源 |
|---------|---------|
| `components/agent/agent-debug-tab.tsx` | `@/pages/conversation/components/resize-handle` |
| `components/artifacts/artifact-preview.tsx` | `@/pages/conversation/components/vite-preview` |
| `components/chat/index.ts` | `@/pages/conversation/components` (整个桶文件) |
| `components/layout/sidebar-bottom-drawer.tsx` | `@/pages/settings/constants` |
| `components/layout/sidebar.tsx` | `@/pages/apps/components/page-section` |
| `components/overlay/chat-capsule.tsx` | `@/pages/conversation/components/desktop-message-list` |
| `components/workspace/executor-list.tsx` | `@/pages/conversation/components/executor-list-item` |
| `components/ui/cover-picker/gradient-gallery.tsx` | `@/pages/apps/utils/gradient-colors` |
| `hooks/index.ts` | 8+ exports from `@/pages/conversation/hooks/` |

- **修复**: 将被依赖的组件从 pages 移到 components

#### 1.4 命名约定不一致 [NAMING-CHAOS]
14+ 文件使用 PascalCase，而代码库 92%+ 使用 kebab-case:
- `pages/kanban/components/`: `KanbanBoardView.tsx`, `TaskCardContent.tsx` 等
- `pages/agents/components/`: `AgentCard.tsx`, `InfoCard.tsx` 等

---

### 2. 组件设计

#### 2.1 God Components

| 文件 | 行数 | 问题 |
|-----|-----:|------|
| `pages/workspace-kanban.tsx` | 3,338 | 死代码，见 1.1 |
| `components/file-browser/index.tsx` | 2,123 | 20+ 组件定义在单文件中 |
| `pages/settings/settings-channels.tsx` | 1,948 | API 调用与 UI 混合 |
| `pages/workspace-cron.tsx` | 1,766 | 表单状态、cron 解析、UI 全部混合 |
| `pages/workspace-ideas.tsx` | 1,528 | CRUD + 编辑器 + 过滤 + 对话框 |
| `components/inspector/inspector-tools.tsx` | 1,434 | 工具列表、执行、轮询、结果渲染 |
| `components/agent/agent-mcp-dialog.tsx` | 1,202 | 协议探测、配置序列化、UI 渲染 |
| `components/inspector/dynamic-json-form.tsx` | 1,101 | 递归表单 + JSON 编辑器 + schema 解析 |

#### 2.2 God Hook [GOD-HOOK]
- **文件**: `pages/conversation/hooks/use-workspace-chat.ts`
- **行数**: 1,496
- **问题**: 41 个 `useState` 调用，返回 ~60 个值。混合了:
  - UI 布局状态 (左/右面板宽度)
  - 会话管理
  - 群聊状态
  - Agent 选择
  - 任务管理
  - Slash 命令
  - 高亮状态
- **修复**: 拆分为 `usePanelLayout`, `useConversationSessions`, `useGroupChatState`, `useAgentSelection`

#### 2.3 过多 Props

| 组件 | Props 数 | 问题 |
|-----|--------:|------|
| `AgentConfigPanel` | 27 | 5 个独立区域的数据聚合 |
| `AgentDetailPanel` | 14 | 7 个布尔开关 (boolean prop proliferation) |
| `GroupChatSidebar` | 14 | 8 个异步回调 |

#### 2.4 Prop Drilling [PROP-DRILLING]
- **问题**: `makeRequest` 穿透 3 层传递到 12+ inspector 子组件
- **路径**: `pages/inspector.tsx` → `components/inspector/inspector.tsx` → 所有 inspector 子组件
- **修复**: 使用 React Context 提供 `makeRequest`

#### 2.5 重复组件 [DUPLICATE-COMPONENTS]

| 重复组 | 文件 |
|-------|------|
| SearchBar | `components/marketplace/search-bar.tsx` + `components/skills/search-bar.tsx` |
| CategoryFilter | `components/marketplace/category-filter.tsx` + `components/skills/category-filter.tsx` |
| AgentDetail | `pages/agents/agent-detail.tsx` + `pages/conversation/components/agent-detail-panel.tsx` |

#### 2.6 复制粘贴逻辑 [COPY-PASTE]
- **文件**: `pages/workspace-kanban.tsx`
- **问题**: `TaskCardWithStuckDetection` (lines 802-824) 和 `ListViewItemWithStuckDetection` (lines 887-904) 包含完全相同的 `isStuck` useMemo 逻辑
- **修复**: 提取为 `useResolvedStuckStatus(task, detectedStuck, isChecking)` hook

---

### 3. 状态管理

#### 3.1 God Store [GOD-STORE]
- **文件**: `stores/app-store.ts`
- **行数**: 606
- **问题**: 混合了 8+ 不相关领域:
  - Python 配置
  - Research providers
  - API keys
  - MCP server 实例和状态
  - Inspector UI 状态
  - 主题/语言
  - 11 个 CLI 工具路径
  - 用户偏好设置

应拆分的 slices:
- Inspector UI state (`inspectorSelectedServerId`, `inspectorConnectionStatus`, etc.)
- CLI tool paths (11 个字符串字段)
- Preferences (`alwaysShowTextDirection`, `weekStartsOnMonday`, etc.)
- Developer preferences (`preferredIDE`, `preferredTerminal`, etc.)

#### 3.2 状态重复 [STATE-DUPLICATION]
- **问题**: `selectedAgentId` 在两个 store 中都有定义
  - `stores/workspace-store.ts` (line 21) - workspace 作用域
  - `stores/chat-config-store.ts` (line 26) - 全局作用域
- **风险**: 消费者可能从错误的 store 读取，得到不同的值

#### 3.3 模块级可变变量 [MODULE-LEVEL-MUTABLES]
- **文件**: `hooks/use-store-sync.ts` (lines 43-55)
```typescript
let lastWrittenServersContent: string | null = null;
let isInitialLoading = true;  // 永不重置
let lastWriteTimestamp = 0;
let readCallCount = 0;        // 无上限累积
let writeCallCount = 0;
```
- **问题**: 这些变量在模块作用域，组件卸载后不重置。React StrictMode 双重挂载会导致问题。

#### 3.4 全局状态泄漏 [GLOBAL-STATE-LEAK]
- **文件**: `hooks/use-gateway-status.ts` (lines 40-44)
```typescript
let globalStatus: GatewayStatus = "disconnected";
let globalListeners: Set<() => void> = new Set();
let pingInterval: NodeJS.Timeout | null = null;
```
- **问题**: `globalListeners` 是普通 Set，React StrictMode 双重挂载会导致监听器累积

---

### 4. 导入模式

#### 4.1 违反 `await import()` 禁令 [FORBIDDEN-IMPORTS]
CLAUDE.md 禁止动态导入，但以下 16 个文件违规:

| 文件 | 导入的模块 |
|-----|-----------|
| `pages/settings/developer-section/index.tsx` | `@tauri-apps/api/path` |
| `pages/apps/page-debug.tsx` | `@tauri-apps/plugin-fs` |
| `pages/agents/executor-detail.tsx` | `@tauri-apps/plugin-fs` (循环内) |
| `pages/conversation/components/right-sidebar.tsx` | `@tauri-apps/plugin-fs` |
| `pages/conversation/components/desktop-message-list.tsx` | `@tauri-apps/plugin-shell` |
| `pages/conversation/components/vite-preview.tsx` | `@tauri-apps/plugin-opener` |
| `pages/conversation/components/executor-detail-panel.tsx` | `@tauri-apps/plugin-shell` |
| `pages/conversation/components/agent-detail-panel.tsx` | `@tauri-apps/plugin-shell` |
| `lib/tauri-file-attach.ts` | `@tauri-apps/plugin-fs` |
| `lib/action-system/builtins.ts` | `html-to-image` |
| `components/global-tab-bar/window-controls.tsx` | `@tauri-apps/plugin-os`, `@tauri-apps/api/window` (4次) |
| `components/workspace/github/issue-detail.tsx` | `@tauri-apps/plugin-shell` |
| `components/workspace/github/issue-detail-modal.tsx` | `@tauri-apps/plugin-shell` |
| `components/workspace/task-detail-panel/details-tab.tsx` | `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-shell` |
| `components/ui/icon-picker/tabs/image-tab.tsx` | `@tauri-apps/plugin-dialog` |
| `components/ui/icon-picker/hooks/use-image-upload.ts` | `@tauri-apps/plugin-fs` |

- **修复**: 使用静态 import 在文件顶部导入

---

### 5. 类型定义

#### 5.1 重复类型定义 (语义偏差) [TYPE-DIVERGENCE]

| 类型名 | 位置 | 问题 |
|-------|------|------|
| `AppNotification` | `types/notification.ts` vs `components/notifications/notification-item.tsx` | `createdAt` 是 `Date` vs `string`; `metadata` 结构不同 |
| `SubtaskStatus` | 3 处定义 | `lib/kanban/types.ts`, `lib/gateway/modules/tasks.ts`, `components/workspace/task-tabs/task-subtasks-tab.tsx` |
| `ApiLogEntry` | `types/index.ts` vs `lib/gateway/types/logs.ts` | 完全相同但独立定义 |
| `ClaudeCodeConfig` | `types/agent.ts` vs `lib/gateway/types/session.ts` | 结构相似但独立定义 |
| `FileEntry` | `types/index.ts` vs `lib/gateway/types/file.ts` | 字段完全不同 (UI vs backend DTO) |
| `AgentConfig` | `pages/conversation/hooks/use-agent-conversation.ts` vs `lib/kanban/types.ts` | 同名但完全不同语义 |

#### 5.2 大量 `any` 使用 [ANY-ABUSE]
- **文件**: `pages/apps/components/yoopta-markdown.ts`, `yoopta-markdown-renderer.tsx`
- **问题**: 10+ 处 `: any` 和 `as any` 用于 Yoopta 节点遍历
- **修复**: 使用 `yoopta.d.ts` 中定义的类型

#### 5.3 已弃用类型仍在使用 [DEPRECATED-TYPES]
- `WorkspaceAgent` 标记为 `@deprecated Use Executor instead`
- 但 `stores/workspace-store.ts` 仍在导入和使用

---

## 中等严重性问题

### 目录结构
- Hook 放在 `lib/` 而非 `hooks/`: `lib/kanban/use-tasks-websocket.ts`
- Hook 放在 `components/` 子目录: `pages/apps/components/use-page-dialogs.ts`
- 通用 hook 埋在 page 子目录: `pages/settings/shortcuts-section/use-platform.ts`
- `.tsx` 文件与同名目录并存: `components/workspace/task-detail-panel.tsx` + `task-detail-panel/`
- 重复 `GroupChat` 类型定义: `types/group-chat.ts` vs `lib/gateway/types/group-chat.ts`
- 空目录残留: `components/chat/tabs/` (空目录)
- `lib/overlay-config.ts` 应在 `lib/overlay/` 内
- `pages/settings/` 混合平面文件和子目录

### 状态管理
- `task-activity-store.ts` 模块加载时自动启动 `setInterval`，无清理保证
- `use-task-agent.ts` 模块级 `Map` 无大小限制，会无限累积
- `ui-store.ts` 同步读取 `localStorage`，不使用 persist 中间件
- `kanban-queue-store.ts` store 工厂缓存永不清理
- `use-store-sync.ts` 生产环境大量 debug 日志
- `overlay-store.ts` 的 `waveEnabled` 双重表示 (顶层字段和 `waveConfig.enabled`)
- `use-auth.ts` Tauri `listen()` 回调永不取消订阅

### 导入模式
- `settings-mcp.tsx` lazy-load 的页面在 `App.tsx` 中已静态导入
- 14 个 slash-command 文件使用 `../../types` 相对导入

### 类型定义
- `WsClientMessage.agentConfig` 是匿名内联类型 (13 个字段)
- `BundledCliResult` 在两处完全相同的定义
- `CronNotificationSettings` 可选性差异 (`in_app: boolean` vs `in_app?: boolean`)
- `StatusVariant` 在两个状态组件中重复定义
- `as any` 用于绕过类型检查: `use-device-websocket.ts`, `use-workspaces.ts`, `skills-market.tsx`

---

## 低严重性问题

- `features/` 目录只有一个 feature
- `components/providers/` 只有一个文件
- `components/status/` 缺少 index 文件
- `components/mobile/` 缺少 index 文件
- `pages/workspace-detail.css` 位置不一致 (应与组件共存)
- 单引号导入 vs 双引号 (5 个文件)
- `JSONSchema7` 被重新定义为 `Record<string, unknown>` 丢失所有结构信息

---

## 修复建议

### 优先级 P0 (立即处理)

1. **删除死代码**: `rm apps/desktop/src/pages/workspace-kanban.tsx`

2. **修复禁止的动态导入**: 将 16 个文件的 `await import()` 改为静态导入

3. **拆分 God Store**: 将 `app-store.ts` 拆分为:
   - `inspector-ui-store.ts`
   - `cli-paths-store.ts`
   - `preferences-store.ts`
   - `developer-prefs-store.ts`

### 优先级 P1 (短期)

4. **拆分 God Hook**: 将 `useWorkspaceChat` 拆分为 4+ 个专注的 hooks

5. **修复反向依赖**: 将 9 个被 components 依赖的 pages 文件移到 components

6. **统一 Kanban 架构**: 明确 `lib/kanban/` → `components/workspace/kanban/` → `pages/kanban/` 层次

7. **消除重复类型**: 建立单一来源:
   - `SubtaskStatus` → `lib/kanban/types.ts`
   - `AppNotification` → `types/notification.ts`
   - `FileEntry` → 分为 `FileEntryUI` 和 `FileEntryDTO`

### 优先级 P2 (中期)

8. **提取 Inspector Context**: 用 Context 替代 `makeRequest` prop drilling

9. **合并重复组件**: `SearchBar`, `CategoryFilter` 移到 `components/ui/`

10. **统一命名约定**: 将 14+ PascalCase 文件重命名为 kebab-case

11. **修复模块级状态**: 为 `use-store-sync.ts`, `use-gateway-status.ts` 添加适当的清理逻辑

---

## 附录: 按文件的问题索引

| 文件 | 问题数 | 最高严重性 |
|-----|-------:|-----------|
| `pages/workspace-kanban.tsx` | 3 | HIGH (死代码) |
| `stores/app-store.ts` | 1 | HIGH |
| `pages/conversation/hooks/use-workspace-chat.ts` | 1 | HIGH |
| `components/file-browser/index.tsx` | 2 | HIGH |
| `pages/settings/settings-channels.tsx` | 2 | HIGH |
| `hooks/use-store-sync.ts` | 2 | HIGH |
| `hooks/use-gateway-status.ts` | 2 | HIGH |
| `types/notification.ts` | 1 | HIGH |
| `components/agent/agent-config-panel.tsx` | 1 | HIGH |
| `pages/inspector.tsx` | 2 | HIGH |
