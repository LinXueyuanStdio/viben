/**
 * Gateway routes index
 */
import type { FastifyInstance } from "fastify";
import type { AppState } from "../state";
import { registerHealthRoutes } from "./health";
import { registerAgentRoutes } from "./agents";
import { registerTasksRoutes } from "./tasks";
import { registerTaskRoutes } from "./task";
import { registerSessionRoutes } from "./sessions";
import { registerCronRoutes } from "./cron";
import { registerEventsRoutes } from "./events";
import { registerChannelRoutes } from "./channels";
import { registerExecutorRoutes } from "./executors";
import { registerModelRoutes } from "./models";
import { registerProviderRoutes } from "./providers";
import { registerWebSocketRoutes } from "./ws";
import { registerHistoryRoutes } from "./history";
import { registerTerminalRoutes } from "./terminal";
import { registerGroupChatRoutes } from "./group-chats";
import { registerWorkspaceRoutes } from "./workspaces";
import { registerChatListRoutes } from "./chat-list";
import { registerMcpRoutes } from "./mcp";
import { registerAgentRunRoutes } from "./agent-run";
import { registerAgentWsRoutes } from "./agent-ws";
import { registerFileRoutes } from "./files";
import { registerTelemetryRoutes } from "./telemetry";
import { registerSandboxRoutes } from "./sandbox";
import { registerCommandsRoutes } from "./commands";
import { registerPythonRoutes } from "./python";
import { registerServiceKeysRoutes } from "./service-keys";
import { registerUsageRoutes } from "./usage";
import { registerInstalledSourcesRoutes } from "./installed-sources";
import { registerLogsRoutes } from "./logs";
import { registerMarketplaceRoutes } from "./marketplace";
import { registerOfficialRegistryRoutes } from "./official-registry";
import { registerCacheRoutes } from "./cache";
import { registerFilesystemRoutes } from "./filesystem";
import { registerTunnelRoutes } from "./tunnel";
import { registerKanbanDataRoutes } from "./kanban-data";
import { registerPackagesRoutes } from "./packages";
import { registerMcpInspectorRoutes } from "./mcp-inspector";
import { registerQueueRoutes } from "./queue";
import { registerGitHubRoutes } from "./github";
import { registerTauriMcpRoutes } from "./tauri-mcp";
import { registerPreferencesRoutes } from "./preferences";
import { registerTaskEventRoutes } from "./task-events";
import { registerPreviewRoutes } from "./preview";

/**
 * Register all routes
 */
export function registerRoutes(fastify: FastifyInstance, state: AppState): void {
  registerHealthRoutes(fastify);
  registerAgentRoutes(fastify, state);
  registerTasksRoutes(fastify, state);
  registerTaskRoutes(fastify, state);
  registerSessionRoutes(fastify, state);
  registerCronRoutes(fastify, state);
  registerEventsRoutes(fastify, state);
  registerChannelRoutes(fastify);
  registerExecutorRoutes(fastify);
  registerModelRoutes(fastify);
  registerProviderRoutes(fastify);
  registerWebSocketRoutes(fastify, state);
  registerHistoryRoutes(fastify);
  registerTerminalRoutes(fastify, state);
  registerWorkspaceRoutes(fastify);
  registerGroupChatRoutes(fastify, state);
  registerChatListRoutes(fastify);
  registerMcpRoutes(fastify);
  registerAgentRunRoutes(fastify);
  registerAgentWsRoutes(fastify);
  registerFileRoutes(fastify);
  registerTelemetryRoutes(fastify);
  registerSandboxRoutes(fastify);
  registerCommandsRoutes(fastify);
  registerPythonRoutes(fastify);
  registerServiceKeysRoutes(fastify);
  registerUsageRoutes(fastify);
  registerInstalledSourcesRoutes(fastify);
  registerLogsRoutes(fastify);
  registerMarketplaceRoutes(fastify);
  registerOfficialRegistryRoutes(fastify);
  registerCacheRoutes(fastify);
  registerFilesystemRoutes(fastify);
  registerTunnelRoutes(fastify);
  registerKanbanDataRoutes(fastify);
  registerPackagesRoutes(fastify);
  registerMcpInspectorRoutes(fastify);
  registerQueueRoutes(fastify, state);
  registerGitHubRoutes(fastify);
  registerTauriMcpRoutes(fastify);
  registerPreferencesRoutes(fastify);
  registerTaskEventRoutes(fastify);
  registerPreviewRoutes(fastify);
}

// Re-export individual route registrations
export { registerHealthRoutes } from "./health";
export { registerAgentRoutes } from "./agents";
export { registerTasksRoutes } from "./tasks";
export { registerTaskRoutes } from "./task";
export { registerSessionRoutes } from "./sessions";
export { registerCronRoutes } from "./cron";
export { registerEventsRoutes } from "./events";
export { registerChannelRoutes } from "./channels";
export { registerExecutorRoutes } from "./executors";
export { registerModelRoutes } from "./models";
export { registerProviderRoutes } from "./providers";
export { registerWebSocketRoutes } from "./ws";
export { registerHistoryRoutes } from "./history";
export { registerTerminalRoutes, getActiveSessionCount, killAllSessions } from "./terminal";
export { registerWorkspaceRoutes } from "./workspaces";
export { registerGroupChatRoutes } from "./group-chats";
export { registerChatListRoutes } from "./chat-list";
export { registerMcpRoutes } from "./mcp";
export { registerAgentRunRoutes } from "./agent-run";
export { registerAgentWsRoutes, getActiveWsSessionCount, closeAllWsSessions } from "./agent-ws";
export { registerFileRoutes } from "./files";
export { registerTelemetryRoutes } from "./telemetry";
export { registerSandboxRoutes } from "./sandbox";
export { registerCommandsRoutes } from "./commands";
export { registerPythonRoutes } from "./python";
export type { PythonInfo, PackageInfo } from "./python";
export { registerServiceKeysRoutes } from "./service-keys";
export { registerUsageRoutes } from "./usage";
export { registerInstalledSourcesRoutes } from "./installed-sources";
export { registerLogsRoutes } from "./logs";
export { registerMarketplaceRoutes } from "./marketplace";
export { registerOfficialRegistryRoutes } from "./official-registry";
export { registerCacheRoutes } from "./cache";
export { registerFilesystemRoutes } from "./filesystem";
export { registerTunnelRoutes } from "./tunnel";
export { registerPackagesRoutes } from "./packages";
export type { InstalledPackage, InstalledPackagesResponse } from "./packages";
export {
  registerMcpInspectorRoutes,
  getMcpInspectorSessionToken,
  isMcpInspectorAuthDisabled,
} from "./mcp-inspector";
export { registerQueueRoutes } from "./queue";
export { registerGitHubRoutes } from "./github";
export { registerTauriMcpRoutes, DEFAULT_SOCKET_PATH as TAURI_MCP_SOCKET_PATH } from "./tauri-mcp";
export { registerPreferencesRoutes } from "./preferences";
export type { DeveloperPreferences, PreferencesResponse } from "./preferences";
export { registerTaskEventRoutes } from "./task-events";
export { registerPreviewRoutes } from "./preview";
// Task SSE manager for state machine events
export { TaskSSEManager, taskSSEManager, type TaskSSEEvent, type TaskSSEEventType, type TaskSSEListener } from "../sse/task-sse-manager";
export type {
  SSEEventType,
  SSEMessage,
  SSESessionMessage,
  SSETextMessage,
  SSEToolUseMessage,
  SSEToolResultMessage,
  SSEPlanMessage,
  SSEQuestionMessage,
  SSEResultMessage,
  SSEErrorMessage,
  SSEDoneMessage,
} from "./agent-run";
