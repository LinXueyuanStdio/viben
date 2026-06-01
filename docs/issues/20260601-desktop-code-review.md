# Desktop 代码组织 Review

**日期**: 2026-06-01  
**范围**: `apps/desktop/src/` 目录下的 components, hooks, stores, pages, types

---

## 摘要

本次 Review 发现了 **5 大类问题**，涉及 **57+ 个超大文件**、**重复代码**、**职责混乱** 等坏味道。最严重的问题集中在：

1. **组件过大**: `file-browser/index.tsx` (2123行)、`inspector-tools.tsx` (1434行)
2. **Hooks 职责过多**: `use-env-orchestrator.ts` (1022行)、`use-workspace-resources.ts` (1191行)
3. **Store 职责混杂**: `app-store.ts` 管理 8+ 个不相关的领域
4. **类型重复定义**: `cron.ts`、`channel.ts` 从 `packages/core` 复制而非导入
5. **页面包含过多业务逻辑**: `agent-detail.tsx` 有 35 个 useState

---

## 1. Components 问题

### 1.1 超大组件 (>300行)

共 **57 个文件**超过 300 行阈值。最严重的：

| 行数 | 文件 | 问题 |
|------|------|------|
| 2123 | `file-browser/index.tsx` | 状态管理、Tauri IPC、上下文菜单全在一个文件 |
| 1434 | `inspector/inspector-tools.tsx` | 包含分页数据获取逻辑 |
| 1202 | `agent/agent-mcp-dialog.tsx` | - |
| 1101 | `inspector/dynamic-json-form.tsx` | - |
| 1058 | `onboarding/step-agent-setup.tsx` | 35 个 hook 调用 |
| 1034 | `layout/page-section.tsx` | 包含 CRUD mutations、拖拽、三个对话框 |

### 1.2 Props 过多 (>10个)

| Props数 | 文件 | 建议 |
|---------|------|------|
| 39 | `agent/agent-config-panel.tsx` | 拆分为子组件或使用 Context |
| 29 | `agent/agent-debug-tab.tsx` | - |
| 24 | `workspace/kanban/components/kanban-board-view.tsx` | - |

### 1.3 UI 与业务逻辑混合

- `layout/page-section.tsx` — 一个"布局组件"却拥有 CRUD mutations
- `file-browser/index.tsx` — 34 个 hook 调用，包含 Tauri IPC
- `inspector/inspector-tools.tsx` — 组件内定义 `fetchTools()` 分页逻辑

### 1.4 重复组件

| 组件 | 位置 | 问题 |
|------|------|------|
| `SearchBar` | `marketplace/search-bar.tsx`, `skills/search-bar.tsx` | 几乎相同，仅键盘快捷键不同 |
| `CategoryFilter` | `marketplace/category-filter.tsx`, `skills/category-filter.tsx` | 结构相同 |
| `issue-detail` vs `issue-detail-modal` | `workspace/github/` | 666 vs 687 行，大量重复 |

### 1.5 命名不一致

- `index.tsx` 作为组件实现 vs `index.ts` 作为 barrel 导出混用
- `kanban/use-kanban-navigation.ts` 在根目录，其他 hooks 在 `kanban/hooks/`

---

## 2. Hooks 问题

### 2.1 职责过多的 Hooks

| 文件 | 行数 | 职责 |
|------|------|------|
| `use-workspace-resources.ts` | 1191 | 包含 6 个 hooks: useExecutors, useWorkspaceModels, useAgents, useWorkspaceResources, useAgentList, useChatList |
| `use-desktop-routing.ts` | 1180 | 28 个导航方法 + header slot 管理 |
| `use-env-orchestrator.ts` | 1022 | DAG 执行引擎、Node.js 安装、CLI 安装、Gateway 启动、Python 检测... |
| `use-gateway-setup.ts` | 470 | 与 use-env-orchestrator 职责重叠 |

### 2.2 依赖纠缠

- `use-tray-status.ts` 导入 4 个其他 hooks
- `use-env-orchestrator.ts` 导入 6 个 hooks
- `use-store-sync.ts` 使用模块级全局变量 (`lastWrittenServersContent`, `isInitialLoading`)

### 2.3 模式不一致

| 问题 | 说明 |
|------|------|
| 防止过期请求 | `useExecutors` 和 `useAgents` 使用 `currentPathRef`，但 `useWorkspaceModels` 不使用 |
| 数据获取方式 | 大多数用手动 `fetch()`，但 `use-kanban.ts` 用 React Query |
| 状态清理 | 4 个 hooks 各自有独立的 `useEffect` 清理 workspacePath 变化 |

### 2.4 使用 `any` 的位置

- `use-mcp-connection.ts:204` — `as any` 绕过 SDK 类型检查
- `use-mcp-connection.ts:349` — `capabilities as any`
- `use-store-sync.ts:133` — 双重类型断言 `as unknown as Record<string, unknown>`

---

## 3. Stores 问题

### 3.1 职责过多的 Store

**`app-store.ts` (606行)** 管理 8+ 个不相关领域：
- Python 解释器选择
- 学术研究 providers (18 个)
- MCP server 生命周期
- 全局偏好设置
- Inspector UI 状态
- 开发工具路径 (11 个)
- Onboarding 状态

### 3.2 重复状态

- `selectedAgentId` 同时存在于 `workspace-store.ts` 和 `chat-config-store.ts`
- `isLoading`/`error` 模式在 5 个 stores 中重复实现

### 3.3 Store 中的副作用 (应在 hooks 中)

| Store | 问题 |
|-------|------|
| `app-store.ts:483-518` | setter 中直接调用 `getGatewayClient()` |
| `notification-store.ts` | fire-and-forget 的 `syncPreferencesToGateway` |
| `kanban-queue-store.ts` | 包含完整的 `fetch()` 调用 |
| `task-activity-store.ts` | 模块加载时启动 `setInterval` |

### 3.4 模式不一致

| 问题 | 说明 |
|------|------|
| actions 结构 | 2 个 stores 用 `{ actions: {} }` 嵌套，13 个用扁平结构 |
| 数据结构 | `action-store.ts` 用 `Map` (不可序列化)，其他用 `Record` |
| 持久化 | `ui-store.ts` 手动管理 localStorage，其他用 Zustand persist |

---

## 4. Pages 问题

### 4.1 业务逻辑过多

| 文件 | 行数 | 问题 |
|------|------|------|
| `agents/agent-detail.tsx` | 1064 | 35 个 useState，12 个直接 getGatewayClient() 调用 |
| `conversation/chat-monitor.tsx` | 713 | 组件内 raw fetch() |
| `settings/settings-model.tsx` | 955 | 17 个 useState |

### 4.2 超大页面

| 文件 | 行数 |
|------|------|
| `settings/settings-channels.tsx` | 1948 |
| `workspace-cron.tsx` | 1766 |
| `workspace-ideas.tsx` | 1528 |
| `search-service.tsx` | 1205 |
| `workspace-github.tsx` | 1119 |

### 4.3 重复代码

| 模式 | 出现次数 | 建议 |
|------|----------|------|
| `CollapsibleSection` 组件 | 2 处重复定义 | 提取到共享组件 |
| `mounted` 动画模式 | 8 处 | 提取 `useMounted` hook |
| workspace 解析模式 | 10 处 | 提取 `useWorkspaceFromParams` |
| loading spinner | 30 处 | 提取 `<PageLoader />` |

### 4.4 命名不一致

- `kanban/components/`: PascalCase
- `conversation/components/`: kebab-case
- `agents/components/`: PascalCase
- `apps/components/`: kebab-case

---

## 5. Types 问题

### 5.1 从 packages/core 重复定义的类型

| Desktop 类型 | Core 源 |
|--------------|---------|
| `CronJob`, `CronJobType`, `JobStatus` | `packages/core/src/cron/ops/types.ts` |
| `ChannelType`, `ChannelConfig`, `AgentBinding` | `packages/core/src/channels/types.ts` |
| `CronNotificationSettings` | 与 `NotificationSettings` 几乎相同 |

### 5.2 类型文件中的运行时代码

| 文件 | 运行时代码 |
|------|-----------|
| `agent.ts` | `isAvailable()`, `getDefaultConfig()` (30行 switch) |
| `unified-agent.ts` | 6 个转换/类型守卫函数 |
| `channel.ts` | 7 个默认值常量 + 3 个函数 |
| `notification.ts` | `parseNotificationDate()` + 默认配置 |
| `overlay.ts` | `PixiZIndex`, `DOMZIndex` 枚举 |

### 5.3 缺失的导出

`cron.ts` 和 `voice.ts` 未从 `index.ts` 导出

### 5.4 命名风格混用

`index.ts` 中同一领域的类型混用 snake_case (`python_path`) 和 camelCase (`downloadPath`)

---

## 修复进度

### ✅ 已完成 (2026-06-01)

#### 1. 类型导入修复
- ✅ `types/cron.ts` 从 `@viben/core/shared` 导入类型
- ✅ `types/channel.ts` 从 `@viben/core/shared` 导入类型
- ✅ 移除重复的类型定义

#### 2. 重复组件合并
- ✅ 创建 `components/ui/search-bar.tsx` (合并 marketplace + skills)
- ✅ 创建 `components/ui/category-filter.tsx` (基础版本)
- ✅ 创建 `components/ui/collapsible-section.tsx` (合并 conversation + agents)
- ✅ 更新所有引用

#### 3. 命名风格统一
- ✅ 重命名 5 个 PascalCase 组件文件为 kebab-case
- ✅ 移动 `kanban/use-kanban-navigation.ts` 到 `kanban/hooks/`

### 待修复

## 优先级建议

### P0 - 紧急 (影响可维护性)

1. 拆分 `file-browser/index.tsx` (2123行)
2. 拆分 `app-store.ts` 为多个领域 store
3. ~~从 `packages/core` 导入类型，删除 desktop 重复定义~~ ✅
4. 将 `use-env-orchestrator.ts` 的 400 行 switch 提取为状态机

### P1 - 重要

1. 提取 `AgentConfigPanel` 的 39 个 props 为子组件
2. 统一数据获取模式 (React Query vs 手动 fetch)
3. ~~提取重复的 `SearchBar`, `CategoryFilter`, `CollapsibleSection`~~ ✅
4. 将 store 中的网络请求移到 hooks

### P2 - 改进

1. ~~统一文件命名 (PascalCase vs kebab-case)~~ ✅
2. 统一 `index.ts` barrel 导出模式
3. 将类型文件中的运行时代码移到工具文件
4. 提取 `useMounted`, `useWorkspaceFromParams` 等通用 hooks

---

## 相关文件

- Components: `apps/desktop/src/components/`
- Hooks: `apps/desktop/src/hooks/`
- Stores: `apps/desktop/src/stores/`
- Pages: `apps/desktop/src/pages/`
- Types: `apps/desktop/src/types/`
