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
  parseErrorMessage,

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
} from "./modules";

// Import types
import type {
  SpawnAgentRequest,
  SpawnAgentResponse,
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

  // Part 2 methods continue below
  // The following modules will be added by another agent:
  // - workspaces
  // - workspace-resources
  // - mcp-servers
  // - mcp-browse
  // - mcp-proxy
  // - mcp-inspector
  // - service-keys
  // - executor-resources
  // - files
  // - system
  // - usage
  // - sources
  // - logs
  // - api-logs
  // - marketplace
  // - official-registry
  // - cache
  // - kanban
  // - preferences
  // - group-chat
}
