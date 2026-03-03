/**
 * Gateway Client Class
 * 网关客户端类
 *
 * Provides a backward-compatible class-based API wrapping all functional modules.
 * 提供向后兼容的基于类的 API，封装所有功能模块。
 */

import { GatewayError } from "./error";
import { getGatewayUrl, discoverGateway } from "./config";

// Import module functions
import {
  // Core module
  ping,
  diagnose,

  // Agent execution module
  spawnAgentStream,
  continueSessionStream,
  stopAgent,
  sendAgentInput,
  listBackgroundTasks,
  getBackgroundTask,
  stopBackgroundTask,
  deleteBackgroundTask,

  // Sessions module
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getSessionMessages,
  getSessionUIMessages,
  appendMessage,
  clearSessionMessages,
  listExecutorSessions,
  getExecutorSessionMessages,

  // Agents CRUD module
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  getDefaultAgent,
  setDefaultAgent,
  listAgentTemplates,
  getAgentTemplate,

  // Models module
  listModels,
  getModel,
  createModel,
  updateModel,
  deleteModel,
  getDefaultModel,
  setDefaultModel,
  enableModel,
  disableModel,

  // Providers module
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setDefaultProvider,
  testProvider,
  discoverModels,
  getProviderEnabledModels,
  updateProviderEnabledModels,
  getApiKeyProviders,

  // API Keys module
  setApiKey,
  clearApiKey,
  verifyApiKey,
  // Workspaces module
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getActiveWorkspace,
  setActiveWorkspace,
  detectAgents,

  // Workspace Resources module
  getExecutors,
  getWorkspaceModels,
  getAgents as getWorkspaceAgents,
  getAgentDetails,
  getChatList,

  // Group Chat module
  listGroupChats,
  getGroupChat,
  createGroupChat,
  updateGroupChat,
  deleteGroupChat,
  addMember,
  removeMember,
  listGroupChatSessions,
  getGroupChatSession,
  createGroupChatSession,
  archiveGroupChatSession,
  listGroupChatMessages,
  sendGroupChatMessage,

  // MCP Servers module
  getMcpServers,
  addMcpServer,
  updateMcpServer,
  deleteMcpServer,
  enableMcpServer,
  disableMcpServer,

  // MCP Proxy module
  getMcpProxyStatus,
  checkMcpProxyInstalled,
  startMcpProxy,
  stopMcpProxy,
  installMcpProxy,
  getPortProcess,
  killPortProcess,
  checkMcpServerOnPort,

  // MCP Inspector module
  getMcpInspectorHealth,
  getMcpInspectorToken,
  getMcpInspectorConfig,
  getMcpInspectorSessions,
  closeMcpInspectorSession,

  // MCP Browse module
  getMcpStatus,
  startMcpServer,
  stopMcpServer,
  testMcpConnection,
  checkPortStatus,
  killProcess,
  isProcessAlive,

  // Service Keys module
  getServiceKeys,
  createServiceKey,
  getServiceKeyById,
  deleteServiceKey,
  validateServiceKey,

  // Executor Resources module
  getSkills,
  addSkill,
  deleteSkill,
  getAgentConfigs,
  getAgentConfig,
  getCommands,
  getCommand,
  getPrompts,
  getPrompt,

  // Files module
  listFiles,
  readFile,
  createFile,
  createDirectory,
  writeFile,
  deleteFile,
  renameFile,
  copyFile,
  moveFile,
  openFile,
  revealFile,
  openFolder,
  revealInFileManager,
  readDirectory,
  readFileContent,
  readMcpServersFile,
  writeMcpServersFile,
  getConfigDir,

  // System module
  getSystemInfo,
  detectPython,
  checkPythonPath,
  checkPythonPackage,
  getPythonInstallCommand,
  detectCliTools,
  checkCliToolPath,
  getCliToolsConfig,
  saveCliToolsConfig,
  updateCliToolPath,

  // Usage module
  initUsage,
  getUsageStats,
  recordUsage,
  getApiKeyUsage,
  getServerUsage,
  getSourceUsage,

  // Sources module
  getInstalledSources,
  showInstalledProvider,
  installProvider,

  // Logs module
  initLogs,
  getLogsDirPath,
  getLogSessions,
  getSessionLogs,
  addLog,
  clearSessionLogs,
  clearLogs,
  cleanupOldSessions,
  exportSessionLogs,

  // API Logs module
  getApiLogsDirPath,
  getApiLogSessions,
  getApiLogs,
  getApiLogSummary,
  clearApiLogs,
  openApiLogsDir,

  // Marketplace module
  getProviderIndex,
  getFlatSources,
  clearProviderCache,

  // Official Registry module
  listOfficialServers,
  getOfficialServer,
  getOfficialServerVersions,
  clearOfficialRegistryCache,
  invalidateOfficialServerCache,

  // Cache module
  isOffline,
  getCacheInfo,
  getCacheSettings,
  setCacheSettings,
  refreshCache,
  clearCache,
  shouldRefreshCache,

  // Kanban module
  getKanbanComments,
  addKanbanComment,
  updateKanbanComment,
  deleteKanbanComment,
  toggleCommentReaction,
  getKanbanActivities,
  addKanbanActivity,
  clearKanbanTaskData,

  // Preferences module
  getPreferences,
  updatePreferences,
  getDeveloperPreferences,
  updateDeveloperPreferences,
  getPreferredIDE,
  setPreferredIDE,
  getPreferredTerminal,
  setPreferredTerminal,
} from "./modules";

// Import types
import type {
  SpawnAgentRequest,
  SSEMessageEvent,
  ExecutorType,
  BackgroundTask,
  FileSession,
  SessionMessage,
  UIMessage,
  CreateFileSessionRequest,
  AppendMessageRequest,
  ExecutorSession,
  ExecutorUIMessage,
  AgentResponse,
  CreateAgentOptions,
  UpdateAgentOptions,
  DefaultAgentResponse,
  AgentTemplate,
  ListTemplatesResponse,
  ModelResponse,
  CreateModelOptions,
  ModelUpdate,
  DefaultModelResponse,
  ProviderResponse,
  CreateProviderOptions,
  ProviderUpdate,
  ProvidersListResponse,
  ProviderStatus,
  DiscoverModelsResponse,
  ProviderEnabledModelsResponse,
  ApiKeyProvidersResponse,
  // Workspace types
  WorkspaceResponse,
  WorkspacesListResponse,
  DetectAgentsResponse,
  ExecutorsResponse,
  WorkspaceModelsResponse,
  AgentsResponse,
  AgentDetails,
  ChatListResponse,
  // Group Chat types
  GroupChat,
  GroupChatWithMembers,
  GroupChatMember,
  GroupChatSession,
  CreateGroupChatRequest,
  UpdateGroupChatRequest,
  AddMemberRequest,
  CreateGroupChatSessionRequest,
  ListGroupChatsParams,
  ListGroupChatMessagesParams,
  ListGroupChatMessagesResponse,
  ListAgentMessagesResponse,
  SendGroupChatMessageResponse,
  SendGroupChatMessageRequest,
  // MCP types
  WorkspaceMcpServerConfig,
  WorkspaceMcpServersResponse,
  McpProxyStatus,
  McpProxyConfig,
  PortProcess,
  McpServerPortStatus,
  McpInspectorHealth,
  McpInspectorToken,
  McpInspectorConfig,
  McpInspectorSession,
  McpStatus,
  McpStartConfig,
  PortStatus,
  // Service Keys types
  ServiceApiKey,
  // Executor Resources types
  WorkspaceSkillConfig,
  WorkspaceSkillsResponse,
  WorkspaceAgentConfigData,
  WorkspaceAgentConfigsResponse,
  WorkspaceCommandData,
  WorkspaceCommandsResponse,
  WorkspacePromptData,
  WorkspacePromptsResponse,
  // Files types
  FileEntry,
  FileListResponse,
  FileContentResponse,
  McpServersConfig,
  // System types
  SystemInfo,
  PythonInfo,
  PythonPackageInfo,
  CliToolName,
  CliToolInfo,
  CliToolsInfo,
  CliToolsConfig,
  // Usage types
  UsageStats,
  ApiKeyUsage,
  // Sources types
  InstalledSourcesResponse,
  // Logs types
  LogLevel,
  LogEntry,
  LogSessionSummary,
  // API Logs types
  ApiLogEntry,
  ApiLogSummary,
  ApiLogSession,
  // Marketplace types
  ProviderIndex,
  FlatSource,
  // Official Registry types
  OfficialServerDisplay,
  OfficialServerListResponse,
  // Cache types
  CacheInfo,
  CacheSettings,
  // Kanban types
  KanbanComment,
  KanbanActivity,
  // Preferences types
  PreferencesResponse,
  DeveloperPreferences,
} from "./types";

// ============================================================================
// GatewayClient Class
// ============================================================================

/**
 * Gateway API client for agent management
 *
 * Provides a class-based API for interacting with the Viben Gateway.
 * All methods delegate to functional modules while maintaining
 * backward compatibility with the previous API.
 */
export class GatewayClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getGatewayUrl();
  }

  // ==========================================================================
  // URL Management
  // ==========================================================================

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Update the base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // ==========================================================================
  // Stream Management
  // ==========================================================================

  /**
   * Cancel any ongoing SSE stream
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ==========================================================================
  // Core Module Methods
  // ==========================================================================

  /**
   * Check if Gateway is reachable
   */
  async ping(): Promise<boolean> {
    return ping(this.baseUrl);
  }

  /**
   * Auto-discover and connect to Gateway
   * Tries known ports and updates baseUrl if found
   */
  async autoDiscover(): Promise<boolean> {
    // First try current URL
    if (await this.ping()) {
      return true;
    }

    // Try discovery
    const discoveredUrl = await discoverGateway();
    if (discoveredUrl) {
      this.baseUrl = discoveredUrl;
      return true;
    }

    return false;
  }

  /**
   * Get detailed diagnostics from Gateway
   */
  async diagnose(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    version: string;
    uptime: number;
    components: Record<string, { status: string; message?: string }>;
  }> {
    return diagnose(this.baseUrl);
  }

  // ==========================================================================
  // Agent Execution Module Methods
  // ==========================================================================

  /**
   * Spawn agent with SSE streaming
   * Returns an async generator that yields SSE events
   */
  async *spawnAgentStream(
    executorType: ExecutorType,
    request: SpawnAgentRequest
  ): AsyncGenerator<SSEMessageEvent, void, unknown> {
    // Cancel any existing stream
    this.cancelStream();

    this.abortController = new AbortController();

    const response = await spawnAgentStream(
      this.baseUrl,
      executorType,
      request,
      this.abortController.signal
    );

    if (!response.body) {
      throw new GatewayError("No response body for SSE stream");
    }

    yield* this.parseSSEStream(response.body);
  }

  /**
   * Continue session with SSE streaming
   */
  async *continueSessionStream(
    executorType: ExecutorType,
    sessionId: string,
    prompt: string,
    resetToMessageId?: string
  ): AsyncGenerator<SSEMessageEvent, void, unknown> {
    // Cancel any existing stream
    this.cancelStream();

    this.abortController = new AbortController();

    const response = await continueSessionStream(
      this.baseUrl,
      executorType,
      sessionId,
      prompt,
      resetToMessageId,
      this.abortController.signal
    );

    if (!response.body) {
      throw new GatewayError("No response body for SSE stream");
    }

    yield* this.parseSSEStream(response.body);
  }

  /**
   * Parse SSE stream from response body
   */
  private async *parseSSEStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<SSEMessageEvent, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            try {
              const event = JSON.parse(data) as SSEMessageEvent;
              yield event;
            } catch {
              console.warn("[GatewayClient] Invalid SSE data:", data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stop a running agent
   */
  async stopAgent(
    executorType: ExecutorType,
    sessionId: string
  ): Promise<{ success: boolean }> {
    // Cancel any ongoing stream
    this.cancelStream();
    return stopAgent(this.baseUrl, executorType, sessionId);
  }

  /**
   * Send input to agent (for interactive questions)
   */
  async sendAgentInput(
    executorType: ExecutorType,
    sessionId: string,
    questionId: string,
    answers: Record<string, string>
  ): Promise<void> {
    return sendAgentInput(
      this.baseUrl,
      executorType,
      sessionId,
      questionId,
      answers
    );
  }

  // ==========================================================================
  // Background Task Methods
  // ==========================================================================

  /**
   * List background tasks
   */
  async listBackgroundTasks(): Promise<BackgroundTask[]> {
    return listBackgroundTasks(this.baseUrl);
  }

  /**
   * Get background task by ID
   */
  async getBackgroundTask(taskId: string): Promise<BackgroundTask | null> {
    return getBackgroundTask(this.baseUrl, taskId);
  }

  /**
   * Stop background task
   */
  async stopBackgroundTask(taskId: string): Promise<{ success: boolean }> {
    return stopBackgroundTask(this.baseUrl, taskId);
  }

  /**
   * Delete background task
   */
  async deleteBackgroundTask(taskId: string): Promise<void> {
    return deleteBackgroundTask(this.baseUrl, taskId);
  }

  // ==========================================================================
  // Session Module Methods
  // ==========================================================================

  /**
   * List sessions for an agent
   */
  async listSessions(
    agentId: string,
    workspacePath?: string
  ): Promise<FileSession[]> {
    return listSessions(this.baseUrl, agentId, workspacePath);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<FileSession | null> {
    return getSession(this.baseUrl, sessionId);
  }

  /**
   * Create a new session
   */
  async createSession(
    agentId: string,
    request: CreateFileSessionRequest
  ): Promise<FileSession> {
    return createSession(this.baseUrl, agentId, request);
  }

  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<FileSession, "status" | "metadata">>
  ): Promise<FileSession> {
    return updateSession(this.baseUrl, sessionId, updates);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    return deleteSession(this.baseUrl, sessionId);
  }

  /**
   * Get session messages (rollout format)
   */
  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    return getSessionMessages(this.baseUrl, sessionId);
  }

  /**
   * Get session UI messages (for frontend rendering)
   */
  async getSessionUIMessages(sessionId: string): Promise<UIMessage[]> {
    return getSessionUIMessages(this.baseUrl, sessionId);
  }

  /**
   * Append message to session
   */
  async appendMessage(
    sessionId: string,
    message: AppendMessageRequest
  ): Promise<void> {
    return appendMessage(this.baseUrl, sessionId, message);
  }

  /**
   * Clear session messages
   */
  async clearSessionMessages(sessionId: string): Promise<void> {
    return clearSessionMessages(this.baseUrl, sessionId);
  }

  /**
   * List executor sessions
   */
  async listExecutorSessions(
    executorType: string,
    workspacePath: string
  ): Promise<ExecutorSession[]> {
    return listExecutorSessions(this.baseUrl, executorType, workspacePath);
  }

  /**
   * Get executor session UI messages
   */
  async getExecutorSessionMessages(
    executorType: string,
    sessionId: string,
    workspacePath: string
  ): Promise<ExecutorUIMessage[]> {
    return getExecutorSessionMessages(
      this.baseUrl,
      executorType,
      sessionId,
      workspacePath
    );
  }

  // ==========================================================================
  // Agent CRUD Module Methods
  // ==========================================================================

  /**
   * List all agents
   */
  async listAgents(workspacePath?: string): Promise<AgentResponse[]> {
    return listAgents(this.baseUrl, workspacePath);
  }

  /**
   * Get agent by ID
   */
  async getAgent(
    agentId: string,
    workspacePath?: string
  ): Promise<AgentResponse | null> {
    return getAgent(this.baseUrl, agentId, workspacePath);
  }

  /**
   * Create agent
   */
  async createAgent(options: CreateAgentOptions): Promise<AgentResponse> {
    return createAgent(this.baseUrl, options);
  }

  /**
   * Update agent
   */
  async updateAgent(
    agentId: string,
    updates: UpdateAgentOptions
  ): Promise<AgentResponse> {
    return updateAgent(this.baseUrl, agentId, updates);
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string, workspacePath?: string): Promise<void> {
    return deleteAgent(this.baseUrl, agentId, workspacePath);
  }

  /**
   * Get default agent
   */
  async getDefaultAgent(): Promise<DefaultAgentResponse> {
    return getDefaultAgent(this.baseUrl);
  }

  /**
   * Set default agent
   */
  async setDefaultAgent(agentId: string): Promise<void> {
    return setDefaultAgent(this.baseUrl, agentId);
  }

  /**
   * List agent templates
   */
  async listAgentTemplates(): Promise<ListTemplatesResponse> {
    return listAgentTemplates(this.baseUrl);
  }

  /**
   * Get agent template by ID
   */
  async getAgentTemplate(templateId: string): Promise<AgentTemplate | null> {
    return getAgentTemplate(this.baseUrl, templateId);
  }

  // ==========================================================================
  // Model Module Methods
  // ==========================================================================

  /**
   * List all models
   */
  async listModels(): Promise<ModelResponse[]> {
    return listModels(this.baseUrl);
  }

  /**
   * Get model by ID
   */
  async getModel(modelId: string): Promise<ModelResponse | null> {
    return getModel(this.baseUrl, modelId);
  }

  /**
   * Create model
   */
  async createModel(options: CreateModelOptions): Promise<ModelResponse> {
    return createModel(this.baseUrl, options);
  }

  /**
   * Update model
   */
  async updateModel(
    modelId: string,
    updates: ModelUpdate
  ): Promise<ModelResponse> {
    return updateModel(this.baseUrl, modelId, updates);
  }

  /**
   * Delete model
   */
  async deleteModel(modelId: string): Promise<void> {
    return deleteModel(this.baseUrl, modelId);
  }

  /**
   * Get default model
   */
  async getDefaultModel(): Promise<DefaultModelResponse> {
    return getDefaultModel(this.baseUrl);
  }

  /**
   * Set default model
   */
  async setDefaultModel(modelId: string): Promise<void> {
    return setDefaultModel(this.baseUrl, modelId);
  }

  /**
   * Enable model
   */
  async enableModel(modelId: string): Promise<ModelResponse> {
    return enableModel(this.baseUrl, modelId);
  }

  /**
   * Disable model
   */
  async disableModel(modelId: string): Promise<ModelResponse> {
    return disableModel(this.baseUrl, modelId);
  }

  // ==========================================================================
  // Provider Module Methods
  // ==========================================================================

  /**
   * List all providers
   */
  async listProviders(): Promise<ProvidersListResponse> {
    return listProviders(this.baseUrl);
  }

  /**
   * Get provider by ID
   */
  async getProvider(providerId: string): Promise<ProviderResponse | null> {
    return getProvider(this.baseUrl, providerId);
  }

  /**
   * Create provider
   */
  async createProvider(
    options: CreateProviderOptions
  ): Promise<ProviderResponse> {
    return createProvider(this.baseUrl, options);
  }

  /**
   * Update provider
   */
  async updateProvider(
    providerId: string,
    updates: ProviderUpdate
  ): Promise<ProviderResponse> {
    return updateProvider(this.baseUrl, providerId, updates);
  }

  /**
   * Delete provider
   */
  async deleteProvider(providerId: string): Promise<void> {
    return deleteProvider(this.baseUrl, providerId);
  }

  /**
   * Set default provider
   */
  async setDefaultProvider(providerId: string): Promise<void> {
    return setDefaultProvider(this.baseUrl, providerId);
  }

  /**
   * Test provider connection
   */
  async testProvider(providerId: string): Promise<ProviderStatus> {
    return testProvider(this.baseUrl, providerId);
  }

  /**
   * Discover models from provider
   */
  async discoverModels(providerId: string): Promise<DiscoverModelsResponse> {
    return discoverModels(this.baseUrl, providerId);
  }

  /**
   * Get enabled models for provider
   */
  async getProviderEnabledModels(
    providerId: string
  ): Promise<ProviderEnabledModelsResponse> {
    return getProviderEnabledModels(this.baseUrl, providerId);
  }

  /**
   * Update enabled models for provider
   */
  async updateProviderEnabledModels(
    providerId: string,
    modelIds: string[]
  ): Promise<ProviderEnabledModelsResponse> {
    return updateProviderEnabledModels(this.baseUrl, providerId, modelIds);
  }

  /**
   * Get API key providers info
   */
  async getApiKeyProviders(): Promise<ApiKeyProvidersResponse> {
    return getApiKeyProviders(this.baseUrl);
  }

  // ==========================================================================
  // API Key Module Methods
  // ==========================================================================

  /**
   * Set API key for provider
   */
  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    return setApiKey(this.baseUrl, providerId, apiKey);
  }

  /**
   * Clear API key for provider
   */
  async clearApiKey(providerId: string): Promise<void> {
    return clearApiKey(this.baseUrl, providerId);
  }

  /**
   * Verify API key for provider
   */
  async verifyApiKey(providerId: string): Promise<boolean> {
    return verifyApiKey(this.baseUrl, providerId);
  }

  // ==========================================================================
  // Workspace Module Methods
  // ==========================================================================

  /**
   * List all workspaces
   */
  async listWorkspaces(): Promise<WorkspacesListResponse> {
    return listWorkspaces(this.baseUrl);
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string): Promise<WorkspaceResponse | null> {
    return getWorkspace(this.baseUrl, workspaceId);
  }

  /**
   * Create or register workspace
   */
  async createWorkspace(
    path: string,
    name?: string
  ): Promise<WorkspaceResponse> {
    return createWorkspace(this.baseUrl, path, name);
  }

  /**
   * Update workspace
   */
  async updateWorkspace(
    workspaceId: string,
    updates: Partial<
      Pick<WorkspaceResponse, "name" | "mcp" | "skills" | "agents">
    >
  ): Promise<WorkspaceResponse> {
    return updateWorkspace(this.baseUrl, workspaceId, updates);
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    return deleteWorkspace(this.baseUrl, workspaceId);
  }

  /**
   * Get active workspace
   */
  async getActiveWorkspace(): Promise<WorkspaceResponse | null> {
    return getActiveWorkspace(this.baseUrl);
  }

  /**
   * Set active workspace
   */
  async setActiveWorkspace(workspaceId: string): Promise<void> {
    return setActiveWorkspace(this.baseUrl, workspaceId);
  }

  /**
   * Detect agents in workspace
   */
  async detectAgents(workspaceId: string): Promise<DetectAgentsResponse> {
    return detectAgents(this.baseUrl, workspaceId);
  }

  // ==========================================================================
  // Workspace Resources Module Methods
  // ==========================================================================

  /**
   * Get executors for a workspace
   */
  async getExecutors(workspacePath: string): Promise<ExecutorsResponse> {
    return getExecutors(this.baseUrl, workspacePath);
  }

  /**
   * Get models for a workspace
   */
  async getWorkspaceModels(
    workspacePath: string
  ): Promise<WorkspaceModelsResponse> {
    return getWorkspaceModels(this.baseUrl, workspacePath);
  }

  /**
   * Get agents for a workspace
   */
  async getWorkspaceAgents(
    workspacePath: string,
    includeGlobal = true
  ): Promise<AgentsResponse> {
    return getWorkspaceAgents(this.baseUrl, workspacePath, includeGlobal);
  }

  /**
   * Get agent details by type
   */
  async getAgentDetails(agentType: string): Promise<AgentDetails | null> {
    return getAgentDetails(this.baseUrl, agentType);
  }

  /**
   * Get aggregated chat list for workspace
   */
  async getChatList(
    workspacePath: string,
    includeGlobal = true
  ): Promise<ChatListResponse> {
    return getChatList(this.baseUrl, workspacePath, includeGlobal);
  }

  // ==========================================================================
  // Group Chat Module Methods
  // ==========================================================================

  /**
   * List group chats
   */
  async listGroupChats(params?: ListGroupChatsParams): Promise<GroupChat[]> {
    return listGroupChats(this.baseUrl, params);
  }

  /**
   * Get group chat by ID
   */
  async getGroupChat(
    groupChatId: string
  ): Promise<GroupChatWithMembers | null> {
    return getGroupChat(this.baseUrl, groupChatId);
  }

  /**
   * Create group chat
   */
  async createGroupChat(
    request: CreateGroupChatRequest
  ): Promise<GroupChatWithMembers> {
    return createGroupChat(this.baseUrl, request);
  }

  /**
   * Update group chat
   */
  async updateGroupChat(
    groupChatId: string,
    request: UpdateGroupChatRequest
  ): Promise<GroupChat> {
    return updateGroupChat(this.baseUrl, groupChatId, request);
  }

  /**
   * Delete group chat
   */
  async deleteGroupChat(groupChatId: string): Promise<void> {
    return deleteGroupChat(this.baseUrl, groupChatId);
  }

  /**
   * Add member to group chat
   */
  async addMember(
    groupChatId: string,
    request: AddMemberRequest
  ): Promise<GroupChatMember> {
    return addMember(this.baseUrl, groupChatId, request);
  }

  /**
   * Remove member from group chat
   */
  async removeMember(groupChatId: string, memberId: string): Promise<void> {
    return removeMember(this.baseUrl, groupChatId, memberId);
  }

  /**
   * List sessions for group chat
   */
  async listGroupChatSessions(
    groupChatId: string
  ): Promise<GroupChatSession[]> {
    return listGroupChatSessions(this.baseUrl, groupChatId);
  }

  /**
   * Get group chat session
   */
  async getGroupChatSession(
    groupChatId: string,
    sessionId: string
  ): Promise<GroupChatSession | null> {
    return getGroupChatSession(this.baseUrl, groupChatId, sessionId);
  }

  /**
   * Create group chat session
   */
  async createGroupChatSession(
    groupChatId: string,
    request: CreateGroupChatSessionRequest
  ): Promise<GroupChatSession> {
    return createGroupChatSession(this.baseUrl, groupChatId, request);
  }

  /**
   * Archive group chat session
   */
  async archiveGroupChatSession(
    groupChatId: string,
    sessionId: string
  ): Promise<GroupChatSession> {
    return archiveGroupChatSession(this.baseUrl, groupChatId, sessionId);
  }

  /**
   * List messages in group chat session
   */
  async listGroupChatMessages(
    groupChatId: string,
    sessionId: string,
    params?: ListGroupChatMessagesParams
  ): Promise<ListGroupChatMessagesResponse | ListAgentMessagesResponse> {
    return listGroupChatMessages(this.baseUrl, groupChatId, sessionId, params);
  }

  /**
   * Send message to group chat session
   */
  async sendGroupChatMessage(
    groupChatId: string,
    sessionId: string,
    request: SendGroupChatMessageRequest
  ): Promise<SendGroupChatMessageResponse> {
    return sendGroupChatMessage(this.baseUrl, groupChatId, sessionId, request);
  }

  // ==========================================================================
  // MCP Servers Module Methods
  // ==========================================================================

  /**
   * Get MCP servers for workspace
   */
  async getMcpServers(
    workspacePath: string
  ): Promise<WorkspaceMcpServersResponse> {
    return getMcpServers(this.baseUrl, workspacePath);
  }

  /**
   * Add MCP server to workspace
   */
  async addMcpServer(
    workspacePath: string,
    server: WorkspaceMcpServerConfig
  ): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
    return addMcpServer(this.baseUrl, workspacePath, server);
  }

  /**
   * Update MCP server in workspace
   */
  async updateMcpServer(
    workspacePath: string,
    serverName: string,
    updates: Partial<WorkspaceMcpServerConfig>
  ): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
    return updateMcpServer(this.baseUrl, workspacePath, serverName, updates);
  }

  /**
   * Delete MCP server from workspace
   */
  async deleteMcpServer(
    workspacePath: string,
    serverName: string
  ): Promise<{ success: boolean; deleted: string }> {
    return deleteMcpServer(this.baseUrl, workspacePath, serverName);
  }

  /**
   * Enable MCP server
   */
  async enableMcpServer(
    workspacePath: string,
    serverName: string
  ): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
    return enableMcpServer(this.baseUrl, workspacePath, serverName);
  }

  /**
   * Disable MCP server
   */
  async disableMcpServer(
    workspacePath: string,
    serverName: string
  ): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
    return disableMcpServer(this.baseUrl, workspacePath, serverName);
  }

  // ==========================================================================
  // MCP Proxy Module Methods
  // ==========================================================================

  /**
   * Get MCP proxy status
   */
  async getMcpProxyStatus(): Promise<McpProxyStatus> {
    return getMcpProxyStatus(this.baseUrl);
  }

  /**
   * Check if MCP proxy is installed
   */
  async checkMcpProxyInstalled(pythonPath: string): Promise<boolean> {
    return checkMcpProxyInstalled(this.baseUrl, pythonPath);
  }

  /**
   * Start MCP proxy
   */
  async startMcpProxy(config: McpProxyConfig): Promise<McpProxyStatus> {
    return startMcpProxy(this.baseUrl, config);
  }

  /**
   * Stop MCP proxy
   */
  async stopMcpProxy(): Promise<{ success: boolean }> {
    return stopMcpProxy(this.baseUrl);
  }

  /**
   * Install MCP proxy
   */
  async installMcpProxy(pythonPath: string): Promise<{ success: boolean }> {
    return installMcpProxy(this.baseUrl, pythonPath);
  }

  /**
   * Get process using a port
   */
  async getPortProcess(port: number): Promise<PortProcess | null> {
    return getPortProcess(this.baseUrl, port);
  }

  /**
   * Kill process using a port
   */
  async killPortProcess(port: number): Promise<{ success: boolean }> {
    return killPortProcess(this.baseUrl, port);
  }

  /**
   * Check MCP server on port
   */
  async checkMcpServerOnPort(port: number): Promise<McpServerPortStatus> {
    return checkMcpServerOnPort(this.baseUrl, port);
  }

  // ==========================================================================
  // MCP Inspector Module Methods
  // ==========================================================================

  /**
   * Get MCP Inspector health and session count
   */
  async getMcpInspectorHealth(): Promise<McpInspectorHealth> {
    return getMcpInspectorHealth(this.baseUrl);
  }

  /**
   * Get MCP Inspector session token
   */
  async getMcpInspectorToken(): Promise<McpInspectorToken> {
    return getMcpInspectorToken(this.baseUrl);
  }

  /**
   * Get MCP Inspector configuration
   */
  async getMcpInspectorConfig(authToken: string): Promise<McpInspectorConfig> {
    return getMcpInspectorConfig(this.baseUrl, authToken);
  }

  /**
   * List active MCP Inspector sessions
   */
  async getMcpInspectorSessions(
    authToken: string
  ): Promise<McpInspectorSession[]> {
    return getMcpInspectorSessions(this.baseUrl, authToken);
  }

  /**
   * Close an MCP Inspector session
   */
  async closeMcpInspectorSession(
    authToken: string,
    sessionId: string
  ): Promise<{ deleted: string }> {
    return closeMcpInspectorSession(this.baseUrl, authToken, sessionId);
  }

  // ==========================================================================
  // MCP Browse Module Methods
  // ==========================================================================

  /**
   * Get browse-mcp server status
   */
  async getMcpStatus(): Promise<McpStatus> {
    return getMcpStatus(this.baseUrl);
  }

  /**
   * Start browse-mcp server
   */
  async startMcpServer(config: McpStartConfig): Promise<McpStatus> {
    return startMcpServer(this.baseUrl, config);
  }

  /**
   * Stop browse-mcp server
   */
  async stopMcpServer(): Promise<{ success: boolean }> {
    return stopMcpServer(this.baseUrl);
  }

  /**
   * Test browse-mcp connection
   */
  async testMcpConnection(pythonPath: string): Promise<boolean> {
    return testMcpConnection(this.baseUrl, pythonPath);
  }

  /**
   * Check port status
   */
  async checkPortStatus(port: number): Promise<PortStatus> {
    return checkPortStatus(this.baseUrl, port);
  }

  /**
   * Kill a process by PID
   */
  async killProcess(pid: number): Promise<boolean> {
    return killProcess(this.baseUrl, pid);
  }

  /**
   * Check if a process is alive
   */
  async isProcessAlive(pid: number): Promise<boolean> {
    return isProcessAlive(this.baseUrl, pid);
  }

  // ==========================================================================
  // Service Keys Module Methods
  // ==========================================================================

  /**
   * Get all service API keys
   */
  async getServiceKeys(): Promise<ServiceApiKey[]> {
    return getServiceKeys(this.baseUrl);
  }

  /**
   * Create a new service API key
   */
  async createServiceKey(name: string): Promise<ServiceApiKey> {
    return createServiceKey(this.baseUrl, name);
  }

  /**
   * Get a service API key by ID
   */
  async getServiceKeyById(keyId: string): Promise<ServiceApiKey | null> {
    return getServiceKeyById(this.baseUrl, keyId);
  }

  /**
   * Delete a service API key
   */
  async deleteServiceKey(keyId: string): Promise<void> {
    return deleteServiceKey(this.baseUrl, keyId);
  }

  /**
   * Validate a service API key
   */
  async validateServiceKey(apiKey: string): Promise<boolean> {
    return validateServiceKey(this.baseUrl, apiKey);
  }

  // ==========================================================================
  // Executor Resources Module Methods
  // ==========================================================================

  /**
   * Get skills for an executor in a workspace
   */
  async getSkills(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceSkillsResponse> {
    return getSkills(this.baseUrl, workspacePath, executorType);
  }

  /**
   * Add skill to an executor
   */
  async addSkill(
    workspacePath: string | undefined,
    executorType: string,
    skill: WorkspaceSkillConfig
  ): Promise<{ success: boolean; skill: WorkspaceSkillConfig }> {
    return addSkill(this.baseUrl, workspacePath, executorType, skill);
  }

  /**
   * Delete skill from an executor
   */
  async deleteSkill(
    workspacePath: string | undefined,
    executorType: string,
    skillId: string
  ): Promise<{ success: boolean; deleted: string }> {
    return deleteSkill(this.baseUrl, workspacePath, executorType, skillId);
  }

  /**
   * Get subagents for an executor in a workspace
   */
  async getAgentConfigs(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceAgentConfigsResponse> {
    return getAgentConfigs(this.baseUrl, workspacePath, executorType);
  }

  /**
   * Get a single subagent file
   */
  async getAgentConfig(
    workspacePath: string | undefined,
    executorType: string,
    configId: string
  ): Promise<{ config: WorkspaceAgentConfigData }> {
    return getAgentConfig(this.baseUrl, workspacePath, executorType, configId);
  }

  /**
   * Get commands for an executor in a workspace
   */
  async getCommands(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceCommandsResponse> {
    return getCommands(this.baseUrl, workspacePath, executorType);
  }

  /**
   * Get a single command file
   */
  async getCommand(
    workspacePath: string | undefined,
    executorType: string,
    commandId: string
  ): Promise<{ command: WorkspaceCommandData }> {
    return getCommand(this.baseUrl, workspacePath, executorType, commandId);
  }

  /**
   * Get all prompts for an executor in a workspace
   */
  async getPrompts(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspacePromptsResponse> {
    return getPrompts(this.baseUrl, workspacePath, executorType);
  }

  /**
   * Get a single prompt file
   */
  async getPrompt(
    workspacePath: string | undefined,
    executorType: string,
    promptId: string
  ): Promise<{ prompt: WorkspacePromptData }> {
    return getPrompt(this.baseUrl, workspacePath, executorType, promptId);
  }

  // ==========================================================================
  // Files Module Methods
  // ==========================================================================

  /**
   * List directory contents
   */
  async listFiles(path: string, showHidden = false): Promise<FileListResponse> {
    return listFiles(this.baseUrl, path, showHidden);
  }

  /**
   * Read file content
   */
  async readFile(path: string, encoding = "utf-8"): Promise<FileContentResponse> {
    return readFile(this.baseUrl, path, encoding);
  }

  /**
   * Create a new file
   */
  async createFile(
    path: string,
    content = "",
    encoding = "utf-8"
  ): Promise<FileEntry> {
    return createFile(this.baseUrl, path, content, encoding);
  }

  /**
   * Create a new directory
   */
  async createDirectory(path: string, recursive = true): Promise<FileEntry> {
    return createDirectory(this.baseUrl, path, recursive);
  }

  /**
   * Write content to file
   */
  async writeFile(
    path: string,
    content: string,
    encoding = "utf-8"
  ): Promise<{ success: boolean; file: FileEntry }> {
    return writeFile(this.baseUrl, path, content, encoding);
  }

  /**
   * Delete file or directory
   */
  async deleteFile(path: string, recursive = false): Promise<void> {
    return deleteFile(this.baseUrl, path, recursive);
  }

  /**
   * Rename file or directory
   */
  async renameFile(
    oldPath: string,
    newPath: string
  ): Promise<{ success: boolean; file: FileEntry }> {
    return renameFile(this.baseUrl, oldPath, newPath);
  }

  /**
   * Copy file or directory
   */
  async copyFile(
    source: string,
    destination: string,
    recursive = true
  ): Promise<{ success: boolean; file: FileEntry }> {
    return copyFile(this.baseUrl, source, destination, recursive);
  }

  /**
   * Move file or directory
   */
  async moveFile(
    source: string,
    destination: string
  ): Promise<{ success: boolean; file: FileEntry }> {
    return moveFile(this.baseUrl, source, destination);
  }

  /**
   * Open file with system default or specific app
   */
  async openFile(
    path: string,
    appId?: string
  ): Promise<{ success: boolean; path: string }> {
    return openFile(this.baseUrl, path, appId);
  }

  /**
   * Reveal file in system file manager
   */
  async revealFile(path: string): Promise<{ success: boolean; path: string }> {
    return revealFile(this.baseUrl, path);
  }

  /**
   * Open a folder in file manager
   */
  async openFolder(folderPath: string): Promise<void> {
    return openFolder(this.baseUrl, folderPath);
  }

  /**
   * Reveal a file/folder in file manager
   */
  async revealInFileManager(targetPath: string): Promise<void> {
    return revealInFileManager(this.baseUrl, targetPath);
  }

  /**
   * Read directory contents
   */
  async readDirectory(
    workspacePath: string,
    dirPath?: string
  ): Promise<FileEntry[]> {
    return readDirectory(this.baseUrl, workspacePath, dirPath);
  }

  /**
   * Read file content
   */
  async readFileContent(
    workspacePath: string,
    filePath: string,
    maxSize?: number
  ): Promise<string> {
    return readFileContent(this.baseUrl, workspacePath, filePath, maxSize);
  }

  /**
   * Read MCP servers config file
   */
  async readMcpServersFile(): Promise<McpServersConfig> {
    return readMcpServersFile(this.baseUrl);
  }

  /**
   * Write MCP servers config file
   */
  async writeMcpServersFile(config: McpServersConfig): Promise<void> {
    return writeMcpServersFile(this.baseUrl, config);
  }

  /**
   * Get config directory path
   */
  async getConfigDir(): Promise<string> {
    return getConfigDir(this.baseUrl);
  }

  // ==========================================================================
  // System Module Methods
  // ==========================================================================

  /**
   * Get system information including home directory
   */
  async getSystemInfo(): Promise<SystemInfo> {
    return getSystemInfo(this.baseUrl);
  }

  /**
   * Detect available Python interpreters on the system
   */
  async detectPython(): Promise<PythonInfo[]> {
    return detectPython(this.baseUrl);
  }

  /**
   * Check if a specific Python path is valid
   */
  async checkPythonPath(pythonPath: string): Promise<PythonInfo> {
    return checkPythonPath(this.baseUrl, pythonPath);
  }

  /**
   * Check if a package is installed in a Python environment
   */
  async checkPythonPackage(
    pythonPath: string,
    packageName: string
  ): Promise<PythonPackageInfo> {
    return checkPythonPackage(this.baseUrl, pythonPath, packageName);
  }

  /**
   * Get the install command for a package
   */
  async getPythonInstallCommand(
    pythonPath: string,
    packageName: string
  ): Promise<{ command: string; uv_command: string }> {
    return getPythonInstallCommand(this.baseUrl, pythonPath, packageName);
  }

  /**
   * Detect all CLI tools
   */
  async detectCliTools(config?: {
    pythonPath?: string;
    gitPath?: string;
    ghPath?: string;
    claudePath?: string;
    codexPath?: string;
    aiderPath?: string;
    goosePath?: string;
    clinePath?: string;
    continuePath?: string;
    cursorPath?: string;
  }): Promise<CliToolsInfo> {
    return detectCliTools(this.baseUrl, config);
  }

  /**
   * Check a specific CLI tool path
   */
  async checkCliToolPath(tool: CliToolName, path: string): Promise<CliToolInfo> {
    return checkCliToolPath(this.baseUrl, tool, path);
  }

  /**
   * Get CLI tools config from config file
   */
  async getCliToolsConfig(): Promise<CliToolsConfig> {
    return getCliToolsConfig(this.baseUrl);
  }

  /**
   * Save CLI tools config to config file
   */
  async saveCliToolsConfig(config: CliToolsConfig): Promise<void> {
    return saveCliToolsConfig(this.baseUrl, config);
  }

  /**
   * Update a single CLI tool selected path
   */
  async updateCliToolPath(
    tool: CliToolName,
    path: string | null
  ): Promise<void> {
    return updateCliToolPath(this.baseUrl, tool, path);
  }

  // ==========================================================================
  // Usage Module Methods
  // ==========================================================================

  /**
   * Initialize usage tracking
   */
  async initUsage(): Promise<void> {
    return initUsage(this.baseUrl);
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    return getUsageStats(this.baseUrl);
  }

  /**
   * Record a usage event
   */
  async recordUsage(
    serverId: string,
    sourceId: string,
    apiKeyId?: string
  ): Promise<void> {
    return recordUsage(this.baseUrl, serverId, sourceId, apiKeyId);
  }

  /**
   * Get usage for a specific API key
   */
  async getApiKeyUsage(keyId: string): Promise<ApiKeyUsage> {
    return getApiKeyUsage(this.baseUrl, keyId);
  }

  /**
   * Get usage for a specific server
   */
  async getServerUsage(serverId: string): Promise<number> {
    return getServerUsage(this.baseUrl, serverId);
  }

  /**
   * Get usage for a specific source
   */
  async getSourceUsage(sourceId: string): Promise<number> {
    return getSourceUsage(this.baseUrl, sourceId);
  }

  // ==========================================================================
  // Sources Module Methods
  // ==========================================================================

  /**
   * Get installed sources from browse-mcp-cli
   */
  async getInstalledSources(
    pythonPath: string
  ): Promise<InstalledSourcesResponse> {
    return getInstalledSources(this.baseUrl, pythonPath);
  }

  /**
   * Show details of a specific provider
   */
  async showInstalledProvider(
    pythonPath: string,
    provider: string
  ): Promise<Record<string, unknown>> {
    return showInstalledProvider(this.baseUrl, pythonPath, provider);
  }

  /**
   * Install a provider plugin
   */
  async installProvider(
    pythonPath: string,
    provider: string,
    upgrade = false
  ): Promise<string> {
    return installProvider(this.baseUrl, pythonPath, provider, upgrade);
  }

  // ==========================================================================
  // Logs Module Methods
  // ==========================================================================

  /**
   * Initialize logs system
   */
  async initLogs(): Promise<void> {
    return initLogs(this.baseUrl);
  }

  /**
   * Get logs directory path
   */
  async getLogsDirPath(): Promise<string> {
    return getLogsDirPath(this.baseUrl);
  }

  /**
   * Get log sessions
   */
  async getLogSessions(serverId?: string): Promise<LogSessionSummary> {
    return getLogSessions(this.baseUrl, serverId);
  }

  /**
   * Get session logs
   */
  async getSessionLogs(
    sessionId: string,
    levelFilter?: string,
    limit?: number
  ): Promise<LogEntry[]> {
    return getSessionLogs(this.baseUrl, sessionId, levelFilter, limit);
  }

  /**
   * Add a log entry
   */
  async addLog(
    level: LogLevel,
    message: string,
    source?: string,
    sessionId?: string
  ): Promise<void> {
    return addLog(this.baseUrl, level, message, source, sessionId);
  }

  /**
   * Clear session logs
   */
  async clearSessionLogs(sessionId: string): Promise<void> {
    return clearSessionLogs(this.baseUrl, sessionId);
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    return clearLogs(this.baseUrl);
  }

  /**
   * Cleanup old sessions
   */
  async cleanupOldSessions(keepCount = 10): Promise<number> {
    return cleanupOldSessions(this.baseUrl, keepCount);
  }

  /**
   * Export session logs
   */
  async exportSessionLogs(
    sessionId: string,
    exportPath: string
  ): Promise<string> {
    return exportSessionLogs(this.baseUrl, sessionId, exportPath);
  }

  // ==========================================================================
  // API Logs Module Methods
  // ==========================================================================

  /**
   * Get API logs directory path
   */
  async getApiLogsDirPath(): Promise<string> {
    return getApiLogsDirPath(this.baseUrl);
  }

  /**
   * Get API log sessions
   */
  async getApiLogSessions(): Promise<ApiLogSession[]> {
    return getApiLogSessions(this.baseUrl);
  }

  /**
   * Get API logs for a run
   */
  async getApiLogs(
    runId: string,
    options?: {
      limit?: number;
      offset?: number;
      providerFilter?: string;
      sourceFilter?: string;
      statusFilter?: string;
      methodFilter?: string;
    }
  ): Promise<ApiLogEntry[]> {
    return getApiLogs(this.baseUrl, runId, options);
  }

  /**
   * Get API log summary
   */
  async getApiLogSummary(runId: string): Promise<ApiLogSummary> {
    return getApiLogSummary(this.baseUrl, runId);
  }

  /**
   * Clear API logs for a run
   */
  async clearApiLogs(runId: string): Promise<void> {
    return clearApiLogs(this.baseUrl, runId);
  }

  /**
   * Open API logs directory
   */
  async openApiLogsDir(): Promise<void> {
    return openApiLogsDir(this.baseUrl);
  }

  // ==========================================================================
  // Marketplace Module Methods
  // ==========================================================================

  /**
   * Get provider index
   */
  async getProviderIndex(forceRefresh = false): Promise<ProviderIndex> {
    return getProviderIndex(this.baseUrl, forceRefresh);
  }

  /**
   * Get flat sources list
   */
  async getFlatSources(): Promise<FlatSource[]> {
    return getFlatSources(this.baseUrl);
  }

  /**
   * Clear provider cache
   */
  async clearProviderCache(): Promise<void> {
    return clearProviderCache(this.baseUrl);
  }

  // ==========================================================================
  // Official Registry Module Methods
  // ==========================================================================

  /**
   * List official servers
   */
  async listOfficialServers(params?: {
    cursor?: string;
    search?: string;
    limit?: number;
  }): Promise<OfficialServerListResponse> {
    return listOfficialServers(this.baseUrl, params);
  }

  /**
   * Get a specific official server
   */
  async getOfficialServer(name: string): Promise<OfficialServerDisplay | null> {
    return getOfficialServer(this.baseUrl, name);
  }

  /**
   * Get versions for a specific official server
   */
  async getOfficialServerVersions(name: string): Promise<string[]> {
    return getOfficialServerVersions(this.baseUrl, name);
  }

  /**
   * Clear official registry cache
   */
  async clearOfficialRegistryCache(): Promise<void> {
    return clearOfficialRegistryCache(this.baseUrl);
  }

  /**
   * Invalidate cache for a specific official server
   */
  async invalidateOfficialServerCache(name: string): Promise<void> {
    return invalidateOfficialServerCache(this.baseUrl, name);
  }

  // ==========================================================================
  // Cache Module Methods
  // ==========================================================================

  /**
   * Check if offline
   */
  async isOffline(): Promise<boolean> {
    return isOffline(this.baseUrl);
  }

  /**
   * Get cache info
   */
  async getCacheInfo(): Promise<CacheInfo> {
    return getCacheInfo(this.baseUrl);
  }

  /**
   * Get cache settings
   */
  async getCacheSettings(): Promise<CacheSettings> {
    return getCacheSettings(this.baseUrl);
  }

  /**
   * Update cache settings
   */
  async setCacheSettings(
    settings: Partial<CacheSettings>
  ): Promise<CacheSettings> {
    return setCacheSettings(this.baseUrl, settings);
  }

  /**
   * Refresh cache
   */
  async refreshCache(): Promise<void> {
    return refreshCache(this.baseUrl);
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    return clearCache(this.baseUrl);
  }

  /**
   * Check if cache should be refreshed
   */
  async shouldRefreshCache(): Promise<boolean> {
    return shouldRefreshCache(this.baseUrl);
  }

  // ==========================================================================
  // Kanban Module Methods
  // ==========================================================================

  /**
   * Get all comments for a kanban task
   */
  async getKanbanComments(taskId: string): Promise<KanbanComment[]> {
    return getKanbanComments(this.baseUrl, taskId);
  }

  /**
   * Add a comment to a kanban task
   */
  async addKanbanComment(
    taskId: string,
    content: string,
    authorId: string,
    authorName: string,
    authorAvatar?: string
  ): Promise<KanbanComment> {
    return addKanbanComment(
      this.baseUrl,
      taskId,
      content,
      authorId,
      authorName,
      authorAvatar
    );
  }

  /**
   * Update a kanban comment
   */
  async updateKanbanComment(
    taskId: string,
    commentId: string,
    content: string
  ): Promise<KanbanComment> {
    return updateKanbanComment(this.baseUrl, taskId, commentId, content);
  }

  /**
   * Delete a kanban comment
   */
  async deleteKanbanComment(taskId: string, commentId: string): Promise<void> {
    return deleteKanbanComment(this.baseUrl, taskId, commentId);
  }

  /**
   * Toggle a reaction on a kanban comment
   */
  async toggleCommentReaction(
    taskId: string,
    commentId: string,
    emoji: string,
    userId: string,
    userName: string
  ): Promise<KanbanComment> {
    return toggleCommentReaction(
      this.baseUrl,
      taskId,
      commentId,
      emoji,
      userId,
      userName
    );
  }

  /**
   * Get all activities for a kanban task
   */
  async getKanbanActivities(taskId: string): Promise<KanbanActivity[]> {
    return getKanbanActivities(this.baseUrl, taskId);
  }

  /**
   * Add an activity to a kanban task
   */
  async addKanbanActivity(
    taskId: string,
    activityType: string,
    actorId: string,
    actorName: string,
    actorAvatar?: string,
    oldValue?: string,
    newValue?: string
  ): Promise<KanbanActivity> {
    return addKanbanActivity(
      this.baseUrl,
      taskId,
      activityType,
      actorId,
      actorName,
      actorAvatar,
      oldValue,
      newValue
    );
  }

  /**
   * Clear all comments and activities for a kanban task
   */
  async clearKanbanTaskData(taskId: string): Promise<void> {
    return clearKanbanTaskData(this.baseUrl, taskId);
  }

  // ==========================================================================
  // Preferences Module Methods
  // ==========================================================================

  /**
   * Get all preferences
   */
  async getPreferences(): Promise<PreferencesResponse> {
    return getPreferences(this.baseUrl);
  }

  /**
   * Update all preferences
   */
  async updatePreferences(
    prefs: Partial<PreferencesResponse>
  ): Promise<PreferencesResponse> {
    return updatePreferences(this.baseUrl, prefs);
  }

  /**
   * Get developer preferences
   */
  async getDeveloperPreferences(): Promise<DeveloperPreferences> {
    return getDeveloperPreferences(this.baseUrl);
  }

  /**
   * Update developer preferences
   */
  async updateDeveloperPreferences(
    prefs: Partial<DeveloperPreferences>
  ): Promise<DeveloperPreferences> {
    return updateDeveloperPreferences(this.baseUrl, prefs);
  }

  /**
   * Get preferred IDE
   */
  async getPreferredIDE(): Promise<string> {
    return getPreferredIDE(this.baseUrl);
  }

  /**
   * Set preferred IDE
   */
  async setPreferredIDE(ide: string): Promise<void> {
    return setPreferredIDE(this.baseUrl, ide);
  }

  /**
   * Get preferred terminal
   */
  async getPreferredTerminal(): Promise<string> {
    return getPreferredTerminal(this.baseUrl);
  }

  /**
   * Set preferred terminal
   */
  async setPreferredTerminal(terminal: string): Promise<void> {
    return setPreferredTerminal(this.baseUrl, terminal);
  }
}
