# Viben Desktop 分析事件定义规范

> **日期**: 2026-06-29  
> **版本**: 1.0  
> **状态**: 草案

---

## 一、概述

Viben Desktop 分析系统采用 **Firebase Analytics** 单通道架构：

- **Firebase Analytics**：负责用户行为事件采集、转化漏斗分析、用户留存追踪。所有用户交互事件（点击、页面浏览、功能使用）通过 `logEvent()` 上报至 Firebase，在 Google Analytics 控制台进行聚合分析。
- 通过 `session_id` 和 `user_id_hash` 实现用户行为关联，可按用户维度查询完整行为序列。

本规范定义了完整的埋点事件体系，已在 30+ 模块中完成接入。

### 设计原则

1. **事件名统一使用 snake_case**，参数名也使用 snake_case。
2. 每个事件携带必要的上下文参数，但不携带可派生或可关联获取的数据。
3. 事件按 category 分为六大类：`navigation`、`engagement`、`conversion`、`error`、`performance`、`lifecycle`。
4. 关键转化节点的事件必须包含 `duration_ms` 和 `success` 参数。
5. 错误事件必须包含 `error_type` 和 `error_message`，不包含用户隐私数据。

---

## 二、用户路径清单

### 路径1：首次启动引导 (Onboarding)

- **路径名称**：首次启动引导
- **用户目标**：完成从零到可用的初始化流程，创建首个智能体，进入工作区
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | HomeRedirect | 应用启动，检测 onboarding_completed 状态 | app_version, platform, is_first_launch |
| 2 | OnboardingPage → WelcomePage | 查看欢迎页，点击"开始" | step_name: welcome |
| 3 | EnvCheckPage | 环境检查自动运行(Git/Node/Python) | git_available, node_available, python_available |
| 4 | EnvCheckPage | 查看检查结果，点击修复/下一步 | failed_checks_count |
| 5 | StepPython | Python 环境检查/安装 | python_version, install_method |
| 6 | StepClaude | Claude CLI 检查/安装 | claude_version, install_method |
| 7 | StepLogin | 点击 GitHub OAuth 登录按钮 | provider: github |
| 8 | 浏览器 OAuth 页面 | 在浏览器中授权应用 | provider, auth_method: oauth |
| 9 | OAuth 回调 | 回调到 viben:// deep-link | provider |
| 10 | StepGateway | Gateway 检查/启动 | gateway_version, start_method |
| 11 | StepAgentSetup | 配置首个 Agent(Name/Model/Provider) | agent_name, provider_id, model_id |
| 12 | OnboardingPage | 引导完成，跳转至工作区 | total_duration_ms, total_steps |

- **覆盖事件**：onboarding_started, onboarding_step_viewed, onboarding_step_completed, onboarding_step_failed, onboarding_env_check_completed, onboarding_python_installed, onboarding_claude_installed, onboarding_oauth_started, onboarding_oauth_completed, onboarding_gateway_started, onboarding_agent_created, onboarding_completed, onboarding_skipped

---

### 路径2：OAuth 认证登录

- **路径名称**：OAuth 认证登录
- **用户目标**：通过 GitHub OAuth 建立用户身份，解锁完整功能
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | LoginDialog | 点击 GitHub OAuth 登录按钮 | provider: github, method: oauth |
| 2 | 浏览器 OAuth 页面 | 浏览器打开 OAuth 授权页面 | provider |
| 3 | 浏览器 OAuth 页面 | 用户授权应用 | provider |
| 4 | OAuth 回调 | 回调到 viben:// deep-link | provider |
| 5 | Gateway | Gateway 交换 token | provider |
| 6 | AuthGuard | JWT 写入 auth-store + localStorage | user_id_hash, is_new_user |
| 7 | AuthGuard | 认证状态更新，界面解锁 | user_id_hash |

- **覆盖事件**：auth_login_attempt, auth_login_success, auth_login_failed, auth_token_refreshed, auth_session_expired, auth_logout

---

### 路径3：创建工作区 (Workspace Creation)

- **路径名称**：创建工作区并配置
- **用户目标**：建立工作环境，开始核心工作流
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Sidebar | 点击侧边栏"添加工作区"按钮 | source: sidebar |
| 2 | AddWorkspaceModal | 填写工作区路径和名称 | workspace_name, workspace_path_depth, has_git |
| 3 | AddWorkspaceModal | 确认创建 | workspace_name |
| 4 | WorkspaceDetailPage | 自动跳转至新工作区主页 | workspace_id |
| 5 | WorkspaceDetailPage | 查看工作区 Dock(macOS 风格) | workspace_id |
| 6 | WorkspaceSettingsDialog | 点击工作区设置，修改配置 | workspace_id, section |
| 7 | WorkspaceDetailPage | 可选：自动发现智能体 | workspace_id, discovery_method |

- **覆盖事件**：workspace_created, workspace_create_failed, workspace_switched, workspace_deleted, workspace_settings_opened, agent_discovery_started, agent_discovery_completed

---

### 路径4：AI 对话交互 (Chat Interaction)

- **路径名称**：基础 AI 对话
- **用户目标**：与 AI 智能体进行对话，完成代码生成、问题解答等任务
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceDetailPage → Dock | 点击 Chat 进入聊天页 | workspace_id |
| 2 | WorkspaceChatPage → LeftPanel | 选择智能体/执行器/群聊 | agent_id, executor_type |
| 3 | TripleSelector | 选择 Agent → Model → Workspace | agent_id, model_id, workspace_id |
| 4 | ChatInput | 输入消息 | message_length, has_attachment |
| 5 | ChatInput | 发送消息(Enter 或点击发送) | message_type |
| 6 | Gateway SSE | Gateway 通过 SSE 流式返回响应 | session_id, agent_id, model_id |
| 7 | ChatArea | 消息逐步渲染(text/tool_use/tool_result/plan) | tool_calls_count |
| 8 | RightSidebar | 查看右侧 Artifacts/工具使用 | artifact_type |
| 9 | ChatArea | 可选：停止生成、审批 Plan、回答 Question | stop_reason / plan_type / question_type |
| 10 | ChatArea | 继续对话或切换会话 | session_id |

- **覆盖事件**：chat_session_created, chat_message_sent, chat_stream_started, chat_first_token_received, chat_stream_completed, chat_stream_stopped, chat_tool_use_displayed, chat_plan_approved, chat_plan_rejected, chat_question_answered, chat_artifact_clicked, chat_session_switched, chat_session_renamed, chat_session_deleted, chat_session_pinned, chat_session_archived, chat_messages_cleared, chat_context_settings_changed, chat_mode_switched, chat_slash_command_used, chat_message_search_used

---

### 路径5：高级 Agent 配置

- **路径名称**：创建和配置自定义智能体
- **用户目标**：自定义 AI 行为，配置 MCP/Skills/Memory 等高级功能
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceAgentsPage | 进入智能体管理页 | workspace_id |
| 2 | WorkspaceAgentsPage | 点击"新建智能体"按钮 | source: agents_page |
| 3 | AgentDetailPage | 填写名称/描述/位置(workspace/global) | agent_name, scope |
| 4 | AgentDetailPage → Settings Tab | 编辑 System Prompt | has_system_prompt_changed |
| 5 | ProviderModelSelector | 选择 Provider 和 Model | provider_id, model_id |
| 6 | Settings Tab | 调整 Temperature 等参数(Slider) | fields_changed |
| 7 | AgentMcpDialog | 配置 MCP 服务器 | mcp_server_name, mcp_server_type |
| 8 | AgentSkillsDialog | 启用/禁用 Skills | skill_name |
| 9 | AgentMemoryDialog | 编辑 MEMORY.md | memory_size_bytes |
| 10 | AgentVariablesSection | 管理自定义变量 | variable_key |
| 11 | AgentDetailPage | 保存配置(POST/PUT /api/agents) | agent_id, fields_changed |
| 12 | AgentDetailPage → Debug Tab | 测试对话 | agent_id |

- **覆盖事件**：agent_created, agent_updated, agent_deleted, agent_duplicated, agent_default_set, agent_mcp_server_added, agent_mcp_server_removed, agent_skill_enabled, agent_memory_edited, agent_variable_added, agent_template_promoted, agent_from_template_created

---

### 路径6：群聊协作

- **路径名称**：创建群聊并多人协作
- **用户目标**：通过多智能体群聊完成复杂协作任务
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceChatPage | 点击创建群聊 | workspace_id |
| 2 | 群聊创建对话框 | 添加智能体成员 | members_count |
| 3 | 群聊创建对话框 | 发起群聊会话 | group_name |
| 4 | 群聊会话 | 发送消息到群聊 | session_id, message_type, has_mention |
| 5 | WebSocket | WebSocket 实时接收各成员回复 | group_id, session_id |
| 6 | 群聊会话列表 | 查看群聊会话列表 | group_id |
| 7 | 群聊会话列表 | 归档/删除群聊会话 | group_id |

- **覆盖事件**：group_chat_created, group_chat_member_added, group_chat_message_sent, group_chat_ws_connected

---

### 路径7：看板任务管理 (Kanban)

- **路径名称**：看板任务全生命周期管理
- **用户目标**：通过看板管理项目任务，从创建到完成的全流程跟踪
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceDetailPage → Dock | 点击 Kanban 进入看板 | workspace_id |
| 2 | WorkspaceKanbanPage | 切换视图模式(Kanban/List/Table) | to_view |
| 3 | WorkspaceKanbanPage | 点击"+ Add Task"创建任务 | source: button |
| 4 | CreateTaskDialog | 填写任务表单(标题/描述/优先级/标签等) | has_description, priority, has_labels |
| 5 | CreateTaskDialog | 提交创建 | task_title_length, column_id |
| 6 | KanbanBoardView | 拖拽任务卡片跨列移动 | from_column, to_column, from_position, to_position |
| 7 | TaskDetailDialog | 点击卡片打开详情编辑 | task_id |
| 8 | TaskDetailDialog | 右键菜单操作(编辑/删除/移动) | operation_type |
| 9 | KanbanToolbar | 使用筛选/排序/搜索 | filter_type, search_query_length |
| 10 | QueueSettingsModal | 配置队列参数 | max_parallel_tasks |
| 11 | KanbanBoardView | 查看阶段进度 | workspace_id |
| 12 | KanbanBoardView | 批量操作(全选/批量启用/禁用) | operation_type, affected_count |

- **覆盖事件**：kanban_view_switched, kanban_task_created, kanban_task_updated, kanban_task_moved, kanban_task_deleted, kanban_task_status_changed, kanban_comment_added, kanban_reaction_toggled, kanban_filter_applied, kanban_search_used, kanban_batch_operation, kanban_queue_settings_changed, kanban_task_enqueued, kanban_task_stuck_detected

---

### 路径8：定时任务管理 (Cron Job)

- **路径名称**：创建和管理定时任务
- **用户目标**：通过定时任务实现自动化工作流
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceDetailPage → Dock | 点击 Cron 进入定时任务页 | workspace_id |
| 2 | WorkspaceCronPage | 点击创建，进入三步向导 | source: cron_page |
| 3 | Step1 向导 | 填写名称/描述/调度方式/启用开关 | schedule_type, job_name |
| 4 | Step2 向导 | 选择任务类型(Agent/Script)，填写内容 | task_type |
| 5 | Step3 向导 | 配置通知设置 | has_notification |
| 6 | WorkspaceCronPage | 提交创建(POST /api/cron) | job_name |
| 7 | WorkspaceCronPage | 在表格中查看所有任务 | - |
| 8 | WorkspaceCronPage | 手动运行任务(Run Now) | job_id, triggered_from |
| 9 | WorkspaceCronPage | 编辑/启用/禁用/删除任务 | job_id, operation_type |
| 10 | WorkspaceCronPage | 批量操作 | operation_type, affected_count |
| 11 | 执行日志弹窗 | 查看执行日志 | job_id, log_entries_count |

- **覆盖事件**：cron_job_created, cron_job_updated, cron_job_deleted, cron_job_enabled, cron_job_disabled, cron_job_run_manual, cron_job_executed, cron_job_execution_failed, cron_logs_viewed, cron_batch_operation

---

### 路径9：文件浏览与编辑 (File Browser)

- **路径名称**：浏览和管理工作区文件
- **用户目标**：在工作区中浏览、预览、管理文件和目录
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceDetailPage → Dock | 点击 Files 进入文件浏览 | workspace_id |
| 2 | FileSidebar | 展开/折叠目录树 | to_path_depth |
| 3 | WorkspaceFilesPage | 切换视图模式(List/Icon/Column/Gallery) | to_view |
| 4 | FilePreview | 点击文件预览(图片/代码/Markdown/PDF等) | file_extension, preview_type, file_size_bytes |
| 5 | FilePreview | 拖拽调整预览面板宽度 | - |
| 6 | FilePreview | 多 Tab 切换预览 | tab_id |
| 7 | WorkspaceFilesPage | 右键菜单操作(打开/删除/重命名) | operation_type |
| 8 | WorkspaceFilesPage | 搜索文件 | search_query_length, results_count |
| 9 | WorkspaceFilesPage | 新建文件/文件夹 | creation_method |
| 10 | WorkspaceFilesPage | 上传文件 | file_size_bytes |
| 11 | WorkspaceFilesPage | 点击操作按钮(打开编辑器/终端打开/复制路径) | open_method |

- **覆盖事件**：file_browser_opened, file_view_switched, file_directory_navigated, file_previewed, file_preview_failed, file_created, file_deleted, file_renamed, file_search_used, file_external_opened

---

### 路径10：MCP 服务发现与安装 (MCP Marketplace)

- **路径名称**：从市场发现和安装 MCP 服务
- **用户目标**：扩展 AI 能力，从官方/社区市场安装 MCP 服务器
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Sidebar | 从侧边栏进入 MCP 市场 | source: sidebar |
| 2 | MarketplacePage → SearchBar | 输入关键词搜索(防抖) | search_query |
| 3 | MarketplacePage → CategoryFilter | 点击分类筛选 | category_name |
| 4 | MarketplacePage → SourceTabs | 切换数据源(官方/社区) | to_source |
| 5 | MarketplacePage | 浏览 PackageCard 列表 | - |
| 6 | PackageDetail | 点击卡片查看详情 | package_name, package_source |
| 7 | PackageDetail → InstallButton | 点击安装 | package_name, package_version |
| 8 | PackageCard | 查看安装进度(idle/installing/installed/error) | package_name |
| 9 | PackageCard | 安装完成，MCP 服务器可用 | package_name, duration_ms |

- **覆盖事件**：mcp_marketplace_opened, mcp_marketplace_searched, mcp_marketplace_category_filtered, mcp_marketplace_source_switched, mcp_package_detail_viewed, mcp_package_install_started, mcp_package_install_completed, mcp_package_install_failed, mcp_package_uninstalled

---

### 路径11：MCP 服务调试 (MCP Inspector)

- **路径名称**：调试和测试 MCP 服务器
- **用户目标**：作为开发者工具，连接并测试 MCP 服务器的工具和资源
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Sidebar | 进入 MCP Inspector | source: sidebar |
| 2 | TransportSelector | 选择传输方式(stdio/SSE/Streamable HTTP) | transport_type |
| 3 | InspectorPage | 输入连接参数，点击连接 | transport_type, server_name |
| 4 | InspectorPage | 连接成功，加载工具/资源/Prompts 列表 | connection_duration_ms |
| 5 | InspectorTools | 选择工具，通过 DynamicJsonForm 填写参数 | tool_name, params_count |
| 6 | InspectorTools | 发送 JSON-RPC 请求 | tool_name |
| 7 | InspectorPage | 查看响应结果 | result_type, response_size_bytes |
| 8 | InspectorResources | 浏览/读取资源 | resource_uri |
| 9 | InspectorAuth | 配置 OAuth 认证 | - |
| 10 | ConfigManager | 保存/加载配置 | config_name |
| 11 | LoggingLevelControl | 调整日志级别 | to_level |
| 12 | NotificationsPanel | 查看通知和历史 | - |

- **覆盖事件**：mcp_inspector_opened, mcp_inspector_connected, mcp_inspector_connect_failed, mcp_inspector_tool_called, mcp_inspector_tool_call_result, mcp_inspector_config_saved, mcp_inspector_config_loaded, mcp_inspector_log_level_changed, mcp_inspector_resource_read

---

### 路径12：技能市场发现与安装 (Skills Marketplace)

- **路径名称**：发现和安装 AI 技能
- **用户目标**：扩展 AI 能力，安装社区或官方的可复用技能
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Sidebar | 从侧边栏进入技能市场 | source: sidebar |
| 2 | SkillsMarketPage → SearchBar | 搜索关键词 | search_query |
| 3 | SkillSourceTabs | 切换官方/社区/已安装 | to_source |
| 4 | SkillsMarketPage | 浏览技能卡片 | - |
| 5 | SkillDetail | 点击卡片查看详情 | skill_id, skill_name, trigger_words |
| 6 | SkillDetail → InstallButton | 点击安装 | skill_id, skill_name |
| 7 | SkillsMarketPage | 安装到 ~/.viben/skills/ | skill_id, duration_ms |
| 8 | AgentSkillsDialog | 在 Agent 配置中启用已安装技能 | agent_id, skill_name |

- **覆盖事件**：skills_marketplace_opened, skills_marketplace_searched, skills_source_switched, skill_detail_viewed, skill_install_started, skill_install_completed, skill_install_failed, skill_uninstalled

---

### 路径13：设置与配置 (Settings)

- **路径名称**：系统设置配置
- **用户目标**：自定义应用主题、语言、快捷键、通知、AI 模型等偏好
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Sidebar | 点击 Settings | source: sidebar, initial_section |
| 2 | SettingsPage | 浏览 19 个设置分类 | - |
| 3 | General Section | 修改主题/语言/日期格式 | to_theme, to_language |
| 4 | Account Section | 查看账户信息 | - |
| 5 | Shortcuts Section | 自定义快捷键 | shortcut_key, new_binding |
| 6 | Notifications Section | 配置通知偏好 | do_not_disturb_enabled |
| 7 | Gateway Section | 查看/配置 Gateway 状态 | - |
| 8 | Model Section | 管理 AI 模型(CRUD/启用禁用/默认模型) | model_id, provider_id |
| 9 | Agents Section | 管理智能体 | - |
| 10 | MCP Section | 管理 MCP 服务器 | - |
| 11 | Skills Section | 管理技能 | - |
| 12 | Sandbox Section | 配置沙箱执行环境 | sandbox_provider |
| 13 | Voice Section | 配置语音交互 | - |
| 14 | Pet Section | 选择/切换桌面宠物 | to_pet |
| 15 | 其他 Section | Environment/TerminalFonts/Overlay/Storage/Developer/About | - |

- **覆盖事件**：settings_opened, settings_section_switched, settings_theme_changed, settings_language_changed, settings_shortcut_modified, settings_notification_prefs_changed, settings_provider_created, settings_provider_tested, settings_model_created, settings_model_default_changed, settings_api_key_configured, settings_api_key_validated, settings_sandbox_config_changed, settings_pet_changed, settings_terminal_font_changed, settings_developer_prefs_changed

---

### 路径14：桌面宠物交互 (Desktop Pet)

- **路径名称**：桌面宠物使用
- **用户目标**：通过桌面宠物获得趣味性体验和快捷聊天入口
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Settings → Pet Section | 选择宠物并启用 | to_pet, pet_enabled |
| 2 | pet-window | 宠物窗口显示在桌面上(128x128 透明窗口) | pet_type |
| 3 | pet-window | 拖拽宠物移动(触发走路/跳跃/下坠动画) | animation_triggered |
| 4 | pet-window | 悬停宠物(触发 alert 动画) | hover_duration_ms |
| 5 | pet-window | 点击宠物，打开聊天窗口 | pet_type |
| 6 | pet-window → chat-window | 在聊天窗口进行对话 | pet_type |
| 7 | pet-window | pet-config-changed 事件触发窗口更新 | pet_type |
| 8 | Gateway | 位置自动保存到 Gateway | - |

- **覆盖事件**：pet_displayed, pet_hidden, pet_dragged, pet_clicked, pet_hovered, pet_chat_opened

---

### 路径15：多窗口切换 (Window Management)

- **路径名称**：多窗口工作流
- **用户目标**：通过独立窗口实现多任务并行，提升工作效率
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | main window | 点击"弹出聊天窗口" | trigger_source |
| 2 | chat-window | 聊天窗口创建并显示(420x600，置顶) | trigger_source |
| 3 | chat-window | 在聊天窗口中进行对话 | messages_sent_count |
| 4 | chat-window | 失焦自动隐藏聊天窗口 | window_duration_ms |
| 5 | main window | 从主窗口预览页面 | page_uid |
| 6 | page-preview-window | 在预览窗口中浏览标签页(前进/后退/刷新) | navigation_type |
| 7 | main window | 触发区域截图 | screenshot_type |
| 8 | screenshot-overlay | 在 overlay 中选择区域并标注 | annotation_tools_used |
| 9 | screenshot-overlay | 确认截图，结果返回主窗口聊天 | screenshot_type, has_annotation |
| 10 | 各窗口 | 多窗口间通过 Tauri Event/Gateway API 通信 | - |

- **覆盖事件**：chat_window_opened, chat_window_closed, page_preview_window_opened, page_preview_tab_opened, page_preview_navigated, screenshot_overlay_opened, screenshot_confirmed, screenshot_cancelled

---

### 路径16：设备配对 (Device Pairing)

- **路径名称**：移动设备配对
- **用户目标**：通过二维码将移动设备与桌面应用配对，实现多端协同
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | Sidebar | 进入设备配对页 | source: sidebar |
| 2 | DevicePairPage | 查看已配对设备列表 | - |
| 3 | DevicePairPage | 点击生成二维码 | device_type |
| 4 | 二维码弹窗 | 移动端扫描二维码 | device_type |
| 5 | WebSocket | WebSocket 连接建立，设备状态实时更新 | device_id |
| 6 | mobile-window → ConnectPage | 移动端进入连接页 | connection_method |
| 7 | mobile-window → DeviceListPage | 连接成功后进入设备列表 | device_name |
| 8 | mobile-window → MobileChatPage | 选择目标桌面进入聊天 | device_id |
| 9 | MobileChatPage | 通过 Gateway API 进行远程交互 | device_id |
| 10 | DevicePairPage | 断开设备连接(AlertDialog 确认) | device_id, disconnect_reason |

- **覆盖事件**：device_pair_page_opened, device_qr_code_generated, device_paired, device_disconnected, device_ws_message_sent, mobile_connect_attempt, mobile_chat_message_sent

---

### 路径17：想法管理 (Ideas Management)

- **路径名称**：AI 辅助创意管理
- **用户目标**：通过 AI 生成和管理创意想法，将优质想法转化为可执行任务
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceDetailPage → Dock | 进入 Ideas 页面 | workspace_id |
| 2 | WorkspaceIdeasPage | 创建 IdeaType(名称/描述/Prompt) | type_name, has_prompt |
| 3 | WorkspaceIdeasPage | 选择 IdeaType，点击"生成 Ideas" | idea_type_id, model_used |
| 4 | LeftPanel | 浏览 Idea 列表，搜索过滤 | ideas_count |
| 5 | LeftPanel | 右键 Idea，选择"提升为任务" | idea_id |
| 6 | WorkspaceIdeasPage | 通过 command queue 创建 Kanban 任务 | task_id |
| 7 | Multi-Tab Editor → CodeEditor | 编辑 Idea 内容 | file_path |
| 8 | WorkspaceIdeasPage | 保存文件 | file_size_bytes |
| 9 | WorkspaceIdeasPage | 删除不想要的 Idea 或 Type | idea_id |

- **覆盖事件**：idea_type_created, ideas_generated, idea_promoted_to_task, idea_deleted, idea_file_saved

---

### 路径18：页面发布与分享 (Page Publish)

- **路径名称**：发布工作区页面
- **用户目标**：将 Markdown 内容发布为可分享的网页
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspacePage | 在页面编辑器中编辑 Markdown 内容 | page_type, has_template |
| 2 | WorkspacePage | 配置页面(config/theme/layout) | page_id |
| 3 | WorkspacePage | 点击发布(POST /api/page/publish) | page_id |
| 4 | PublishPage | 查看发布状态(publishing → published/failed) | page_id |
| 5 | PublishPage | 获取发布 URL | publish_url |
| 6 | page-preview-window | 在预览窗口中预览 | page_id, view_mode: page |
| 7 | PublishPage | 查看发布历史和版本 | page_id |
| 8 | PublishPage | 可选：回滚到历史版本 | from_version, to_version |
| 9 | WorkspacePage | 上传页面资产(图片等) | asset_type, asset_size_bytes |

- **覆盖事件**：page_created, page_content_updated, page_publish_started, page_publish_completed, page_publish_failed, page_publish_rollback, page_asset_uploaded

---

### 路径19：错误恢复 (Error Recovery)

- **路径名称**：系统错误检测与恢复
- **用户目标**：在系统出现错误时快速感知并恢复，保障工作连续性
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | AppErrorBoundary | React 组件崩溃，捕获错误 | error_type, component_stack, route_path |
| 2 | AppErrorBoundary | 显示错误回退 UI | error_type |
| 3 | GatewayStatusIndicator | Gateway 连接断开，指示器变红 | disconnect_reason |
| 4 | OfflineBanner | 离线提示显示 | trigger |
| 5 | StatusBar | 用户查看连接状态 | - |
| 6 | FailureView | 用户手动重试(刷新/重新连接) | - |
| 7 | GatewayStatusIndicator | 网络恢复，Gateway 自动重连 | outage_duration_ms, reconnect_attempts |
| 8 | Gateway health check | 健康检查轮询恢复 | - |
| 9 | SSE connection | SSE 连接断开后自动重连 | endpoint, reconnect_attempt |
| 10 | Browser | 用户刷新页面恢复 | route_path |

- **覆盖事件**：app_error_boundary_triggered, gateway_connection_lost, gateway_connection_restored, sse_connection_error, api_call_failed, offline_mode_entered, offline_mode_exited, page_load_failed

---

### 路径20：语音交互 (Voice Interaction)

- **路径名称**：语音对话
- **用户目标**：通过语音进行免提 AI 对话交互
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | AcpChat → 麦克风按钮 | 点击麦克风按钮开启语音 | trigger_method: button |
| 2 | VoiceAgent | 建立与 Vocal Bridge 的 WebSocket 连接 | - |
| 3 | VoiceAgent | 状态机切换(disconnected→connecting→listening) | voice_state |
| 4 | VoiceAgent | 用户说话，唤醒词检测 | wake_word, detection_confidence |
| 5 | OverlayRoot → VoiceSubtitleLayer | 语音转文字，字幕显示 | transcript_length |
| 6 | OverlayRoot → WaveLayer | 声波动画显示 | - |
| 7 | VoiceAgent | AI 回复流式语音 | response_id, model_id |
| 8 | VoiceAgent | 静默检测(startSilenceTimer) | - |
| 9 | AcpChat → 麦克风按钮 | 点击关闭或自动静默结束 | stop_reason, session_duration_ms |

- **覆盖事件**：voice_started, voice_wake_word_detected, voice_speech_recognized, voice_response_started, voice_response_completed, voice_stopped, voice_error

---

### 路径21：GitHub 集成工作流

- **路径名称**：GitHub Issue 管理和自动修复
- **用户目标**：在应用内管理 GitHub Issue，通过 AI 自动分析和修复
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | WorkspaceDetailPage → Dock | 进入 GitHub 集成页 | workspace_id |
| 2 | WorkspaceGitHubPage | 配置 GitHub 仓库连接 | - |
| 3 | WorkspaceGitHubPage | 加载 Issue 列表(分页) | repo_name, page_number |
| 4 | WorkspaceGitHubPage | 筛选 Issue(标签/状态/负责人) | - |
| 5 | WorkspaceGitHubPage | 选中 Issue 查看详情 | issue_number, has_ai_analysis |
| 6 | WorkspaceGitHubPage | 触发 AI 分析 Issue | issue_number |
| 7 | WorkspaceGitHubPage | 创建 Auto-Fix 任务 | issue_number, task_type |
| 8 | WebSocket | WebSocket 实时追踪修复进度 | task_id |
| 9 | WorkspaceGitHubPage | 审批/取消修复任务 | task_id |
| 10 | WorkspaceGitHubPage | 查看修复结果 | task_id, fix_duration_ms |

- **覆盖事件**：github_integration_opened, github_issues_loaded, github_issue_selected, github_auto_fix_created, github_auto_fix_completed

---

### 路径22：斜杠命令交互 (Slash Commands)

- **路径名称**：通过命令面板快速操作
- **用户目标**：通过斜杠命令快速执行配置、导航等操作，减少鼠标操作
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | ChatInput | 在聊天输入框输入"/" | trigger: typing_/ |
| 2 | SlashCommandPanel | 命令面板弹出，显示可用命令 | - |
| 3 | SlashCommandPanel | 浏览分类(config/auth/workspace/info/session) | command_category |
| 4 | SlashCommandPanel | 选择命令(如 /config、/model、/doctor、/clear) | command_name |
| 5 | ChatArea | 命令执行(type: message/ui/action/prompt) | execution_type |
| 6 | ChatArea | 查看执行结果(Dialog/Toast/消息) | duration_ms |

- **覆盖事件**：slash_command_panel_opened, slash_command_executed

---

### 路径23：通知中心交互

- **路径名称**：查看和管理通知
- **用户目标**：集中查看系统通知，快速响应重要事项
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | NotificationBell | 点击铃铛(显示未读数) | unread_count |
| 2 | NotificationCenter | 通知中心展开 | - |
| 3 | NotificationFilters | 按类型筛选(全部/任务/系统/更新) | filter_type |
| 4 | NotificationFilters | 按状态筛选(未读/已读) | filter_status |
| 5 | NotificationItem | 点击通知跳转至相关内容 | notification_type, target_type |
| 6 | NotificationItem | 标记已读/全部已读 | mark_scope |
| 7 | NotificationItem | 删除通知 | notification_id |
| 8 | NotificationCenter | 配置通知偏好(免打扰/分类开关) | do_not_disturb_enabled |

- **覆盖事件**：notification_received, notification_clicked, notification_marked_read, notification_center_opened, notification_deleted

---

### 路径24：离线工作与恢复

- **路径名称**：离线环境使用
- **用户目标**：在网络断开时继续使用已缓存内容，恢复后自动同步
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | OfflineIndicator | 网络断开，离线指示器显示 | trigger |
| 2 | CacheManager | 提供缓存数据访问 | cache_type, cache_hit |
| 3 | 各页面 | 用户继续浏览已缓存内容 | cache_type |
| 4 | OfflineIndicator | 网络恢复，自动检测(isOffline → false) | - |
| 5 | SyncManager | 离线期间的操作排队同步 | sync_type, pending_items_count |
| 6 | SyncStatus | 显示同步进度 | synced_items_count |
| 7 | NotificationCenter | 同步完成通知 | conflicts_count |

- **覆盖事件**：cache_accessed, sync_started, sync_completed

---

### 路径25：演示模式 (Presentation Mode)

- **路径名称**：演示模式投屏
- **用户目标**：通过全屏投屏和操作可视化进行教学或演示
- **步骤序列**：

| 步骤 | 页面/组件 | 用户操作 | 关键参数 |
|------|-----------|----------|----------|
| 1 | AcpChat | 启动演示模式 | session_id, presentation_type |
| 2 | OverlayRoot → PresentationLayer | 全屏投屏显示 | - |
| 3 | OverlayRoot → KeystrokeLayer | 实时显示按键 | - |
| 4 | OverlayRoot → ClickIndicatorLayer | 鼠标点击波纹显示 | - |
| 5 | PresentationLayer | AI 工具调用自动转为演示步骤 | tool_name |
| 6 | PresentationLayer | 步骤状态追踪(pending/active/completed) | step_status |
| 7 | PresentationLayer | 截图记录(completePresentationStep) | has_screenshot |
| 8 | AcpChat | 停止演示 | total_steps, completed_steps |

- **覆盖事件**：presentation_started, presentation_step_completed, presentation_stopped

---

## 三、事件定义清单

以下为完整的事件定义清单，共 **218 个事件**，覆盖 6 大 category。

### 3.1 navigation（导航类，34 个）

| # | event_name | category | trigger | priority | parameters | user_path |
|---|-----------|----------|---------|----------|-----------|-----------|
| 1 | onboarding_step_viewed | navigation | 进入引导步骤页面 | high | step_name, step_index, total_steps | 首次启动引导 |
| 2 | onboarding_skipped | navigation | 用户跳过引导流程 | medium | skipped_from_step | 首次启动引导 |
| 3 | workspace_switched | navigation | 切换活跃工作区 | high | from_workspace_id, to_workspace_id, switch_method | 创建工作区 |
| 4 | workspace_settings_opened | navigation | 打开工作区设置 | medium | workspace_id, section | 创建工作区 |
| 5 | chat_session_switched | navigation | 切换会话 | high | from_session_id, to_session_id, switch_method | AI对话交互 |
| 6 | kanban_view_switched | navigation | 切换看板视图 | medium | workspace_id, from_view, to_view | 看板任务管理 |
| 7 | file_browser_opened | navigation | 打开文件浏览器 | high | workspace_id, initial_path_depth | 文件浏览与编辑 |
| 8 | file_view_switched | navigation | 切换文件视图模式 | medium | from_view, to_view | 文件浏览与编辑 |
| 9 | file_directory_navigated | navigation | 导航目录 | high | from_path_depth, to_path_depth, navigation_method | 文件浏览与编辑 |
| 10 | mcp_marketplace_opened | navigation | 进入MCP市场 | high | source | MCP服务发现与安装 |
| 11 | mcp_marketplace_source_switched | navigation | 切换MCP数据源 | medium | from_source, to_source | MCP服务发现与安装 |
| 12 | mcp_inspector_opened | navigation | 进入MCP调试器 | high | source | MCP服务调试 |
| 13 | skills_marketplace_opened | navigation | 进入技能市场 | high | source | 技能市场 |
| 14 | skills_source_switched | navigation | 切换技能数据源 | medium | from_source, to_source | 技能市场 |
| 15 | settings_opened | navigation | 进入设置页 | high | source, initial_section | 设置与配置 |
| 16 | settings_section_switched | navigation | 切换设置分类 | high | from_section, to_section | 设置与配置 |
| 17 | chat_window_opened | navigation | 打开独立聊天窗口 | high | trigger_source | 多窗口管理 |
| 18 | page_preview_window_opened | navigation | 打开页面预览窗口 | high | workspace_id, page_uid, view_mode | 多窗口管理 |
| 19 | page_preview_tab_opened | navigation | 预览窗口新建标签页 | medium | tab_url, tab_index | 多窗口管理 |
| 20 | page_preview_navigated | navigation | 预览窗口内导航 | medium | navigation_type, tab_id | 多窗口管理 |
| 21 | device_pair_page_opened | navigation | 进入设备配对页 | high | source | 设备配对 |
| 22 | github_integration_opened | navigation | 进入GitHub集成页 | medium | workspace_id | GitHub集成 |
| 23 | notification_center_opened | navigation | 打开通知中心 | medium | unread_count | 通知中心 |
| 24 | tab_opened | navigation | 新建标签页 | high | tab_id, tab_url, tab_index, total_tabs, is_pinned | 全局 |
| 25 | tab_closed | navigation | 关闭标签页 | high | tab_id, tab_age_ms, was_active | 全局 |
| 26 | tab_switched | navigation | 切换标签页 | high | from_tab_id, to_tab_id, switch_method | 全局 |
| 27 | sidebar_section_toggled | navigation | 侧边栏分组折叠/展开 | medium | section_name, action | 全局 |
| 28 | onboarding_step_viewed | navigation | 进入引导步骤 | high | step_name, step_index, total_steps | 首次启动引导 |
| 29 | workspace_switched | navigation | 切换工作区 | high | from_workspace_id, to_workspace_id | 创建工作区 |
| 30 | settings_opened | navigation | 打开设置 | high | source, initial_section | 设置与配置 |
| 31 | file_browser_opened | navigation | 打开文件浏览器 | high | workspace_id | 文件浏览与编辑 |
| 32 | mcp_marketplace_opened | navigation | 进入MCP市场 | high | source | MCP市场 |
| 33 | skills_marketplace_opened | navigation | 进入技能市场 | high | source | 技能市场 |
| 34 | mcp_inspector_opened | navigation | 进入调试器 | high | source | MCP服务调试 |

### 3.2 engagement（参与类，79 个）

| # | event_name | category | trigger | priority | parameters | user_path |
|---|-----------|----------|---------|----------|-----------|-----------|
| 35 | chat_message_sent | engagement | 用户发送消息 | critical | session_id, agent_id, model_id, message_type, message_length, has_attachment | AI对话交互 |
| 36 | chat_stream_completed | engagement | SSE流式响应完成 | critical | session_id, total_tokens, tool_calls_count, duration_ms, total_cost_tokens | AI对话交互 |
| 37 | chat_stream_stopped | engagement | 用户手动停止生成 | high | session_id, tokens_generated_before_stop, stop_reason | AI对话交互 |
| 38 | chat_tool_use_displayed | engagement | 工具调用渲染 | medium | session_id, tool_name, tool_call_index | AI对话交互 |
| 39 | chat_plan_approved | engagement | 用户批准Plan | high | session_id, plan_type, approval_duration_ms | AI对话交互 |
| 40 | chat_plan_rejected | engagement | 用户拒绝Plan | high | session_id, plan_type, rejection_reason | AI对话交互 |
| 41 | chat_question_answered | engagement | 用户回答Agent问题 | medium | session_id, question_type, answer_length | AI对话交互 |
| 42 | chat_artifact_clicked | engagement | 点击Artifact查看 | medium | session_id, artifact_type, artifact_size_bytes | AI对话交互 |
| 43 | chat_session_renamed | engagement | 重命名会话 | medium | session_id, name_length | AI对话交互 |
| 44 | chat_session_pinned | engagement | 置顶会话 | medium | session_id, pinned | AI对话交互 |
| 45 | chat_session_archived | engagement | 归档会话 | medium | session_id | AI对话交互 |
| 46 | chat_context_settings_changed | engagement | 调整上下文设置 | medium | session_id, context_window_size, max_tokens | AI对话交互 |
| 47 | chat_mode_switched | engagement | 切换聊天模式 | medium | from_mode, to_mode | AI对话交互 |
| 48 | chat_slash_command_used | engagement | 使用斜杠命令 | high | session_id, command_name, command_category | AI对话交互 |
| 49 | chat_message_search_used | engagement | 搜索聊天消息 | medium | session_id, search_query_length, results_count | AI对话交互 |
| 50 | agent_updated | engagement | 更新智能体配置 | high | agent_id, fields_changed, has_system_prompt_changed, has_mcp_changed, has_skills_changed | 高级Agent配置 |
| 51 | agent_duplicated | engagement | 复制智能体 | medium | source_agent_id, new_agent_id | 高级Agent配置 |
| 52 | agent_default_set | engagement | 设为默认智能体 | high | agent_id, previous_default_id | 高级Agent配置 |
| 53 | agent_mcp_server_added | engagement | 添加MCP服务器到Agent | high | agent_id, mcp_server_name, mcp_server_type | 高级Agent配置 |
| 54 | agent_mcp_server_removed | engagement | 移除MCP服务器 | medium | agent_id, mcp_server_name | 高级Agent配置 |
| 55 | agent_skill_enabled | engagement | 启用Skill | high | agent_id, skill_id, skill_name | 高级Agent配置 |
| 56 | agent_memory_edited | engagement | 编辑Memory | medium | agent_id, memory_size_bytes, edit_duration_ms | 高级Agent配置 |
| 57 | agent_variable_added | engagement | 添加自定义变量 | medium | agent_id, variable_key | 高级Agent配置 |
| 58 | group_chat_member_added | engagement | 添加群聊成员 | medium | group_id, member_type, member_id | 群聊协作 |
| 59 | group_chat_message_sent | engagement | 发送群聊消息 | high | group_id, session_id, message_type, has_mention | 群聊协作 |
| 60 | kanban_task_updated | engagement | 编辑任务 | high | task_id, fields_changed, update_source | 看板任务管理 |
| 61 | kanban_task_moved | engagement | 拖拽移动任务 | high | task_id, from_column, to_column, from_position, to_position | 看板任务管理 |
| 62 | kanban_comment_added | engagement | 添加评论 | medium | task_id, comment_length, has_attachment | 看板任务管理 |
| 63 | kanban_reaction_toggled | engagement | 切换表情反应 | medium | task_id, comment_id, reaction_emoji, action | 看板任务管理 |
| 64 | kanban_filter_applied | engagement | 应用筛选条件 | medium | workspace_id, filter_type, filter_value | 看板任务管理 |
| 65 | kanban_search_used | engagement | 搜索任务 | medium | workspace_id, search_query_length, results_count | 看板任务管理 |
| 66 | kanban_batch_operation | engagement | 批量操作 | high | workspace_id, operation_type, affected_count | 看板任务管理 |
| 67 | kanban_queue_settings_changed | engagement | 修改队列设置 | medium | workspace_id, max_parallel_tasks, previous_value | 看板任务管理 |
| 68 | cron_job_updated | engagement | 编辑定时任务 | high | job_id, fields_changed, has_schedule_changed | 定时任务管理 |
| 69 | cron_job_run_manual | engagement | 手动运行定时任务 | high | job_id, triggered_from | 定时任务管理 |
| 70 | cron_logs_viewed | engagement | 查看执行日志 | medium | job_id, log_entries_count | 定时任务管理 |
| 71 | cron_batch_operation | engagement | 批量操作定时任务 | high | operation_type, affected_count | 定时任务管理 |
| 72 | file_previewed | engagement | 预览文件 | high | file_extension, file_size_bytes, preview_type | 文件浏览与编辑 |
| 73 | file_renamed | engagement | 重命名文件 | medium | old_extension, new_extension | 文件浏览与编辑 |
| 74 | file_search_used | engagement | 搜索文件 | medium | search_query_length, results_count, search_duration_ms | 文件浏览与编辑 |
| 75 | file_external_opened | engagement | 用外部程序打开文件 | medium | file_extension, open_method | 文件浏览与编辑 |
| 76 | mcp_marketplace_searched | engagement | 搜索MCP服务 | high | search_query, results_count, search_duration_ms | MCP服务发现与安装 |
| 77 | mcp_marketplace_category_filtered | engagement | 分类筛选MCP | medium | category_name, results_count | MCP服务发现与安装 |
| 78 | mcp_package_detail_viewed | engagement | 查看MCP包详情 | high | package_name, package_source, package_version | MCP服务发现与安装 |
| 79 | mcp_inspector_tool_called | engagement | 调用MCP工具 | high | tool_name, params_count, has_custom_headers | MCP服务调试 |
| 80 | mcp_inspector_tool_call_result | engagement | 工具调用返回 | high | tool_name, result_type, duration_ms, response_size_bytes | MCP服务调试 |
| 81 | mcp_inspector_config_saved | engagement | 保存Inspector配置 | medium | config_name, transport_type, tools_count | MCP服务调试 |
| 82 | mcp_inspector_config_loaded | engagement | 加载Inspector配置 | medium | config_name, config_age_days | MCP服务调试 |
| 83 | mcp_inspector_log_level_changed | engagement | 修改日志级别 | medium | from_level, to_level | MCP服务调试 |
| 84 | mcp_inspector_resource_read | engagement | 读取MCP资源 | medium | resource_uri, resource_size_bytes | MCP服务调试 |
| 85 | skills_marketplace_searched | engagement | 搜索技能 | high | search_query, results_count | 技能市场 |
| 86 | skill_detail_viewed | engagement | 查看技能详情 | high | skill_id, skill_name, trigger_words, files_count | 技能市场 |
| 87 | settings_theme_changed | engagement | 修改主题 | medium | from_theme, to_theme | 设置与配置 |
| 88 | settings_language_changed | engagement | 修改语言 | medium | from_language, to_language | 设置与配置 |
| 89 | settings_shortcut_modified | engagement | 修改快捷键 | medium | shortcut_key, old_binding, new_binding | 设置与配置 |
| 90 | settings_notification_prefs_changed | engagement | 修改通知偏好 | medium | do_not_disturb_enabled, categories_changed | 设置与配置 |
| 91 | settings_provider_tested | engagement | 测试Provider连接 | high | provider_id, test_result, duration_ms | 设置与配置 |
| 92 | settings_model_default_changed | engagement | 修改默认模型 | medium | from_model_id, to_model_id | 设置与配置 |
| 93 | settings_api_key_validated | engagement | 验证API Key | high | provider_id, validation_result | 设置与配置 |
| 94 | settings_sandbox_config_changed | engagement | 修改沙箱配置 | medium | sandbox_provider, sandbox_enabled | 设置与配置 |
| 95 | settings_pet_changed | engagement | 切换桌面宠物 | medium | from_pet, to_pet, pet_enabled | 设置与配置 |
| 96 | settings_terminal_font_changed | engagement | 修改终端字体 | medium | font_family, font_size, preset_applied | 设置与配置 |
| 97 | settings_developer_prefs_changed | engagement | 修改开发者偏好 | medium | preferred_ide_changed, preferred_terminal_changed, skip_permissions_changed | 设置与配置 |
| 98 | pet_dragged | engagement | 拖拽宠物 | medium | drag_distance_px, animation_triggered | 桌面宠物交互 |
| 99 | pet_clicked | engagement | 点击宠物 | high | pet_type, previous_animation | 桌面宠物交互 |
| 100 | pet_hovered | engagement | 悬停宠物 | medium | hover_duration_ms | 桌面宠物交互 |
| 101 | screenshot_overlay_opened | engagement | 打开截图叠加层 | high | screenshot_type, monitor_id | 多窗口管理 |
| 102 | screenshot_cancelled | engagement | 取消截图 | medium | screenshot_type, overlay_duration_ms, had_selection | 多窗口管理 |
| 103 | device_ws_message_sent | engagement | 发送设备消息 | medium | device_id, message_type, message_size_bytes | 设备配对 |
| 104 | mobile_chat_message_sent | engagement | 移动端发送聊天消息 | medium | session_id, message_length, network_type | 设备配对 |
| 105 | idea_file_saved | engagement | 保存想法文件 | medium | file_path, file_size_bytes, save_duration_ms | 想法管理 |
| 106 | page_content_updated | engagement | 更新页面内容 | medium | page_id, content_size_bytes, update_method | 页面发布与分享 |
| 107 | page_asset_uploaded | engagement | 上传页面资源 | medium | page_id, asset_type, asset_size_bytes | 页面发布与分享 |
| 108 | voice_started | engagement | 开启语音输入 | high | trigger_method | 语音交互 |
| 109 | voice_wake_word_detected | engagement | 检测到唤醒词 | high | wake_word, detection_confidence | 语音交互 |
| 110 | voice_speech_recognized | engagement | 语音识别完成 | high | transcript_length, recognition_duration_ms, language | 语音交互 |
| 111 | voice_response_started | engagement | AI语音回复开始 | high | response_id, model_id | 语音交互 |
| 112 | voice_response_completed | engagement | AI语音回复完成 | high | response_id, response_length, total_duration_ms | 语音交互 |
| 113 | voice_stopped | engagement | 停止语音输入 | medium | stop_reason, session_duration_ms | 语音交互 |
| 114 | github_issues_loaded | engagement | 加载Issue列表 | medium | repo_name, issues_count, page_number | GitHub集成 |
| 115 | github_issue_selected | engagement | 选中Issue查看 | medium | issue_number, has_ai_analysis | GitHub集成 |
| 116 | slash_command_panel_opened | engagement | 打开斜杠命令面板 | medium | trigger | 斜杠命令交互 |
| 117 | slash_command_executed | engagement | 执行斜杠命令 | high | command_name, command_category, execution_type, duration_ms | 斜杠命令交互 |
| 118 | notification_clicked | engagement | 点击通知 | high | notification_id, notification_type, target_type | 通知中心 |
| 119 | notification_marked_read | engagement | 标记已读 | medium | notification_id, mark_scope | 通知中心 |
| 120 | cache_accessed | engagement | 访问离线缓存 | medium | cache_type, cache_hit, data_size_bytes | 离线工作 |
| 121 | presentation_started | engagement | 启动演示模式 | medium | session_id, presentation_type | 演示模式 |
| 122 | presentation_step_completed | engagement | 演示步骤完成 | medium | step_id, step_status, tool_name, has_screenshot | 演示模式 |
| 123 | presentation_stopped | engagement | 停止演示模式 | medium | session_id, total_steps, completed_steps, duration_ms | 演示模式 |
| 124 | tab_reordered | engagement | 拖拽排序标签页 | medium | tab_id, from_index, to_index | 全局 |
| 125 | sidebar_resized | engagement | 调整侧边栏宽度 | medium | from_width_px, to_width_px | 全局 |
| 126 | search_global_used | engagement | 使用全局搜索 | medium | search_query_length, search_category, results_count | 全局 |
| 127 | keyboard_shortcut_used | engagement | 使用键盘快捷键 | medium | shortcut_name, shortcut_keys, context | 全局 |

### 3.3 conversion（转化类，36 个）

| # | event_name | category | trigger | priority | parameters | user_path |
|---|-----------|----------|---------|----------|-----------|-----------|
| 128 | onboarding_started | conversion | 用户点击欢迎页"开始"按钮 | critical | app_version, platform, language | 首次启动引导 |
| 129 | onboarding_step_completed | conversion | 引导步骤完成 | critical | step_name, step_index, duration_ms, success | 首次启动引导 |
| 130 | onboarding_env_check_completed | conversion | 环境检查完成 | critical | git_available, node_available, python_available, failed_checks_count | 首次启动引导 |
| 131 | onboarding_python_installed | conversion | Python环境安装完成 | high | python_version, install_method, duration_ms | 首次启动引导 |
| 132 | onboarding_claude_installed | conversion | Claude CLI安装完成 | high | claude_version, install_method, duration_ms | 首次启动引导 |
| 133 | onboarding_oauth_started | conversion | 用户点击GitHub登录 | critical | provider | 首次启动引导 |
| 134 | onboarding_oauth_completed | conversion | OAuth认证完成 | critical | provider, duration_ms, success | 首次启动引导 |
| 135 | onboarding_agent_created | conversion | 首个Agent创建完成 | critical | agent_name, provider_id, model_id, has_mcp, has_skills | 首次启动引导 |
| 136 | onboarding_completed | conversion | 引导流程全部完成 | critical | total_duration_ms, total_steps, skipped_steps | 首次启动引导 |
| 137 | auth_login_attempt | conversion | 用户发起登录 | critical | provider, method | OAuth认证登录 |
| 138 | auth_login_success | conversion | 登录成功 | critical | provider, user_id_hash, is_new_user, duration_ms | OAuth认证登录 |
| 139 | workspace_created | conversion | 工作区创建成功 | critical | workspace_name, workspace_path_depth, has_git | 创建工作区 |
| 140 | agent_created | conversion | 创建智能体 | critical | agent_name, scope, provider_id, model_id, from_template | 高级Agent配置 |
| 141 | agent_template_promoted | conversion | 提升为模板 | medium | agent_id, template_name | 高级Agent配置 |
| 142 | agent_from_template_created | conversion | 从模板创建Agent | high | template_id, agent_name | 高级Agent配置 |
| 143 | group_chat_created | conversion | 创建群聊 | high | group_name, members_count, workspace_id | 群聊协作 |
| 144 | kanban_task_created | conversion | 创建看板任务 | critical | workspace_id, task_title_length, has_description, priority, has_labels, column_id | 看板任务管理 |
| 145 | cron_job_created | conversion | 创建定时任务 | critical | job_name, schedule_type, task_type, has_notification | 定时任务管理 |
| 146 | file_created | conversion | 创建文件 | medium | file_extension, creation_method, file_size_bytes | 文件浏览与编辑 |
| 147 | mcp_package_install_started | conversion | 开始安装MCP包 | critical | package_name, package_version, install_source | MCP服务发现与安装 |
| 148 | mcp_package_install_completed | conversion | MCP包安装完成 | critical | package_name, package_version, duration_ms, success | MCP服务发现与安装 |
| 149 | skill_install_started | conversion | 开始安装技能 | critical | skill_id, skill_name, install_source | 技能市场 |
| 150 | skill_install_completed | conversion | 技能安装完成 | critical | skill_id, skill_name, duration_ms, success | 技能市场 |
| 151 | settings_provider_created | conversion | 创建AI Provider | high | provider_id, provider_type | 设置与配置 |
| 152 | settings_model_created | conversion | 创建模型 | high | model_id, provider_id, model_category | 设置与配置 |
| 153 | settings_api_key_configured | conversion | 配置API Key | critical | provider_id, has_existing_key | 设置与配置 |
| 154 | pet_chat_opened | conversion | 从宠物打开聊天窗口 | high | pet_type | 桌面宠物交互 |
| 155 | screenshot_confirmed | conversion | 确认截图 | high | screenshot_type, annotation_tools_used, has_annotation, selection_area_px | 多窗口管理 |
| 156 | device_qr_code_generated | conversion | 生成配对二维码 | high | device_type | 设备配对 |
| 157 | device_paired | conversion | 设备配对成功 | critical | device_type, device_name, pairing_method, duration_ms | 设备配对 |
| 158 | mobile_connect_attempt | conversion | 移动端尝试连接 | high | connection_method, gateway_found_count | 设备配对 |
| 159 | idea_type_created | conversion | 创建想法类型 | medium | type_name, has_prompt | 想法管理 |
| 160 | ideas_generated | conversion | AI生成想法 | high | idea_type_id, ideas_count, duration_ms, model_used | 想法管理 |
| 161 | idea_promoted_to_task | conversion | 想法提升为任务 | high | idea_id, task_id, promotion_method | 想法管理 |
| 162 | page_created | conversion | 创建页面 | high | workspace_id, page_type, has_template | 页面发布与分享 |
| 163 | page_publish_started | conversion | 开始发布页面 | critical | page_id, page_type | 页面发布与分享 |
| 164 | page_publish_completed | conversion | 页面发布成功 | critical | page_id, publish_url, duration_ms, asset_count | 页面发布与分享 |
| 165 | github_auto_fix_created | conversion | 创建自动修复任务 | high | issue_number, task_type, estimated_complexity | GitHub集成 |
| 166 | github_auto_fix_completed | conversion | 自动修复完成 | high | task_id, issue_number, fix_duration_ms, success | GitHub集成 |

### 3.4 error（错误类，23 个）

| # | event_name | category | trigger | priority | parameters | user_path |
|---|-----------|----------|---------|----------|-----------|-----------|
| 167 | onboarding_step_failed | error | 引导步骤失败 | high | step_name, step_index, error_type, error_message | 首次启动引导 |
| 168 | auth_login_failed | error | 登录失败 | high | provider, error_type, error_message | OAuth认证登录 |
| 169 | workspace_create_failed | error | 工作区创建失败 | high | error_type, error_message, path | 创建工作区 |
| 170 | kanban_task_stuck_detected | error | 任务卡住检测 | high | task_id, stuck_duration_ms, last_activity_type | 看板任务管理 |
| 171 | cron_job_execution_failed | error | 定时任务执行失败 | high | job_id, error_type, error_message, retry_count | 定时任务管理 |
| 172 | file_preview_failed | error | 文件预览失败 | medium | file_extension, file_size_bytes, error_type, error_message | 文件浏览与编辑 |
| 173 | mcp_package_install_failed | error | MCP包安装失败 | high | package_name, error_type, error_message, duration_ms | MCP服务发现与安装 |
| 174 | mcp_inspector_connect_failed | error | 连接MCP服务器失败 | high | transport_type, error_type, error_message | MCP服务调试 |
| 175 | skill_install_failed | error | 技能安装失败 | high | skill_id, error_type, error_message | 技能市场 |
| 176 | page_publish_failed | error | 页面发布失败 | high | page_id, error_type, error_message, duration_ms | 页面发布与分享 |
| 177 | app_error_boundary_triggered | error | Error Boundary捕获错误 | critical | error_type, error_message, component_stack, route_path | 错误恢复 |
| 178 | gateway_connection_lost | error | Gateway连接断开 | critical | previous_status, disconnect_reason, connection_duration_ms | 错误恢复 |
| 179 | sse_connection_error | error | SSE连接错误 | high | endpoint, error_type, reconnect_attempt | 错误恢复 |
| 180 | api_call_failed | error | API调用失败 | high | endpoint, http_status, error_code, retry_count | 错误恢复 |
| 181 | page_load_failed | error | 页面加载失败 | high | route_path, error_type, is_lazy_load | 错误恢复 |
| 182 | voice_error | error | 语音错误 | high | error_type, error_message, voice_state | 语音交互 |
| 183 | app_crashed | error | 应用崩溃 | critical | crash_type, last_route, app_uptime_ms | 全局 |
| 184 | onboarding_step_failed | error | 引导步骤失败 | high | step_name, step_index, error_type, error_message | 首次启动引导 |
| 185 | workspace_create_failed | error | 工作区创建失败 | high | error_type, error_message, path | 创建工作区 |
| 186 | auth_login_failed | error | 登录失败 | high | provider, error_type, error_message | OAuth认证登录 |
| 187 | mcp_package_install_failed | error | MCP包安装失败 | high | package_name, error_type, error_message | MCP市场 |
| 188 | skill_install_failed | error | 技能安装失败 | high | skill_id, error_type, error_message | 技能市场 |
| 189 | page_publish_failed | error | 页面发布失败 | high | page_id, error_type, error_message | 页面发布 |

### 3.5 performance（性能类，9 个）

| # | event_name | category | trigger | priority | parameters | user_path |
|---|-----------|----------|---------|----------|-----------|-----------|
| 190 | chat_stream_started | performance | SSE流式响应开始 | high | session_id, agent_id, model_id | AI对话交互 |
| 191 | chat_first_token_received | performance | 首个token到达 | critical | session_id, time_to_first_token_ms | AI对话交互 |
| 192 | mcp_inspector_connected | performance | 连接MCP服务器成功 | high | transport_type, server_name, connection_duration_ms | MCP服务调试 |
| 193 | group_chat_ws_connected | performance | 群聊WebSocket连接建立 | medium | group_id, session_id, connection_duration_ms | 群聊协作 |
| 194 | chat_stream_started | performance | SSE流式开始 | high | session_id, agent_id, model_id | AI对话交互 |
| 195 | chat_first_token_received | performance | 首token到达 | critical | session_id, time_to_first_token_ms | AI对话交互 |
| 196 | mcp_inspector_connected | performance | MCP连接成功 | high | transport_type, server_name, connection_duration_ms | MCP服务调试 |
| 197 | group_chat_ws_connected | performance | WebSocket连接建立 | medium | group_id, session_id, connection_duration_ms | 群聊协作 |
| 198 | sync_started | performance | 开始数据同步 | high | sync_type, pending_items_count | 离线工作 |

### 3.6 lifecycle（生命周期类，20 个）

| # | event_name | category | trigger | priority | parameters | user_path |
|---|-----------|----------|---------|----------|-----------|-----------|
| 199 | onboarding_gateway_started | lifecycle | Gateway启动完成 | high | gateway_version, start_method, duration_ms | 首次启动引导 |
| 200 | auth_token_refreshed | lifecycle | Token自动刷新 | medium | refresh_method, duration_ms, success | OAuth认证登录 |
| 201 | auth_session_expired | lifecycle | Session过期 | high | session_age_ms, reason | OAuth认证登录 |
| 202 | auth_logout | lifecycle | 用户主动登出 | medium | session_duration_ms | OAuth认证登录 |
| 203 | workspace_deleted | lifecycle | 工作区被删除 | high | workspace_id, workspace_age_days, task_count | 创建工作区 |
| 204 | agent_discovery_started | lifecycle | 自动发现智能体开始 | medium | workspace_id, discovery_method | 创建工作区 |
| 205 | agent_discovery_completed | lifecycle | 自动发现智能体完成 | medium | workspace_id, agents_found_count, duration_ms | 创建工作区 |
| 206 | chat_session_created | lifecycle | 创建新会话 | critical | workspace_id, agent_id, executor_type, session_type | AI对话交互 |
| 207 | chat_session_deleted | lifecycle | 删除会话 | high | session_id, session_age_days, message_count | AI对话交互 |
| 208 | chat_messages_cleared | lifecycle | 清空会话消息 | medium | session_id, messages_count_before_clear | AI对话交互 |
| 209 | agent_deleted | lifecycle | 删除智能体 | high | agent_id, agent_age_days, sessions_count | 高级Agent配置 |
| 210 | kanban_task_deleted | lifecycle | 删除任务 | high | task_id, task_age_days, column | 看板任务管理 |
| 211 | kanban_task_status_changed | lifecycle | 任务状态变更 | critical | task_id, from_status, to_status, change_source | 看板任务管理 |
| 212 | kanban_task_enqueued | lifecycle | 任务加入后台队列 | high | task_id, queue_position, queue_total | 看板任务管理 |
| 213 | cron_job_deleted | lifecycle | 删除定时任务 | high | job_id, job_age_days, execution_count | 定时任务管理 |
| 214 | cron_job_enabled | lifecycle | 启用定时任务 | medium | job_id, was_disabled_duration_ms | 定时任务管理 |
| 215 | cron_job_disabled | lifecycle | 禁用定时任务 | medium | job_id, enabled_duration_ms | 定时任务管理 |
| 216 | cron_job_executed | lifecycle | 定时任务自动执行 | critical | job_id, execution_result, duration_ms, output_length | 定时任务管理 |
| 217 | file_deleted | lifecycle | 删除文件 | medium | file_extension, file_size_bytes | 文件浏览与编辑 |
| 218 | mcp_package_uninstalled | lifecycle | 卸载MCP包 | medium | package_name, install_age_days | MCP服务发现与安装 |
| 219 | skill_uninstalled | lifecycle | 卸载技能 | medium | skill_id, install_age_days | 技能市场 |
| 220 | pet_displayed | lifecycle | 桌面宠物显示 | high | pet_type, pet_name | 桌面宠物交互 |
| 221 | pet_hidden | lifecycle | 桌面宠物隐藏 | medium | pet_type, displayed_duration_ms | 桌面宠物交互 |
| 222 | chat_window_closed | lifecycle | 关闭聊天窗口 | medium | window_duration_ms, messages_sent_count | 多窗口管理 |
| 223 | device_disconnected | lifecycle | 断开设备连接 | medium | device_id, connection_duration_ms, disconnect_reason | 设备配对 |
| 224 | idea_deleted | lifecycle | 删除想法 | medium | idea_id, idea_age_days | 想法管理 |
| 225 | page_publish_rollback | lifecycle | 回滚发布版本 | medium | page_id, from_version, to_version | 页面发布与分享 |
| 226 | gateway_connection_restored | lifecycle | Gateway连接恢复 | critical | outage_duration_ms, reconnect_attempts | 错误恢复 |
| 227 | offline_mode_entered | lifecycle | 进入离线模式 | high | trigger | 错误恢复 |
| 228 | offline_mode_exited | lifecycle | 退出离线模式 | high | offline_duration_ms, pending_sync_count | 错误恢复 |
| 229 | notification_received | lifecycle | 收到新通知 | high | notification_type, notification_category, source | 通知中心 |
| 230 | notification_deleted | lifecycle | 删除通知 | medium | notification_id, notification_age_hours | 通知中心 |
| 231 | sync_completed | lifecycle | 同步完成 | high | sync_type, synced_items_count, duration_ms, conflicts_count | 离线工作 |
| 232 | app_launched | lifecycle | 应用启动 | critical | app_version, platform, os_version, is_first_launch, locale | 全局 |
| 233 | app_session_start | lifecycle | 应用会话开始 | critical | session_id, previous_session_duration_ms, session_gap_ms | 全局 |
| 234 | app_session_end | lifecycle | 应用会话结束 | critical | session_id, session_duration_ms, pages_viewed_count, messages_sent_count, tasks_created_count | 全局 |
| 235 | app_updated | lifecycle | 应用更新 | high | from_version, to_version, update_method | 全局 |

---

## 四、参数类型定义

以下是分析事件参数的 TypeScript 接口定义，所有参数名使用 snake_case。

```typescript
// ============================================================
// 通用参数
// ============================================================

/** 所有事件的基础参数 */
interface BaseEventParams {
  /** 应用版本号，如 "1.3.1" */
  app_version: string;
  /** 操作系统：macos | windows | linux */
  platform: "macos" | "windows" | "linux";
  /** 操作系统版本 */
  os_version: string;
  /** 用户语言设置，如 "zh-CN" */
  locale: string;
  /** 应用会话ID (UUID v4) */
  session_id: string;
  /** 用户ID哈希（SHA-256），用于跨事件关联 */
  user_id_hash?: string;
}

/** 耗时与结果参数 */
interface DurationParams {
  /** 操作耗时（毫秒） */
  duration_ms: number;
  /** 操作是否成功 */
  success?: boolean;
}

/** 错误参数 */
interface ErrorParams {
  /** 错误类型分类 */
  error_type: string;
  /** 错误详情（不包含用户隐私数据） */
  error_message: string;
}

// ============================================================
// 引导流程参数
// ============================================================

interface OnboardingParams {
  /** 引导步骤名称 */
  step_name: string;
  /** 步骤索引（从0开始） */
  step_index: number;
  /** 引导总步骤数 */
  total_steps: number;
}

interface OnboardingEnvCheckParams {
  /** Git 是否可用 */
  git_available: boolean;
  /** Node.js 是否可用 */
  node_available: boolean;
  /** Python 是否可用 */
  python_available: boolean;
  /** 检查未通过的数量 */
  failed_checks_count: number;
}

interface OnboardingOAuthParams {
  /** OAuth 提供商 */
  provider: "github";
}

interface OnboardingAgentParams {
  /** 智能体名称 */
  agent_name: string;
  /** AI Provider ID */
  provider_id: string;
  /** 模型 ID */
  model_id: string;
  /** 是否配置了 MCP */
  has_mcp: boolean;
  /** 是否配置了 Skills */
  has_skills: boolean;
}

interface OnboardingInstallParams {
  /** 安装的版本号 */
  version: string;
  /** 安装方式 */
  install_method: string;
}

// ============================================================
// 认证参数
// ============================================================

interface AuthParams {
  /** 认证提供商 */
  provider: string;
  /** 认证方式：oauth | email */
  method: "oauth" | "email";
}

interface AuthSuccessParams extends AuthParams {
  /** 用户ID哈希 */
  user_id_hash: string;
  /** 是否新用户 */
  is_new_user: boolean;
  /** 认证耗时 */
  duration_ms: number;
}

interface AuthTokenParams {
  /** 刷新方式 */
  refresh_method: string;
  /** 耗时 */
  duration_ms: number;
  /** 是否成功 */
  success: boolean;
}

interface AuthSessionExpiredParams {
  /** Session 存活时间（毫秒） */
  session_age_ms: number;
  /** 过期原因 */
  reason: string;
}

// ============================================================
// 工作区参数
// ============================================================

interface WorkspaceParams {
  /** 工作区唯一 ID */
  workspace_id: string;
}

interface WorkspaceCreateParams {
  /** 工作区名称 */
  workspace_name: string;
  /** 路径深度 */
  workspace_path_depth: number;
  /** 是否包含 Git 仓库 */
  has_git: boolean;
}

interface WorkspaceSwitchParams {
  /** 来源工作区 ID */
  from_workspace_id: string;
  /** 目标工作区 ID */
  to_workspace_id: string;
  /** 切换方式：click | search | shortcut */
  switch_method: "click" | "search" | "shortcut";
}

interface WorkspaceDeleteParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 工作区存在天数 */
  workspace_age_days: number;
  /** 任务数量 */
  task_count: number;
}

interface WorkspaceSettingsParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 设置分区名称 */
  section: string;
}

interface AgentDiscoveryParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 发现方式 */
  discovery_method: string;
  /** 发现的智能体数量 */
  agents_found_count?: number;
}

// ============================================================
// 聊天参数
// ============================================================

interface ChatSessionParams {
  /** 会话 ID */
  session_id: string;
  /** 智能体 ID */
  agent_id?: string;
  /** 执行器类型 */
  executor_type?: string;
  /** 会话类型：single | group */
  session_type?: "single" | "group";
  /** 工作区 ID */
  workspace_id?: string;
}

interface ChatMessageSentParams {
  /** 会话 ID */
  session_id: string;
  /** 智能体 ID */
  agent_id: string;
  /** 模型 ID */
  model_id: string;
  /** 消息类型：text | slash_command | attachment */
  message_type: "text" | "slash_command" | "attachment";
  /** 消息长度（字符数） */
  message_length: number;
  /** 是否包含附件 */
  has_attachment: boolean;
}

interface ChatStreamStartedParams {
  /** 会话 ID */
  session_id: string;
  /** 智能体 ID */
  agent_id: string;
  /** 模型 ID */
  model_id: string;
}

interface ChatFirstTokenParams {
  /** 会话 ID */
  session_id: string;
  /** 首Token延迟（毫秒） */
  time_to_first_token_ms: number;
}

interface ChatStreamCompletedParams {
  /** 会话 ID */
  session_id: string;
  /** 总 Token 消耗 */
  total_tokens: number;
  /** 工具调用次数 */
  tool_calls_count: number;
  /** 总耗时 */
  duration_ms: number;
  /** Token 费用（输入+输出） */
  total_cost_tokens: number;
}

interface ChatStreamStoppedParams {
  /** 会话 ID */
  session_id: string;
  /** 停止前已生成的 Token 数 */
  tokens_generated_before_stop: number;
  /** 停止原因 */
  stop_reason: string;
}

interface ChatToolUseParams {
  /** 会话 ID */
  session_id: string;
  /** 工具名称 */
  tool_name: string;
  /** 工具调用序号 */
  tool_call_index: number;
}

interface ChatPlanParams {
  /** 会话 ID */
  session_id: string;
  /** Plan 类型 */
  plan_type: string;
  /** 审批耗时 */
  approval_duration_ms?: number;
  /** 拒绝原因 */
  rejection_reason?: string;
}

interface ChatQuestionParams {
  /** 会话 ID */
  session_id: string;
  /** 问题类型 */
  question_type: string;
  /** 回答长度 */
  answer_length: number;
}

interface ChatArtifactParams {
  /** 会话 ID */
  session_id: string;
  /** Artifact 类型：code | image | text */
  artifact_type: "code" | "image" | "text";
  /** Artifact 大小（字节） */
  artifact_size_bytes: number;
}

interface ChatSessionActionParams {
  /** 会话 ID */
  session_id: string;
}

interface ChatSessionRenameParams {
  /** 会话 ID */
  session_id: string;
  /** 名称长度 */
  name_length: number;
}

interface ChatSessionDeleteParams {
  /** 会话 ID */
  session_id: string;
  /** 会话存在天数 */
  session_age_days: number;
  /** 消息数量 */
  message_count: number;
}

interface ChatSessionSwitchParams {
  /** 来源会话 ID */
  from_session_id: string;
  /** 目标会话 ID */
  to_session_id: string;
  /** 切换方式：click | search */
  switch_method: "click" | "search";
}

interface ChatModeSwitchedParams {
  /** 来源模式 */
  from_mode: string;
  /** 目标模式：full | floating | compact | expanded */
  to_mode: "full" | "floating" | "compact" | "expanded";
}

interface ChatSlashCommandParams {
  /** 会话 ID */
  session_id: string;
  /** 命令名称 */
  command_name: string;
  /** 命令分类 */
  command_category: string;
}

interface ChatSearchParams {
  /** 会话 ID */
  session_id: string;
  /** 搜索关键词长度 */
  search_query_length: number;
  /** 结果数量 */
  results_count: number;
}

interface ChatContextSettingsParams {
  /** 会话 ID */
  session_id: string;
  /** 上下文窗口大小 */
  context_window_size: number;
  /** 最大 Token 数 */
  max_tokens: number;
}

// ============================================================
// Agent 配置参数
// ============================================================

interface AgentCreateParams {
  /** 智能体名称 */
  agent_name: string;
  /** 作用域：workspace | global */
  scope: "workspace" | "global";
  /** Provider ID */
  provider_id: string;
  /** 模型 ID */
  model_id: string;
  /** 是否从模板创建 */
  from_template: boolean;
}

interface AgentUpdateParams {
  /** 智能体 ID */
  agent_id: string;
  /** 变更的字段列表 */
  fields_changed: string[];
  /** System Prompt 是否变更 */
  has_system_prompt_changed: boolean;
  /** MCP 配置是否变更 */
  has_mcp_changed: boolean;
  /** Skills 配置是否变更 */
  has_skills_changed: boolean;
}

interface AgentMcpParams {
  /** 智能体 ID */
  agent_id: string;
  /** MCP 服务器名称 */
  mcp_server_name: string;
  /** MCP 服务器类型 */
  mcp_server_type: string;
}

interface AgentSkillParams {
  /** 智能体 ID */
  agent_id: string;
  /** 技能 ID */
  skill_id: string;
  /** 技能名称 */
  skill_name: string;
}

interface AgentMemoryParams {
  /** 智能体 ID */
  agent_id: string;
  /** Memory 文件大小（字节） */
  memory_size_bytes: number;
  /** 编辑耗时 */
  edit_duration_ms: number;
}

interface AgentVariableParams {
  /** 智能体 ID */
  agent_id: string;
  /** 变量键名 */
  variable_key: string;
}

interface AgentTemplateParams {
  /** 智能体 ID */
  agent_id: string;
  /** 模板名称 */
  template_name: string;
}

interface AgentFromTemplateParams {
  /** 模板 ID */
  template_id: string;
  /** 新智能体名称 */
  agent_name: string;
}

interface AgentDeleteParams {
  /** 智能体 ID */
  agent_id: string;
  /** 存在天数 */
  agent_age_days: number;
  /** 关联会话数 */
  sessions_count: number;
}

// ============================================================
// 群聊参数
// ============================================================

interface GroupChatCreateParams {
  /** 群组名称 */
  group_name: string;
  /** 成员数量 */
  members_count: number;
  /** 工作区 ID */
  workspace_id: string;
}

interface GroupChatMemberParams {
  /** 群组 ID */
  group_id: string;
  /** 成员类型：agent | executor */
  member_type: "agent" | "executor";
  /** 成员 ID */
  member_id: string;
}

interface GroupChatMessageParams {
  /** 群组 ID */
  group_id: string;
  /** 会话 ID */
  session_id: string;
  /** 消息类型 */
  message_type: string;
  /** 是否包含 @提及 */
  has_mention: boolean;
}

interface GroupChatWsParams {
  /** 群组 ID */
  group_id: string;
  /** 会话 ID */
  session_id: string;
  /** 连接耗时 */
  connection_duration_ms: number;
}

// ============================================================
// 看板参数
// ============================================================

interface KanbanTaskCreateParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 任务标题长度 */
  task_title_length: number;
  /** 是否有描述 */
  has_description: boolean;
  /** 优先级：high | medium | low */
  priority: "high" | "medium" | "low";
  /** 是否有标签 */
  has_labels: boolean;
  /** 列 ID */
  column_id: string;
}

interface KanbanTaskUpdateParams {
  /** 任务 ID */
  task_id: string;
  /** 变更字段列表 */
  fields_changed: string[];
  /** 更新来源：dialog | inline */
  update_source: "dialog" | "inline";
}

interface KanbanTaskMoveParams {
  /** 任务 ID */
  task_id: string;
  /** 来源列 */
  from_column: string;
  /** 目标列 */
  to_column: string;
  /** 来源位置 */
  from_position: number;
  /** 目标位置 */
  to_position: number;
}

interface KanbanTaskStatusParams {
  /** 任务 ID */
  task_id: string;
  /** 来源状态 */
  from_status: string;
  /** 目标状态 */
  to_status: string;
  /** 变更来源：drag | button | api */
  change_source: "drag" | "button" | "api";
}

interface KanbanTaskDeleteParams {
  /** 任务 ID */
  task_id: string;
  /** 任务存在天数 */
  task_age_days: number;
  /** 所在列 */
  column: string;
}

interface KanbanCommentParams {
  /** 任务 ID */
  task_id: string;
  /** 评论长度 */
  comment_length: number;
  /** 是否有附件 */
  has_attachment: boolean;
}

interface KanbanReactionParams {
  /** 任务 ID */
  task_id: string;
  /** 评论 ID */
  comment_id: string;
  /** 表情符号 */
  reaction_emoji: string;
  /** 操作：add | remove */
  action: "add" | "remove";
}

interface KanbanFilterParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 筛选类型 */
  filter_type: string;
  /** 筛选值 */
  filter_value: string;
}

interface KanbanSearchParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 搜索关键词长度 */
  search_query_length: number;
  /** 结果数量 */
  results_count: number;
}

interface KanbanBatchParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 操作类型：enable | disable | delete | archive */
  operation_type: "enable" | "disable" | "delete" | "archive";
  /** 影响数量 */
  affected_count: number;
}

interface KanbanQueueParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 最大并行任务数 */
  max_parallel_tasks: number;
  /** 旧值 */
  previous_value: number;
}

interface KanbanTaskEnqueuedParams {
  /** 任务 ID */
  task_id: string;
  /** 队列位置 */
  queue_position: number;
  /** 队列总数 */
  queue_total: number;
}

interface KanbanTaskStuckParams {
  /** 任务 ID */
  task_id: string;
  /** 卡住时长（毫秒） */
  stuck_duration_ms: number;
  /** 最后活动类型 */
  last_activity_type: string;
}

// ============================================================
// 定时任务参数
// ============================================================

interface CronJobCreateParams {
  /** 任务名称 */
  job_name: string;
  /** 调度类型：interval | cron */
  schedule_type: "interval" | "cron";
  /** 任务类型：agent | script */
  task_type: "agent" | "script";
  /** 是否配置通知 */
  has_notification: boolean;
}

interface CronJobUpdateParams {
  /** 任务 ID */
  job_id: string;
  /** 变更字段列表 */
  fields_changed: string[];
  /** 调度规则是否变更 */
  has_schedule_changed: boolean;
}

interface CronJobDeleteParams {
  /** 任务 ID */
  job_id: string;
  /** 存在天数 */
  job_age_days: number;
  /** 历史执行次数 */
  execution_count: number;
}

interface CronJobToggleParams {
  /** 任务 ID */
  job_id: string;
  /** 禁用持续时长 */
  was_disabled_duration_ms?: number;
  /** 启用持续时长 */
  enabled_duration_ms?: number;
}

interface CronJobRunManualParams {
  /** 任务 ID */
  job_id: string;
  /** 触发来源：table | batch */
  triggered_from: "table" | "batch";
}

interface CronJobExecutedParams {
  /** 任务 ID */
  job_id: string;
  /** 执行结果：success | failed | timeout */
  execution_result: "success" | "failed" | "timeout";
  /** 执行耗时 */
  duration_ms: number;
  /** 输出长度 */
  output_length: number;
}

interface CronJobExecFailedParams {
  /** 任务 ID */
  job_id: string;
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
  /** 重试次数 */
  retry_count: number;
}

interface CronLogsParams {
  /** 任务 ID */
  job_id: string;
  /** 日志条目数 */
  log_entries_count: number;
}

interface CronBatchParams {
  /** 操作类型：enable | disable | delete */
  operation_type: "enable" | "disable" | "delete";
  /** 影响数量 */
  affected_count: number;
}

// ============================================================
// 文件浏览参数
// ============================================================

interface FileBrowserParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 初始路径深度 */
  initial_path_depth?: number;
}

interface FileViewSwitchedParams {
  /** 来源视图 */
  from_view: string;
  /** 目标视图：list | icon | column | gallery */
  to_view: "list" | "icon" | "column" | "gallery";
}

interface FileDirectoryParams {
  /** 来源路径深度 */
  from_path_depth: number;
  /** 目标路径深度 */
  to_path_depth: number;
  /** 导航方式：tree | breadcrumb */
  navigation_method: "tree" | "breadcrumb";
}

interface FilePreviewParams {
  /** 文件扩展名 */
  file_extension: string;
  /** 文件大小（字节） */
  file_size_bytes: number;
  /** 预览类型：image | code | markdown | pdf | video | audio | font | docx | xlsx | pptx */
  preview_type: "image" | "code" | "markdown" | "pdf" | "video" | "audio" | "font" | "docx" | "xlsx" | "pptx";
}

interface FilePreviewFailedParams {
  /** 文件扩展名 */
  file_extension: string;
  /** 文件大小 */
  file_size_bytes: number;
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
}

interface FileCreatedParams {
  /** 文件扩展名 */
  file_extension: string;
  /** 创建方式：new | upload */
  creation_method: "new" | "upload";
  /** 文件大小 */
  file_size_bytes: number;
}

interface FileDeletedParams {
  /** 文件扩展名 */
  file_extension: string;
  /** 文件大小 */
  file_size_bytes: number;
}

interface FileRenamedParams {
  /** 旧扩展名 */
  old_extension: string;
  /** 新扩展名 */
  new_extension: string;
}

interface FileSearchParams {
  /** 搜索关键词长度 */
  search_query_length: number;
  /** 结果数量 */
  results_count: number;
  /** 搜索耗时 */
  search_duration_ms: number;
}

interface FileExternalParams {
  /** 文件扩展名 */
  file_extension: string;
  /** 打开方式：system_default | editor | terminal | reveal */
  open_method: "system_default" | "editor" | "terminal" | "reveal";
}

// ============================================================
// MCP 市场参数
// ============================================================

interface McpMarketplaceParams {
  /** 触发来源：sidebar | navigation */
  source: "sidebar" | "navigation";
}

interface McpMarketplaceSearchParams {
  /** 搜索关键词 */
  search_query: string;
  /** 结果数量 */
  results_count: number;
  /** 搜索耗时 */
  search_duration_ms: number;
}

interface McpMarketplaceCategoryParams {
  /** 分类名称 */
  category_name: string;
  /** 筛选结果数 */
  results_count: number;
}

interface McpMarketplaceSourceParams {
  /** 来源数据源 */
  from_source: string;
  /** 目标数据源：official | community */
  to_source: "official" | "community";
}

interface McpPackageDetailParams {
  /** 包名称 */
  package_name: string;
  /** 包来源 */
  package_source: string;
  /** 包版本 */
  package_version: string;
}

interface McpPackageInstallParams {
  /** 包名称 */
  package_name: string;
  /** 包版本 */
  package_version: string;
  /** 安装来源：marketplace | official */
  install_source: "marketplace" | "official";
  /** 安装耗时 */
  duration_ms?: number;
  /** 是否成功 */
  success?: boolean;
}

interface McpPackageInstallFailedParams {
  /** 包名称 */
  package_name: string;
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
  /** 操作耗时 */
  duration_ms: number;
}

interface McpPackageUninstallParams {
  /** 包名称 */
  package_name: string;
  /** 已安装天数 */
  install_age_days: number;
}

// ============================================================
// MCP 调试器参数
// ============================================================

interface McpInspectorConnectedParams {
  /** 传输类型：stdio | sse | streamable_http */
  transport_type: "stdio" | "sse" | "streamable_http";
  /** 服务器名称 */
  server_name: string;
  /** 连接耗时 */
  connection_duration_ms: number;
}

interface McpInspectorConnectFailedParams {
  /** 传输类型 */
  transport_type: string;
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
}

interface McpInspectorToolCallParams {
  /** 工具名称 */
  tool_name: string;
  /** 参数数量 */
  params_count: number;
  /** 是否有自定义Headers */
  has_custom_headers: boolean;
}

interface McpInspectorToolResultParams {
  /** 工具名称 */
  tool_name: string;
  /** 结果类型：success | error */
  result_type: "success" | "error";
  /** 执行耗时 */
  duration_ms: number;
  /** 响应大小（字节） */
  response_size_bytes: number;
}

interface McpInspectorConfigParams {
  /** 配置名称 */
  config_name: string;
  /** 传输类型 */
  transport_type: string;
  /** 工具数量 */
  tools_count?: number;
  /** 配置存在天数 */
  config_age_days?: number;
}

interface McpInspectorLogLevelParams {
  /** 来源日志级别 */
  from_level: string;
  /** 目标日志级别 */
  to_level: string;
}

interface McpInspectorResourceParams {
  /** 资源 URI */
  resource_uri: string;
  /** 资源大小（字节） */
  resource_size_bytes: number;
}

// ============================================================
// 技能市场参数
// ============================================================

interface SkillsMarketplaceParams {
  /** 触发来源：sidebar */
  source: string;
}

interface SkillsMarketplaceSearchParams {
  /** 搜索关键词 */
  search_query: string;
  /** 结果数量 */
  results_count: number;
}

interface SkillsSourceParams {
  /** 来源数据源 */
  from_source: string;
  /** 目标数据源：official | community | installed */
  to_source: "official" | "community" | "installed";
}

interface SkillDetailParams {
  /** 技能 ID */
  skill_id: string;
  /** 技能名称 */
  skill_name: string;
  /** 触发词列表 */
  trigger_words: string[];
  /** 包含文件数 */
  files_count: number;
}

interface SkillInstallParams {
  /** 技能 ID */
  skill_id: string;
  /** 技能名称 */
  skill_name: string;
  /** 安装来源 */
  install_source: string;
  /** 安装耗时 */
  duration_ms?: number;
  /** 是否成功 */
  success?: boolean;
}

interface SkillInstallFailedParams {
  /** 技能 ID */
  skill_id: string;
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
}

interface SkillUninstallParams {
  /** 技能 ID */
  skill_id: string;
  /** 已安装天数 */
  install_age_days: number;
}

// ============================================================
// 设置参数
// ============================================================

interface SettingsSectionParams {
  /** 触发来源 */
  source: string;
  /** 初始分区 */
  initial_section?: string;
  /** 来源分区 */
  from_section?: string;
  /** 目标分区 */
  to_section?: string;
}

interface SettingsThemeParams {
  /** 来源主题 */
  from_theme: string;
  /** 目标主题：light | dark | system */
  to_theme: "light" | "dark" | "system";
}

interface SettingsLanguageParams {
  /** 来源语言 */
  from_language: string;
  /** 目标语言 */
  to_language: string;
}

interface SettingsShortcutParams {
  /** 快捷键名称 */
  shortcut_key: string;
  /** 旧绑定 */
  old_binding: string;
  /** 新绑定 */
  new_binding: string;
}

interface SettingsNotificationParams {
  /** 是否开启免打扰 */
  do_not_disturb_enabled: boolean;
  /** 变更的分类列表 */
  categories_changed: string[];
}

interface SettingsProviderParams {
  /** Provider ID */
  provider_id: string;
  /** Provider 类型 */
  provider_type: string;
}

interface SettingsProviderTestParams {
  /** Provider ID */
  provider_id: string;
  /** 测试结果：success | failed */
  test_result: "success" | "failed";
  /** 耗时 */
  duration_ms: number;
}

interface SettingsModelParams {
  /** 模型 ID */
  model_id: string;
  /** Provider ID */
  provider_id: string;
  /** 模型分类 */
  model_category?: string;
}

interface SettingsModelDefaultParams {
  /** 旧默认模型 ID */
  from_model_id: string;
  /** 新默认模型 ID */
  to_model_id: string;
}

interface SettingsApiKeyParams {
  /** Provider ID */
  provider_id: string;
  /** 是否已有 Key */
  has_existing_key: boolean;
}

interface SettingsApiKeyValidateParams {
  /** Provider ID */
  provider_id: string;
  /** 验证结果：valid | invalid | error */
  validation_result: "valid" | "invalid" | "error";
}

interface SettingsSandboxParams {
  /** 沙箱 Provider */
  sandbox_provider: string;
  /** 沙箱是否启用 */
  sandbox_enabled: boolean;
}

interface SettingsPetParams {
  /** 旧宠物 */
  from_pet: string;
  /** 新宠物 */
  to_pet: string;
  /** 宠物是否启用 */
  pet_enabled: boolean;
}

interface SettingsTerminalFontParams {
  /** 字体族 */
  font_family: string;
  /** 字号 */
  font_size: number;
  /** 是否应用了预设 */
  preset_applied: boolean;
}

interface SettingsDeveloperParams {
  /** 偏好 IDE 是否变更 */
  preferred_ide_changed: boolean;
  /** 偏好终端是否变更 */
  preferred_terminal_changed: boolean;
  /** 跳过权限检查是否变更 */
  skip_permissions_changed: boolean;
}

// ============================================================
// 桌面宠物参数
// ============================================================

interface PetParams {
  /** 宠物类型 */
  pet_type: string;
  /** 宠物名称 */
  pet_name?: string;
}

interface PetDisplayedParams {
  /** 宠物类型 */
  pet_type: string;
  /** 宠物名称 */
  pet_name: string;
}

interface PetHiddenParams {
  /** 宠物类型 */
  pet_type: string;
  /** 显示持续时长 */
  displayed_duration_ms: number;
}

interface PetDraggedParams {
  /** 拖拽距离（像素） */
  drag_distance_px: number;
  /** 触发的动画：walk | jump | fall */
  animation_triggered: "walk" | "jump" | "fall";
}

interface PetClickedParams {
  /** 宠物类型 */
  pet_type: string;
  /** 上一个动画 */
  previous_animation: string;
}

interface PetHoveredParams {
  /** 悬停持续时长 */
  hover_duration_ms: number;
}

// ============================================================
// 多窗口参数
// ============================================================

interface ChatWindowParams {
  /** 触发来源：button | menu | pet */
  trigger_source: "button" | "menu" | "pet";
  /** 窗口持续时长 */
  window_duration_ms?: number;
  /** 发送消息数 */
  messages_sent_count?: number;
}

interface PagePreviewWindowParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 页面 UID */
  page_uid: string;
  /** 视图模式：page | skill */
  view_mode: "page" | "skill";
}

interface PagePreviewTabParams {
  /** 标签页 URL */
  tab_url: string;
  /** 标签页索引 */
  tab_index: number;
}

interface PagePreviewNavigateParams {
  /** 导航类型：forward | back | refresh */
  navigation_type: "forward" | "back" | "refresh";
  /** 标签页 ID */
  tab_id: string;
}

interface ScreenshotOverlayParams {
  /** 截图类型：region | fullscreen */
  screenshot_type: "region" | "fullscreen";
  /** 显示器 ID */
  monitor_id?: string;
}

interface ScreenshotConfirmParams {
  /** 截图类型 */
  screenshot_type: string;
  /** 使用的标注工具 */
  annotation_tools_used: string[];
  /** 是否有标注 */
  has_annotation: boolean;
  /** 选择区域（像素） */
  selection_area_px: number;
}

interface ScreenshotCancelParams {
  /** 截图类型 */
  screenshot_type: string;
  /** Overlay 持续时长 */
  overlay_duration_ms: number;
  /** 是否有选择区域 */
  had_selection: boolean;
}

// ============================================================
// 设备配对参数
// ============================================================

interface DevicePairPageParams {
  /** 触发来源 */
  source: string;
}

interface DeviceQrCodeParams {
  /** 设备类型：gateway | client */
  device_type: "gateway" | "client";
}

interface DevicePairedParams {
  /** 设备类型 */
  device_type: string;
  /** 设备名称 */
  device_name: string;
  /** 配对方式：qr | manual */
  pairing_method: "qr" | "manual";
  /** 配对耗时 */
  duration_ms: number;
}

interface DeviceDisconnectParams {
  /** 设备 ID */
  device_id: string;
  /** 连接持续时长 */
  connection_duration_ms: number;
  /** 断开原因 */
  disconnect_reason: string;
}

interface DeviceWsMessageParams {
  /** 设备 ID */
  device_id: string;
  /** 消息类型 */
  message_type: string;
  /** 消息大小 */
  message_size_bytes: number;
}

interface MobileConnectParams {
  /** 连接方式：scan | lan */
  connection_method: "scan" | "lan";
  /** 发现的 Gateway 数量 */
  gateway_found_count: number;
}

interface MobileChatMessageParams {
  /** 会话 ID */
  session_id: string;
  /** 消息长度 */
  message_length: number;
  /** 网络类型 */
  network_type: string;
}

// ============================================================
// 想法管理参数
// ============================================================

interface IdeaTypeCreateParams {
  /** 类型名称 */
  type_name: string;
  /** 是否有 Prompt */
  has_prompt: boolean;
}

interface IdeasGeneratedParams {
  /** Idea 类型 ID */
  idea_type_id: string;
  /** 生成 Idea 数量 */
  ideas_count: number;
  /** 生成耗时 */
  duration_ms: number;
  /** 使用的模型 */
  model_used: string;
}

interface IdeaPromotedParams {
  /** Idea ID */
  idea_id: string;
  /** 任务 ID */
  task_id: string;
  /** 提升方式 */
  promotion_method: string;
}

interface IdeaDeleteParams {
  /** Idea ID */
  idea_id: string;
  /** Idea 存在天数 */
  idea_age_days: number;
}

interface IdeaFileSaveParams {
  /** 文件路径 */
  file_path: string;
  /** 文件大小 */
  file_size_bytes: number;
  /** 保存耗时 */
  save_duration_ms: number;
}

// ============================================================
// 页面发布参数
// ============================================================

interface PageCreateParams {
  /** 工作区 ID */
  workspace_id: string;
  /** 页面类型：static | proxy | server */
  page_type: "static" | "proxy" | "server";
  /** 是否使用模板 */
  has_template: boolean;
}

interface PageContentUpdateParams {
  /** 页面 ID */
  page_id: string;
  /** 内容大小 */
  content_size_bytes: number;
  /** 更新方式 */
  update_method: string;
}

interface PagePublishStartParams {
  /** 页面 ID */
  page_id: string;
  /** 页面类型 */
  page_type: string;
}

interface PagePublishCompletedParams {
  /** 页面 ID */
  page_id: string;
  /** 发布 URL */
  publish_url: string;
  /** 发布耗时 */
  duration_ms: number;
  /** 资源数量 */
  asset_count: number;
}

interface PagePublishFailedParams {
  /** 页面 ID */
  page_id: string;
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
  /** 耗时 */
  duration_ms: number;
}

interface PagePublishRollbackParams {
  /** 页面 ID */
  page_id: string;
  /** 回滚前版本 */
  from_version: string;
  /** 回滚后版本 */
  to_version: string;
}

interface PageAssetUploadParams {
  /** 页面 ID */
  page_id: string;
  /** 资源类型 */
  asset_type: string;
  /** 资源大小 */
  asset_size_bytes: number;
}

// ============================================================
// 错误恢复参数
// ============================================================

interface AppErrorBoundaryParams {
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
  /** React 组件栈 */
  component_stack: string;
  /** 当前路由路径 */
  route_path: string;
}

interface GatewayConnectionLostParams {
  /** 之前的状态 */
  previous_status: string;
  /** 断开原因 */
  disconnect_reason: string;
  /** 连接持续时长 */
  connection_duration_ms: number;
}

interface GatewayConnectionRestoredParams {
  /** 中断持续时长 */
  outage_duration_ms: number;
  /** 重连尝试次数 */
  reconnect_attempts: number;
}

interface SseConnectionErrorParams {
  /** SSE 端点 */
  endpoint: string;
  /** 错误类型 */
  error_type: string;
  /** 重连尝试次数 */
  reconnect_attempt: number;
}

interface ApiCallFailedParams {
  /** API 端点 */
  endpoint: string;
  /** HTTP 状态码 */
  http_status: number;
  /** 错误码 */
  error_code: string;
  /** 重试次数 */
  retry_count: number;
}

interface OfflineModeParams {
  /** 触发原因：network_lost | gateway_down */
  trigger: "network_lost" | "gateway_down";
}

interface OfflineModeExitedParams {
  /** 离线持续时长 */
  offline_duration_ms: number;
  /** 待同步数量 */
  pending_sync_count: number;
}

interface PageLoadFailedParams {
  /** 路由路径 */
  route_path: string;
  /** 错误类型 */
  error_type: string;
  /** 是否懒加载 */
  is_lazy_load: boolean;
}

// ============================================================
// App 崩溃参数
// ============================================================

interface AppCrashedParams {
  /** 崩溃类型 */
  crash_type: string;
  /** 崩溃前最后的路径 */
  last_route: string;
  /** 应用运行时长 */
  app_uptime_ms: number;
}

// ============================================================
// 语音交互参数
// ============================================================

interface VoiceStartedParams {
  /** 触发方式：button | wake_word */
  trigger_method: "button" | "wake_word";
}

interface VoiceWakeWordParams {
  /** 唤醒词文本 */
  wake_word: string;
  /** 检测置信度（0-1） */
  detection_confidence: number;
}

interface VoiceRecognizedParams {
  /** 转写文本长度 */
  transcript_length: number;
  /** 识别耗时 */
  recognition_duration_ms: number;
  /** 识别语言 */
  language: string;
}

interface VoiceResponseStartedParams {
  /** 响应 ID */
  response_id: string;
  /** 模型 ID */
  model_id: string;
}

interface VoiceResponseCompletedParams {
  /** 响应 ID */
  response_id: string;
  /** 响应长度 */
  response_length: number;
  /** 总耗时 */
  total_duration_ms: number;
}

interface VoiceStoppedParams {
  /** 停止原因：manual | silence | error */
  stop_reason: "manual" | "silence" | "error";
  /** 会话持续时长 */
  session_duration_ms: number;
}

interface VoiceErrorParams {
  /** 错误类型 */
  error_type: string;
  /** 错误信息 */
  error_message: string;
  /** 语音状态 */
  voice_state: string;
}

// ============================================================
// GitHub 集成参数
// ============================================================

interface GitHubIntegrationParams {
  /** 工作区 ID */
  workspace_id: string;
}

interface GitHubIssuesLoadedParams {
  /** 仓库名称 */
  repo_name: string;
  /** Issue 数量 */
  issues_count: number;
  /** 分页页码 */
  page_number: number;
}

interface GitHubIssueSelectedParams {
  /** Issue 编号 */
  issue_number: number;
  /** 是否已有 AI 分析 */
  has_ai_analysis: boolean;
}

interface GitHubAutoFixCreatedParams {
  /** Issue 编号 */
  issue_number: number;
  /** 任务类型 */
  task_type: string;
  /** 估计复杂度 */
  estimated_complexity: string;
}

interface GitHubAutoFixCompletedParams {
  /** 任务 ID */
  task_id: string;
  /** Issue 编号 */
  issue_number: number;
  /** 修复耗时 */
  fix_duration_ms: number;
  /** 是否成功 */
  success: boolean;
}

// ============================================================
// 斜杠命令参数
// ============================================================

interface SlashCommandPanelParams {
  /** 触发方式 */
  trigger: string;
}

interface SlashCommandExecutedParams {
  /** 命令名称 */
  command_name: string;
  /** 命令分类 */
  command_category: string;
  /** 执行类型：message | ui | action | prompt */
  execution_type: "message" | "ui" | "action" | "prompt";
  /** 执行耗时 */
  duration_ms: number;
}

// ============================================================
// 通知中心参数
// ============================================================

interface NotificationReceivedParams {
  /** 通知类型 */
  notification_type: string;
  /** 通知分类 */
  notification_category: string;
  /** 来源 */
  source: string;
}

interface NotificationClickedParams {
  /** 通知 ID */
  notification_id: string;
  /** 通知类型 */
  notification_type: string;
  /** 跳转目标类型 */
  target_type: string;
}

interface NotificationMarkReadParams {
  /** 通知 ID */
  notification_id: string;
  /** 标记范围：single | all */
  mark_scope: "single" | "all";
}

interface NotificationCenterOpenedParams {
  /** 未读数量 */
  unread_count: number;
}

interface NotificationDeletedParams {
  /** 通知 ID */
  notification_id: string;
  /** 通知存在小时数 */
  notification_age_hours: number;
}

// ============================================================
// 离线/同步参数
// ============================================================

interface CacheAccessedParams {
  /** 缓存类型 */
  cache_type: string;
  /** 是否命中缓存 */
  cache_hit: boolean;
  /** 数据大小 */
  data_size_bytes: number;
}

interface SyncStartedParams {
  /** 同步类型 */
  sync_type: string;
  /** 待同步项数量 */
  pending_items_count: number;
}

interface SyncCompletedParams {
  /** 同步类型 */
  sync_type: string;
  /** 已同步项数量 */
  synced_items_count: number;
  /** 同步耗时 */
  duration_ms: number;
  /** 冲突数量 */
  conflicts_count: number;
}

// ============================================================
// 演示模式参数
// ============================================================

interface PresentationStartedParams {
  /** 会话 ID */
  session_id: string;
  /** 演示类型 */
  presentation_type: string;
}

interface PresentationStepParams {
  /** 步骤 ID */
  step_id: string;
  /** 步骤状态：pending | active | completed */
  step_status: "pending" | "active" | "completed";
  /** 工具名称 */
  tool_name: string;
  /** 是否有截图 */
  has_screenshot: boolean;
}

interface PresentationStoppedParams {
  /** 会话 ID */
  session_id: string;
  /** 总步骤数 */
  total_steps: number;
  /** 已完成步骤数 */
  completed_steps: number;
  /** 演示持续时长 */
  duration_ms: number;
}

// ============================================================
// 全局生命周期参数
// ============================================================

interface AppLaunchedParams {
  /** 应用版本 */
  app_version: string;
  /** 操作系统 */
  platform: string;
  /** 系统版本 */
  os_version: string;
  /** 是否首次启动 */
  is_first_launch: boolean;
  /** 语言设置 */
  locale: string;
}

interface AppSessionStartParams {
  /** 会话 ID */
  session_id: string;
  /** 上次会话持续时长 */
  previous_session_duration_ms: number;
  /** 会话间隔 */
  session_gap_ms: number;
}

interface AppSessionEndParams {
  /** 会话 ID */
  session_id: string;
  /** 会话持续时长 */
  session_duration_ms: number;
  /** 浏览页面数 */
  pages_viewed_count: number;
  /** 发送消息数 */
  messages_sent_count: number;
  /** 创建任务数 */
  tasks_created_count: number;
}

interface AppUpdatedParams {
  /** 更新前版本 */
  from_version: string;
  /** 更新后版本 */
  to_version: string;
  /** 更新方式：auto | manual */
  update_method: "auto" | "manual";
}

// ============================================================
// 标签页管理参数
// ============================================================

interface TabOpenedParams {
  /** 标签页 ID */
  tab_id: string;
  /** 标签页 URL */
  tab_url: string;
  /** 标签页索引 */
  tab_index: number;
  /** 标签页总数 */
  total_tabs: number;
  /** 是否固定 */
  is_pinned: boolean;
}

interface TabClosedParams {
  /** 标签页 ID */
  tab_id: string;
  /** 标签页存活时长 */
  tab_age_ms: number;
  /** 关闭时是否为活跃标签页 */
  was_active: boolean;
}

interface TabSwitchedParams {
  /** 来源标签页 ID */
  from_tab_id: string;
  /** 目标标签页 ID */
  to_tab_id: string;
  /** 切换方式：click | shortcut */
  switch_method: "click" | "shortcut";
}

interface TabReorderedParams {
  /** 标签页 ID */
  tab_id: string;
  /** 原始索引 */
  from_index: number;
  /** 目标索引 */
  to_index: number;
}

// ============================================================
// 侧边栏参数
// ============================================================

interface SidebarSectionParams {
  /** 分区名称 */
  section_name: string;
  /** 操作：expand | collapse */
  action: "expand" | "collapse";
}

interface SidebarResizedParams {
  /** 原始宽度 */
  from_width_px: number;
  /** 目标宽度 */
  to_width_px: number;
}

// ============================================================
// 全局搜索/快捷键参数
// ============================================================

interface GlobalSearchParams {
  /** 搜索关键词长度 */
  search_query_length: number;
  /** 搜索分类 */
  search_category: string;
  /** 结果数量 */
  results_count: number;
}

interface KeyboardShortcutParams {
  /** 快捷键名称 */
  shortcut_name: string;
  /** 快捷键组合 */
  shortcut_keys: string;
  /** 上下文：global | page_specific */
  context: "global" | "page_specific";
}

// ============================================================
// 事件参数联合类型（供 Analytics SDK 使用）
// ============================================================

/** 所有事件参数的联合类型 */
type AnalyticsEventParams =
  | OnboardingParams
  | OnboardingEnvCheckParams
  | OnboardingOAuthParams
  | OnboardingAgentParams
  | OnboardingInstallParams
  | AuthParams
  | AuthSuccessParams
  | AuthTokenParams
  | AuthSessionExpiredParams
  | WorkspaceParams
  | WorkspaceCreateParams
  | WorkspaceSwitchParams
  | WorkspaceDeleteParams
  | WorkspaceSettingsParams
  | AgentDiscoveryParams
  | ChatSessionParams
  | ChatMessageSentParams
  | ChatStreamStartedParams
  | ChatFirstTokenParams
  | ChatStreamCompletedParams
  | ChatStreamStoppedParams
  | ChatToolUseParams
  | ChatPlanParams
  | ChatQuestionParams
  | ChatArtifactParams
  | ChatSessionRenameParams
  | ChatSessionDeleteParams
  | ChatSessionSwitchParams
  | ChatModeSwitchedParams
  | ChatSlashCommandParams
  | ChatSearchParams
  | ChatContextSettingsParams
  | AgentCreateParams
  | AgentUpdateParams
  | AgentMcpParams
  | AgentSkillParams
  | AgentMemoryParams
  | AgentVariableParams
  | AgentTemplateParams
  | AgentFromTemplateParams
  | AgentDeleteParams
  | GroupChatCreateParams
  | GroupChatMemberParams
  | GroupChatMessageParams
  | GroupChatWsParams
  | KanbanTaskCreateParams
  | KanbanTaskUpdateParams
  | KanbanTaskMoveParams
  | KanbanTaskStatusParams
  | KanbanTaskDeleteParams
  | KanbanCommentParams
  | KanbanReactionParams
  | KanbanFilterParams
  | KanbanSearchParams
  | KanbanBatchParams
  | KanbanQueueParams
  | KanbanTaskEnqueuedParams
  | KanbanTaskStuckParams
  | CronJobCreateParams
  | CronJobUpdateParams
  | CronJobDeleteParams
  | CronJobToggleParams
  | CronJobRunManualParams
  | CronJobExecutedParams
  | CronJobExecFailedParams
  | CronLogsParams
  | CronBatchParams
  | FileBrowserParams
  | FileViewSwitchedParams
  | FileDirectoryParams
  | FilePreviewParams
  | FilePreviewFailedParams
  | FileCreatedParams
  | FileDeletedParams
  | FileRenamedParams
  | FileSearchParams
  | FileExternalParams
  | McpMarketplaceParams
  | McpMarketplaceSearchParams
  | McpMarketplaceCategoryParams
  | McpMarketplaceSourceParams
  | McpPackageDetailParams
  | McpPackageInstallParams
  | McpPackageInstallFailedParams
  | McpPackageUninstallParams
  | McpInspectorConnectedParams
  | McpInspectorConnectFailedParams
  | McpInspectorToolCallParams
  | McpInspectorToolResultParams
  | McpInspectorConfigParams
  | McpInspectorLogLevelParams
  | McpInspectorResourceParams
  | SkillsMarketplaceParams
  | SkillsMarketplaceSearchParams
  | SkillsSourceParams
  | SkillDetailParams
  | SkillInstallParams
  | SkillInstallFailedParams
  | SkillUninstallParams
  | SettingsSectionParams
  | SettingsThemeParams
  | SettingsLanguageParams
  | SettingsShortcutParams
  | SettingsNotificationParams
  | SettingsProviderParams
  | SettingsProviderTestParams
  | SettingsModelParams
  | SettingsModelDefaultParams
  | SettingsApiKeyParams
  | SettingsApiKeyValidateParams
  | SettingsSandboxParams
  | SettingsPetParams
  | SettingsTerminalFontParams
  | SettingsDeveloperParams
  | PetParams
  | PetDisplayedParams
  | PetHiddenParams
  | PetDraggedParams
  | PetClickedParams
  | PetHoveredParams
  | ChatWindowParams
  | PagePreviewWindowParams
  | PagePreviewTabParams
  | PagePreviewNavigateParams
  | ScreenshotOverlayParams
  | ScreenshotConfirmParams
  | ScreenshotCancelParams
  | DevicePairPageParams
  | DeviceQrCodeParams
  | DevicePairedParams
  | DeviceDisconnectParams
  | DeviceWsMessageParams
  | MobileConnectParams
  | MobileChatMessageParams
  | IdeaTypeCreateParams
  | IdeasGeneratedParams
  | IdeaPromotedParams
  | IdeaDeleteParams
  | IdeaFileSaveParams
  | PageCreateParams
  | PageContentUpdateParams
  | PagePublishStartParams
  | PagePublishCompletedParams
  | PagePublishFailedParams
  | PagePublishRollbackParams
  | PageAssetUploadParams
  | AppErrorBoundaryParams
  | GatewayConnectionLostParams
  | GatewayConnectionRestoredParams
  | SseConnectionErrorParams
  | ApiCallFailedParams
  | OfflineModeParams
  | OfflineModeExitedParams
  | PageLoadFailedParams
  | AppCrashedParams
  | VoiceStartedParams
  | VoiceWakeWordParams
  | VoiceRecognizedParams
  | VoiceResponseStartedParams
  | VoiceResponseCompletedParams
  | VoiceStoppedParams
  | VoiceErrorParams
  | GitHubIntegrationParams
  | GitHubIssuesLoadedParams
  | GitHubIssueSelectedParams
  | GitHubAutoFixCreatedParams
  | GitHubAutoFixCompletedParams
  | SlashCommandPanelParams
  | SlashCommandExecutedParams
  | NotificationReceivedParams
  | NotificationClickedParams
  | NotificationMarkReadParams
  | NotificationCenterOpenedParams
  | NotificationDeletedParams
  | CacheAccessedParams
  | SyncStartedParams
  | SyncCompletedParams
  | PresentationStartedParams
  | PresentationStepParams
  | PresentationStoppedParams
  | AppLaunchedParams
  | AppSessionStartParams
  | AppSessionEndParams
  | AppUpdatedParams
  | TabOpenedParams
  | TabClosedParams
  | TabSwitchedParams
  | TabReorderedParams
  | SidebarSectionParams
  | SidebarResizedParams
  | GlobalSearchParams
  | KeyboardShortcutParams;
```

---

## 五、优先级矩阵

### 5.1 按路径 x 事件重要性

| 用户路径 | Critical 事件 | High 事件 | Medium 事件 | 总计 | 业务重要性 |
|----------|:------------:|:---------:|:-----------:|:----:|:---------:|
| 首次启动引导 | 8 | 5 | 1 | 14 | **S** (核心转化) |
| OAuth 认证登录 | 2 | 2 | 2 | 6 | **S** (核心转化) |
| 创建工作区 | 1 | 4 | 2 | 7 | **A** (关键功能) |
| AI 对话交互 | 4 | 10 | 7 | 21 | **S** (核心功能) |
| 高级 Agent 配置 | 1 | 7 | 4 | 12 | **A** (关键功能) |
| 群聊协作 | 0 | 2 | 2 | 4 | **B** (增强功能) |
| 看板任务管理 | 2 | 8 | 4 | 14 | **A** (关键功能) |
| 定时任务管理 | 2 | 5 | 3 | 10 | **A** (关键功能) |
| 文件浏览与编辑 | 0 | 3 | 7 | 10 | **B** (增强功能) |
| MCP 市场 | 2 | 5 | 2 | 9 | **A** (生态关键) |
| MCP 服务调试 | 0 | 6 | 3 | 9 | **B** (开发者工具) |
| 技能市场 | 2 | 4 | 2 | 8 | **A** (生态关键) |
| 设置与配置 | 2 | 5 | 9 | 16 | **A** (留存关键) |
| 桌面宠物交互 | 0 | 3 | 3 | 6 | **B** (趣味功能) |
| 多窗口管理 | 0 | 4 | 4 | 8 | **B** (效率功能) |
| 设备配对 | 1 | 3 | 3 | 7 | **B** (扩展功能) |
| 想法管理 | 0 | 3 | 2 | 5 | **B** (辅助功能) |
| 页面发布 | 2 | 3 | 2 | 7 | **A** (分享传播) |
| 错误恢复 | 3 | 5 | 0 | 8 | **S** (质量保障) |
| 语音交互 | 0 | 6 | 1 | 7 | **B** (新交互) |
| GitHub 集成 | 0 | 2 | 3 | 5 | **B** (开发者) |
| 斜杠命令 | 0 | 1 | 1 | 2 | **C** (效率) |
| 通知中心 | 0 | 2 | 3 | 5 | **B** (触达) |
| 离线工作 | 0 | 1 | 2 | 3 | **B** (可用性) |
| 演示模式 | 0 | 0 | 3 | 3 | **C** (小众) |
| 全局生命周期 | 4 | 4 | 4 | 12 | **S** (基础监控) |

### 5.2 关键转化漏斗

```
1. 用户获取漏斗
   app_launched → onboarding_started → onboarding_step_completed(×N) → onboarding_completed

2. 首次价值交付 (TTV) 漏斗
   onboarding_completed → workspace_created → agent_created → chat_message_sent → chat_stream_completed

3. 深度激活漏斗
   chat_stream_completed → kanban_task_created → cron_job_created → agent_updated(mcp/skills)

4. 生态参与漏斗
   mcp_marketplace_opened → mcp_package_detail_viewed → mcp_package_install_completed → agent_mcp_server_added

5. 留存漏斗
   app_session_start → (D1) app_session_start → (D7) app_session_start → (D30) app_session_start

6. 传播漏斗
   page_created → page_publish_completed → (shared_url_accessed)
```

### 5.3 北极星指标

| 指标 | 计算方式 | 类别 |
|------|---------|------|
| DAU（日活跃用户） | `app_session_start` 去重计数 | 规模 |
| 每用户日对话次数 | `chat_message_sent` / DAU | 活跃度 |
| TTV（Time To Value） | `onboarding_completed.timestamp - app_launched.timestamp` 中位数 | 转化 |
| D1/D7/D30 留存 | 按 `app_session_start` 计算 | 留存 |
| 任务完成率 | `kanban_task_status_changed(to completed)` / `kanban_task_created` | 效率 |
| Agent 配置深度 | 含 MCP 配置的 agent 数 / 总 agent 数 | 深度 |
| 安装转化率 | `mcp_package_install_completed` / `mcp_package_detail_viewed` | 生态 |
| 崩溃率 | `app_crashed` / `app_session_start` | 质量 |
| API Key 配置率 | 至少一个 provider 配置了 API Key 的用户 / DAU | 激活 |

---

## 六、实施建议

### 第一批（P0 - 立即实施，约 30 个事件）

**目标**：覆盖核心转化漏斗和基础监控，确保上线前具备基本的用户行为分析能力。

**范围**：所有 Critical 优先级事件 + 全局生命周期事件

| 序号 | event_name | category | 所属路径 |
|:----:|-----------|----------|---------|
| 1 | app_launched | lifecycle | 全局 |
| 2 | app_session_start | lifecycle | 全局 |
| 3 | app_session_end | lifecycle | 全局 |
| 4 | app_crashed | error | 全局 |
| 5 | onboarding_started | conversion | 首次启动引导 |
| 6 | onboarding_step_completed | conversion | 首次启动引导 |
| 7 | onboarding_env_check_completed | conversion | 首次启动引导 |
| 8 | onboarding_oauth_started | conversion | 首次启动引导 |
| 9 | onboarding_oauth_completed | conversion | 首次启动引导 |
| 10 | onboarding_agent_created | conversion | 首次启动引导 |
| 11 | onboarding_completed | conversion | 首次启动引导 |
| 12 | auth_login_attempt | conversion | OAuth 认证登录 |
| 13 | auth_login_success | conversion | OAuth 认证登录 |
| 14 | workspace_created | conversion | 创建工作区 |
| 15 | chat_session_created | lifecycle | AI 对话交互 |
| 16 | chat_message_sent | engagement | AI 对话交互 |
| 17 | chat_first_token_received | performance | AI 对话交互 |
| 18 | chat_stream_completed | engagement | AI 对话交互 |
| 19 | agent_created | conversion | 高级 Agent 配置 |
| 20 | kanban_task_created | conversion | 看板任务管理 |
| 21 | kanban_task_status_changed | lifecycle | 看板任务管理 |
| 22 | cron_job_created | conversion | 定时任务管理 |
| 23 | cron_job_executed | lifecycle | 定时任务管理 |
| 24 | settings_api_key_configured | conversion | 设置与配置 |
| 25 | mcp_package_install_started | conversion | MCP 市场 |
| 26 | mcp_package_install_completed | conversion | MCP 市场 |
| 27 | skill_install_started | conversion | 技能市场 |
| 28 | app_error_boundary_triggered | error | 错误恢复 |
| 29 | gateway_connection_lost | error | 错误恢复 |
| 30 | gateway_connection_restored | lifecycle | 错误恢复 |

### 第二批（P1 - 2 周内实施，约 60 个事件）

**目标**：补全核心路径的 High 优先级事件，形成完整的用户行为分析视图。

**范围**：所有 High 优先级事件

- AI 对话交互：chat_stream_stopped, chat_plan_approved, chat_plan_rejected, chat_slash_command_used, chat_session_switched, chat_session_deleted
- 高级 Agent 配置：agent_updated, agent_default_set, agent_mcp_server_added, agent_skill_enabled, agent_from_template_created
- 看板任务管理：kanban_task_updated, kanban_task_moved, kanban_task_deleted, kanban_batch_operation, kanban_task_enqueued, kanban_task_stuck_detected
- 定时任务管理：cron_job_updated, cron_job_deleted, cron_job_run_manual, cron_job_execution_failed, cron_batch_operation
- MCP 市场：mcp_marketplace_opened, mcp_marketplace_searched, mcp_package_detail_viewed, mcp_package_install_failed
- MCP 调试器：mcp_inspector_opened, mcp_inspector_connected, mcp_inspector_connect_failed, mcp_inspector_tool_called, mcp_inspector_tool_call_result
- 技能市场：skills_marketplace_opened, skills_marketplace_searched, skill_detail_viewed, skill_install_failed
- 设置：settings_opened, settings_section_switched, settings_provider_tested, settings_api_key_validated, settings_provider_created, settings_model_created
- 错误恢复：sse_connection_error, api_call_failed, offline_mode_entered, offline_mode_exited, page_load_failed
- 页面发布：page_publish_started, page_publish_completed, page_publish_failed, page_created
- 全局：app_updated, tab_opened, tab_closed, tab_switched

### 第三批（P2 - 1 个月内实施，约 128 个事件）

**目标**：补全所有 Medium 优先级事件和辅助路径，实现全路径覆盖。

**范围**：所有剩余 Medium 优先级事件 + 辅助路径事件

- 文件浏览：所有 medium 事件（file_view_switched, file_created, file_deleted, file_renamed, file_search_used, file_external_opened, file_preview_failed）
- 群聊协作：所有事件（group_chat_created, group_chat_member_added, group_chat_message_sent, group_chat_ws_connected）
- 桌面宠物：pet_displayed, pet_hidden, pet_dragged, pet_hovered
- 多窗口管理：chat_window_closed, page_preview_tab_opened, page_preview_navigated, screenshot_cancelled
- 设备配对：device_disconnected, device_ws_message_sent, mobile_chat_message_sent
- 想法管理：idea_type_created, idea_deleted, idea_file_saved
- GitHub 集成：github_integration_opened, github_issues_loaded, github_issue_selected
- 斜杠命令：slash_command_panel_opened
- 通知中心：notification_marked_read, notification_center_opened, notification_deleted
- 离线工作：cache_accessed
- 演示模式：presentation_started, presentation_step_completed, presentation_stopped
- 设置细项：settings_theme_changed, settings_language_changed, settings_shortcut_modified, settings_notification_prefs_changed, settings_model_default_changed, settings_sandbox_config_changed, settings_pet_changed, settings_terminal_font_changed, settings_developer_prefs_changed
- 全局细项：tab_reordered, sidebar_section_toggled, sidebar_resized, search_global_used, keyboard_shortcut_used

---

## 附录：实施注意事项

1. **Firebase logEvent 调用规范**：所有事件通过统一的 `analytics.logEvent(event_name, params)` 调用，参数中不包含 PII（个人可识别信息）。
2. **Sentry 集成**：error 类别的事件同步上报至 Sentry，通过 `Sentry.captureException()` 或 `Sentry.captureMessage()` 发送。
3. **session_id 生成**：应用启动时生成 UUID v4 作为 session_id，存储在内存中，应用退出时随 `app_session_end` 事件上报。
4. **user_id_hash**：登录后对用户唯一标识做 SHA-256 哈希，作为伪匿名标识用于跨会话分析。
5. **参数校验**：每个事件上报前需校验必填参数不为空，可选参数允许 `undefined`，Firebase 会自动过滤 `undefined` 值。
6. **离线缓存**：网络不可用时，事件先存入 localStorage 队列，网络恢复后按 FIFO 顺序上报。
7. **采样策略**：高频事件（如 `chat_message_sent`、`file_previewed`）可在 Firebase 控制台设置采样率，避免超出免费配额。
