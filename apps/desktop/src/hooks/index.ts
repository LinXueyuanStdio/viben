export { useAuth } from "./use-auth";
export {
  useDesktopRouting,
  useDesktopRoutingHeaderSync,
  openWorkspaceSectionByRoutePath,
} from "./use-desktop-routing";
export type {
  DesktopNavigationOptions,
  DesktopRoutingApi,
} from "./use-desktop-routing";
export { useDesktopDeepLink } from "./use-desktop-deep-link";
export type { DesktopDeepLinkIntent } from "@/navigation/deep-link";
export { usePython } from "./use-python";
export { useVibenCli } from "./use-viben-cli";
export type { UseVibenCliReturn, VibenCliPath, VibenCliSource } from "./use-viben-cli";
export { useMcp } from "./use-mcp";
export { useMarketplace } from "./use-marketplace";
export { useInstalledSources } from "./use-installed-sources";
export { useApiLogs } from "./use-api-logs";
export { useTheme } from "./use-theme";
export { useUnifiedSessions } from "./use-unified-sessions";
export { useMcpConnection } from "./use-mcp-connection";
export { useMcpProxy, buildProxyUrl, buildProxyHeaders } from "./use-mcp-proxy";
export type { McpProxyConfig, McpProxyStatus } from "./use-mcp-proxy";

// Viben Platform Integration
export {
  useMcpSearch,
  useSkillSearch,
  usePackageList,
  useInstallPackage,
  usePlatformAuth,
  usePlatformUser,
  useFavorite,
} from "./use-viben";
export {
  useCloudSkillPackages,
  useCloudSkillSearch,
  useCloudSkillPackage,
  useCloudSkillCategories,
} from "./use-cloud-skills";
export type {
  CloudSkillPackage,
  CloudPackageAuthor as CloudSkillPackageAuthor,
  SkillCategory,
  PaginationInfo as SkillPaginationInfo,
  UseCloudSkillPackagesOptions,
} from "./use-cloud-skills";
export {
  useCloudMcpPackages,
  useCloudMcpSearch,
  useCloudMcpPackage,
  useCloudMcpCategories,
  useCloudMcp,
} from "./use-cloud-mcp";
export type {
  CloudMcpPackage,
  CloudPackageAuthor,
  CloudMcpCategory,
  PaginationInfo,
  CloudMcpListResponse,
  UseCloudMcpPackagesOptions,
  UseCloudMcpPackagesReturn,
  UseCloudMcpSearchOptions,
  UseCloudMcpSearchReturn,
  UseCloudMcpPackageReturn,
  UseCloudMcpCategoriesReturn,
  UseCloudMcpOptions,
} from "./use-cloud-mcp";
export { usePackageUpdates } from "./use-package-updates";
export type {
  PackageUpdate,
  UsePackageUpdatesOptions,
  UsePackageUpdatesReturn,
} from "./use-package-updates";
export {
  useLocalWorkspaces,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "./use-workspaces";
export { useWorkspaceParam, buildWorkspaceUrl, isExecutorType } from "./use-workspace-param";
export type { UseWorkspaceParamReturn } from "./use-workspace-param";
export {
  useSkillReadme,
  useSkillFiles,
  useSkillFileContent,
  useSkillFileWriter,
} from "./use-skill-content";
export type { SaveStatus } from "./use-skill-content";
export {
  useConfigFileContent,
  useConfigFileWriter,
  useConfigFiles,
  getParentDir,
  getFilename,
} from "./use-config-file";
export {
  useWorkspaceAgentConfigs,
  useAgentConfigContent,
  useWorkspaceCommands,
  useCommandContent,
  useWorkspacePrompts,
  usePromptContent,
} from "./use-agent-configs";

// Workspace Resources (Gateway API)
export {
  useExecutors,
  useAgents,
  useAgents as useGatewayAgents, // Alias for backwards compatibility
  useAgentDetail,
  useAgentList,
  useChatList,
  useWorkspaceResources,
} from "./use-workspace-resources";
export type {
  UseExecutorsOptions,
  UseExecutorsReturn,
  UseAgentsOptions,
  UseAgentsReturn,
  UseAgentDetailReturn,
  UseAgentListOptions,
  UseAgentListReturn,
  AgentListItem,
  AgentListItemType,
  AgentListCounts,
  UseChatListOptions,
  UseChatListReturn,
  AgentOperations,
  UseWorkspaceResourcesReturn,
} from "./use-workspace-resources";

// Providers (Gateway API)
export {
  useProviders,
  DEFAULT_BASE_URLS,
  PROVIDER_TYPE_LABELS,
} from "./use-providers";
export type {
  UseProvidersReturn,
  Provider,
  ProviderType as ProviderConfigType,
  ProviderStatus,
  CreateProviderOptions,
  ProviderUpdate,
} from "./use-providers";

// Unified Models (Gateway API)
export { useModels } from "./use-models";
export type {
  UseModelsOptions,
  UseModelsReturn,
  WorkspaceModel,
  ModelResponse,
  CreateModelOptions as GatewayCreateModelOptions,
  ModelUpdate as GatewayModelUpdate,
  DiscoveredModel,
  ProviderType,
} from "./use-models";

// Official MCP Registry Integration
export {
  useOfficialRegistryServers,
  useOfficialRegistrySearch,
  useOfficialRegistryServer,
  useOfficialRegistry,
  getPackageTypeLabel,
  getInstallCommand,
  getServerIconUrl,
} from "./use-official-registry";
export type {
  OfficialServerListDisplay,
  UseOfficialRegistryServersOptions,
  UseOfficialRegistryServersReturn,
  UseOfficialRegistrySearchOptions,
  UseOfficialRegistrySearchReturn,
  UseOfficialRegistryServerReturn,
  UseOfficialRegistryOptions,
  OfficialServerDisplay,
  OfficialServerResponse,
  OfficialPackage,
  OfficialPackageRegistryType,
} from "./use-official-registry";

// Unified Agents (combines executors and agents)
export { useUnifiedAgents, useVibenAgentsOnly } from "./use-unified-agents";
export type { UseUnifiedAgentsOptions, UseUnifiedAgentsReturn } from "./use-unified-agents";

// Task Agent
export { useTaskAgent } from "./use-task-agent";
export type { TaskContext } from "./use-task-agent";
export { useVitePreview } from "./use-vite-preview";
export type { PreviewStatus, PreviewState, UseVitePreviewReturn } from "./use-vite-preview";

// Kanban Comments and Activities
export {
  useKanbanComments,
  useAddKanbanComment,
  useUpdateKanbanComment,
  useDeleteKanbanComment,
  useToggleCommentReaction,
  kanbanCommentsKeys,
} from "./use-kanban-comments";
export type { KanbanComment } from "./use-kanban-comments";
export {
  useKanbanActivities,
  useAddKanbanActivity,
  useRecordTaskActivity,
  useClearKanbanTaskData,
  kanbanActivitiesKeys,
} from "./use-kanban-activities";
export type { KanbanActivity } from "./use-kanban-activities";

// Gateway Status
export { useGatewayStatus } from "./use-gateway-status";
export type { GatewayStatus, UseGatewayStatusReturn } from "./use-gateway-status";

// Environment Orchestrator (Onboarding DAG)
export { useEnvOrchestrator } from "./use-env-orchestrator";
export type { UseEnvOrchestratorReturn } from "./use-env-orchestrator";

// Gateway Management
export { useGateway } from "./use-gateway";
export type {
  GatewayStatus as GatewayStatusInfo,
  GatewayConfig,
  UseGatewayReturn,
} from "./use-gateway";

// Channel Management
export { useChannels } from "./use-channels";
export type { UseChannelsReturn } from "./use-channels";
export { useChannelInstances, syncChannels } from "./use-channel-instances";
export type { UseChannelInstancesReturn } from "./use-channel-instances";
export { useChannelNotifications } from "./use-channel-notifications";
export type { UseChannelNotificationsReturn } from "./use-channel-notifications";

// Screenshot
export { useScreenshot } from "./use-screenshot";
export type {
  UseScreenshotOptions,
  UseScreenshotReturn,
} from "./use-screenshot";

// Model Auto-Correct
export { useModelAutoCorrect } from "./use-model-auto-correct";

// Cron Job Management
export {
  useCronJobs,
  useCreateCronJob,
  useUpdateCronJob,
  useDeleteCronJob,
  useEnableCronJob,
  useDisableCronJob,
  useRunCronJob,
  useCronExecutionLogs,
} from "./use-cron";
export { useCronNotifications } from "./use-cron-notifications";
export type { CronJobStatus, UseCronNotificationsReturn } from "./use-cron-notifications";
export { useCronNotificationAdapter } from "./use-cron-notification-adapter";

// File Browser
export { useFileBrowser } from "./use-file-browser";
export type { ViewMode } from "./use-file-browser";

// Toast Notifications
export { useToast, toast } from "./use-toast";
export type {
  ToastType,
  ToastAction,
  ToastOptions,
  PromiseToastMessages,
  PromiseToastOptions,
} from "./use-toast";

// System Notification
export {
  useSystemNotification,
  sendSystemNotification,
  ensureNotificationPermission,
} from "./use-system-notification";
export type {
  NotificationPermission,
  SystemNotificationOptions,
  UseSystemNotificationReturn,
} from "./use-system-notification";

// WebSocket with heartbeat and auto-reconnect
export { useWebSocket } from "./use-websocket";
export type { WebSocketState, UseWebSocketOptions, UseWebSocketReturn } from "./use-websocket";
export { useGatewayWebSocket } from "./use-gateway-websocket";
export type {
  GatewayEventPayload,
  GatewayWsMessage,
  UseGatewayWebSocketOptions,
} from "./use-gateway-websocket";

// Background Tasks
export { useBackgroundTasks } from "./use-background-tasks";
export type {
  BackgroundTask,
  BackgroundTaskStatus,
  UseBackgroundTasksReturn,
} from "./use-background-tasks";

// MCP Completion
export {
  useCompletion,
  createCompletionHandler,
} from "./use-completion";
export type {
  ResourceReference,
  PromptReference,
  CompletionRef,
  CompletionHandler,
  UseCompletionOptions,
  UseCompletionReturn,
} from "./use-completion";

// Task Specs Data
export { useTaskSpecsData } from "./use-task-specs-data";
export type {
  TaskSpecsData,
  ImplementationSubtask,
  ImplementationPlan,
} from "./use-task-specs-data";

// Stuck Detection
export { useStuckDetection, formatStuckDuration } from "./use-stuck-detection";
export type {
  UseStuckDetectionOptions,
  UseStuckDetectionReturn,
  TaskProgress,
  StuckDetectionSubtask,
} from "./use-stuck-detection";

// Worktree Existence Check
export { useWorktreeExists } from "./use-worktree-exists";

// Task Events (State Machine SSE)
export { useTaskEvents } from "./use-task-events";
export type {
  UseTaskEventsOptions,
  UseTaskEventsReturn,
} from "./use-task-events";

// Queue Auto-Promotion is now handled by Gateway's CommandQueue (Promoter).
// See: packages/core/src/queue/core/promoter.ts

// Ideas Management
export {
  useIdeas,
  useIdeaTypes,
  useIdeaDetail,
  useGenerateIdeas,
} from "./use-ideas";
export type {
  Idea,
  IdeaType,
  EffortLevel,
  IdeaStatus,
  IdeaListOptions,
  IdeaPromoteOptions,
  IdeaGenerateOptions,
  UseIdeasOptions,
  UseIdeasReturn,
  UseIdeaTypesOptions,
  UseIdeaTypesReturn,
  UseIdeaDetailOptions,
  UseIdeaDetailReturn,
  UseGenerateIdeasReturn,
} from "./use-ideas";

// Page Tabs
export { usePageTabs, useTabList, useActiveTabState, useTabActions, useTabNavigation } from "./use-page-tabs";
export type { ActiveTabState, TabActions, TabNavigationActions } from "./use-page-tabs";
export type { PageTab } from "@/stores/tab-store";

// Global Shortcuts
export { useGlobalShortcuts } from "./use-global-shortcuts";

// Workspace Pages (Gateway API)
export {
  usePages,
  usePage,
  useCreatePage,
  useDeletePage,
  usePageTemplates,
  pageKeys,
  templateKeys,
} from "./use-pages";
export type {
  PageConfig,
  PageType,
  PagePermission,
  StaticPageConfig,
  MarkdownPageConfig,
  ServerPageConfig,
  ProxyPageConfig,
  PageTemplate,
  CreatePageParams,
} from "./use-pages";

// Overlay
export { useOverlay } from "./use-overlay";
export { useDanmaku } from "./use-danmaku";
export { useSubtitle } from "./use-subtitle";
export { useClickIndicator } from "./use-click-indicator";
export { useKeystroke } from "./use-keystroke";
export { useWave } from "./use-wave";
export { useGlobalInput } from "./use-global-input";
export { useOverlayShortcuts } from "./use-overlay-shortcuts";

// Action System
export { useActionProvider } from "./use-action-provider";
export type { ActionProviderEntry } from "./use-action-provider";

// Page Dialogs
export { usePageDialogs } from "./use-page-dialogs";
export type { PageDialogsState } from "./use-page-dialogs";

// Platform Detection
export { usePlatform } from "./use-platform";

// Pet Window
export { usePetWindow } from "./use-pet-window";

// Pet
export { usePet } from "./use-pet";
export type { PetConfigResponse, UsePetResult } from "./use-pet";
