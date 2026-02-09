export { useAuth } from "./use-auth";
export { usePython } from "./use-python";
export { useAgents } from "./use-agents";
export { useMcp } from "./use-mcp";
export { useMcpStatusMonitor, useOnPageEnter, useServerStatus } from "./use-mcp-status-monitor";
export { useUsage } from "./use-usage";
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
  useWorkspaces,
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
export { useTrayStatus, useTrayStatusSync } from "./use-tray-status";
export { useStoreSync, useMainWindowStoreSync, useTrayWindowStoreSync } from "./use-store-sync";
export {
  useLocalWorkspaces,
  useWorkspaceAgents,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "./use-workspaces";
export {
  useSkillReadme,
  useSkillFiles,
  useSkillFileContent,
  useSkillFileWriter,
} from "./use-skill-content";
export type { SaveStatus } from "./use-skill-content";
export {
  useWorkspaceAgentConfigs,
  useAgentConfigContent,
  useWorkspaceCommands,
  useCommandContent,
} from "./use-agent-configs";

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

// Viben-core Agents and Models
export { useVibenAgents } from "./use-viben-agents";
export type { Agent, CreateAgentOptions, AgentUpdate, AgentTemplate, AgentSession, AgentMemory, UseVibenAgentsReturn } from "./use-viben-agents";
export { useVibenModels } from "./use-viben-models";
export type { Model, CreateModelOptions, ModelUpdate, DiscoveredModel, UseVibenModelsReturn } from "./use-viben-models";

// Unified Agents (combines executors and agents)
export { useUnifiedAgents, useVibenAgentsOnly, useWorkspaceExecutors } from "./use-unified-agents";
export type { UseUnifiedAgentsOptions, UseUnifiedAgentsReturn } from "./use-unified-agents";

// Workspace Chat
export { useAgent } from "./use-agent";
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

// Screenshot
export { useScreenshot } from "./use-screenshot";
export type {
  UseScreenshotOptions,
  UseScreenshotReturn,
} from "./use-screenshot";

// Chat Config
export { useChatConfig } from "./use-chat-config";
export type { UseChatConfigReturn } from "./use-chat-config";

// Cron Job Management
export {
  useCronJobs,
  useCreateCronJob,
  useUpdateCronJob,
  useDeleteCronJob,
  useEnableCronJob,
  useDisableCronJob,
  useRunCronJob,
} from "./use-cron";

// Group Chat
export { useGroupChat } from "./use-group-chat";
export type { UseGroupChatOptions, UseGroupChatReturn } from "./use-group-chat";

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
