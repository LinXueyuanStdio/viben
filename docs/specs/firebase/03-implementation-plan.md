# Viben Desktop 增长分析实施计划

---

## 一、概述

### 1.1 实施范围

基于《Viben Desktop 增长分析报告》中定义的 218 个事件和 `apps/desktop` 现有代码结构，本计划覆盖以下四个层面的实施：

1. **基础设施层**：建立 `src/lib/analytics/` 分析抽象层（Provider 可替换架构），建立统一的初始化入口
2. **全局埋点层**：建立类型化的事件跟踪函数库，实现应用生命周期事件（app_launch、session_start/end、page_view 等）的自动采集
3. **核心路径埋点**：对 Chat、Workspace、Onboarding、MCP 等核心业务路径实施关键事件埋点
4. **次要路径埋点**：对 Settings、Kanban、Cron、File Viewer、Skill、Pet 等辅助路径实施事件埋点

### 1.2 时间线预估

| Phase | 内容 | 预估时间 | 优先级 |
|-------|------|---------|--------|
| Phase 1 | 基础设施 | 4 小时 | P0 |
| Phase 2 | 全局埋点 | 3 小时 | P0 |
| Phase 3 | 核心路径埋点 | 5 小时 | P1 |
| Phase 4 | 次要路径埋点 | 4 小时 | P2 |
| **总计** | | **16 小时** | |

### 1.3 现有代码分析

当前状态：
- `src/lib/analytics/providers/firebase.ts`：已实现 `FirebaseAnalyticsProvider`，Provider 可替换架构
- `src/lib/analytics/` 分析抽象层已建立，业务代码通过 `useAnalytics()` hook 调用
- `src/lib/init.ts`：应用初始化入口，统一管理 Analytics Provider 注册和初始化
- `packages/core/src/services/firebase.ts` 中有 `FirebaseService`（含 `reportBug()` 和 `trackEvent()`），可用于 Gateway 侧日志收集

架构变更要点（详见 `00-analytics-architecture.md`）：
- 已实现 `src/lib/analytics/` 分析抽象层，业务代码通过 `useAnalytics()` hook 调用，不直接依赖 Firebase SDK
- Firebase 实现作为 `AnalyticsProvider` 接口的一个 Provider，未来可替换为火山引擎等后端

---

## 二、文件变更清单

### 2.1 新增文件

#### 2.1.1 分析抽象层 `src/lib/analytics/`

| # | 文件路径（绝对路径） | 用途 |
|---|---------------------|------|
| 1 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/types.ts` | 事件名称常量 + 参数类型定义（与 Provider 无关，纯类型文件） |
| 2 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/provider.ts` | `AnalyticsProvider` 接口定义 |
| 3 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/factory.ts` | 单例工厂：`setupAnalyticsProvider` / `initAnalytics` / `getProvider` / `switchProvider` |
| 4 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/context.tsx` | React Context + `AnalyticsProvider` 组件 |
| 5 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/hooks.ts` | `useAnalytics()` / `usePageView()` / `useTrackEvent()` |
| 6 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/providers/firebase.ts` | `FirebaseAnalyticsProvider` 实现（`AnalyticsProvider` 接口） |
| 7 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/index.ts` | 公共 API 入口（统一 re-export） |

#### 2.1.2 初始化入口 `src/lib/`

| # | 文件路径（绝对路径） | 用途 |
|---|---------------------|------|
| 8 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/init.ts` | 应用初始化入口（注册 Analytics Provider + 初始化 Firebase） |

### 2.2 修改文件

| # | 文件路径（绝对路径） | 变更说明 |
|---|---------------------|---------|
| 1 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/main.tsx` | （1）替换为 `initApp()` 初始化流程；<br>（2）添加 `app_launch`、`app_session_start`、`app_session_end` 事件 |
| 2 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/components/layout/app-layout.tsx` | 添加 `usePageViewTracking()` 实现 page_view 自动跟踪 |
| 3 | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/components/mobile/mobile-layout.tsx` | 添加 `usePageViewTracking()` 实现 page_view 自动跟踪 |

### 2.3 Phase 3-4 修改文件（通过 `useAnalytics().logEvent()` 新增埋点调用）

这些文件将在 Phase 3 和 Phase 4 中添加埋点调用，所有埋点通过 `useAnalytics()` hook 进行，具体范围见各阶段任务清单：

| # | 文件路径（绝对路径） | Phase | 埋点内容 |
|---|---------------------|-------|---------|
| 1 | `.../src/components/acp-chat/` 相关文件 | Phase 3 | Chat 消息发送/接收/流式响应事件 |
| 2 | `.../src/pages/workspace-detail.tsx` | Phase 3 | workspace_created, workspace_switched |
| 3 | `.../src/pages/onboarding.tsx` | Phase 3 | onboarding_* 全流程事件 |
| 4 | `.../src/pages/marketplace.tsx` | Phase 3 | mcp_marketplace_*, mcp_package_* |
| 5 | `.../src/pages/skills-market.tsx` | Phase 3 | skills_marketplace_*, skill_install_* |
| 6 | `.../src/pages/agent-detail.tsx` | Phase 3 | agent_created, agent_updated, agent_mcp_* |
| 7 | `.../src/pages/settings.tsx` | Phase 4 | settings_* 事件 |
| 8 | `.../src/pages/workspace-kanban.tsx` | Phase 4 | kanban_* 事件 |
| 9 | `.../src/pages/workspace-cron.tsx` | Phase 4 | cron_* 事件 |
| 10 | `.../src/pages/workspace-files.tsx` | Phase 4 | file_* 事件 |
| 11 | `.../src/pages/workspace-ideas.tsx` | Phase 4 | idea_*, ideas_generated |
| 12 | `.../src/pages/inspector.tsx` | Phase 4 | mcp_inspector_* 事件 |
| 13 | `.../src/pages/device-pair.tsx` | Phase 4 | device_* 事件 |
| 14 | `.../src/pages/publish.tsx` | Phase 4 | page_publish_* 事件 |
| 15 | `.../src/pages/workspace-github.tsx` | Phase 4 | github_* 事件 |
| 16 | `.../src/pages/chat-window/index.tsx` | Phase 4 | chat_window_* 事件 |
| 17 | `.../src/pages/pet-window/index.tsx` | Phase 4 | pet_* 事件 |
| 18 | `.../src/pages/screenshot-overlay/index.tsx` | Phase 4 | screenshot_* 事件 |
| 19 | `.../src/components/global-tab-bar/` 相关文件 | Phase 4 | tab_* 事件 |
| 20 | `.../src/components/notifications/` 相关文件 | Phase 4 | notification_* 事件 |
| 21 | `.../src/components/voice/` 相关文件 | Phase 4 | voice_* 事件 |
| 22 | `.../src/components/layout/sidebar.tsx` | Phase 4 | sidebar_* 事件 |
| 23 | `.../src/components/acp-chat/slash-command` 相关 | Phase 4 | slash_command_* 事件 |

---

## 三、分阶段实施计划

### Phase 1 — 基础设施（~4 小时）

**目标**：建立分析抽象层（`src/lib/analytics/`），Provider 可替换架构；建立统一的应用初始化入口。

#### 任务清单

- [ ] **1.1 创建 analytics Provider 接口和类型定义**（30 分钟）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/provider.ts`
    - 定义 `AnalyticsProvider` 接口：`initialize` / `logEvent` / `setUserProperties` / `setUserId` / `setScreenName` / `flush`
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/types.ts`
    - 定义 `AnalyticsEvents` 常量对象（235 个事件名常量）
    - 定义事件参数类型映射（`PageViewParams`、`ChatMessageParams` 等）
    - 定义 `BaseEventParams`（`app_version`、`platform`、`os_version`、`locale`、`session_id`）

- [ ] **1.2 创建 factory 单例工厂**（20 分钟）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/factory.ts`
  - 实现 `setupAnalyticsProvider(provider)` — 注册 Provider
  - 实现 `initAnalytics(config)` — 初始化已注册的 Provider
  - 实现 `getProvider()` — 获取当前 Provider 单例
  - 实现 `switchProvider(newProvider, config)` — 运行时切换 Provider

- [ ] **1.3 实现 FirebaseAnalyticsProvider**（45 分钟）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/providers/firebase.ts`
  - 实现 `FirebaseAnalyticsProvider` 类（实现 `AnalyticsProvider` 接口）
  - `initialize(config)` — 使用 Firebase SDK 的 `initializeApp` + `getAnalytics`
  - `logEvent(name, params)` — 调用 Firebase `logEvent`，DEV 模式下 console.debug 降级
  - `setUserProperties` / `setUserId` / `setScreenName` / `flush`
  - 添加延迟初始化检查（`getAnalytics` 在某些环境下可能为 null）
  - 将现有 `src/lib/firebase.ts` 的 Firebase 配置迁移到此处

- [ ] **1.4 创建 React Context + Hooks**（30 分钟）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/context.tsx`
    - `AnalyticsContext` + `AnalyticsProvider` 组件（包裹 `getProvider()` 到 Context）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/hooks.ts`
    - `useAnalytics()` — 返回 `{ logEvent }`，类型安全的埋点函数
    - `usePageView()` — 监听路由变化自动上报 `page_view` 事件
    - `useTrackEvent()` — 一次性事件上报（挂载时触发）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/index.ts`
    - 统一 re-export 所有公共 API

- [ ] **1.5 创建应用初始化入口**（20 分钟）
  - 创建 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/init.ts`
  - 实现 `initApp()` 函数：
    - 注册 `FirebaseAnalyticsProvider`
    - 初始化 Firebase Analytics
  - 幂等操作——多次调用只执行一次

- [ ] **1.6 更新 main.tsx 初始化流程**（30 分钟）
  - 导入 `initApp()` 初始化入口
  - 添加 `app_launch`、`app_session_start`、`app_session_end` 事件

- [ ] **1.7 验证 Phase 1**（30 分钟）
  - `pnpm typecheck` 通过
  - 桌面应用正常启动（无白屏）
  - 在 Firebase Console DebugView 中验证 `app_launched` 事件
  - 验证 Analytics Provider 工厂初始化流程正常

---

### Phase 2 — 全局埋点（~3 小时）

**目标**：基于 `useAnalytics()` hook 实现类型安全的全局生命周期事件自动采集。业务代码不直接依赖 Firebase SDK。

#### 任务清单

- [ ] **2.1 实现 hooks.ts 中的 usePageView**（30 分钟）
  - 在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/hooks.ts` 中实现 `usePageView()`
  - 使用 `useLocation()` 监听路由变化
  - 路由变化时自动调用 `getProvider().logEvent(AnalyticsEvents.PAGE_VIEW, {...})`
  - 参数：`page_name`、`page_path`、`previous_page_path`
  - 防抖处理（同一路由 500ms 内不重复上报）
  - 集成到 `AppLayout` 组件中（替换原来的 `usePageViewTracking`）

- [ ] **2.2 完善 types.ts 事件常量**（45 分钟）
  - 在 `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/lib/analytics/types.ts` 中完善
  - 定义完整的 `AnalyticsEvents` 常量对象（235 个事件名，按 Category 分组）
  - 定义事件参数类型映射：`PageViewParams`、`ChatMessageParams`、`WorkspaceParams`、`OnboardingParams` 等
  - 定义 `BaseEventParams`（`app_version`、`platform`、`os_version`、`locale`、`session_id`）
  - 实现 `getBaseParams()` 工具函数（从 factory getProvider 获取 session 上下文）
  - 实现 `getSessionId()` — 生成/获取持久化 session UUID（localStorage，跨日重置）

- [ ] **2.3 在 main.tsx 添加 app_launch 事件**（20 分钟）
  - 在 `main.tsx` 中 `ReactDOM.createRoot` 之前调用 `getProvider().logEvent(AnalyticsEvents.APP_LAUNCH, {...})`
  - 参数：`app_version`、`platform`、`os_version`、`is_first_launch`、`locale`
  - 实现 `isFirstLaunch()` 检测（localStorage 标记）

- [ ] **2.4 添加 session 生命周期跟踪**（20 分钟）
  - 在 `main.tsx` 中：
    - 应用启动时记录 `AnalyticsEvents.SESSION_START`
    - 使用 `document.addEventListener("visibilitychange")` 或 Tauri 窗口事件监听
    - 应用关闭/隐藏时记录 `AnalyticsEvents.SESSION_END`（`beforeunload` 事件）
  - 参数：`session_id`、`session_duration_ms`、`previous_session_duration_ms`、`session_gap_ms`

- [ ] **2.5 添加全局错误处理**（30 分钟）
  - 在 `main.tsx` 中添加：
    - `window.onerror` 监听 → `getProvider().logEvent(AnalyticsEvents.APP_CRASHED, {...})` + `Sentry.captureException()`
    - `window.addEventListener("unhandledrejection")` → 同上
  - 在 `sentry/init.ts` 中配置 `Sentry.init` 时启用 `beforeSend` 去重
  - 注意：ErrorBoundary 捕获的错误通过 ErrorBoundary 内置上报，全局处理器作为兜底

- [ ] **2.6 实现 useTrackEvent hook**（15 分钟）
  - 在 `hooks.ts` 中实现 `useTrackEvent(eventName, params?)`
  - 组件挂载时自动触发一次事件上报
  - 用于页面/组件级别的生命周期事件（如 `onboarding_started`）

- [ ] **2.7 验证 Phase 2**（20 分钟）
  - `pnpm typecheck` 通过
  - 打开应用，检查 Network 面板是否有 Firebase Analytics 请求
  - 切换页面，检查 `page_view` 事件上报（通过 `usePageView()`）
  - 检查 `app_launch` 事件参数完整性
  - 触发 JS 错误，验证全局错误处理上报
  - 验证 Session UUID 在 localStorage 中持久化
  - 验证业务代码中无直接 `import from "firebase/analytics"` 残留

---

### Phase 3 — 核心路径埋点（~5 小时）

**目标**：通过 `useAnalytics().logEvent()` 对 Chat 对话、Workspace 管理、Onboarding 引导、MCP/Skills 市场等核心业务路径实施事件埋点。业务代码不直接 import Firebase SDK。

#### 任务清单

- [ ] **3.1 Chat 流程埋点**（1.5 小时）
  - 事件范围：`chat_session_created`, `chat_message_sent`, `chat_stream_started`, `chat_first_token_received`, `chat_stream_completed`, `chat_stream_stopped`, `chat_tool_use_displayed`, `chat_plan_approved/rejected`, `chat_question_answered`, `chat_artifact_clicked`, `chat_session_switched`, `chat_session_deleted`, `chat_slash_command_used`
  - 在 `AcpChat` 组件及 WebSocket/SSE 消息处理逻辑中通过 `useAnalytics().logEvent()` 调用
  - 关键时间点测量：`time_to_first_token_ms`（记录发送时间到首 token 时间的差值）
  - 注意：需在响应式状态流中识别消息生命周期事件

- [ ] **3.2 Workspace 管理埋点**（45 分钟）
  - 事件范围：`workspace_created`, `workspace_create_failed`, `workspace_switched`, `workspace_deleted`, `workspace_settings_opened`
  - 在 `WorkspaceDetailPage`、`AddWorkspaceModal`、`WorkspaceSettingsDialog` 中通过 `useAnalytics().logEvent()` 调用
  - 参数：`workspace_name`, `workspace_path_depth`, `has_git`, `workspace_id`

- [ ] **3.3 Onboarding 流程埋点**（1 小时）
  - 事件范围：`onboarding_started`, `onboarding_step_viewed/completed/failed`, `onboarding_env_check_completed`, `onboarding_python_installed`, `onboarding_claude_installed`, `onboarding_oauth_started/completed`, `onboarding_gateway_started`, `onboarding_agent_created`, `onboarding_completed`, `onboarding_skipped`
  - 在 `OnboardingPage` 和 `OnboardingWizard` 各步骤组件中通过 `useAnalytics().logEvent()` 调用
  - 关键指标：`duration_ms`（每个步骤耗时）、`success`（步骤是否成功）
  - 注意：引导流程可能多次进入，需正确关联同一 session

- [ ] **3.4 Agent 配置埋点**（45 分钟）
  - 事件范围：`agent_created`, `agent_updated`, `agent_deleted`, `agent_duplicated`, `agent_default_set`, `agent_mcp_server_added/removed`, `agent_skill_enabled`, `agent_memory_edited`, `agent_variable_added`, `agent_template_promoted`, `agent_from_template_created`
  - 在 `AgentDetailPage`（Debug/Settings Tab）、`AgentConfigPanel`、`AgentMcpDialog`、`AgentSkillsDialog`、`AgentMemoryDialog` 中通过 `useAnalytics().logEvent()` 调用
  - 参数：`agent_id`, `agent_name`, `scope`, `provider_id`, `model_id`, `fields_changed[]`

- [ ] **3.5 OAuth 认证埋点**（20 分钟）
  - 事件范围：`auth_login_attempt`, `auth_login_success`, `auth_login_failed`, `auth_token_refreshed`, `auth_session_expired`, `auth_logout`
  - 在 `LoginDialog`、OAuth 回调处理、`AuthGuard`、token 刷新逻辑中通过 `useAnalytics().logEvent()` 调用
  - 参数：`provider`, `method`, `user_id_hash`（SHA-256 哈希，非明文），`is_new_user`, `duration_ms`

- [ ] **3.6 MCP 市场 + Skills 市场埋点**（30 分钟）
  - MCP 事件：`mcp_marketplace_opened/searched/category_filtered/source_switched`, `mcp_package_detail_viewed`, `mcp_package_install_started/completed/failed`, `mcp_package_uninstalled`
  - Skills 事件：`skills_marketplace_opened/searched`, `skills_source_switched`, `skill_detail_viewed`, `skill_install_started/completed/failed`, `skill_uninstalled`
  - 在 `MarketplacePage`、`SkillsMarketPage`、`PackageCard`、`PackageDetail`、安装逻辑中通过 `useAnalytics().logEvent()` 调用
  - 参数：`package_name`, `package_version`, `skill_id`, `skill_name`, `install_source`, `duration_ms`

- [ ] **3.7 Group Chat 埋点**（15 分钟）
  - 事件范围：`group_chat_created`, `group_chat_member_added`, `group_chat_message_sent`, `group_chat_ws_connected`
  - 在群聊创建/管理组件中通过 `useAnalytics().logEvent()` 调用

- [ ] **3.8 验证 Phase 3**（30 分钟）
  - `pnpm typecheck` 通过
  - 走通完整 Onboarding 流程，验证每一步事件上报
  - 发送 Chat 消息，验证消息生命周期事件链完整
  - 创建工作区，验证 `workspace_created` 事件
  - 安装一个 MCP 包/Skill，验证安装漏斗事件
  - 在 Firebase DebugView 中确认事件实时可见
  - 确认所有业务代码中无 `import { logEvent } from "firebase/analytics"` 残留

---

### Phase 4 — 次要路径埋点（~4 小时）

**目标**：通过 `useAnalytics().logEvent()` 对 Settings、Kanban、Cron、File Viewer、Pet、Tab 等辅助路径实施事件埋点。

#### 任务清单

- [ ] **4.1 Settings 操作埋点**（30 分钟）
  - 事件范围：`settings_opened`, `settings_section_switched`, `settings_theme_changed`, `settings_language_changed`, `settings_shortcut_modified`, `settings_notification_prefs_changed`, `settings_provider_created/tested`, `settings_model_created/default_changed`, `settings_api_key_configured/validated`, `settings_sandbox_config_changed`, `settings_pet_changed`, `settings_terminal_font_changed`, `settings_developer_prefs_changed`
  - 在 `SettingsPage` 及各 Section 组件中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.2 Kanban 操作埋点**（45 分钟）
  - 事件范围：`kanban_view_switched`, `kanban_task_created/updated/moved/deleted/status_changed`, `kanban_comment_added`, `kanban_reaction_toggled`, `kanban_filter_applied`, `kanban_search_used`, `kanban_batch_operation`, `kanban_queue_settings_changed`, `kanban_task_enqueued`, `kanban_task_stuck_detected`
  - 在 `WorkspaceKanbanPage`、`KanbanBoardView`、`CreateTaskDialog`、`TaskDetailDialog`、`QueueSettingsModal` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.3 Cron Job 执行埋点**（30 分钟）
  - 事件范围：`cron_job_created/updated/deleted/enabled/disabled`, `cron_job_run_manual`, `cron_job_executed`, `cron_job_execution_failed`, `cron_logs_viewed`, `cron_batch_operation`
  - 在 `WorkspaceCronPage`（三步向导）、执行日志弹窗中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.4 File Browser 操作埋点**（20 分钟）
  - 事件范围：`file_browser_opened`, `file_view_switched`, `file_directory_navigated`, `file_previewed/failed`, `file_created/deleted/renamed`, `file_search_used`, `file_external_opened`
  - 在 `WorkspaceFilesPage`、`FileSidebar`、`FileListView`、`FilePreview` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.5 Ideas 管理埋点**（15 分钟）
  - 事件范围：`idea_type_created`, `ideas_generated`, `idea_promoted_to_task`, `idea_deleted`, `idea_file_saved`
  - 在 `WorkspaceIdeasPage` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.6 MCP Inspector 埋点**（20 分钟）
  - 事件范围：`mcp_inspector_opened/connected/connect_failed`, `mcp_inspector_tool_called/tool_call_result`, `mcp_inspector_config_saved/loaded`, `mcp_inspector_log_level_changed`, `mcp_inspector_resource_read`
  - 在 `InspectorPage`、`InspectorTools`、`ConfigManager` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.7 Page Publish 埋点**（15 分钟）
  - 事件范围：`page_created`, `page_content_updated`, `page_publish_started/completed/failed`, `page_publish_rollback`, `page_asset_uploaded`
  - 在 `PublishPage`、`WorkspacePage` 编辑器中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.8 Pet 窗口交互埋点**（15 分钟）
  - 事件范围：`pet_displayed/hidden`, `pet_dragged`, `pet_clicked`, `pet_hovered`, `pet_chat_opened`
  - 在 `PetWindowPage` 及相关动画/交互逻辑中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.9 多窗口 & Tab 管理埋点**（20 分钟）
  - 窗口事件：`chat_window_opened/closed`, `page_preview_window_opened`, `page_preview_tab_opened/navigated`, `screenshot_overlay_opened/confirmed/cancelled`
  - Tab 事件：`tab_opened/closed/switched/reordered`
  - 在 `GlobalTabBar`、窗口入口逻辑中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.10 Device Pairing 埋点**（15 分钟）
  - 事件范围：`device_pair_page_opened`, `device_qr_code_generated`, `device_paired/disconnected`, `device_ws_message_sent`, `mobile_connect_attempt`, `mobile_chat_message_sent`
  - 在 `DevicePairPage`、`ConnectPage`、`MobileChatPage` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.11 Voice 交互埋点**（15 分钟）
  - 事件范围：`voice_started/stopped`, `voice_wake_word_detected`, `voice_speech_recognized`, `voice_response_started/completed`, `voice_error`
  - 在 `VoiceAgent`、`VoiceSubtitleLayer` 相关组件中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.12 GitHub 集成埋点**（15 分钟）
  - 事件范围：`github_integration_opened`, `github_issues_loaded`, `github_issue_selected`, `github_auto_fix_created/completed`
  - 在 `WorkspaceGitHubPage` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.13 通知、Slash Command 及其他埋点**（20 分钟）
  - Notification：`notification_received/clicked/marked_read/deleted`, `notification_center_opened`
  - Slash Command：`slash_command_panel_opened`, `slash_command_executed`
  - Search：`search_global_used`, `keyboard_shortcut_used`
  - Sidebar：`sidebar_section_toggled`, `sidebar_resized`
  - 在各对应组件中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.14 Offline & Sync 埋点**（10 分钟）
  - 事件范围：`cache_accessed`, `sync_started/completed`, `offline_mode_entered/exited`
  - 在 `OfflineIndicator`、`CacheManager`、同步逻辑中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.15 Presentation 模式埋点**（10 分钟）
  - 事件范围：`presentation_started/stopped`, `presentation_step_completed`
  - 在 `PresentationLayer`、`OverlayRoot` 中通过 `useAnalytics().logEvent()` 调用

- [ ] **4.16 验证 Phase 4**（30 分钟）
  - `pnpm typecheck` 通过
  - 操作 Settings 各项设置，验证事件上报正确
  - 创建/移动 Kanban 任务，验证完整任务生命周期事件
  - 创建 Cron Job，手动运行，验证执行事件
  - 浏览文件，切换视图，验证文件操作事件
  - 打开 Pet 窗口，拖拽/点击宠物，验证交互事件
  - 在 Firebase DebugView 中确认所有新增事件
  - 确认所有业务代码中无直接 `import from "firebase/analytics"` 残留（）仅 `analytics/providers/firebase.ts` 允许 import Firebase SDK）

---

## 四、关键代码示例

### 4.1 分析抽象层核心代码

#### factory.ts — 单例工厂

```typescript
// src/lib/analytics/factory.ts

import type { AnalyticsProvider } from './provider';

let _provider: AnalyticsProvider | null = null;
let _initialized = false;

/**
 * 设置当前分析 Provider。必须在应用启动时调用一次。
 *
 * @example
 * import { FirebaseAnalyticsProvider } from './providers/firebase';
 * setupAnalyticsProvider(new FirebaseAnalyticsProvider());
 * await initAnalytics({ apiKey: '...', ... });
 */
export function setupAnalyticsProvider(provider: AnalyticsProvider): void {
  if (_provider) {
    console.warn('[analytics] Provider already set, replacing:', _provider.name, '→', provider.name);
  }
  _provider = provider;
}

export async function initAnalytics(config: Record<string, unknown>): Promise<void> {
  if (!_provider) throw new Error('[analytics] No provider registered. Call setupAnalyticsProvider() first.');
  await _provider.initialize(config);
  _initialized = true;
}

/** 获取当前 Provider 单例（内部使用） */
export function getProvider(): AnalyticsProvider {
  if (!_provider) throw new Error('[analytics] No provider registered.');
  return _provider;
}

/** 运行时切换 Provider（如远程配置下发切换指令） */
export async function switchProvider(
  newProvider: AnalyticsProvider,
  config: Record<string, unknown>
): Promise<void> {
  await _provider?.flush();
  _provider = newProvider;
  await _provider.initialize(config);
}
```

#### hooks.ts — React Hooks

```typescript
// src/lib/analytics/hooks.ts

import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getProvider } from './factory';
import { AnalyticsEvents } from './types';

/**
 * 核心 hook：返回类型安全的 logEvent 函数。
 * 业务代码统一入口，不直接依赖 Firebase SDK。
 *
 * @example
 * const { logEvent } = useAnalytics();
 * logEvent(AnalyticsEvents.PAGE_VIEW, { page_name: 'workspace', page_path: '/workspace' });
 */
export function useAnalytics() {
  const provider = getProvider();

  const logEvent = useCallback(
    (eventName: string, params?: Record<string, unknown>) => {
      provider.logEvent(eventName, params);
    },
    [provider]
  );

  return { logEvent };
}

/**
 * 自动页面浏览跟踪 hook。
 * 监听路由变化，自动上报 page_view 事件。
 * 在 AppLayout 中调用一次即可。
 */
export function usePageView(): void {
  const location = useLocation();
  const previousPathRef = useRef<string>('');
  const lastTrackedRef = useRef<{ path: string; time: number }>({ path: '', time: 0 });

  useEffect(() => {
    const currentPath = location.pathname;
    const now = Date.now();

    // 防抖：同一路径 500ms 内不重复上报
    if (lastTrackedRef.current.path === currentPath && now - lastTrackedRef.current.time < 500) {
      return;
    }

    const provider = getProvider();
    provider.logEvent(AnalyticsEvents.PAGE_VIEW, {
      page_name: document.title || '',
      page_path: currentPath,
      previous_page_path: previousPathRef.current || undefined,
    });

    lastTrackedRef.current = { path: currentPath, time: now };
    previousPathRef.current = currentPath;
  }, [location.pathname]);
}

/**
 * 一次性事件上报 hook（组件挂载时触发）。
 *
 * @example
 * useTrackEvent(AnalyticsEvents.ONBOARDING_STARTED, { source: 'app_launch' });
 */
export function useTrackEvent(eventName: string, params?: Record<string, unknown>): void {
  useEffect(() => {
    getProvider().logEvent(eventName, params);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
```

#### types.ts — 事件常量

```typescript
// src/lib/analytics/types.ts

/** 事件名称常量 —— 与 Provider 无关，是唯一的真相来源 */
export const AnalyticsEvents = {
  // Navigation
  PAGE_VIEW:              'page_view',
  TAB_SWITCHED:           'tab_switched',
  // Lifecycle
  APP_LAUNCH:             'app_launch',
  SESSION_START:          'session_start',
  SESSION_END:            'session_end',
  APP_CRASHED:            'app_crashed',
  APP_ERROR_BOUNDARY_TRIGGERED: 'app_error_boundary_triggered',
  // Chat
  CHAT_MESSAGE_SENT:      'chat_message_sent',
  CHAT_MESSAGE_RECEIVED:  'chat_message_received',
  CHAT_STREAM_STARTED:    'chat_stream_started',
  CHAT_STREAM_COMPLETED:  'chat_stream_completed',
  // ... 其余 230+ 事件常量
} as const;

/** 通用基础参数 */
export interface BaseEventParams {
  app_version: string;
  platform: string;
  os_version: string;
  locale: string;
  session_id: string;
}

// Session 管理（放在 types.ts 而非 hook 中，因为 factory 也需要使用）
const SESSION_KEY = 'viben_session_id';
const SESSION_DATE_KEY = 'viben_session_date';

export function getSessionId(): string {
  const today = new Date().toISOString().split('T')[0];
  const storedDate = localStorage.getItem(SESSION_DATE_KEY);
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId || storedDate !== today) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(SESSION_DATE_KEY, today);
  }
  return sessionId;
}
```

### 4.2 Sentry 初始化配置

```typescript
// src/lib/sentry/init.ts

import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

export function initializeSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn && import.meta.env.DEV) {
    console.info("[Sentry] DSN not configured, skipping Sentry initialization (dev mode)");
    return;
  }

  Sentry.init({
    dsn: dsn || "",
    integrations: [
      Sentry.browserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // 性能监控采样率
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    // Session Replay 采样率
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    // 错误 Replay 采样率
    replaysOnErrorSampleRate: 1.0,
    // 环境标识
    environment: import.meta.env.PROD ? "production" : "development",
    // 过滤 PII
    beforeSend(event) {
      // 过滤敏感请求头
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
      return event;
    },
  });
}
```

### 4.3 ErrorBoundary 关键代码

```typescript
// src/lib/sentry/error-boundary.tsx

import { Component, type ReactNode, type ErrorInfo } from "react";
import * as Sentry from "@sentry/react";
import { getProvider } from "@/lib/analytics/factory";
import { AnalyticsEvents } from "@/lib/analytics/types";
import { useTranslation } from "react-i18next";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  onReset?: () => void;
  /** 窗口标识（用于区分不同窗口的错误来源） */
  windowId?: string;
}

interface ErrorFallbackProps {
  error: Error | null;
  resetError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 1. 上报到 Sentry
    Sentry.withScope((scope) => {
      scope.setTag("window_id", this.props.windowId || "main");
      scope.setContext("errorInfo", {
        componentStack: errorInfo.componentStack ?? null,
      });
      Sentry.captureException(error);
    });

    // 2. 通过 Analytics 抽象层上报（不直接依赖 Firebase SDK）
    try {
      const provider = getProvider();
      provider.logEvent(AnalyticsEvents.APP_ERROR_BOUNDARY_TRIGGERED, {
        error_type: error.name,
        error_message: error.message.substring(0, 500),
        component_stack: (errorInfo.componentStack ?? "").substring(0, 1000),
        route_path: typeof window !== "undefined" ? window.location.pathname : "",
        window_id: this.props.windowId || "main",
      });
    } catch {
      // Provider 可能尚未初始化，静默忽略
    }

    // 3. 开发环境控制台日志
    if (import.meta.env.DEV) {
      console.error("[AppErrorBoundary] Caught error:", error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback({
            error: this.state.error,
            resetError: this.handleReset,
          });
        }
        return this.props.fallback;
      }
      return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

/** 默认错误回退 UI（使用 hooks 需要函数组件包装） */
function DefaultErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground p-4">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold mb-2">
          {t("error_boundary.title", "出现了一些问题")}
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message || t("error_boundary.unknown", "未知错误")}
        </p>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          {t("error_boundary.reload", "重新加载")}
        </button>
      </div>
    </div>
  );
}

export { AppErrorBoundary };
export type { ErrorBoundaryProps, ErrorFallbackProps };
```

### 4.4 main.tsx 初始化流程

```typescript
// src/main.tsx — 应用入口初始化流程

import React from "react";
import ReactDOM from "react-dom/client";
import { FirebaseAnalyticsProvider } from "@/lib/analytics/providers/firebase";
import {
  setupAnalyticsProvider,
  initAnalytics,
  getProvider,
} from "@/lib/analytics/factory";
import { AnalyticsProvider } from "@/lib/analytics/context";
import { AnalyticsEvents, getSessionId } from "@/lib/analytics/types";
import { AppErrorBoundary } from "@/lib/sentry/error-boundary";
import { initializeSentry } from "@/lib/sentry/init";
import App from "./App";

// === 1. 初始化 Sentry（独立于 Analytics 抽象层） ===
initializeSentry();

// === 2. 注册并初始化分析 Provider（将来切换后端只需改这一行 import） ===
setupAnalyticsProvider(new FirebaseAnalyticsProvider());

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

await initAnalytics(firebaseConfig);

// === 3. 上报应用启动事件 ===
const provider = getProvider();
const isFirstLaunch = !localStorage.getItem("viben_launched_before");
if (isFirstLaunch) {
  localStorage.setItem("viben_launched_before", "true");
}

provider.logEvent(AnalyticsEvents.APP_LAUNCH, {
  app_version: __APP_VERSION__,
  platform: navigator.platform,
  os_version: navigator.userAgent,
  is_first_launch: isFirstLaunch,
  locale: navigator.language,
  session_id: getSessionId(),
});

// === 4. Session 生命周期 ===
provider.logEvent(AnalyticsEvents.SESSION_START, {
  session_id: getSessionId(),
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    provider.logEvent(AnalyticsEvents.SESSION_END, {
      session_id: getSessionId(),
    });
  }
});

window.addEventListener("beforeunload", () => {
  provider.logEvent(AnalyticsEvents.SESSION_END, {
    session_id: getSessionId(),
  });
  provider.flush();
});

// === 5. 全局错误兜底（ErrorBoundary 无法捕获的错误） ===
window.onerror = (message, source, lineno, colno, error) => {
  try {
    provider.logEvent(AnalyticsEvents.APP_CRASHED, {
      error_type: error?.name ?? "Error",
      error_message: String(message).substring(0, 500),
    });
  } catch { /* ignore */ }
};

window.addEventListener("unhandledrejection", (event) => {
  try {
    provider.logEvent(AnalyticsEvents.APP_CRASHED, {
      error_type: event.reason?.name ?? "UnhandledRejection",
      error_message: String(event.reason?.message ?? event.reason).substring(0, 500),
    });
  } catch { /* ignore */ }
});

// === 6. React 渲染 ===
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AnalyticsProvider>
      <AppErrorBoundary windowId="main">
        <App />
      </AppErrorBoundary>
    </AnalyticsProvider>
  </React.StrictMode>
);
```

**关键点**：
- `getProvider()` 在初始化完成前调用会抛出错误，因此初始化必须在渲染前完成
- `AnalyticsProvider` Context 组件包裹整个应用，但 hooks 实际上直接调用 `getProvider()`（同步获取，不需要 Context 传递）
- 全局错误处理器放在 `ErrorBoundary` 之外作为兜底，捕获非 React 渲染树的错误

---

## 五、测试策略

### 5.1 单元测试

| 测试模块 | 测试内容 | 工具 |
|---------|---------|------|
| `factory.test.ts` | `getProvider()` 抛出异常当未注册 Provider；`switchProvider()` 正确切换；`initAnalytics()` 在未注册时抛异常 | vitest |
| `types.test.ts` | `AnalyticsEvents` 常量完整性；`BaseEventParams` 类型约束；`getSessionId()` 持久化和跨日重置 | vitest + tsc |
| `hooks.test.tsx` | `useAnalytics()` 返回 `logEvent` 函数；`usePageView()` 防抖行为；`useTrackEvent()` 挂载触发 | vitest + @testing-library/react |
| `firebase-provider.test.ts` | `FirebaseAnalyticsProvider` 的 `logEvent`/`setUserId` 降级行为（mock Firebase SDK） | vitest |
| `error-boundary.test.tsx` | ErrorBoundary 捕获错误后的 fallback 渲染；`onReset` 回调触发；Sentry scope 设置正确性 | vitest + @testing-library/react |

### 5.2 集成测试

| 测试场景 | 测试内容 |
|---------|---------|
| ErrorBoundary + Sentry 集成 | 模拟 `Sentry.captureException`，验证错误对象正确传递 |
| ErrorBoundary + Analytics 集成 | Mock `getProvider().logEvent`，验证 `app_error_boundary_triggered` 事件参数 |
| Provider 可替换性 | 用 mock AnalyticsProvider 替换 FirebaseAnalyticsProvider，验证业务代码无需改动 |
| 窗口隔离性 | 在子窗口中触发错误，验证不影响主窗口（Tauri 多 webview 天然隔离） |
| 全局错误处理兜底 | mock `window.onerror`，验证非 React 错误仍被捕获 |

### 5.3 端到端验证

- **开发环境 Debug 模式**：设置 `VITE_DEBUG_ANALYTICS=true` 环境变量，所有 `logEvent` 调用输出到 console，方便人工验证
- **Firebase DebugView**：本地开发时启用 Firebase Analytics Debug Mode，在 Firebase Console > Analytics > DebugView 实时查看事件
- **Sentry 测试事件**：开发环境故意触发 `Sentry.captureMessage("test")` 确认事件到达
- **关键漏斗验证**：手动走通 Onboarding 完整流程，在 DebugView 中确认所有 12 个 onboarding 事件按序出现
- **Provider 切换验证**：用 mock Provider 替换 FirebaseAnalyticsProvider，验证事件输出到 console 而非 Firebase

---

## 六、依赖关系图

```
Phase 1 (基础设施)
├── 1.1 provider.ts + types.ts 创建
├── 1.2 factory.ts (依赖 1.1)
├── 1.3 FirebaseAnalyticsProvider (依赖 1.1, 1.2)
├── 1.4 context.tsx + hooks.ts + index.ts (依赖 1.2, 1.1)
├── 1.5 安装 @sentry/react
├── 1.6 Sentry 初始化 (依赖 1.5)
├── 1.7 ErrorBoundary 组件 (依赖 1.6, 1.2)  ← 使用 getProvider() 而非直接 import Firebase
├── 1.8 main.tsx 初始化流程 (依赖 1.3, 1.4, 1.6, 1.7)
├── 1.9 替换 App.tsx ErrorBoundary (依赖 1.7)
├── 1.10 替换 MobileApp.tsx ErrorBoundary (依赖 1.7)
├── 1.11 子窗口 ErrorBoundary (依赖 1.7)
├── 1.12 删除旧 firebase.ts (依赖 1.8 完成)
└── 1.13 验证 (依赖 1.1-1.12)
        │
        ▼
Phase 2 (全局埋点 — 全部通过 useAnalytics() hook)
├── 2.1 usePageView 实现 (依赖 1.4 hooks.ts, 1.2 factory)
├── 2.2 types.ts 事件常量完善 (依赖 1.1)
├── 2.3 app_launch 事件 (依赖 1.8, 2.2)
├── 2.4 session 生命周期 (依赖 1.8, 2.2)
├── 2.5 全局错误处理 (依赖 1.8, 1.6, 2.2)
├── 2.6 useTrackEvent hook (依赖 1.4 hooks.ts)
└── 2.7 验证 (依赖 2.1-2.6)
        │
        ▼
Phase 3 (核心路径埋点 — 全部通过 useAnalytics().logEvent())
├── 3.1 Chat 流程 (依赖 1.4 useAnalytics hook)
├── 3.2 Workspace 管理 (依赖 1.4)
├── 3.3 Onboarding 流程 (依赖 1.4)
├── 3.4 Agent 配置 (依赖 1.4)
├── 3.5 OAuth 认证 (依赖 1.4)
├── 3.6 MCP/Skills 市场 (依赖 1.4)
├── 3.7 Group Chat (依赖 1.4)
└── 3.8 验证 (依赖 3.1-3.7)
        │
        ▼
Phase 4 (次要路径埋点 — 全部通过 useAnalytics().logEvent())
├── 4.1 Settings (依赖 1.4)
├── 4.2 Kanban (依赖 1.4)
├── 4.3 Cron Job (依赖 1.4)
├── 4.4 File Browser (依赖 1.4)
├── 4.5 Ideas (依赖 1.4)
├── 4.6 MCP Inspector (依赖 1.4)
├── 4.7 Page Publish (依赖 1.4)
├── 4.8 Pet (依赖 1.4)
├── 4.9 多窗口 & Tab (依赖 1.4)
├── 4.10 Device Pairing (依赖 1.4)
├── 4.11 Voice (依赖 1.4)
├── 4.12 GitHub (依赖 1.4)
├── 4.13 Notification/Slash/Search (依赖 1.4)
├── 4.14 Offline & Sync (依赖 1.4)
├── 4.15 Presentation (依赖 1.4)
└── 4.16 验证 (依赖 4.1-4.15)
```

**关键依赖说明**：
- Phase 1 的所有子任务是 Phase 2-4 的硬依赖（必须先有基础设施才能埋点）
- Phase 1 的核心交付是 `src/lib/analytics/` 抽象层（provider + factory + hooks），Phase 2-4 的业务埋点全部通过 `useAnalytics()` hook 调用，不直接依赖 Firebase SDK
- Phase 1.3（`FirebaseAnalyticsProvider`）和 1.4（hooks）是 Phase 2-4 所有埋点任务的直接依赖
- Phase 3 和 Phase 4 的各个子任务之间基本独立，可以并行实施
- `@sentry/react` 安装（1.5）阻塞 Sentry 初始化（1.6），进而阻塞 ErrorBoundary（1.7）
- ErrorBoundary（1.7）通过 `getProvider().logEvent()` 上报错误，不直接依赖 Firebase SDK
