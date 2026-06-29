/**
 * Analytics 事件定义
 *
 * 事件名常量和参数类型——Provider 无关，是单一真相来源。
 *
 * 当前仅包含 Critical (P0) 和 High (P1) 优先级事件（共 129 个，含 1 个标准路由 page_view 事件）。
 * Medium (P2) 事件将在后续版本中按需添加。
 *
 * 事件按 category 分为六大类：navigation, engagement, conversion, error, performance, lifecycle。
 * 所有事件名和参数名统一使用 snake_case。
 */

// ============================================================
// 事件名称常量
// ============================================================

export const AnalyticsEvents = {
  // ---- Navigation (17) ----
  PAGE_VIEW: "page_view",
  ONBOARDING_STEP_VIEWED: "onboarding_step_viewed",
  WORKSPACE_SWITCHED: "workspace_switched",
  CHAT_SESSION_SWITCHED: "chat_session_switched",
  FILE_BROWSER_OPENED: "file_browser_opened",
  FILE_DIRECTORY_NAVIGATED: "file_directory_navigated",
  MCP_MARKETPLACE_OPENED: "mcp_marketplace_opened",
  MCP_INSPECTOR_OPENED: "mcp_inspector_opened",
  SKILLS_MARKETPLACE_OPENED: "skills_marketplace_opened",
  SETTINGS_OPENED: "settings_opened",
  SETTINGS_SECTION_SWITCHED: "settings_section_switched",
  CHAT_WINDOW_OPENED: "chat_window_opened",
  PAGE_PREVIEW_WINDOW_OPENED: "page_preview_window_opened",
  DEVICE_PAIR_PAGE_OPENED: "device_pair_page_opened",
  TAB_OPENED: "tab_opened",
  TAB_CLOSED: "tab_closed",
  TAB_SWITCHED: "tab_switched",

  // ---- Engagement (35) ----
  CHAT_MESSAGE_SENT: "chat_message_sent",
  CHAT_STREAM_COMPLETED: "chat_stream_completed",
  CHAT_STREAM_STOPPED: "chat_stream_stopped",
  CHAT_PLAN_APPROVED: "chat_plan_approved",
  CHAT_PLAN_REJECTED: "chat_plan_rejected",
  CHAT_SLASH_COMMAND_USED: "chat_slash_command_used",
  AGENT_UPDATED: "agent_updated",
  AGENT_DEFAULT_SET: "agent_default_set",
  AGENT_MCP_SERVER_ADDED: "agent_mcp_server_added",
  AGENT_SKILL_ENABLED: "agent_skill_enabled",
  GROUP_CHAT_MESSAGE_SENT: "group_chat_message_sent",
  KANBAN_TASK_UPDATED: "kanban_task_updated",
  KANBAN_TASK_MOVED: "kanban_task_moved",
  KANBAN_BATCH_OPERATION: "kanban_batch_operation",
  CRON_JOB_UPDATED: "cron_job_updated",
  CRON_JOB_RUN_MANUAL: "cron_job_run_manual",
  CRON_BATCH_OPERATION: "cron_batch_operation",
  FILE_PREVIEWED: "file_previewed",
  MCP_MARKETPLACE_SEARCHED: "mcp_marketplace_searched",
  MCP_PACKAGE_DETAIL_VIEWED: "mcp_package_detail_viewed",
  MCP_INSPECTOR_TOOL_CALLED: "mcp_inspector_tool_called",
  MCP_INSPECTOR_TOOL_CALL_RESULT: "mcp_inspector_tool_call_result",
  SKILLS_MARKETPLACE_SEARCHED: "skills_marketplace_searched",
  SKILL_DETAIL_VIEWED: "skill_detail_viewed",
  SETTINGS_PROVIDER_TESTED: "settings_provider_tested",
  SETTINGS_API_KEY_VALIDATED: "settings_api_key_validated",
  PET_CLICKED: "pet_clicked",
  SCREENSHOT_OVERLAY_OPENED: "screenshot_overlay_opened",
  VOICE_STARTED: "voice_started",
  VOICE_WAKE_WORD_DETECTED: "voice_wake_word_detected",
  VOICE_SPEECH_RECOGNIZED: "voice_speech_recognized",
  VOICE_RESPONSE_STARTED: "voice_response_started",
  VOICE_RESPONSE_COMPLETED: "voice_response_completed",
  SLASH_COMMAND_EXECUTED: "slash_command_executed",
  NOTIFICATION_CLICKED: "notification_clicked",

  // ---- Conversion (36) ----
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_ENV_CHECK_COMPLETED: "onboarding_env_check_completed",
  ONBOARDING_PYTHON_INSTALLED: "onboarding_python_installed",
  ONBOARDING_CLAUDE_INSTALLED: "onboarding_claude_installed",
  ONBOARDING_OAUTH_STARTED: "onboarding_oauth_started",
  ONBOARDING_OAUTH_COMPLETED: "onboarding_oauth_completed",
  ONBOARDING_AGENT_CREATED: "onboarding_agent_created",
  ONBOARDING_COMPLETED: "onboarding_completed",
  AUTH_LOGIN_ATTEMPT: "auth_login_attempt",
  AUTH_LOGIN_SUCCESS: "auth_login_success",
  WORKSPACE_CREATED: "workspace_created",
  AGENT_CREATED: "agent_created",
  AGENT_FROM_TEMPLATE_CREATED: "agent_from_template_created",
  GROUP_CHAT_CREATED: "group_chat_created",
  KANBAN_TASK_CREATED: "kanban_task_created",
  CRON_JOB_CREATED: "cron_job_created",
  MCP_PACKAGE_INSTALL_STARTED: "mcp_package_install_started",
  MCP_PACKAGE_INSTALL_COMPLETED: "mcp_package_install_completed",
  SKILL_INSTALL_STARTED: "skill_install_started",
  SKILL_INSTALL_COMPLETED: "skill_install_completed",
  SETTINGS_PROVIDER_CREATED: "settings_provider_created",
  SETTINGS_MODEL_CREATED: "settings_model_created",
  SETTINGS_API_KEY_CONFIGURED: "settings_api_key_configured",
  PET_CHAT_OPENED: "pet_chat_opened",
  SCREENSHOT_CONFIRMED: "screenshot_confirmed",
  DEVICE_QR_CODE_GENERATED: "device_qr_code_generated",
  DEVICE_PAIRED: "device_paired",
  MOBILE_CONNECT_ATTEMPT: "mobile_connect_attempt",
  IDEAS_GENERATED: "ideas_generated",
  IDEA_PROMOTED_TO_TASK: "idea_promoted_to_task",
  PAGE_CREATED: "page_created",
  PAGE_PUBLISH_STARTED: "page_publish_started",
  PAGE_PUBLISH_COMPLETED: "page_publish_completed",
  GITHUB_AUTO_FIX_CREATED: "github_auto_fix_created",
  GITHUB_AUTO_FIX_COMPLETED: "github_auto_fix_completed",

  // ---- Error (16) ----
  ONBOARDING_STEP_FAILED: "onboarding_step_failed",
  AUTH_LOGIN_FAILED: "auth_login_failed",
  WORKSPACE_CREATE_FAILED: "workspace_create_failed",
  KANBAN_TASK_STUCK_DETECTED: "kanban_task_stuck_detected",
  CRON_JOB_EXECUTION_FAILED: "cron_job_execution_failed",
  MCP_PACKAGE_INSTALL_FAILED: "mcp_package_install_failed",
  MCP_INSPECTOR_CONNECT_FAILED: "mcp_inspector_connect_failed",
  SKILL_INSTALL_FAILED: "skill_install_failed",
  PAGE_PUBLISH_FAILED: "page_publish_failed",
  APP_ERROR_BOUNDARY_TRIGGERED: "app_error_boundary_triggered",
  GATEWAY_CONNECTION_LOST: "gateway_connection_lost",
  SSE_CONNECTION_ERROR: "sse_connection_error",
  API_CALL_FAILED: "api_call_failed",
  PAGE_LOAD_FAILED: "page_load_failed",
  VOICE_ERROR: "voice_error",
  APP_CRASHED: "app_crashed",

  // ---- Performance (4) ----
  CHAT_STREAM_STARTED: "chat_stream_started",
  CHAT_FIRST_TOKEN_RECEIVED: "chat_first_token_received",
  MCP_INSPECTOR_CONNECTED: "mcp_inspector_connected",
  SYNC_STARTED: "sync_started",

  // ---- Lifecycle (21) ----
  ONBOARDING_GATEWAY_STARTED: "onboarding_gateway_started",
  AUTH_SESSION_EXPIRED: "auth_session_expired",
  WORKSPACE_DELETED: "workspace_deleted",
  CHAT_SESSION_CREATED: "chat_session_created",
  CHAT_SESSION_DELETED: "chat_session_deleted",
  AGENT_DELETED: "agent_deleted",
  KANBAN_TASK_DELETED: "kanban_task_deleted",
  KANBAN_TASK_STATUS_CHANGED: "kanban_task_status_changed",
  KANBAN_TASK_ENQUEUED: "kanban_task_enqueued",
  CRON_JOB_DELETED: "cron_job_deleted",
  CRON_JOB_EXECUTED: "cron_job_executed",
  PET_DISPLAYED: "pet_displayed",
  GATEWAY_CONNECTION_RESTORED: "gateway_connection_restored",
  OFFLINE_MODE_ENTERED: "offline_mode_entered",
  OFFLINE_MODE_EXITED: "offline_mode_exited",
  NOTIFICATION_RECEIVED: "notification_received",
  SYNC_COMPLETED: "sync_completed",
  APP_LAUNCHED: "app_launched",
  APP_SESSION_START: "app_session_start",
  APP_SESSION_END: "app_session_end",
  APP_UPDATED: "app_updated",
} as const;

/** 事件名联合类型 */
export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

// ============================================================
// 参数类型定义（按业务子领域分组）
// ============================================================

// -------------------------------------------
// 引导流程 (Onboarding)
// -------------------------------------------

/** onboarding_step_viewed, onboarding_step_completed, onboarding_step_failed */
export interface OnboardingParams {
  step_name: string;
  step_index: number;
  total_steps: number;
}

/** onboarding_env_check_completed */
export interface OnboardingEnvCheckParams {
  git_available: boolean;
  node_available: boolean;
  python_available: boolean;
  failed_checks_count: number;
}

/** onboarding_oauth_started, onboarding_oauth_completed */
export interface OnboardingOAuthParams {
  provider: "github";
}

/** onboarding_agent_created */
export interface OnboardingAgentParams {
  agent_name: string;
  provider_id: string;
  model_id: string;
  has_mcp: boolean;
  has_skills: boolean;
}

/** onboarding_python_installed, onboarding_claude_installed */
export interface OnboardingInstallParams {
  /** 安装的版本号 */
  version: string;
  /** 安装方式 */
  install_method: string;
}

/** onboarding_completed */
export interface OnboardingCompletedParams {
  total_duration_ms: number;
  total_steps: number;
  skipped_steps: number;
}

/** onboarding_started */
export interface OnboardingStartedParams {
  app_version: string;
  platform: string;
  language: string;
}

/** onboarding_gateway_started */
export interface OnboardingGatewayParams {
  gateway_version: string;
  start_method: string;
  duration_ms: number;
}

// -------------------------------------------
// 认证 (Auth)
// -------------------------------------------

/** auth_login_attempt */
export interface AuthParams {
  provider: string;
  method: "oauth" | "email";
}

/** auth_login_success */
export interface AuthSuccessParams {
  provider: string;
  user_id_hash: string;
  is_new_user: boolean;
  duration_ms: number;
}

/** auth_login_failed */
export interface AuthFailedParams {
  provider: string;
  error_type: string;
  error_message: string;
}

/** auth_session_expired */
export interface AuthSessionExpiredParams {
  session_age_ms: number;
  reason: string;
}

// -------------------------------------------
// 工作区 (Workspace)
// -------------------------------------------

/** workspace_created */
export interface WorkspaceCreateParams {
  workspace_name: string;
  workspace_path_depth: number;
  has_git: boolean;
}

/** workspace_create_failed */
export interface WorkspaceCreateFailedParams {
  error_type: string;
  error_message: string;
  path: string;
}

/** workspace_switched */
export interface WorkspaceSwitchParams {
  from_workspace_id: string;
  to_workspace_id: string;
  switch_method: "click" | "search" | "shortcut";
}

/** workspace_deleted */
export interface WorkspaceDeleteParams {
  workspace_id: string;
  workspace_age_days: number;
  task_count: number;
}

// -------------------------------------------
// 聊天对话 (Chat)
// -------------------------------------------

/** chat_session_created */
export interface ChatSessionParams {
  workspace_id: string;
  agent_id: string;
  executor_type: string;
  session_type: "single" | "group";
}

/** chat_message_sent */
export interface ChatMessageSentParams {
  session_id: string;
  agent_id: string;
  model_id: string;
  message_type: "text" | "slash_command" | "attachment";
  message_length: number;
  has_attachment: boolean;
}

/** chat_stream_started */
export interface ChatStreamStartedParams {
  session_id: string;
  agent_id: string;
  model_id: string;
}

/** chat_first_token_received */
export interface ChatFirstTokenParams {
  session_id: string;
  time_to_first_token_ms: number;
}

/** chat_stream_completed */
export interface ChatStreamCompletedParams {
  session_id: string;
  total_tokens: number;
  tool_calls_count: number;
  duration_ms: number;
  total_cost_tokens: number;
}

/** chat_stream_stopped */
export interface ChatStreamStoppedParams {
  session_id: string;
  tokens_generated_before_stop: number;
  stop_reason: string;
}

/** chat_plan_approved, chat_plan_rejected */
export interface ChatPlanParams {
  session_id: string;
  plan_type: string;
  approval_duration_ms?: number;
  rejection_reason?: string;
}

/** chat_slash_command_used */
export interface ChatSlashCommandParams {
  session_id: string;
  command_name: string;
  command_category: string;
}

/** chat_session_switched */
export interface ChatSessionSwitchParams {
  from_session_id: string;
  to_session_id: string;
  switch_method: "click" | "search";
}

/** chat_session_deleted */
export interface ChatSessionDeleteParams {
  session_id: string;
  session_age_days: number;
  message_count: number;
}

// -------------------------------------------
// Agent 配置 (Agent Config)
// -------------------------------------------

/** agent_created */
export interface AgentCreateParams {
  agent_name: string;
  scope: "workspace" | "global";
  provider_id: string;
  model_id: string;
  from_template: boolean;
}

/** agent_from_template_created */
export interface AgentFromTemplateParams {
  template_id: string;
  agent_name: string;
}

/** agent_updated */
export interface AgentUpdateParams {
  agent_id: string;
  fields_changed: string[];
  has_system_prompt_changed: boolean;
  has_mcp_changed: boolean;
  has_skills_changed: boolean;
}

/** agent_default_set */
export interface AgentDefaultSetParams {
  agent_id: string;
  previous_default_id: string;
}

/** agent_mcp_server_added */
export interface AgentMcpParams {
  agent_id: string;
  mcp_server_name: string;
  mcp_server_type: string;
}

/** agent_skill_enabled */
export interface AgentSkillParams {
  agent_id: string;
  skill_id: string;
  skill_name: string;
}

/** agent_deleted */
export interface AgentDeleteParams {
  agent_id: string;
  agent_age_days: number;
  sessions_count: number;
}

// -------------------------------------------
// 群聊 (Group Chat)
// -------------------------------------------

/** group_chat_created */
export interface GroupChatCreateParams {
  group_name: string;
  members_count: number;
  workspace_id: string;
}

/** group_chat_message_sent */
export interface GroupChatMessageParams {
  group_id: string;
  session_id: string;
  message_type: string;
  has_mention: boolean;
}

// -------------------------------------------
// 看板任务 (Kanban)
// -------------------------------------------

/** kanban_task_created */
export interface KanbanTaskCreateParams {
  workspace_id: string;
  task_title_length: number;
  has_description: boolean;
  priority: "high" | "medium" | "low";
  has_labels: boolean;
  column_id: string;
}

/** kanban_task_updated */
export interface KanbanTaskUpdateParams {
  task_id: string;
  fields_changed: string[];
  update_source: "dialog" | "inline";
}

/** kanban_task_moved */
export interface KanbanTaskMoveParams {
  task_id: string;
  from_column: string;
  to_column: string;
  from_position: number;
  to_position: number;
}

/** kanban_task_status_changed */
export interface KanbanTaskStatusParams {
  task_id: string;
  from_status: string;
  to_status: string;
  change_source: "drag" | "button" | "api";
}

/** kanban_task_deleted */
export interface KanbanTaskDeleteParams {
  task_id: string;
  task_age_days: number;
  column: string;
}

/** kanban_batch_operation */
export interface KanbanBatchParams {
  workspace_id: string;
  operation_type: "enable" | "disable" | "delete" | "archive";
  affected_count: number;
}

/** kanban_task_enqueued */
export interface KanbanTaskEnqueuedParams {
  task_id: string;
  queue_position: number;
  queue_total: number;
}

/** kanban_task_stuck_detected */
export interface KanbanTaskStuckParams {
  task_id: string;
  stuck_duration_ms: number;
  last_activity_type: string;
}

// -------------------------------------------
// 定时任务 (Cron Job)
// -------------------------------------------

/** cron_job_created */
export interface CronJobCreateParams {
  job_name: string;
  schedule_type: "interval" | "cron";
  task_type: "agent" | "script";
  has_notification: boolean;
}

/** cron_job_updated */
export interface CronJobUpdateParams {
  job_id: string;
  fields_changed: string[];
  has_schedule_changed: boolean;
}

/** cron_job_deleted */
export interface CronJobDeleteParams {
  job_id: string;
  job_age_days: number;
  execution_count: number;
}

/** cron_job_run_manual */
export interface CronJobRunManualParams {
  job_id: string;
  triggered_from: "table" | "batch";
}

/** cron_job_executed */
export interface CronJobExecutedParams {
  job_id: string;
  execution_result: "success" | "failed" | "timeout";
  duration_ms: number;
  output_length: number;
}

/** cron_job_execution_failed */
export interface CronJobExecFailedParams {
  job_id: string;
  error_type: string;
  error_message: string;
  retry_count: number;
}

/** cron_batch_operation */
export interface CronBatchParams {
  operation_type: "enable" | "disable" | "delete";
  affected_count: number;
}

// -------------------------------------------
// 文件浏览 (File Browser)
// -------------------------------------------

/** file_browser_opened */
export interface FileBrowserParams {
  workspace_id: string;
  initial_path_depth?: number;
}

/** file_directory_navigated */
export interface FileDirectoryParams {
  from_path_depth: number;
  to_path_depth: number;
  navigation_method: "tree" | "breadcrumb";
}

/** file_previewed */
export interface FilePreviewParams {
  file_extension: string;
  file_size_bytes: number;
  preview_type:
    | "image"
    | "code"
    | "markdown"
    | "pdf"
    | "video"
    | "audio"
    | "font"
    | "docx"
    | "xlsx"
    | "pptx";
}

// -------------------------------------------
// MCP 市场 (MCP Marketplace)
// -------------------------------------------

/** mcp_marketplace_opened */
export interface McpMarketplaceParams {
  source: "sidebar" | "navigation";
}

/** mcp_marketplace_searched */
export interface McpMarketplaceSearchParams {
  search_query: string;
  results_count: number;
  search_duration_ms: number;
}

/** mcp_package_detail_viewed */
export interface McpPackageDetailParams {
  package_name: string;
  package_source: string;
  package_version: string;
}

/** mcp_package_install_started, mcp_package_install_completed */
export interface McpPackageInstallParams {
  package_name: string;
  package_version: string;
  install_source: "marketplace" | "official";
  duration_ms?: number;
  success?: boolean;
}

/** mcp_package_install_failed */
export interface McpPackageInstallFailedParams {
  package_name: string;
  error_type: string;
  error_message: string;
  duration_ms: number;
}

// -------------------------------------------
// MCP 调试器 (MCP Inspector)
// -------------------------------------------

/** mcp_inspector_opened */
export interface McpInspectorOpenParams {
  source: string;
}

/** mcp_inspector_connected */
export interface McpInspectorConnectedParams {
  transport_type: "stdio" | "sse" | "streamable_http";
  server_name: string;
  connection_duration_ms: number;
}

/** mcp_inspector_connect_failed */
export interface McpInspectorConnectFailedParams {
  transport_type: string;
  error_type: string;
  error_message: string;
}

/** mcp_inspector_tool_called */
export interface McpInspectorToolCallParams {
  tool_name: string;
  params_count: number;
  has_custom_headers: boolean;
}

/** mcp_inspector_tool_call_result */
export interface McpInspectorToolResultParams {
  tool_name: string;
  result_type: "success" | "error";
  duration_ms: number;
  response_size_bytes: number;
}

// -------------------------------------------
// 技能市场 (Skills Marketplace)
// -------------------------------------------

/** skills_marketplace_opened */
export interface SkillsMarketplaceParams {
  source: string;
}

/** skills_marketplace_searched */
export interface SkillsMarketplaceSearchParams {
  search_query: string;
  results_count: number;
}

/** skill_detail_viewed */
export interface SkillDetailParams {
  skill_id: string;
  skill_name: string;
  trigger_words: string[];
  files_count: number;
}

/** skill_install_started, skill_install_completed */
export interface SkillInstallParams {
  skill_id: string;
  skill_name: string;
  install_source: string;
  duration_ms?: number;
  success?: boolean;
}

/** skill_install_failed */
export interface SkillInstallFailedParams {
  skill_id: string;
  error_type: string;
  error_message: string;
}

// -------------------------------------------
// 设置 (Settings)
// -------------------------------------------

/** settings_opened, settings_section_switched */
export interface SettingsSectionParams {
  source: string;
  initial_section?: string;
  from_section?: string;
  to_section?: string;
}

/** settings_provider_created */
export interface SettingsProviderParams {
  provider_id: string;
  provider_type: string;
}

/** settings_provider_tested */
export interface SettingsProviderTestParams {
  provider_id: string;
  test_result: "success" | "failed";
  duration_ms: number;
}

/** settings_model_created */
export interface SettingsModelParams {
  model_id: string;
  provider_id: string;
  model_category?: string;
}

/** settings_api_key_configured */
export interface SettingsApiKeyParams {
  provider_id: string;
  has_existing_key: boolean;
}

/** settings_api_key_validated */
export interface SettingsApiKeyValidateParams {
  provider_id: string;
  validation_result: "valid" | "invalid" | "error";
}

// -------------------------------------------
// 桌面宠物 (Desktop Pet)
// -------------------------------------------

/** pet_displayed */
export interface PetDisplayedParams {
  pet_type: string;
  pet_name: string;
}

/** pet_clicked */
export interface PetClickedParams {
  pet_type: string;
  previous_animation: string;
}

/** pet_chat_opened */
export interface PetChatOpenedParams {
  pet_type: string;
}

// -------------------------------------------
// 多窗口 (Window Management)
// -------------------------------------------

/** chat_window_opened */
export interface ChatWindowParams {
  trigger_source: "button" | "menu" | "pet";
}

/** page_preview_window_opened */
export interface PagePreviewWindowParams {
  workspace_id: string;
  page_uid: string;
  view_mode: "page" | "skill";
}

/** screenshot_overlay_opened */
export interface ScreenshotOverlayParams {
  screenshot_type: "region" | "fullscreen";
  monitor_id?: string;
}

/** screenshot_confirmed */
export interface ScreenshotConfirmParams {
  screenshot_type: string;
  annotation_tools_used: string[];
  has_annotation: boolean;
  selection_area_px: number;
}

// -------------------------------------------
// 设备配对 (Device Pairing)
// -------------------------------------------

/** device_pair_page_opened */
export interface DevicePairPageParams {
  source: string;
}

/** device_qr_code_generated */
export interface DeviceQrCodeParams {
  device_type: "gateway" | "client";
}

/** device_paired */
export interface DevicePairedParams {
  device_type: string;
  device_name: string;
  pairing_method: "qr" | "manual";
  duration_ms: number;
}

/** mobile_connect_attempt */
export interface MobileConnectParams {
  connection_method: "scan" | "lan";
  gateway_found_count: number;
}

// -------------------------------------------
// 想法管理 (Ideas)
// -------------------------------------------

/** ideas_generated */
export interface IdeasGeneratedParams {
  idea_type_id: string;
  ideas_count: number;
  duration_ms: number;
  model_used: string;
}

/** idea_promoted_to_task */
export interface IdeaPromotedParams {
  idea_id: string;
  task_id: string;
  promotion_method: string;
}

// -------------------------------------------
// 页面发布 (Page Publish)
// -------------------------------------------

/** page_created */
export interface PageCreateParams {
  workspace_id: string;
  page_type: "static" | "proxy" | "server";
  has_template: boolean;
}

/** page_publish_started */
export interface PagePublishStartParams {
  page_id: string;
  page_type: string;
}

/** page_publish_completed */
export interface PagePublishCompletedParams {
  page_id: string;
  publish_url: string;
  duration_ms: number;
  asset_count: number;
}

/** page_publish_failed */
export interface PagePublishFailedParams {
  page_id: string;
  error_type: string;
  error_message: string;
  duration_ms: number;
}

// -------------------------------------------
// 错误恢复 (Error Recovery)
// -------------------------------------------

/** app_error_boundary_triggered */
export interface AppErrorBoundaryParams {
  error_type: string;
  error_message: string;
  component_stack: string;
  route_path: string;
}

/** gateway_connection_lost */
export interface GatewayConnectionLostParams {
  previous_status: string;
  disconnect_reason: string;
  connection_duration_ms: number;
}

/** gateway_connection_restored */
export interface GatewayConnectionRestoredParams {
  outage_duration_ms: number;
  reconnect_attempts: number;
}

/** sse_connection_error */
export interface SseConnectionErrorParams {
  endpoint: string;
  error_type: string;
  reconnect_attempt: number;
}

/** api_call_failed */
export interface ApiCallFailedParams {
  endpoint: string;
  http_status: number;
  error_code: string;
  retry_count: number;
}

/** offline_mode_entered */
export interface OfflineModeParams {
  trigger: "network_lost" | "gateway_down";
}

/** offline_mode_exited */
export interface OfflineModeExitedParams {
  offline_duration_ms: number;
  pending_sync_count: number;
}

/** page_load_failed */
export interface PageLoadFailedParams {
  route_path: string;
  error_type: string;
  is_lazy_load: boolean;
}

// -------------------------------------------
// 语音交互 (Voice)
// -------------------------------------------

/** voice_started */
export interface VoiceStartedParams {
  trigger_method: "button" | "wake_word";
}

/** voice_wake_word_detected */
export interface VoiceWakeWordParams {
  wake_word: string;
  detection_confidence: number;
}

/** voice_speech_recognized */
export interface VoiceRecognizedParams {
  transcript_length: number;
  recognition_duration_ms: number;
  language: string;
}

/** voice_response_started */
export interface VoiceResponseStartedParams {
  response_id: string;
  model_id: string;
}

/** voice_response_completed */
export interface VoiceResponseCompletedParams {
  response_id: string;
  response_length: number;
  total_duration_ms: number;
}

/** voice_error */
export interface VoiceErrorParams {
  error_type: string;
  error_message: string;
  voice_state: string;
}

// -------------------------------------------
// GitHub 集成 (GitHub Integration)
// -------------------------------------------

/** github_auto_fix_created */
export interface GitHubAutoFixCreatedParams {
  issue_number: number;
  task_type: string;
  estimated_complexity: string;
}

/** github_auto_fix_completed */
export interface GitHubAutoFixCompletedParams {
  task_id: string;
  issue_number: number;
  fix_duration_ms: number;
  success: boolean;
}

// -------------------------------------------
// 斜杠命令 (Slash Command)
// -------------------------------------------

/** slash_command_executed */
export interface SlashCommandExecutedParams {
  command_name: string;
  command_category: string;
  execution_type: "message" | "ui" | "action" | "prompt";
  duration_ms: number;
}

// -------------------------------------------
// 通知中心 (Notification)
// -------------------------------------------

/** notification_received */
export interface NotificationReceivedParams {
  notification_type: string;
  notification_category: string;
  source: string;
}

/** notification_clicked */
export interface NotificationClickedParams {
  notification_id: string;
  notification_type: string;
  target_type: string;
}

// -------------------------------------------
// 离线/同步 (Offline & Sync)
// -------------------------------------------

/** sync_started */
export interface SyncStartedParams {
  sync_type: string;
  pending_items_count: number;
}

/** sync_completed */
export interface SyncCompletedParams {
  sync_type: string;
  synced_items_count: number;
  duration_ms: number;
  conflicts_count: number;
}

// -------------------------------------------
// 全局标签页 (Tabs)
// -------------------------------------------

/** tab_opened */
export interface TabOpenedParams {
  tab_id: string;
  tab_url: string;
  tab_index: number;
  total_tabs: number;
  is_pinned: boolean;
}

/** tab_closed */
export interface TabClosedParams {
  tab_id: string;
  tab_age_ms: number;
  was_active: boolean;
}

/** tab_switched */
export interface TabSwitchedParams {
  from_tab_id: string;
  to_tab_id: string;
  switch_method: "click" | "shortcut";
}

// -------------------------------------------
// 全局生命周期 (App Lifecycle)
// -------------------------------------------

/** app_launched */
export interface AppLaunchedParams {
  app_version: string;
  platform: string;
  os_version: string;
  is_first_launch: boolean;
  locale: string;
}

/** app_session_start */
export interface AppSessionStartParams {
  session_id: string;
  previous_session_duration_ms: number;
  session_gap_ms: number;
}

/** app_session_end */
export interface AppSessionEndParams {
  session_id: string;
  session_duration_ms: number;
  pages_viewed_count: number;
  messages_sent_count: number;
  tasks_created_count: number;
}

/** app_updated */
export interface AppUpdatedParams {
  from_version: string;
  to_version: string;
  update_method: "auto" | "manual";
}

/** app_crashed */
export interface AppCrashedParams {
  crash_type: string;
  last_route: string;
  app_uptime_ms: number;
}

// -------------------------------------------
// 页面浏览 (Page View)
// -------------------------------------------

/** page_view */
export interface PageViewParams {
  page_name: string;
  page_path: string;
  page_referrer: string;
}

// ============================================================
// 事件参数联合类型
// ============================================================

/**
 * 所有事件参数的联合类型。
 * 供 Analytics SDK 使用，调用方根据事件名选择对应的参数接口。
 */
export type AnalyticsEventParams =
  // 页面浏览
  | PageViewParams
  // 引导流程
  | OnboardingParams
  | OnboardingEnvCheckParams
  | OnboardingOAuthParams
  | OnboardingAgentParams
  | OnboardingInstallParams
  | OnboardingCompletedParams
  | OnboardingStartedParams
  | OnboardingGatewayParams
  // 认证
  | AuthParams
  | AuthSuccessParams
  | AuthFailedParams
  | AuthSessionExpiredParams
  // 工作区
  | WorkspaceCreateParams
  | WorkspaceCreateFailedParams
  | WorkspaceSwitchParams
  | WorkspaceDeleteParams
  // 聊天
  | ChatSessionParams
  | ChatMessageSentParams
  | ChatStreamStartedParams
  | ChatFirstTokenParams
  | ChatStreamCompletedParams
  | ChatStreamStoppedParams
  | ChatPlanParams
  | ChatSlashCommandParams
  | ChatSessionSwitchParams
  | ChatSessionDeleteParams
  // Agent 配置
  | AgentCreateParams
  | AgentFromTemplateParams
  | AgentUpdateParams
  | AgentDefaultSetParams
  | AgentMcpParams
  | AgentSkillParams
  | AgentDeleteParams
  // 群聊
  | GroupChatCreateParams
  | GroupChatMessageParams
  // 看板
  | KanbanTaskCreateParams
  | KanbanTaskUpdateParams
  | KanbanTaskMoveParams
  | KanbanTaskStatusParams
  | KanbanTaskDeleteParams
  | KanbanBatchParams
  | KanbanTaskEnqueuedParams
  | KanbanTaskStuckParams
  // 定时任务
  | CronJobCreateParams
  | CronJobUpdateParams
  | CronJobDeleteParams
  | CronJobRunManualParams
  | CronJobExecutedParams
  | CronJobExecFailedParams
  | CronBatchParams
  // 文件浏览
  | FileBrowserParams
  | FileDirectoryParams
  | FilePreviewParams
  // MCP 市场
  | McpMarketplaceParams
  | McpMarketplaceSearchParams
  | McpPackageDetailParams
  | McpPackageInstallParams
  | McpPackageInstallFailedParams
  // MCP 调试器
  | McpInspectorOpenParams
  | McpInspectorConnectedParams
  | McpInspectorConnectFailedParams
  | McpInspectorToolCallParams
  | McpInspectorToolResultParams
  // 技能市场
  | SkillsMarketplaceParams
  | SkillsMarketplaceSearchParams
  | SkillDetailParams
  | SkillInstallParams
  | SkillInstallFailedParams
  // 设置
  | SettingsSectionParams
  | SettingsProviderParams
  | SettingsProviderTestParams
  | SettingsModelParams
  | SettingsApiKeyParams
  | SettingsApiKeyValidateParams
  // 桌面宠物
  | PetDisplayedParams
  | PetClickedParams
  | PetChatOpenedParams
  // 多窗口
  | ChatWindowParams
  | PagePreviewWindowParams
  | ScreenshotOverlayParams
  | ScreenshotConfirmParams
  // 设备配对
  | DevicePairPageParams
  | DeviceQrCodeParams
  | DevicePairedParams
  | MobileConnectParams
  // 想法管理
  | IdeasGeneratedParams
  | IdeaPromotedParams
  // 页面发布
  | PageCreateParams
  | PagePublishStartParams
  | PagePublishCompletedParams
  | PagePublishFailedParams
  // 错误恢复
  | AppErrorBoundaryParams
  | GatewayConnectionLostParams
  | GatewayConnectionRestoredParams
  | SseConnectionErrorParams
  | ApiCallFailedParams
  | OfflineModeParams
  | OfflineModeExitedParams
  | PageLoadFailedParams
  // 语音
  | VoiceStartedParams
  | VoiceWakeWordParams
  | VoiceRecognizedParams
  | VoiceResponseStartedParams
  | VoiceResponseCompletedParams
  | VoiceErrorParams
  // GitHub 集成
  | GitHubAutoFixCreatedParams
  | GitHubAutoFixCompletedParams
  // 斜杠命令
  | SlashCommandExecutedParams
  // 通知中心
  | NotificationReceivedParams
  | NotificationClickedParams
  // 离线同步
  | SyncStartedParams
  | SyncCompletedParams
  // 标签页
  | TabOpenedParams
  | TabClosedParams
  | TabSwitchedParams
  // 全局生命周期
  | AppLaunchedParams
  | AppSessionStartParams
  | AppSessionEndParams
  | AppUpdatedParams
  | AppCrashedParams;

// ============================================================
// Session ID 工具函数
// ============================================================

let _sessionId: string | null = null;

/**
 * 获取当前 session 的唯一标识符。
 * 首次调用时生成新的 UUID v4，后续调用返回同一值。
 * 页面刷新后 ID 会重新生成，符合"新 session"的语义。
 */
export function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = crypto.randomUUID();
  }
  return _sessionId;
}
