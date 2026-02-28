/**
 * Gateway HTTP/SSE Client
 * 网关 HTTP/SSE 客户端
 *
 * Connects Desktop frontend to viben gateway for real AI agent execution.
 * 连接桌面前端到 viben 网关，用于实际的 AI 智能体执行。
 */

import type { AgentMessage } from "@/types";

// ============================================================================
// Configuration
// ============================================================================

/** Default Gateway port */
const DEFAULT_GATEWAY_PORT = 18790;

/** Candidate ports to try when auto-discovering Gateway */
const DISCOVERY_PORTS = [18790, 18791, 18800, 3790, 8790];

/** Default Gateway URL - use 127.0.0.1 to avoid proxy issues */
const DEFAULT_GATEWAY_URL = `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;

/**
 * Get the Gateway base URL from localStorage or use default
 */
export function getGatewayUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("viben_gateway_url") || DEFAULT_GATEWAY_URL;
  }
  return DEFAULT_GATEWAY_URL;
}

/**
 * Set the Gateway base URL
 */
export function setGatewayUrl(url: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("viben_gateway_url", url);
  }
}

/**
 * Auto-discover Gateway by probing known ports
 * Returns the first reachable Gateway URL or null if none found
 */
export async function discoverGateway(): Promise<string | null> {
  // First try the configured URL
  const configuredUrl = getGatewayUrl();
  if (await pingGatewayUrl(configuredUrl)) {
    return configuredUrl;
  }

  // Try discovery ports - use 127.0.0.1 to avoid proxy issues
  for (const port of DISCOVERY_PORTS) {
    const url = `http://127.0.0.1:${port}`;
    if (url !== configuredUrl && await pingGatewayUrl(url)) {
      // Found a working Gateway, save it
      setGatewayUrl(url);
      return url;
    }
  }

  return null;
}

/**
 * Ping a Gateway URL to check if it's reachable
 */
async function pingGatewayUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Types (re-exported from @viben/core)
// ============================================================================

import type { ExecutorType } from "@viben/core/shared";
export type { ExecutorType };

/** Agent availability information */
export type AvailabilityInfo =
  | { type: "LOGIN_DETECTED"; last_auth_timestamp: number }
  | { type: "INSTALLATION_FOUND" }
  | { type: "NOT_FOUND" };

/** Agent capabilities */
export type BaseAgentCapability =
  | "SESSION_FORK"
  | "SETUP_HELPER"
  | "CONTEXT_USAGE";

/** Agent details from Gateway */
export interface AgentDetails {
  id: string;
  name: string;
  availability: AvailabilityInfo;
  supports_mcp: boolean;
  capabilities: string[];
}

/** ClaudeCode specific configuration */
export interface ClaudeCodeConfig {
  append_prompt?: string;
  plan?: boolean;
  approvals?: boolean;
  model?: string;
  dangerously_skip_permissions?: boolean;
  base_command_override?: string;
  env?: Record<string, string>;
}

/** Generic executor config - will be typed per agent type */
export type ExecutorConfig = ClaudeCodeConfig | Record<string, unknown>;

/** Spawn agent request */
export interface SpawnAgentRequest {
  prompt: string;
  workdir: string;
  session_id?: string;
  config?: ExecutorConfig;
}

/** Spawn agent response */
export interface SpawnAgentResponse {
  session_id: string;
  status: "spawned";
}

/** Stop agent request */
export interface StopAgentRequest {
  session_id: string;
}

/** Continue session request */
export interface ContinueSessionRequest {
  prompt: string;
  session_id: string;
  reset_to_message_id?: string;
}

// ============================================================================
// File-based Session Types
// ============================================================================

/** File-based session (stored in .agent_sessions) */
export interface FileSession {
  id: string;
  agent_id: string;
  /** Agent path (absolute path to agent directory, reliable reference) */
  agent_path?: string;
  /** Agent config snapshot at session creation time */
  agent_config?: Record<string, unknown>;
  task_id: string | null;
  prompt: string | null;
  status: string;
  /** Workspace path where this session runs (absolute path) */
  workspace_path?: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

/** Session message (rollout format - for sending to agent) */
export interface SessionMessage {
  timestamp: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
}

/** UI Message (for frontend rendering) */
export interface UIMessage {
  id: string;
  timestamp: string;
  type: "user" | "text" | "tool_use" | "tool_result" | "thinking" | "error" | "sdk_session";
  content?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  is_error?: boolean;
  attachments?: Record<string, unknown>[];
  /** SDK session ID for resume (stored when type is "sdk_session") */
  sdkSessionId?: string;
}

/** Create session request */
export interface CreateFileSessionRequest {
  session_id?: string;
  prompt?: string;
  task_id?: string;
  /** Agent path (absolute path to agent directory) */
  agent_path?: string;
  /** Agent config snapshot at session creation time */
  agent_config?: Record<string, unknown>;
  /** Workspace path where this session runs (absolute path) */
  workspace_path?: string;
}

/** Append message request */
export interface AppendMessageRequest {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
}

// ============================================================================
// SSE Message Types
// ============================================================================

/** SSE event types from agent stream */
export type SSEEventType =
  | "session"
  | "text"
  | "tool_use"
  | "tool_result"
  | "plan"
  | "question"
  | "result"
  | "error"
  | "done";

/** Base SSE event */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

/** Session created event - first event from agent run */
export interface SSESessionEvent {
  type: "session";
  sessionId: string;
  /** Trace ID for observability correlation */
  traceId?: string;
}

/** Text message event */
export interface SSETextEvent extends SSEEvent {
  type: "text";
  data: {
    content: string;
    partial?: boolean;
  };
}

/** Tool use event */
export interface SSEToolUseEvent extends SSEEvent {
  type: "tool_use";
  data: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
}

/** Tool result event */
export interface SSEToolResultEvent extends SSEEvent {
  type: "tool_result";
  data: {
    tool_use_id: string;
    output: string;
    is_error?: boolean;
  };
}

/** Plan event */
export interface SSEPlanEvent extends SSEEvent {
  type: "plan";
  data: {
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: string;
    }>;
    notes?: string;
  };
}

/** Result event */
export interface SSEResultEvent extends SSEEvent {
  type: "result";
  data: {
    content: string;
    success: boolean;
  };
}

/** Error event */
export interface SSEErrorEvent extends SSEEvent {
  type: "error";
  data: {
    message: string;
    code?: string;
  };
}

/** Done event */
export interface SSEDoneEvent extends SSEEvent {
  type: "done";
  data: {
    session_id: string;
  };
}

/** Question event - interactive question from agent */
export interface SSEQuestionEvent extends SSEEvent {
  type: "question";
  data: {
    id: string;
    questions: Array<{
      header: string;
      question: string;
      options: Array<{ label: string; description?: string }>;
      multiSelect: boolean;
    }>;
  };
}

export type SSEMessageEvent =
  | SSESessionEvent
  | SSETextEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEPlanEvent
  | SSEQuestionEvent
  | SSEResultEvent
  | SSEErrorEvent
  | SSEDoneEvent;

// ============================================================================
// Background Task Types
// ============================================================================

/** Background task status */
export type BackgroundTaskStatus = "running" | "completed" | "error" | "stopped";

/** Background task info */
export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  workspacePath?: string;
  agentPath?: string;
  agentName?: string;
  status: BackgroundTaskStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  errorMessage?: string;
}

// ============================================================================
// API Client
// ============================================================================

export class GatewayError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/**
 * Gateway API client for agent management
 */
export class GatewayClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getGatewayUrl();
  }

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

  /**
   * Check if Gateway is reachable
   */
  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
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
   * Diagnose Gateway connectivity and available endpoints
   * Returns diagnostic information about the Gateway
   */
  async diagnose(): Promise<{
    reachable: boolean;
    healthCheck: boolean;
    version: string | null;
    service: string | null;
    timestamp: string | null;
    url: string;
    endpoints: { path: string; available: boolean }[];
    websockets: { path: string; available: boolean }[];
  }> {
    const result = {
      reachable: false,
      healthCheck: false,
      version: null as string | null,
      service: null as string | null,
      timestamp: null as string | null,
      url: this.baseUrl,
      endpoints: [] as { path: string; available: boolean }[],
      websockets: [] as { path: string; available: boolean }[],
    };

    // Test health endpoint and extract detailed info
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const healthResponse = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      result.healthCheck = healthResponse.ok;
      result.reachable = true;

      if (healthResponse.ok) {
        try {
          const healthData = await healthResponse.json();
          result.version = healthData.version || null;
          result.service = healthData.service || null;
          result.timestamp = healthData.timestamp || null;
        } catch {
          // JSON parsing failed, but health check still passed
        }
      }
    } catch {
      result.reachable = false;
    }

    // Add health endpoint to the list
    result.endpoints.push({ path: "/health", available: result.healthCheck });

    // Only test other endpoints if health check passed
    if (result.healthCheck) {
      // Test specific HTTP endpoints - comprehensive list
      const testEndpoints = [
        "/api/agents",
        "/api/sessions",
        "/api/cron",
        "/api/group-chats",
        "/api/models",
        "/api/providers",
        "/api/channels",
        "/api/executors",
        "/api/workspaces",
        "/api/mcp/servers",
        "/api/packages",
      ];

      for (const path of testEndpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const response = await fetch(`${this.baseUrl}${path}`, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          result.endpoints.push({ path, available: response.ok || response.status < 500 });
        } catch {
          result.endpoints.push({ path, available: false });
        }
      }

      // Test WebSocket endpoints
      const wsEndpoints = [
        "/ws",           // Main event WebSocket
        "/api/agent/ws", // Agent interaction WebSocket
        "/api/terminal", // Terminal PTY WebSocket
      ];

      for (const path of wsEndpoints) {
        const available = await this.testWebSocketEndpoint(path);
        result.websockets.push({ path, available });
      }
    }

    return result;
  }

  // ============================================================================
  // Generic HTTP Methods
  // ============================================================================

  /**
   * Make a GET request to the Gateway
   */
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Gateway GET ${path} failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Make a POST request to the Gateway
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Gateway POST ${path} failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Test WebSocket connectivity to a specific endpoint
   */
  private async testWebSocketEndpoint(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      const wsUrl = this.baseUrl.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}${path}`);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      };

      ws.onclose = (event) => {
        // If closed without opening, it's an error
        // onclose can fire after onopen, so only resolve(false) if not already resolved
        if (event.code !== 1000) {
          clearTimeout(timeout);
          resolve(false);
        }
      };
    });
  }

  /**
   * List all available agent types
   */
  async listAgents(): Promise<ExecutorType[]> {
    const response = await fetch(`${this.baseUrl}/api/agents`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list agents: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.agents as ExecutorType[];
  }

  /**
   * Get executor details by type
   */
  async getExecutorDetails(executorType: ExecutorType): Promise<AgentDetails> {
    const response = await fetch(`${this.baseUrl}/api/agents/${executorType}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to get executor details: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Check agent availability
   */
  async checkAvailability(executorType: ExecutorType): Promise<AvailabilityInfo> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${executorType}/availability`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody?.error?.message || errorBody?.message || JSON.stringify(errorBody);
      } catch {
        // Keep statusText as fallback
      }
      throw new GatewayError(
        `Failed to check availability: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Workspace Resource APIs
  // ==========================================================================

  /**
   * Get executors with availability and config status
   *
   * @param workspacePath - Optional workspace path to scope executors
   * @param includeGlobal - Whether to include global executors (default: true)
   *
   * When workspacePath is provided with includeGlobal=true:
   * - Returns merged executors (same-name executors are combined)
   * - project_config_path points to workspace-level config
   * - global_config_path points to global config
   * - Editing should prioritize project-level config
   */
  async getExecutors(options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }): Promise<ExecutorsResponse> {
    const params = new URLSearchParams();
    if (options?.workspacePath) {
      params.set("workspace_path", options.workspacePath);
    }
    if (options?.includeGlobal !== undefined) {
      params.set("include_global", String(options.includeGlobal));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.baseUrl}/api/executors?${queryString}`
      : `${this.baseUrl}/api/executors`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get executors: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get models with availability status
   *
   * @param workspacePath - Optional workspace path to scope models (default: user home)
   * @param includeGlobal - Whether to include global models (default: true)
   * @param includeProviderPredefined - Include predefined models for reference (default: false, used in Settings > Models)
   */
  async getModels(options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
    /** Include predefined models for reference (used in Settings > Models) */
    includeProviderPredefined?: boolean;
  }): Promise<WorkspaceModelsResponse> {
    const params = new URLSearchParams();
    if (options?.workspacePath) {
      params.set("workspace_path", options.workspacePath);
    }
    if (options?.includeGlobal !== undefined) {
      params.set("include_global", String(options.includeGlobal));
    }
    if (options?.includeProviderPredefined) {
      params.set("include_provider_predefined", "true");
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.baseUrl}/api/models?${queryString}`
      : `${this.baseUrl}/api/models`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get models: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * @deprecated Use getExecutors({ workspacePath }) instead
   */
  async getWorkspaceExecutors(
    workspacePath: string
  ): Promise<WorkspaceExecutorsResponse> {
    return this.getExecutors({ workspacePath, includeGlobal: true });
  }

  /**
   * @deprecated Use getModels({ workspacePath }) instead
   */
  async getWorkspaceModels(
    workspacePath: string
  ): Promise<WorkspaceModelsResponse> {
    return this.getModels({ workspacePath, includeGlobal: true });
  }

  /**
   * Get agents (Viben + discovered IDE configs)
   *
   * @param workspacePath - Optional workspace path to scope agents
   * @param includeGlobal - Whether to include global agents (default: true)
   *
   * When workspacePath is provided with includeGlobal=true:
   * - Returns both workspace-scoped and global agents
   * - source field indicates "workspace" or "global"
   */
  async getAgents(options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }): Promise<AgentsResponse> {
    const params = new URLSearchParams();
    if (options?.workspacePath) {
      params.set("workspace_path", options.workspacePath);
    }
    if (options?.includeGlobal !== undefined) {
      params.set("include_global", String(options.includeGlobal));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.baseUrl}/api/agents?${queryString}`
      : `${this.baseUrl}/api/agents`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get agents: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * @deprecated Use getAgents({ workspacePath }) instead
   */
  async getWorkspaceAgents(
    workspacePath: string
  ): Promise<WorkspaceAgentsResponse> {
    return this.getAgents({ workspacePath, includeGlobal: true });
  }

  /**
   * Get a single agent by ID
   *
   * @param agentId - The agent ID
   * @param workspacePath - Optional workspace path to check workspace agents first
   *
   * When workspacePath is provided, checks workspace first, then falls back to global.
   */
  async getAgentById(
    agentId: string,
    workspacePath?: string
  ): Promise<AgentResponse> {
    const params = new URLSearchParams();
    if (workspacePath) {
      params.set("workspace_path", workspacePath);
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.baseUrl}/api/agents/${agentId}?${queryString}`
      : `${this.baseUrl}/api/agents/${agentId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get agent: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get aggregated chat list (group chats, executors, agents)
   *
   * @param workspacePath - Workspace path to scope items
   * @param includeGlobal - Whether to include global items (default: true)
   *
   * Returns a unified list of items that can be shown in a chat sidebar.
   */
  async getChatList(options?: {
    workspacePath?: string;
    includeGlobal?: boolean;
  }): Promise<ChatListResponse> {
    const params = new URLSearchParams();
    if (options?.workspacePath) {
      params.set("workspace_path", options.workspacePath);
    }
    if (options?.includeGlobal !== undefined) {
      params.set("include_global", String(options.includeGlobal));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${this.baseUrl}/api/chat-list?${queryString}`
      : `${this.baseUrl}/api/chat-list`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get chat list: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Helper to parse error message from response
   */
  private async parseErrorMessage(response: Response): Promise<string> {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody?.error?.message ||
        errorBody?.message ||
        JSON.stringify(errorBody);
    } catch {
      // Keep statusText as fallback
    }
    return errorMessage;
  }

  // ==========================================================================
  // Agent APIs
  // ==========================================================================

  /**
   * Spawn a new agent process
   * Returns the session ID
   */
  async spawnAgent(
    executorType: ExecutorType,
    request: SpawnAgentRequest
  ): Promise<SpawnAgentResponse> {
    const url = `${this.baseUrl}/api/agents/${executorType}/spawn`;
    console.log("[GatewayClient] Spawn request:", { url, executorType, request });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    });

    console.log("[GatewayClient] Spawn response:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        console.log("[GatewayClient] Error body:", errorBody);
        errorMessage = errorBody?.error?.message || errorBody?.message || JSON.stringify(errorBody);
      } catch {
        // If JSON parsing fails, try reading as text
        try {
          const textError = await response.text();
          console.log("[GatewayClient] Error text:", textError);
          if (textError) {
            errorMessage = textError;
          }
        } catch {
          // Keep statusText as fallback
        }
      }
      throw new GatewayError(
        `Failed to spawn agent: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

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

    const response = await fetch(
      `${this.baseUrl}/api/agents/${executorType}/spawn`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      }
    );

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody?.error?.message || errorBody?.message || JSON.stringify(errorBody);
      } catch {
        try {
          const textError = await response.text();
          if (textError) {
            errorMessage = textError;
          }
        } catch {
          // Keep statusText as fallback
        }
      }
      throw new GatewayError(
        `Failed to spawn agent: ${errorMessage}`,
        response.status
      );
    }

    if (!response.body) {
      throw new GatewayError("No response body for SSE stream");
    }

    const reader = response.body.getReader();
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
              // Skip invalid JSON
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
   * Stop an agent process
   */
  async stopAgent(
    _executorType: ExecutorType,
    sessionId: string
  ): Promise<void> {
    // Cancel any ongoing stream
    this.cancelStream();

    // Use the new endpoint: POST /api/agent/stop/:sessionId
    const response = await fetch(
      `${this.baseUrl}/api/agent/stop/${sessionId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to stop agent: ${response.statusText}`,
        response.status
      );
    }
  }

  /**
   * Start a background task
   * This runs the agent in the background (server-side) and returns immediately.
   * Use subscribeToBackgroundTasks to monitor task progress.
   */
  async startBackgroundTask(request: {
    prompt: string;
    cwd?: string;
    taskId?: string;
    sessionId?: string;
    agentPath?: string;
    agentConfig?: {
      name?: string;
      model?: string;
      provider?: string;
      systemPrompt?: string;
    };
    resume?: string;
  }): Promise<{ sessionId: string; taskId: string }> {
    // Create a new AbortController for this request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for initial response

    try {
      const response = await fetch(`${this.baseUrl}/api/agent/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          prompt: request.prompt,
          cwd: request.cwd,
          task_id: request.taskId,
          session_id: request.sessionId,
          agent_path: request.agentPath,
          agent_config: request.agentConfig,
          resume: request.resume,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new GatewayError(
          `Failed to start background task: ${error || response.statusText}`,
          response.status
        );
      }

      // Read only the first SSE message to get session ID
      const reader = response.body?.getReader();
      if (!reader) {
        throw new GatewayError("No response body", 500);
      }

      const decoder = new TextDecoder();
      let sessionId = "";
      let buffer = "";

      // Read until we get the session message
      while (!sessionId) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "session") {
                sessionId = data.sessionId;
                break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Don't cancel the reader - let the stream continue in background
      // The server will continue processing

      return {
        sessionId: sessionId || request.sessionId || "",
        taskId: request.taskId || sessionId || "",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Subscribe to background task updates (SSE)
   * Returns an EventSource-like interface
   */
  subscribeToBackgroundTasks(
    onTasks: (tasks: BackgroundTask[]) => void,
    onError?: (error: Error) => void
  ): { close: () => void } {
    const eventSource = new EventSource(`${this.baseUrl}/api/agent/tasks/subscribe`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "tasks") {
          onTasks(data.tasks);
        }
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    };

    eventSource.onerror = () => {
      onError?.(new Error("SSE connection error"));
    };

    return {
      close: () => eventSource.close(),
    };
  }

  /**
   * Continue an existing session
   */
  async continueSession(
    executorType: ExecutorType,
    request: ContinueSessionRequest
  ): Promise<SpawnAgentResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${executorType}/continue`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new GatewayError(
        `Failed to continue session: ${error || response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Continue session with SSE streaming
   */
  async *continueSessionStream(
    executorType: ExecutorType,
    request: ContinueSessionRequest
  ): AsyncGenerator<SSEMessageEvent, void, unknown> {
    // Cancel any existing stream
    this.cancelStream();

    this.abortController = new AbortController();

    const response = await fetch(
      `${this.baseUrl}/api/agents/${executorType}/continue`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new GatewayError(
        `Failed to continue session: ${error || response.statusText}`,
        response.status
      );
    }

    if (!response.body) {
      throw new GatewayError("No response body for SSE stream");
    }

    const reader = response.body.getReader();
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
   * Cancel any ongoing SSE stream
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ==========================================================================
  // Executor Session Discovery
  // ==========================================================================

  /**
   * Discover sessions for an executor type in a workspace
   *
   * @param executorType - The executor type (e.g., "CLAUDE_CODE")
   * @param workspacePath - Absolute path to the workspace
   * @returns Array of discovered sessions
   */
  async discoverExecutorSessions(
    executorType: string,
    workspacePath: string
  ): Promise<ExecutorSession[]> {
    const params = new URLSearchParams({ workspace_path: workspacePath });
    const response = await fetch(
      `${this.baseUrl}/api/executors/${executorType}/discover-sessions?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to discover executor sessions: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.sessions as ExecutorSession[];
  }

  /**
   * Get messages for an executor session
   *
   * @param executorType - The executor type (e.g., "CLAUDE_CODE")
   * @param sessionId - The session ID
   * @param workspacePath - Absolute path to the workspace
   * @param limit - Optional limit on number of messages to return
   * @returns Array of UI messages for frontend rendering
   */
  async getExecutorSessionMessages(
    executorType: string,
    sessionId: string,
    workspacePath: string,
    limit?: number
  ): Promise<ExecutorUIMessage[]> {
    const params = new URLSearchParams({ workspace_path: workspacePath });
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }

    const response = await fetch(
      `${this.baseUrl}/api/executors/${executorType}/sessions/${sessionId}/messages?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to get executor session messages: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.messages as ExecutorUIMessage[];
  }

  // ==========================================================================
  // File-based Session Management
  // ==========================================================================

  /**
   * List all file-based sessions for an agent
   * @param agentId - Agent ID
   * @param workspacePath - Optional workspace path to find workspace agents
   */
  async listAgentSessions(agentId: string, workspacePath?: string): Promise<FileSession[]> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);
    const query = params.toString();
    const url = `${this.baseUrl}/api/agents/${agentId}/sessions${query ? `?${query}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list sessions: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.sessions as FileSession[];
  }

  /**
   * Create a new file-based session
   */
  async createAgentSession(
    agentId: string,
    request?: CreateFileSessionRequest
  ): Promise<FileSession> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request || {}),
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to create session: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a file-based session by ID
   */
  async getAgentSession(agentId: string, sessionId: string): Promise<FileSession> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions/${sessionId}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to get session: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a file-based session
   */
  async deleteAgentSession(agentId: string, sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions/${sessionId}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to delete session: ${response.statusText}`,
        response.status
      );
    }
  }

  /**
   * List all messages in a session (rollout format)
   */
  async listSessionMessages(
    agentId: string,
    sessionId: string
  ): Promise<SessionMessage[]> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions/${sessionId}/messages`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list messages: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.messages as SessionMessage[];
  }

  /**
   * List all UI messages in a session (for frontend rendering)
   * @param agentId - Agent ID
   * @param sessionId - Session ID
   * @param workspacePath - Optional workspace path to find workspace agents
   */
  async listSessionUIMessages(
    agentId: string,
    sessionId: string,
    workspacePath?: string
  ): Promise<UIMessage[]> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);
    const query = params.toString();
    const url = `${this.baseUrl}/api/agents/${agentId}/sessions/${sessionId}/ui-messages${query ? `?${query}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list UI messages: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.messages as UIMessage[];
  }

  /**
   * Append a message to a session
   */
  async appendSessionMessage(
    agentId: string,
    sessionId: string,
    message: AppendMessageRequest
  ): Promise<SessionMessage> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to append message: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Group Chat Management
  // ==========================================================================

  /**
   * List all group chats
   *
   * @param params - Optional parameters for filtering
   * @param params.workspace_path - Workspace path to list group chats from
   * @param params.include_global - Whether to include global group chats (default: true)
   */
  async listGroupChats(params?: ListGroupChatsParams): Promise<GroupChat[]> {
    const searchParams = new URLSearchParams();
    if (params?.workspace_path) {
      searchParams.set("workspace_path", params.workspace_path);
    }
    if (params?.include_global !== undefined) {
      searchParams.set("include_global", String(params.include_global));
    }
    if (params?.created_by) {
      searchParams.set("created_by", params.created_by);
    }

    const queryString = searchParams.toString();
    const url = queryString
      ? `${this.baseUrl}/api/group-chats?${queryString}`
      : `${this.baseUrl}/api/group-chats`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list group chats: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.group_chats as GroupChat[];
  }

  /**
   * Create a new group chat
   */
  async createGroupChat(
    request: CreateGroupChatRequest
  ): Promise<GroupChatWithMembers> {
    const response = await fetch(`${this.baseUrl}/api/group-chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create group chat: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a group chat by ID with its members
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async getGroupChat(
    groupChatId: string,
    workspacePath: string
  ): Promise<GroupChatWithMembers> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to get group chat: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Update a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param request - Update request data
   */
  async updateGroupChat(
    groupChatId: string,
    workspacePath: string,
    request: UpdateGroupChatRequest
  ): Promise<GroupChat> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}?${searchParams.toString()}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to update group chat: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async deleteGroupChat(
    groupChatId: string,
    workspacePath: string
  ): Promise<void> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}?${searchParams.toString()}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to delete group chat: ${response.statusText}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Group Chat Members
  // ==========================================================================

  /**
   * List members of a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async listGroupChatMembers(
    groupChatId: string,
    workspacePath: string
  ): Promise<GroupChatMember[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/members?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list group chat members: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.members as GroupChatMember[];
  }

  /**
   * Add a member to a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param request - Add member request data
   */
  async addGroupChatMember(
    groupChatId: string,
    workspacePath: string,
    request: AddMemberRequest
  ): Promise<GroupChatMember> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/members?${searchParams.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to add member: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Remove a member from a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param memberId - The member ID to remove
   */
  async removeGroupChatMember(
    groupChatId: string,
    workspacePath: string,
    memberId: string
  ): Promise<void> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/members/${memberId}?${searchParams.toString()}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to remove member: ${response.statusText}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Group Chat Sessions
  // ==========================================================================

  /**
   * List sessions for a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async listGroupChatSessions(
    groupChatId: string,
    workspacePath: string
  ): Promise<GroupChatSession[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list group chat sessions: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.sessions as GroupChatSession[];
  }

  /**
   * Create a new session for a group chat
   *
   * @param groupChatId - The group chat ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param request - Optional session creation request
   */
  async createGroupChatSession(
    groupChatId: string,
    workspacePath: string,
    request?: CreateGroupChatSessionRequest
  ): Promise<GroupChatSession> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions?${searchParams.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request || {}),
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to create group chat session: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a group chat session by ID
   *
   * @param groupChatId - The group chat ID
   * @param sessionId - The session ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async getGroupChatSession(
    groupChatId: string,
    sessionId: string,
    workspacePath: string
  ): Promise<GroupChatSession> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions/${sessionId}?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to get group chat session: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a group chat session
   *
   * @param groupChatId - The group chat ID
   * @param sessionId - The session ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async deleteGroupChatSession(
    groupChatId: string,
    sessionId: string,
    workspacePath: string
  ): Promise<void> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions/${sessionId}?${searchParams.toString()}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to delete group chat session: ${response.statusText}`,
        response.status
      );
    }
  }

  /**
   * List available agents in a session (for view switching)
   *
   * @param groupChatId - The group chat ID
   * @param sessionId - The session ID
   * @param workspacePath - The workspace path where the group chat is stored
   */
  async listSessionAgents(
    groupChatId: string,
    sessionId: string,
    workspacePath: string
  ): Promise<string[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions/${sessionId}/agents?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list session agents: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.agents as string[];
  }

  // ==========================================================================
  // Group Chat Messages
  // ==========================================================================

  /**
   * List messages in a group chat session
   *
   * @param groupChatId - The group chat ID
   * @param sessionId - The session ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param params - Optional parameters for filtering
   */
  async listGroupChatMessages(
    groupChatId: string,
    sessionId: string,
    workspacePath: string,
    params?: ListGroupChatMessagesParams
  ): Promise<ListGroupChatMessagesResponse | ListAgentMessagesResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);
    if (params?.view) searchParams.set("view", params.view);
    if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.before) searchParams.set("before", params.before);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions/${sessionId}/messages?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list group chat messages: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Send a message to a group chat session
   *
   * @param groupChatId - The group chat ID
   * @param sessionId - The session ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param request - The message to send
   */
  async sendGroupChatMessage(
    groupChatId: string,
    sessionId: string,
    workspacePath: string,
    request: SendGroupChatMessageRequest
  ): Promise<SendGroupChatMessageResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/sessions/${sessionId}/messages?${searchParams.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to send message: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Group Chat WebSocket
  // ==========================================================================

  /**
   * Connect to a group chat session WebSocket for real-time updates
   *
   * @param groupChatId - The group chat ID
   * @param sessionId - The session ID
   * @param workspacePath - The workspace path where the group chat is stored
   * @param memberType - Type of the connecting member (human/agent)
   * @param memberId - ID of the connecting member
   * @returns WebSocket connection
   */
  connectGroupChatWs(
    groupChatId: string,
    sessionId: string,
    workspacePath: string,
    memberType: string,
    memberId: string
  ): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    const searchParams = new URLSearchParams();
    searchParams.set("workspace_path", workspacePath);
    searchParams.set("member_type", memberType);
    searchParams.set("member_id", memberId);
    const url = `${wsUrl}/api/group-chats/${groupChatId}/sessions/${sessionId}/ws?${searchParams.toString()}`;
    return new WebSocket(url);
  }

  // ==========================================================================
  // Viben Agent CRUD Operations
  // ==========================================================================

  /**
   * Create a new agent
   *
   * @param options - Agent creation options
   * @returns Created agent response
   */
  async createAgent(options: CreateAgentOptions): Promise<AgentResponse> {
    const response = await fetch(`${this.baseUrl}/api/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create agent: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /** @deprecated Use createAgent instead */
  createVibenAgent = this.createAgent.bind(this);

  /**
   * Get an agent by ID
   *
   * @param agentId - The agent ID
   * @param options - Optional parameters
   * @param options.workspacePath - Workspace path to check first for workspace-scoped agents
   * @returns Agent response
   */
  async getAgent(
    agentId: string,
    options?: { workspacePath?: string }
  ): Promise<AgentResponse> {
    const params = new URLSearchParams();
    if (options?.workspacePath) {
      params.set("workspace_path", options.workspacePath);
    }
    const queryString = params.toString();
    const url = `${this.baseUrl}/api/agents/${encodeURIComponent(agentId)}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get agent: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /** @deprecated Use getAgent instead */
  getVibenAgent = this.getAgent.bind(this);

  /**
   * Update an agent
   *
   * @param agentId - The agent ID
   * @param options - Update options (includes workspace_path for workspace-scoped agents)
   * @returns Updated agent response
   */
  async updateAgent(
    agentId: string,
    options: UpdateAgentOptions
  ): Promise<AgentResponse> {
    // Extract workspace_path for query param, rest goes to body
    const { workspace_path, ...bodyOptions } = options;

    // Build URL with optional workspace_path query param
    const params = new URLSearchParams();
    if (workspace_path) {
      params.set("workspace_path", workspace_path);
    }
    const queryString = params.toString();
    const url = queryString
      ? `${this.baseUrl}/api/agents/${encodeURIComponent(agentId)}?${queryString}`
      : `${this.baseUrl}/api/agents/${encodeURIComponent(agentId)}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bodyOptions),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to update agent: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /** @deprecated Use updateAgent instead */
  updateVibenAgent = this.updateAgent.bind(this);

  /**
   * Delete an agent
   *
   * @param agentId - The agent ID
   * @param options - Optional parameters
   * @param options.workspacePath - Workspace path to check first for workspace-scoped agents
   */
  async deleteAgent(
    agentId: string,
    options?: { workspacePath?: string }
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options?.workspacePath) {
      params.set("workspace_path", options.workspacePath);
    }
    const queryString = params.toString();
    const url = `${this.baseUrl}/api/agents/${encodeURIComponent(agentId)}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete agent: ${errorMessage}`,
        response.status
      );
    }
  }

  /** @deprecated Use deleteAgent instead */
  deleteVibenAgent = this.deleteAgent.bind(this);

  // ==========================================================================
  // Default Agent Management
  // ==========================================================================

  /**
   * Get the default agent ID
   *
   * @returns Default agent response
   */
  async getDefaultAgentId(): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/api/agents/default`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get default agent: ${errorMessage}`,
        response.status
      );
    }

    const data: DefaultAgentResponse = await response.json();
    return data.default_agent_id;
  }

  /**
   * Set the default agent
   *
   * @param agentId - The agent ID to set as default
   */
  async setDefaultAgent(agentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/agents/default`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ agent_id: agentId }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to set default agent: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Agent Templates
  // ==========================================================================

  /**
   * List all agent templates
   *
   * @returns List of templates
   */
  async listAgentTemplates(): Promise<AgentTemplate[]> {
    const response = await fetch(`${this.baseUrl}/api/agents/templates`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to list templates: ${errorMessage}`,
        response.status
      );
    }

    const data: ListTemplatesResponse = await response.json();
    return data.templates;
  }

  /**
   * Get a template by ID
   *
   * @param templateId - The template ID
   * @returns Template
   */
  async getAgentTemplate(templateId: string): Promise<AgentTemplate> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/templates/${encodeURIComponent(templateId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get template: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create a template from an agent
   *
   * @param agentId - The agent ID to create template from
   * @param templateId - The ID for the new template
   * @returns Created template
   */
  async createAgentTemplate(
    agentId: string,
    templateId: string
  ): Promise<AgentTemplate> {
    const response = await fetch(`${this.baseUrl}/api/agents/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ agent_id: agentId, template_id: templateId }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create template: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create an agent from a template
   *
   * @param templateId - The template ID
   * @param agentId - The ID for the new agent
   * @returns Created agent response
   */
  async createAgentFromTemplate(
    templateId: string,
    agentId: string
  ): Promise<AgentResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/templates/${encodeURIComponent(templateId)}/instantiate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ agent_id: agentId }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create agent from template: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Model CRUD Operations
  // ==========================================================================

  /**
   * Create a new custom model
   *
   * @param options - Model creation options
   * @returns Created model response
   */
  async createModel(options: CreateModelOptions): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/api/models`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create model: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a model by ID
   *
   * @param id - The model ID
   * @returns Model response
   */
  async getModel(id: string): Promise<ModelResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/models/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get model: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Update a model
   *
   * @param id - The model ID
   * @param updates - Model update options
   * @returns Updated model response
   */
  async updateModel(id: string, updates: ModelUpdate): Promise<ModelResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/models/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to update model: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a model
   *
   * @param id - The model ID
   */
  async deleteModel(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/models/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete model: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Default Model Management
  // ==========================================================================

  /**
   * Get the default model ID
   *
   * @returns Default model ID or null if not set
   */
  async getDefaultModelId(): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/api/models/default`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get default model: ${errorMessage}`,
        response.status
      );
    }

    const data: DefaultModelResponse = await response.json();
    return data.default_model_id;
  }

  /**
   * Set the default model
   *
   * @param modelId - The model ID to set as default
   */
  async setDefaultModel(modelId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/models/default`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ model_id: modelId }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to set default model: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Model Enable/Disable
  // ==========================================================================

  /**
   * Enable a model
   *
   * @param id - The model ID
   */
  async enableModel(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/models/${encodeURIComponent(id)}/enable`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to enable model: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Disable a model
   *
   * @param id - The model ID
   */
  async disableModel(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/models/${encodeURIComponent(id)}/disable`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to disable model: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Provider Model Discovery
  // ==========================================================================

  /**
   * Discover models available from a provider via API
   *
   * @param providerId - The provider ID
   * @returns List of discovered models
   */
  async discoverProviderModels(providerId: string): Promise<DiscoveredModel[]> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(providerId)}/discover-models`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to discover provider models: ${errorMessage}`,
        response.status
      );
    }

    const data: DiscoverModelsResponse = await response.json();
    return data.models;
  }

  /**
   * List models enabled for a specific provider
   *
   * @param providerId - The provider ID
   * @returns List of enabled model IDs
   */
  async listProviderEnabledModels(providerId: string): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(providerId)}/models`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to list provider enabled models: ${errorMessage}`,
        response.status
      );
    }

    const data = await response.json() as {
      provider_id: string;
      models: Array<{ id: string; enabled: boolean }>;
      total: number;
    };
    // Extract enabled model IDs from the models array
    return data.models.filter(m => m.enabled).map(m => m.id);
  }

  /**
   * Enable a model for a specific provider
   *
   * @param providerId - The provider ID
   * @param modelId - The model ID to enable
   */
  async enableProviderModel(providerId: string, modelId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/enable`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to enable provider model: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Disable a model for a specific provider
   *
   * @param providerId - The provider ID
   * @param modelId - The model ID to disable
   */
  async disableProviderModel(providerId: string, modelId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/disable`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to disable provider model: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Provider CRUD
  // ==========================================================================

  /**
   * List all providers
   */
  async listProviders(): Promise<ProvidersListResponse> {
    const response = await fetch(`${this.baseUrl}/api/providers`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to list providers: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create a new provider
   */
  async createProvider(options: CreateProviderOptions): Promise<ProviderResponse> {
    const body = {
      type: options.type,
      name: options.name,
      api_key: options.apiKey,
      base_url: options.baseUrl,
      api_version: options.apiVersion,
      deployment: options.deployment,
      timeout: options.timeout,
      max_retries: options.maxRetries,
      headers: options.headers,
      set_as_default: options.setAsDefault,
    };

    const response = await fetch(`${this.baseUrl}/api/providers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create provider: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a provider by ID
   */
  async getProvider(id: string): Promise<ProviderResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get provider: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Update a provider
   */
  async updateProvider(id: string, updates: ProviderUpdate): Promise<ProviderResponse> {
    const body: Record<string, unknown> = {};
    if (updates.type !== undefined) body.type = updates.type;
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.apiKey !== undefined) body.api_key = updates.apiKey;
    if (updates.baseUrl !== undefined) body.base_url = updates.baseUrl;
    if (updates.apiVersion !== undefined) body.api_version = updates.apiVersion;
    if (updates.deployment !== undefined) body.deployment = updates.deployment;
    if (updates.timeout !== undefined) body.timeout = updates.timeout;
    if (updates.maxRetries !== undefined) body.max_retries = updates.maxRetries;
    if (updates.headers !== undefined) body.headers = updates.headers;

    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to update provider: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a provider
   */
  async deleteProvider(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete provider: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Get the default provider
   */
  async getDefaultProvider(): Promise<{ default_provider_id: string | null; provider: ProviderResponse | null }> {
    const response = await fetch(`${this.baseUrl}/api/providers/default`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get default provider: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Set the default provider
   */
  async setDefaultProvider(providerId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/providers/default`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ provider_id: providerId }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to set default provider: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Enable a provider
   */
  async enableProvider(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(id)}/enable`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to enable provider: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Disable a provider
   */
  async disableProvider(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(id)}/disable`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to disable provider: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Test provider connection
   */
  async testProvider(id: string): Promise<ProviderStatus> {
    const response = await fetch(
      `${this.baseUrl}/api/providers/${encodeURIComponent(id)}/test`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to test provider: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // API Key Management
  // ==========================================================================

  /**
   * Get API key status for all providers
   */
  async getApiKeyProviders(): Promise<ApiKeyProvidersResponse> {
    const response = await fetch(`${this.baseUrl}/api/providers/api-keys`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get API key providers: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Set API key for a provider
   */
  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    await this.updateProvider(providerId, { apiKey });
  }

  /**
   * Delete API key for a provider
   */
  async deleteApiKey(providerId: string): Promise<void> {
    await this.updateProvider(providerId, { apiKey: "" });
  }

  /**
   * Validate an API key for a provider
   */
  async validateApiKey(
    providerId: string,
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> {
    const response = await fetch(`${this.baseUrl}/api/providers/validate-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ provider_id: providerId, api_key: apiKey }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to validate API key: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get all API keys
   */
  async getAllApiKeys(): Promise<Record<string, string>> {
    const response = await fetch(`${this.baseUrl}/api/providers/api-keys/all`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get all API keys: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.keys;
  }

  // ==========================================================================
  // Workspace CRUD
  // ==========================================================================

  /**
   * List all registered workspaces
   */
  async listWorkspaces(): Promise<WorkspacesListResponse> {
    const response = await fetch(`${this.baseUrl}/api/workspaces`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to list workspaces: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Add (register) a workspace
   */
  async addWorkspace(path: string, name?: string): Promise<WorkspaceResponse> {
    const response = await fetch(`${this.baseUrl}/api/workspaces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path, name }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to add workspace: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a workspace by ID
   */
  async getWorkspace(id: string): Promise<WorkspaceResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/workspaces/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get workspace: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Remove (unregister) a workspace
   */
  async removeWorkspace(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/workspaces/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to remove workspace: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Get the active workspace
   */
  async getActiveWorkspace(): Promise<{ active_workspace: WorkspaceResponse | null }> {
    const response = await fetch(`${this.baseUrl}/api/workspaces/active`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get active workspace: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Set the active workspace
   */
  async setActiveWorkspace(options: { workspaceId?: string; path?: string }): Promise<WorkspaceResponse> {
    const body: Record<string, string> = {};
    if (options.workspaceId) body.workspace_id = options.workspaceId;
    if (options.path) body.path = options.path;

    const response = await fetch(`${this.baseUrl}/api/workspaces/active`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to set active workspace: ${errorMessage}`,
        response.status
      );
    }

    const data = await response.json();
    return data.active_workspace;
  }

  /**
   * Detect agents in a workspace
   */
  async detectWorkspaceAgents(workspaceId: string): Promise<DetectAgentsResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/detect-agents`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to detect workspace agents: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // MCP Servers (Workspace IDE Agents)
  // ==========================================================================

  /**
   * Get MCP servers for an executor in a workspace
   *
   * @param workspacePath - The workspace path (defaults to home dir)
   * @param executorType - The executor type (e.g., "CLAUDE_CODE", "cursor")
   */
  async getMcpServers(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceMcpServersResponse> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP servers: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Add MCP server to an executor
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param server - The MCP server configuration
   */
  async addMcpServer(
    workspacePath: string | undefined,
    executorType: string,
    server: WorkspaceMcpServerConfig
  ): Promise<{ success: boolean; server: WorkspaceMcpServerConfig }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers?${params.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ server }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to add MCP server: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Update MCP server
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param serverName - The server name to update
   * @param updates - The updates to apply
   */
  async updateMcpServer(
    workspacePath: string | undefined,
    executorType: string,
    serverName: string,
    updates: Partial<WorkspaceMcpServerConfig>
  ): Promise<{ success: boolean }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers/${encodeURIComponent(serverName)}?${params.toString()}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to update MCP server: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete MCP server
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param serverName - The server name to delete
   */
  async deleteMcpServer(
    workspacePath: string | undefined,
    executorType: string,
    serverName: string
  ): Promise<{ success: boolean; deleted: string }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/mcp-servers/${encodeURIComponent(serverName)}?${params.toString()}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete MCP server: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Browse-MCP Process Management
  // ==========================================================================

  /**
   * Get browse-mcp server status
   */
  async getMcpStatus(): Promise<McpStatus> {
    const response = await fetch(`${this.baseUrl}/api/mcp/browse/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP status: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Start browse-mcp server
   */
  async startMcpServer(config: McpStartConfig): Promise<McpStatus> {
    const response = await fetch(`${this.baseUrl}/api/mcp/browse/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to start MCP server: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Stop browse-mcp server
   */
  async stopMcpServer(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/mcp/browse/stop`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to stop MCP server: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Test browse-mcp connection
   */
  async testMcpConnection(pythonPath: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/mcp/browse/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ python_path: pythonPath }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.connected;
  }

  /**
   * Check port status
   */
  async checkPortStatus(port: number): Promise<PortStatus> {
    const response = await fetch(`${this.baseUrl}/api/mcp/port/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ port }),
    });

    if (!response.ok) {
      return { in_use: false, pid: null, process_name: null };
    }

    return response.json();
  }

  /**
   * Kill a process by PID
   */
  async killProcess(pid: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/mcp/process/kill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ pid }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.success;
  }

  /**
   * Check if a process is alive
   */
  async isProcessAlive(pid: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/mcp/process/alive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ pid }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.alive;
  }

  // ==========================================================================
  // MCP Proxy Management
  // ==========================================================================

  /**
   * Get MCP proxy status
   */
  async getMcpProxyStatus(): Promise<McpProxyStatus> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/status`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP proxy status: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Check if MCP proxy is installed
   */
  async checkMcpProxyInstalled(pythonPath: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/check-installed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ python_path: pythonPath }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.installed;
  }

  /**
   * Start MCP proxy
   */
  async startMcpProxy(config: McpProxyConfig): Promise<McpProxyStatus> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to start MCP proxy: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Stop MCP proxy
   */
  async stopMcpProxy(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/stop`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to stop MCP proxy: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Install MCP proxy
   */
  async installMcpProxy(pythonPath: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/install`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ python_path: pythonPath }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to install MCP proxy: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get process using a port
   */
  async getPortProcess(port: number): Promise<PortProcess | null> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/port-process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ port }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.process;
  }

  /**
   * Kill process using a port
   */
  async killPortProcess(port: number): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/mcp/proxy/kill-port-process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ port }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to kill port process: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Check MCP server on port
   */
  async checkMcpServerOnPort(port: number): Promise<McpServerPortStatus> {
    const response = await fetch(`${this.baseUrl}/api/mcp/server/check-port`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ port }),
    });

    if (!response.ok) {
      return {
        status: "stopped",
        pid: null,
        process_name: null,
        is_mcp_server: false,
      };
    }

    return response.json();
  }

  // ==========================================================================
  // MCP Inspector (Gateway-integrated Proxy)
  // ==========================================================================

  /**
   * Get MCP Inspector health and session count
   */
  async getMcpInspectorHealth(): Promise<McpInspectorHealth> {
    const response = await fetch(`${this.baseUrl}/api/mcp/inspector/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP Inspector health: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get MCP Inspector session token
   */
  async getMcpInspectorToken(): Promise<McpInspectorToken> {
    const response = await fetch(`${this.baseUrl}/api/mcp/inspector/token`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP Inspector token: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get MCP Inspector configuration
   */
  async getMcpInspectorConfig(authToken: string): Promise<McpInspectorConfig> {
    const response = await fetch(`${this.baseUrl}/api/mcp/inspector/config`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP Inspector config: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * List active MCP Inspector sessions
   */
  async getMcpInspectorSessions(authToken: string): Promise<McpInspectorSession[]> {
    const response = await fetch(`${this.baseUrl}/api/mcp/inspector/sessions`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get MCP Inspector sessions: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.sessions;
  }

  /**
   * Close an MCP Inspector session
   */
  async closeMcpInspectorSession(authToken: string, sessionId: string): Promise<{ deleted: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/mcp/inspector/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to close MCP Inspector session: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Service API Keys
  // ==========================================================================

  /**
   * Get all service API keys
   */
  async getServiceKeys(): Promise<ServiceApiKey[]> {
    const response = await fetch(`${this.baseUrl}/api/service-keys`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get service keys: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.keys;
  }

  /**
   * Create a new service API key
   */
  async createServiceKey(name: string): Promise<ServiceApiKey> {
    const response = await fetch(`${this.baseUrl}/api/service-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create service key: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a service API key by ID
   */
  async getServiceKeyById(keyId: string): Promise<ServiceApiKey | null> {
    const response = await fetch(
      `${this.baseUrl}/api/service-keys/${encodeURIComponent(keyId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get service key: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a service API key
   */
  async deleteServiceKey(keyId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/service-keys/${encodeURIComponent(keyId)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete service key: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Validate a service API key
   */
  async validateServiceKey(apiKey: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/service-keys/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ api_key: apiKey }),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.valid;
  }

  // ==========================================================================
  // Skills (Executor Resources)
  // ==========================================================================

  /**
   * Get skills for an executor in a workspace
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   */
  async getSkills(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceSkillsResponse> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/skills?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get skills: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Add skill to an executor
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param skill - The skill to add
   */
  async addSkill(
    workspacePath: string | undefined,
    executorType: string,
    skill: WorkspaceSkillConfig
  ): Promise<{ success: boolean; skill: WorkspaceSkillConfig }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/skills?${params.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ skill }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to add skill: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete skill from an executor
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param skillId - The skill ID to delete
   */
  async deleteSkill(
    workspacePath: string | undefined,
    executorType: string,
    skillId: string
  ): Promise<{ success: boolean; deleted: string }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/skills/${encodeURIComponent(skillId)}?${params.toString()}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete skill: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Subagents (.claude/agents/*.md or executor-specific paths)
  // ==========================================================================

  /**
   * Get subagents for an executor in a workspace
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type (e.g., "CLAUDE_CODE", "cursor")
   */
  async getAgentConfigs(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceAgentConfigsResponse> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/subagents?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get subagents: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a single subagent file
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param configId - The subagent ID (filename without extension)
   */
  async getAgentConfig(
    workspacePath: string | undefined,
    executorType: string,
    configId: string
  ): Promise<{ config: WorkspaceAgentConfigData }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/subagents/${encodeURIComponent(configId)}?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get subagent: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Commands (slash commands from .claude/commands/ or executor-specific paths)
  // ==========================================================================

  /**
   * Get commands for an executor in a workspace
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type (e.g., "CLAUDE_CODE", "cursor")
   */
  async getCommands(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspaceCommandsResponse> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/commands?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get commands: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a single command file
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param commandId - The command ID (namespace/name or just name)
   */
  async getCommand(
    workspacePath: string | undefined,
    executorType: string,
    commandId: string
  ): Promise<{ command: WorkspaceCommandData }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/commands/${encodeURIComponent(commandId)}?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get command: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Prompts (.claude/prompts/ or similar)
  // ==========================================================================

  /**
   * Get all prompts for an executor in a workspace
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   */
  async getPrompts(
    workspacePath: string | undefined,
    executorType: string
  ): Promise<WorkspacePromptsResponse> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/prompts?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get prompts: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a single prompt file
   *
   * @param workspacePath - The workspace path
   * @param executorType - The executor type
   * @param promptId - The prompt ID
   */
  async getPrompt(
    workspacePath: string | undefined,
    executorType: string,
    promptId: string
  ): Promise<{ prompt: WorkspacePromptData }> {
    const params = new URLSearchParams();
    if (workspacePath) params.set("workspace_path", workspacePath);

    const response = await fetch(
      `${this.baseUrl}/api/executors/${encodeURIComponent(executorType)}/prompts/${encodeURIComponent(promptId)}?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get prompt: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================

  /**
   * List directory contents
   */
  async listFiles(path: string, showHidden = false): Promise<FileListResponse> {
    const params = new URLSearchParams();
    params.set("path", path);
    if (showHidden) params.set("show_hidden", "true");

    const response = await fetch(
      `${this.baseUrl}/api/files/list?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to list files: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Read file content
   */
  async readFile(path: string, encoding = "utf-8"): Promise<FileContentResponse> {
    const params = new URLSearchParams();
    params.set("path", path);
    params.set("encoding", encoding);

    const response = await fetch(
      `${this.baseUrl}/api/files/content?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to read file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create a new file
   */
  async createFile(path: string, content = "", encoding = "utf-8"): Promise<FileEntry> {
    const response = await fetch(`${this.baseUrl}/api/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path, content, encoding }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create a new directory
   */
  async createDirectory(path: string, recursive = true): Promise<FileEntry> {
    const response = await fetch(`${this.baseUrl}/api/files/directory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path, recursive }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to create directory: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Write content to file
   */
  async writeFile(path: string, content: string, encoding = "utf-8"): Promise<{ success: boolean; file: FileEntry }> {
    const response = await fetch(`${this.baseUrl}/api/files/content`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path, content, encoding }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to write file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete file or directory
   */
  async deleteFile(path: string, recursive = false): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path, recursive }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete file: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Rename file or directory
   */
  async renameFile(oldPath: string, newPath: string): Promise<{ success: boolean; file: FileEntry }> {
    const response = await fetch(`${this.baseUrl}/api/files/rename`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to rename file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Copy file or directory
   */
  async copyFile(source: string, destination: string, recursive = true): Promise<{ success: boolean; file: FileEntry }> {
    const response = await fetch(`${this.baseUrl}/api/files/copy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ source, destination, recursive }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to copy file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Move file or directory
   */
  async moveFile(source: string, destination: string): Promise<{ success: boolean; file: FileEntry }> {
    const response = await fetch(`${this.baseUrl}/api/files/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ source, destination }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to move file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Open file with system default or specific app
   */
  async openFile(path: string, appId?: string): Promise<{ success: boolean; path: string }> {
    const response = await fetch(`${this.baseUrl}/api/files/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path, app_id: appId }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to open file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Reveal file in system file manager (Finder/Explorer)
   */
  async revealFile(path: string): Promise<{ success: boolean; path: string }> {
    const response = await fetch(`${this.baseUrl}/api/files/reveal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to reveal file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // System Info APIs
  // ==========================================================================

  /**
   * Get system information including home directory
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await fetch(`${this.baseUrl}/api/system/info`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get system info: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Python Detection APIs
  // ==========================================================================

  /**
   * Detect available Python interpreters on the system
   */
  async detectPython(): Promise<PythonInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/python/detect`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to detect Python: ${errorMessage}`,
        response.status
      );
    }

    const data = await response.json();
    return data.pythons;
  }

  /**
   * Check if a specific Python path is valid
   */
  async checkPythonPath(pythonPath: string): Promise<PythonInfo> {
    const response = await fetch(`${this.baseUrl}/api/python/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ python_path: pythonPath }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to check Python path: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Check if a package is installed in a Python environment
   */
  async checkPythonPackage(pythonPath: string, packageName: string): Promise<PythonPackageInfo> {
    const response = await fetch(`${this.baseUrl}/api/python/package/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ python_path: pythonPath, package_name: packageName }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to check package: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get the install command for a package
   */
  async getPythonInstallCommand(pythonPath: string, packageName: string): Promise<{ command: string; uv_command: string }> {
    const response = await fetch(`${this.baseUrl}/api/python/package/install-command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ python_path: pythonPath, package_name: packageName }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get install command: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // CLI Tools Detection
  // ==========================================================================

  /**
   * Detect all CLI tools (python, git, gh, claude, codex, aider, goose, etc.)
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
    const params = new URLSearchParams();
    if (config?.pythonPath) params.append("python_path", config.pythonPath);
    if (config?.gitPath) params.append("git_path", config.gitPath);
    if (config?.ghPath) params.append("gh_path", config.ghPath);
    if (config?.claudePath) params.append("claude_path", config.claudePath);
    if (config?.codexPath) params.append("codex_path", config.codexPath);
    if (config?.aiderPath) params.append("aider_path", config.aiderPath);
    if (config?.goosePath) params.append("goose_path", config.goosePath);
    if (config?.clinePath) params.append("cline_path", config.clinePath);
    if (config?.continuePath) params.append("continue_path", config.continuePath);
    if (config?.cursorPath) params.append("cursor_path", config.cursorPath);

    const url = params.toString()
      ? `${this.baseUrl}/api/cli-tools/detect?${params}`
      : `${this.baseUrl}/api/cli-tools/detect`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to detect CLI tools: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Check a specific CLI tool path
   */
  async checkCliToolPath(
    tool: CliToolName,
    path: string
  ): Promise<CliToolInfo> {
    const response = await fetch(`${this.baseUrl}/api/cli-tools/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ tool, path }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to check CLI tool path: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  // ==========================================================================
  // Usage Tracking
  // ==========================================================================

  /**
   * Initialize usage tracking
   */
  async initUsage(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/usage/init`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to initialize usage: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    const response = await fetch(`${this.baseUrl}/api/usage/stats`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get usage stats: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Record a usage event
   */
  async recordUsage(serverId: string, sourceId: string, apiKeyId?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/usage/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        server_id: serverId,
        source_id: sourceId,
        api_key_id: apiKeyId,
      }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to record usage: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Get usage for a specific API key
   */
  async getApiKeyUsage(keyId: string): Promise<ApiKeyUsage> {
    const response = await fetch(
      `${this.baseUrl}/api/usage/api-key/${encodeURIComponent(keyId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get API key usage: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get usage for a specific server
   */
  async getServerUsage(serverId: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/api/usage/server/${encodeURIComponent(serverId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get server usage: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.usage_count;
  }

  /**
   * Get usage for a specific source
   */
  async getSourceUsage(sourceId: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/api/usage/source/${encodeURIComponent(sourceId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get source usage: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.usage_count;
  }

  // ==========================================================================
  // Installed Sources (browse-mcp-cli)
  // ==========================================================================

  /**
   * Get installed sources from browse-mcp-cli
   */
  async getInstalledSources(pythonPath: string): Promise<InstalledSourcesResponse> {
    const params = new URLSearchParams({ python_path: pythonPath });
    const response = await fetch(
      `${this.baseUrl}/api/sources/installed?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get installed sources: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Show details of a specific provider
   */
  async showInstalledProvider(pythonPath: string, provider: string): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ python_path: pythonPath });
    const response = await fetch(
      `${this.baseUrl}/api/sources/provider/${encodeURIComponent(provider)}?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to show provider: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Install a provider plugin
   */
  async installProvider(pythonPath: string, provider: string, upgrade = false): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/sources/provider/install`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        python_path: pythonPath,
        provider,
        upgrade,
      }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to install provider: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.output || "Installation successful";
  }

  // ==========================================================================
  // Session Logs
  // ==========================================================================

  /**
   * Initialize logs system
   */
  async initLogs(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/logs/init`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to initialize logs: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Get logs directory path
   */
  async getLogsDirPath(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/logs/dir`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get logs dir: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.path;
  }

  /**
   * Get log sessions
   */
  async getLogSessions(serverId?: string): Promise<LogSessionSummary> {
    const params = new URLSearchParams();
    if (serverId) params.set("server_id", serverId);

    const response = await fetch(
      `${this.baseUrl}/api/logs/sessions?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get log sessions: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get session logs
   */
  async getSessionLogs(sessionId: string, levelFilter?: string, limit?: number): Promise<LogEntry[]> {
    const params = new URLSearchParams();
    if (levelFilter) params.set("level_filter", levelFilter);
    if (limit) params.set("limit", String(limit));

    const response = await fetch(
      `${this.baseUrl}/api/logs/session/${encodeURIComponent(sessionId)}?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get session logs: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Add a log entry
   */
  async addLog(level: LogLevel, message: string, source?: string, sessionId?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/logs/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        level,
        message,
        source,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to add log: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Clear session logs
   */
  async clearSessionLogs(sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/logs/session/${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear session logs: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/logs`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear logs: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Cleanup old sessions
   */
  async cleanupOldSessions(keepCount = 10): Promise<number> {
    const response = await fetch(`${this.baseUrl}/api/logs/cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ keep_count: keepCount }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to cleanup sessions: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.deleted;
  }

  /**
   * Export session logs
   */
  async exportSessionLogs(sessionId: string, exportPath: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/logs/session/${encodeURIComponent(sessionId)}/export`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ export_path: exportPath }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to export session logs: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.exported;
  }

  // ==========================================================================
  // API Logs
  // ==========================================================================

  /**
   * Get API logs directory path
   */
  async getApiLogsDirPath(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/api-logs/dir`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get API logs dir: ${errorMessage}`,
        response.status
      );
    }

    const result = await response.json();
    return result.path;
  }

  /**
   * Get API log sessions
   */
  async getApiLogSessions(): Promise<ApiLogSession[]> {
    const response = await fetch(`${this.baseUrl}/api/api-logs/sessions`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get API log sessions: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
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
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.providerFilter) params.set("provider_filter", options.providerFilter);
    if (options?.sourceFilter) params.set("source_filter", options.sourceFilter);
    if (options?.statusFilter) params.set("status_filter", options.statusFilter);
    if (options?.methodFilter) params.set("method_filter", options.methodFilter);

    const response = await fetch(
      `${this.baseUrl}/api/api-logs/${encodeURIComponent(runId)}?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get API logs: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get API log summary
   */
  async getApiLogSummary(runId: string): Promise<ApiLogSummary> {
    const response = await fetch(
      `${this.baseUrl}/api/api-logs/${encodeURIComponent(runId)}/summary`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get API log summary: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Clear API logs for a run
   */
  async clearApiLogs(runId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/api-logs/${encodeURIComponent(runId)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear API logs: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Open API logs directory
   */
  async openApiLogsDir(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/api-logs/open`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to open API logs dir: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Marketplace
  // ==========================================================================

  /**
   * Get provider index
   */
  async getProviderIndex(forceRefresh = false): Promise<ProviderIndex> {
    const params = new URLSearchParams();
    if (forceRefresh) params.set("force_refresh", "true");

    const response = await fetch(
      `${this.baseUrl}/api/marketplace/index?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get provider index: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get flat sources list
   */
  async getFlatSources(): Promise<FlatSource[]> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/sources`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get sources: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Clear provider cache
   */
  async clearProviderCache(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/marketplace/cache`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear provider cache: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Official Registry
  // ==========================================================================

  /**
   * List official servers
   */
  async listOfficialServers(params?: {
    cursor?: string;
    search?: string;
    limit?: number;
  }): Promise<OfficialServerListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const response = await fetch(
      `${this.baseUrl}/api/official-registry/servers?${searchParams.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to list official servers: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a specific official server
   */
  async getOfficialServer(name: string): Promise<OfficialServerDisplay | null> {
    const response = await fetch(
      `${this.baseUrl}/api/official-registry/servers/${encodeURIComponent(name)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get official server: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get versions for a specific official server
   */
  async getOfficialServerVersions(name: string): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/api/official-registry/servers/${encodeURIComponent(name)}/versions`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  /**
   * Clear official registry cache
   */
  async clearOfficialRegistryCache(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/official-registry/cache`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear official registry cache: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Invalidate cache for a specific official server
   */
  async invalidateOfficialServerCache(name: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/official-registry/servers/${encodeURIComponent(name)}/cache`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to invalidate server cache: ${errorMessage}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Cache / Offline
  // ==========================================================================

  /**
   * Check if offline
   */
  async isOffline(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/cache/offline`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return true; // Assume offline if we can't check
    }

    const data = await response.json();
    return data.offline;
  }

  /**
   * Get cache info
   */
  async getCacheInfo(): Promise<CacheInfo> {
    const response = await fetch(`${this.baseUrl}/api/cache/info`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get cache info: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get cache settings
   */
  async getCacheSettings(): Promise<CacheSettings> {
    const response = await fetch(`${this.baseUrl}/api/cache/settings`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get cache settings: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Update cache settings
   */
  async setCacheSettings(settings: Partial<CacheSettings>): Promise<CacheSettings> {
    const response = await fetch(`${this.baseUrl}/api/cache/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to set cache settings: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Refresh cache
   */
  async refreshCache(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/cache/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to refresh cache: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/cache`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear cache: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Check if cache should be refreshed
   */
  async shouldRefreshCache(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/cache/should-refresh`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.should_refresh;
  }

  // ==========================================================================
  // Filesystem
  // ==========================================================================

  /**
   * Open a folder in file manager
   */
  async openFolder(folderPath: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/open-folder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path: folderPath }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to open folder: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Reveal a file/folder in file manager
   */
  async revealInFileManager(targetPath: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/reveal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ path: targetPath }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to reveal in file manager: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Read directory contents
   */
  async readDirectory(workspacePath: string, dirPath?: string): Promise<FileEntry[]> {
    const params = new URLSearchParams();
    params.set("workspace_path", workspacePath);
    if (dirPath) params.set("dir_path", dirPath);

    const response = await fetch(
      `${this.baseUrl}/api/files/directory?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to read directory: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Read file content
   */
  async readFileContent(
    workspacePath: string,
    filePath: string,
    maxSize?: number
  ): Promise<string> {
    const params = new URLSearchParams();
    params.set("workspace_path", workspacePath);
    params.set("file_path", filePath);
    if (maxSize) params.set("max_size", String(maxSize));

    const response = await fetch(
      `${this.baseUrl}/api/files/content?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to read file content: ${errorMessage}`,
        response.status
      );
    }

    const data = await response.json();
    return data.content;
  }

  /**
   * Read MCP servers config file
   */
  async readMcpServersFile(): Promise<McpServersConfig> {
    const response = await fetch(`${this.baseUrl}/api/files/mcp-servers`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to read MCP servers file: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Write MCP servers config file
   */
  async writeMcpServersFile(config: McpServersConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/files/mcp-servers`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to write MCP servers file: ${errorMessage}`,
        response.status
      );
    }
  }

  /**
   * Get config directory path
   */
  async getConfigDir(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/files/config-dir`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get config dir: ${errorMessage}`,
        response.status
      );
    }

    const data = await response.json();
    return data.path;
  }

  // ==========================================================================
  // Kanban Comments & Activities
  // ==========================================================================

  /**
   * Get all comments for a kanban task
   */
  async getKanbanComments(taskId: string): Promise<KanbanComment[]> {
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get kanban comments: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
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
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          content,
          author_id: authorId,
          author_name: authorName,
          author_avatar: authorAvatar,
        }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to add kanban comment: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Update a kanban comment
   */
  async updateKanbanComment(
    taskId: string,
    commentId: string,
    content: string
  ): Promise<KanbanComment> {
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ content }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to update kanban comment: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Delete a kanban comment
   */
  async deleteKanbanComment(taskId: string, commentId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to delete kanban comment: ${errorMessage}`,
        response.status
      );
    }
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
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}/reactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          emoji,
          user_id: userId,
          user_name: userName,
        }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to toggle comment reaction: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get all activities for a kanban task
   */
  async getKanbanActivities(taskId: string): Promise<KanbanActivity[]> {
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/activities`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to get kanban activities: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
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
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/activities`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          activity_type: activityType,
          actor_id: actorId,
          actor_name: actorName,
          actor_avatar: actorAvatar,
          old_value: oldValue,
          new_value: newValue,
        }),
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to add kanban activity: ${errorMessage}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Clear all comments and activities for a kanban task
   */
  async clearKanbanTaskData(taskId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/kanban/tasks/${encodeURIComponent(taskId)}/data`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      const errorMessage = await this.parseErrorMessage(response);
      throw new GatewayError(
        `Failed to clear kanban task data: ${errorMessage}`,
        response.status
      );
    }
  }

}

// ============================================================================
// Kanban Types
// ============================================================================

/** Comment author information */
export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

/** Comment reaction user */
export interface CommentReactionUser {
  id: string;
  name: string;
}

/** Comment reaction */
export interface CommentReaction {
  emoji: string;
  users: CommentReactionUser[];
  count: number;
}

/** Kanban comment */
export interface KanbanComment {
  id: string;
  task_id: string;
  content: string;
  author: CommentAuthor;
  createdAt: string;
  updatedAt?: string;
  reactions: CommentReaction[];
}

/** Activity actor information */
export interface ActivityActor {
  id: string;
  name: string;
  avatar?: string;
}

/** Activity type */
export type ActivityType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "title_changed"
  | "description_changed"
  | "tag_added"
  | "tag_removed"
  | "due_date_changed"
  | "comment_added";

/** Activity data */
export interface ActivityData {
  oldValue?: string;
  newValue?: string;
  [key: string]: unknown;
}

/** Kanban activity event */
export interface KanbanActivity {
  id: string;
  task_id: string;
  type: ActivityType;
  actor: ActivityActor;
  timestamp: string;
  data: ActivityData;
}

// ============================================================================
// Log Types
// ============================================================================

/** Log entry */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}

/** Log level */
export type LogLevel = "info" | "warning" | "error" | "debug";

/** Log session */
export interface LogSession {
  run_id: string;
  id: string;
  server_id: string;
  server_name: string;
  pid: number | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  log_file: string;
  log_count: number;
  error_count: number;
  started_at?: string;
}

/** Log session summary */
export interface LogSessionSummary {
  sessions: LogSession[];
  total_sessions: number;
}

/** API log entry */
export interface ApiLogEntry {
  timestamp: string;
  run_id: string;
  api_key_hash: string | null;
  provider: string;
  source: string;
  method: "search" | "download" | "read";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  latency_ms: number;
  status: "success" | "error";
  error: string | null;
}

/** API log summary */
export interface ApiLogSummary {
  run_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  by_source: Record<string, number>;
  by_method: Record<string, number>;
  avg_latency_ms: number;
}

/** API log session */
export interface ApiLogSession {
  run_id: string;
  log_file: string;
  entry_count: number;
  created_at: string | null;
  last_entry_at: string | null;
}

// ============================================================================
// Marketplace Types
// ============================================================================

/** Marketplace category */
export interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  plugin_count: number;
  source_count: number;
}

/** Marketplace plugin */
export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version?: string;
  author_name: string;
  author_email?: string;
  author_url?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  categories: string[];
  builtin: boolean;
  package?: string;
  source_count: number;
  sources: string[];
}

/** Provider index */
export interface ProviderIndex {
  version: string;
  updated_at?: string;
  categories: MarketplaceCategory[];
  plugins: MarketplacePlugin[];
}

/** Flat source for UI display */
export interface FlatSource {
  id: string;
  source_name: string;
  plugin_id: string;
  name: string;
  description: string;
  category?: string;
  api_key_type: "none" | "optional" | "required";
  documentation?: string;
  plugin_name: string;
}

// ============================================================================
// Usage Types
// ============================================================================

/** Daily usage data */
export interface DailyUsage {
  date: string;
  total_requests: number;
  by_source: Record<string, number>;
  by_api_key: Record<string, number>;
  by_server: Record<string, number>;
}

/** Activity day for heatmap */
export interface ActivityDay {
  date: string;
  count: number;
  level: number; // 0-4
}

/** Usage statistics */
export interface UsageStats {
  total_requests: number;
  today_requests: number;
  this_week_requests: number;
  this_month_requests: number;
  by_source: Record<string, number>;
  by_api_key: Record<string, number>;
  by_server: Record<string, number>;
  daily_usage: DailyUsage[];
  activity_heatmap: ActivityDay[];
}

/** API key usage info */
export interface ApiKeyUsage {
  key_id: string;
  usage_count: number;
  last_used: string | null;
}

// ============================================================================
// Installed Sources Types
// ============================================================================

/** Source info from browse-mcp-cli */
export interface InstalledSource {
  name: string;
  provider: string;
  enabled: boolean;
}

/** Provider info from browse-mcp-cli */
export interface InstalledProviderInfo {
  name: string;
  description?: string;
  package?: string;
  sources: string[];
  count: number;
}

/** Response from browse-mcp-cli list */
export interface InstalledSourcesResponse {
  providers: Record<string, InstalledProviderInfo>;
  sources: InstalledSource[];
  total: number;
  enabled: number;
}

// ============================================================================
// Official Registry Types (re-exported from types)
// ============================================================================

export type {
  OfficialServerDisplay,
  OfficialPackage,
  OfficialPackageRegistryType,
} from "@/types/official-registry";

import type { OfficialServerDisplay } from "@/types/official-registry";

/** Response for listing official servers */
export interface OfficialServerListResponse {
  servers: OfficialServerDisplay[];
  nextCursor: string | null;
  count: number;
}

// ============================================================================
// Cache / Offline Types
// ============================================================================

/** Cache info */
export interface CacheInfo {
  cache_dir: string;
  total_size_bytes: number;
  mcp_packages_cached: number;
  skills_packages_cached: number;
  last_updated: string | null;
}

/** Cache settings */
export interface CacheSettings {
  enabled: boolean;
  auto_refresh: boolean;
  refresh_interval_hours: number;
  max_size_mb: number;
}

// ============================================================================
// Filesystem Types
// ============================================================================

/** MCP servers config - file format for ~/.viben/mcp-servers.json */
export interface McpServersConfig {
  mcpServers?: unknown[];
  mcpServerStatuses?: Record<string, unknown>;
  lastUpdated?: number;
  [key: string]: unknown;
}

// ============================================================================
// Python Detection Types
// ============================================================================

/** Python interpreter information */
export interface PythonInfo {
  path: string;
  version: string | null;
  is_valid: boolean;
}

/** Python package information */
export interface PythonPackageInfo {
  name: string;
  version: string | null;
  installed: boolean;
}

/** System information */
export interface SystemInfo {
  home_dir: string;
  platform: string;
  arch: string;
  hostname: string;
  release: string;
  type: string;
  viben_dir: string;
}

/** CLI tool detection result */
export interface CliToolInfo {
  found: boolean;
  path?: string;
  version?: string;
  source: "user-config" | "homebrew" | "nvm" | "pyenv" | "pip" | "npm" | "cargo" | "system-path" | "fallback";
  message?: string;
}

/** Supported CLI tool names */
export type CliToolName =
  | "python"
  | "git"
  | "gh"
  | "claude"
  | "codex"
  | "aider"
  | "goose"
  | "cline"
  | "continue"
  | "cursor";

/** All CLI tools detection result */
export interface CliToolsInfo {
  python: CliToolInfo;
  git: CliToolInfo;
  gh: CliToolInfo;
  claude: CliToolInfo;
  codex: CliToolInfo;
  aider: CliToolInfo;
  goose: CliToolInfo;
  cline: CliToolInfo;
  continue: CliToolInfo;
  cursor: CliToolInfo;
}

// ============================================================================
// Group Chat Types (for gateway client)
// ============================================================================

/** Group chat settings */
export interface GroupChatSettings {
  broadcast_mode: "all" | "mention_only";
  show_thinking: boolean;
  history_limit: number;
}

/** Group chat entity */
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: GroupChatSettings;
  /** The workspace path where this group chat is stored */
  workspace_path: string;
  /** Whether this is a global group chat (from ~/.viben/) */
  is_global: boolean;
}

/** Member type in a group chat */
export type MemberType = "human" | "agent" | "executor";

/** Role of a member in a group chat */
export type MemberRole = "owner" | "admin" | "member";

/** Member of a group chat */
export interface GroupChatMember {
  id: string;
  member_type: MemberType;
  member_id: string;
  display_name: string;
  role: MemberRole;
  model?: string;
  joined_at: string;
  last_seen_at?: string;
}

/** Group chat session */
export interface GroupChatSession {
  id: string;
  group_chat_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  active_agents: string[];
  status: "active" | "archived";
}

/** UI Message type for group chat (user-facing view) */
export type GroupChatUIMessageType =
  | "user"
  | "agent_thinking"
  | "agent_response"
  | "system";

/** UI Message in a group chat session (user-facing view) */
export interface GroupChatUIMessage {
  id: string;
  type: GroupChatUIMessageType;
  timestamp: string;
  sender_id?: string;
  sender_name?: string;
  content?: string;
  agent_id?: string;
  agent_name?: string;
  status?: string;
  event?: string;
  data?: Record<string, unknown>;
}

/** Agent rollout message (agent view with tool calls) */
export interface AgentRolloutMessage {
  timestamp: string;
  role: string;
  content: string;
  name?: string;
  tool_calls?: Record<string, unknown>;
  tool_call_id?: string;
}

/** Type of message content */
export type MessageContentType = "text" | "code" | "file" | "system" | "tool_call";

/** Message in a group chat (legacy format, kept for compatibility) */
export interface GroupChatMessage {
  id: string;
  group_chat_id: string;
  sender_id: string;
  sender_type: MemberType;
  sender_name: string;
  content_type: MessageContentType;
  content: string;
  mentions?: string[];
  reply_to?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/** Input for creating a member in a group chat */
export interface CreateMemberInput {
  type: "human" | "agent";
  member_id: string;
  display_name?: string;
  role?: MemberRole;
  model?: string;
}

/** Request to create a group chat */
export interface CreateGroupChatRequest {
  name: string;
  description?: string;
  workspace_path: string;
  created_by: string;
  members?: CreateMemberInput[];
}

/** Response containing group chat with members */
export interface GroupChatWithMembers {
  group_chat: GroupChat;
  members: GroupChatMember[];
}

/** Request to update a group chat */
export interface UpdateGroupChatRequest {
  name?: string;
  description?: string;
}

/** Request to add a member */
export interface AddMemberRequest {
  type: MemberType;
  member_id: string;
  display_name: string;
  role?: MemberRole;
  model?: string;
}

/** Request to create a session */
export interface CreateGroupChatSessionRequest {
  title?: string;
  active_agents?: string[];
}

/** Parameters for listing group chats */
export interface ListGroupChatsParams {
  workspace_path?: string;
  include_global?: boolean;
  created_by?: string;
}

/** Parameters for listing messages */
export interface ListGroupChatMessagesParams {
  view?: "ui" | "agent";
  agent_id?: string;
  limit?: number;
  before?: string;
}

/** Response for listing UI messages */
export interface ListGroupChatMessagesResponse {
  messages: GroupChatUIMessage[];
  view: string;
  agent_id?: string;
  has_more: boolean;
}

/** Response for listing agent messages */
export interface ListAgentMessagesResponse {
  messages: AgentRolloutMessage[];
  view: string;
  agent_id: string;
  has_more: boolean;
}

/** Response for sending a message */
export interface SendGroupChatMessageResponse {
  message: GroupChatUIMessage;
  agents_triggered: string[];
}

/** Request to send a message */
export interface SendGroupChatMessageRequest {
  content: string;
  sender_id: string;
  sender_name: string;
}

// ============================================================================
// Executor Session Types
// ============================================================================

/** Executor session discovered from workspace */
export interface ExecutorSession {
  /** Unique session ID */
  id: string;
  /** Executor type (e.g., "CLAUDE_CODE") */
  executor_type: string;
  /** Workspace path where this session was found */
  workspace_path: string;
  /** When the session was created */
  created_at: string;
  /** When the session was last updated */
  updated_at: string;
  /** Optional session name or description */
  name?: string;
  /** Number of messages in the session */
  message_count?: number;
}

/** Executor UI message for frontend rendering */
export interface ExecutorUIMessage {
  id: string;
  timestamp: string;
  type: "user" | "text" | "tool_use" | "tool_result" | "thinking" | "error";
  content?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  is_error?: boolean;
  attachments?: Record<string, unknown>[];
  /** For Task tool calls, the subagent ID (e.g., "a1477d3") */
  subagent_id?: string;
  /** For Task tool calls, recursively loaded subagent messages */
  subagent_messages?: ExecutorUIMessage[];
}

// ============================================================================
// Default Client Instance
// ============================================================================

let defaultClient: GatewayClient | null = null;

/**
 * Get the default Gateway client instance
 */
export function getGatewayClient(): GatewayClient {
  if (!defaultClient) {
    defaultClient = new GatewayClient();
  }
  return defaultClient;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert SSE event to AgentMessage
 */
export function sseEventToAgentMessage(
  event: SSEMessageEvent
): AgentMessage | null {
  const id = crypto.randomUUID();

  switch (event.type) {
    case "text": {
      const data = event.data as SSETextEvent["data"];
      return {
        id,
        type: "text",
        content: data.content,
      };
    }
    case "tool_use": {
      const data = event.data as SSEToolUseEvent["data"];
      return {
        id: data.id || id,
        type: "tool_use",
        name: data.name,
        input: data.input,
      };
    }
    case "tool_result": {
      const data = event.data as SSEToolResultEvent["data"];
      return {
        id,
        type: "tool_result",
        toolUseId: data.tool_use_id,
        output: data.output,
        isError: data.is_error,
      };
    }
    case "plan": {
      const data = event.data as SSEPlanEvent["data"];
      return {
        id,
        type: "plan",
        plan: {
          goal: data.goal,
          steps: data.steps.map((s) => ({
            id: s.id,
            description: s.description,
            status: s.status as "pending" | "in_progress" | "completed" | "failed" | "cancelled",
          })),
          notes: data.notes,
        },
      };
    }
    case "result": {
      const data = event.data as SSEResultEvent["data"];
      return {
        id,
        type: "result",
        content: data.content,
      };
    }
    case "error": {
      const data = event.data as SSEErrorEvent["data"];
      return {
        id,
        type: "error",
        message: data.message,
        isError: true,
      };
    }
    case "done":
      return null;
    default:
      return null;
  }
}

// ============================================================================
// Workspace API Types
// ============================================================================

/** Executor info with merged configs */
export interface ExecutorInfo {
  /** Executor type (e.g., "CLAUDE_CODE") */
  type: ExecutorType;
  /** Display name */
  name: string;
  /** Description for UI display */
  description: string;
  /** Documentation URL (optional) */
  docs_url?: string;
  /** Global availability info */
  availability: AvailabilityInfo;
  /** Whether this executor supports MCP */
  supports_mcp: boolean;
  /** Executor capabilities */
  capabilities: string[];
  /** Workspace-specific config exists */
  has_workspace_config: boolean;
  /** The workspace path this executor config belongs to (absolute path) */
  workspace_path: string;
  /** Path to workspace/project config file (prioritized for editing) */
  workspace_config_path?: string;
  /** Path to global (~) config file */
  global_config_path?: string;
}

/** Response for executors */
export interface ExecutorsResponse {
  workspace_path: string;
  executors: ExecutorInfo[];
  total: number;
}

/** @deprecated Use ExecutorInfo instead */
export interface WorkspaceExecutor {
  /** Executor type (e.g., "CLAUDE_CODE") */
  type: ExecutorType;
  /** Display name */
  name: string;
  /** Global availability info */
  availability: AvailabilityInfo;
  /** Whether this executor supports MCP */
  supports_mcp: boolean;
  /** Executor capabilities */
  capabilities: string[];
  /** Workspace-specific config exists */
  has_workspace_config: boolean;
  /** Path to workspace config file (if exists) */
  workspace_config_path?: string;
}

/** @deprecated Use ExecutorsResponse instead */
export interface WorkspaceExecutorsResponse {
  workspace_path: string;
  executors: WorkspaceExecutor[];
}

/** Workspace model info - alias for ModelResponse for backward compatibility */
export type WorkspaceModel = ModelResponse;

/** Response for workspace models */
export interface WorkspaceModelsResponse {
  workspace_path: string;
  models: ModelResponse[];
  total: number;
}

/** Workspace agent type */
export type WorkspaceAgentType =
  | "VIBEN"
  | "CLAUDE_CODE"
  | "CURSOR"
  | "VSCODE"
  | "CONTINUE"
  | "ZED"
  | "WINDSURF"
  | "OTHER";

/**
 * Agent info - basic agent information for listing.
 * For full agent details (Viben agents), use AgentResponse.
 */
export interface AgentInfo {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent type */
  executor_type: WorkspaceAgentType;
  /** Source: "global" or "workspace" */
  source: "global" | "workspace";
  /** The workspace path this agent belongs to (absolute path) */
  workspace_path: string;
  /** Path to agent config */
  config_path?: string;
  /** MCP config path (if applicable) */
  mcp_config_path?: string;
  /** Number of MCP servers configured */
  mcp_server_count: number;
  /** Number of skills/commands configured */
  skill_count: number;

  // Optional fields for Viben agents (populated when detailed info is available)
  /** Description (Viben agents only) */
  description?: string;
  /** Model ID (Viben agents only) */
  model?: string;
  /** Provider ID (Viben agents only) */
  provider?: string;
  /** System prompt (Viben agents only) */
  system_prompt?: string;
  /** Append prompt (Viben agents only) */
  append_prompt?: string;
  /** Temperature (Viben agents only) */
  temperature?: number;
  /** Max tokens (Viben agents only) */
  max_tokens?: number;
  /** MCP servers (Viben agents only) */
  mcp_servers?: string[];
  /** Skills (Viben agents only) */
  skills?: string[];
  /** Plan mode (Viben agents only) */
  plan_mode?: boolean;
  /** Approvals (Viben agents only) */
  approvals?: boolean;
  /** Created at (Viben agents only) */
  created_at?: string;
  /** Updated at (Viben agents only) */
  updated_at?: string;
}

/** Response for agents */
export interface AgentsResponse {
  workspace_path: string;
  agents: AgentInfo[];
  total: number;
}

/** @deprecated Use AgentInfo instead */
export interface WorkspaceAgent {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent type */
  executor_type: WorkspaceAgentType;
  /** Source: "global" or "workspace" */
  source: string;
  /** Path to agent config */
  config_path?: string;
  /** MCP config path (if applicable) */
  mcp_config_path?: string;
  /** Number of MCP servers configured */
  mcp_server_count: number;
  /** Number of skills/commands configured */
  skill_count: number;
}

/** @deprecated Use AgentsResponse instead */
export interface WorkspaceAgentsResponse {
  workspace_path: string;
  agents: WorkspaceAgent[];
  total: number;
}

// ============================================================================
// Model CRUD Types
// ============================================================================

/** Provider type (matching Rust ProviderType) */
export type ProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "azure"
  | "bedrock"
  | "custom";

/** Options for creating a custom model */
export interface CreateModelOptions {
  id: string;
  name: string;
  provider: ProviderType;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  set_as_default?: boolean;
}

/** Options for updating a model */
export interface ModelUpdate {
  name?: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
}

/** Response from model operations */
export interface ModelResponse {
  id: string;
  name: string;
  provider: string;
  provider_id: string;
  provider_name: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  input_price?: number;
  output_price?: number;
  is_default: boolean;
  enabled: boolean;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Response for default model */
export interface DefaultModelResponse {
  default_model_id: string | null;
}

/** Discovered model from provider API */
export interface DiscoveredModel {
  id: string;
  name: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  owned_by?: string;
  created?: number;
}

/** Response for discovered models */
export interface DiscoverModelsResponse {
  models: DiscoveredModel[];
  total: number;
}

/** Response for provider enabled models */
export interface ProviderEnabledModelsResponse {
  provider_id: string;
  enabled_models: string[];
}

// ============================================================================
// Provider CRUD Types
// ============================================================================

// ProviderType is already defined above in Model CRUD Types

/** Provider response from gateway */
export interface ProviderResponse {
  id: string;
  type: ProviderType;
  name: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Options for creating a provider */
export interface CreateProviderOptions {
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  setAsDefault?: boolean;
}

/** Options for updating a provider */
export interface ProviderUpdate {
  type?: ProviderType;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  deployment?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

/** Provider status from test */
export interface ProviderStatus {
  provider_id: string;
  connected: boolean;
  latency?: number;
  error?: string;
  checked_at: string;
}

/** Response for listing providers */
export interface ProvidersListResponse {
  providers: ProviderResponse[];
  total: number;
  default_provider_id: string | null;
}

/** API key info for a provider */
export interface ApiKeyInfo {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  has_key: boolean;
  key_prefix: string | null;
  doc_url: string | null;
}

/** Response for API key providers */
export interface ApiKeyProvidersResponse {
  providers: ApiKeyInfo[];
}

// ============================================================================
// Workspace CRUD Types
// ============================================================================

/** Workspace response from gateway */
export interface WorkspaceResponse {
  id: string;
  path: string;
  name: string;
  config_path: string;
  /** Git repo path (path + "/.git") for kanban compatibility */
  git_repo_path: string;
  type?: "global" | "custom";
  mcp?: {
    enabled: string[];
    disabled?: string[];
  };
  skills?: {
    enabled: string[];
    disabled?: string[];
  };
  agents?: string[];
  created_at?: string;
  updated_at?: string;
}

/** Response for listing workspaces */
export interface WorkspacesListResponse {
  workspaces: WorkspaceResponse[];
  total: number;
  active_workspace_id: string | null;
}

/** Response for detecting agents */
export interface DetectAgentsResponse {
  workspace_id: string;
  workspace_path: string;
  agents: Array<{
    id: string;
    name: string;
    type: string;
    source: string;
    config_path?: string;
  }>;
  total: number;
}

// ============================================================================
// Workspace MCP/Skills Types
// ============================================================================

/** MCP Server configuration */
export interface WorkspaceMcpServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
  headers?: Record<string, string>;
  disabled?: boolean;
}

/** Response for listing MCP servers */
export interface WorkspaceMcpServersResponse {
  servers: WorkspaceMcpServerConfig[];
  total: number;
}

/** Browse-MCP server status */
export interface McpStatus {
  running: boolean;
  pid: number | null;
  transport: string | null;
  port: number | null;
  /** Command that was executed */
  command?: string;
  /** Full command line arguments */
  args?: string[];
  /** Startup timestamp */
  startedAt?: string;
  /** Endpoint URL for connecting */
  endpointUrl?: string;
  /** Exit code if process terminated */
  exitCode?: number | null;
  /** Exit signal if process was killed */
  exitSignal?: string | null;
  /** Stderr output from the process */
  stderr?: string;
  /** Stdout output from the process */
  stdout?: string;
  /** Error message if startup failed */
  error?: string;
}

/** Configuration for starting browse-mcp server */
export interface McpStartConfig {
  python_path: string;
  transport: "stdio" | "sse" | "http" | string;
  port?: number;
  download_path?: string;
  enabled_sources?: string[];
  api_keys?: Record<string, string>;
  server_id?: string;
  server_name?: string;
}

/** Port status */
export interface PortStatus {
  in_use: boolean;
  pid: number | null;
  process_name: string | null;
}

/** MCP Proxy status */
export interface McpProxyStatus {
  running: boolean;
  pid: number | null;
  host: string | null;
  port: number | null;
  auth_token: string | null;
  url: string | null;
}

/** MCP Proxy config */
export interface McpProxyConfig {
  python_path: string;
  host: string;
  port: number;
  auth_token?: string;
}

/** Port process info */
export interface PortProcess {
  pid: number;
  name: string | null;
  is_mcp_proxy: boolean;
}

/** MCP Server port status */
export interface McpServerPortStatus {
  status: "running" | "stopped" | "conflict";
  pid: number | null;
  process_name: string | null;
  is_mcp_server: boolean;
}

/** MCP Inspector health response */
export interface McpInspectorHealth {
  status: string;
  sessions: number;
}

/** MCP Inspector token response */
export interface McpInspectorToken {
  token: string | null;
  authDisabled: boolean;
}

/** MCP Inspector config response */
export interface McpInspectorConfig {
  defaultEnvironment: Record<string, string>;
  defaultCommand: string;
  defaultArgs: string;
  defaultTransport: string;
  defaultServerUrl: string;
  authRequired: boolean;
}

/** MCP Inspector session info */
export interface McpInspectorSession {
  sessionId: string;
  transportType: string;
  createdAt: string;
  serverConnected: boolean;
}

/** Service API Key */
export interface ServiceApiKey {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  created_at: string;
  last_used: string | null;
}

/** Workspace Skill configuration */
export interface WorkspaceSkillConfig {
  id: string;
  name: string;
  version: string;
  source: string;
  path?: string;
  description?: string;
}

/** Response for listing skills */
export interface WorkspaceSkillsResponse {
  skills: WorkspaceSkillConfig[];
  total: number;
}

// ============================================================================
// Agent Configs Types (prompts from .claude/agents/*.md)
// ============================================================================

/** Agent config data from .claude/agents/*.md */
export interface WorkspaceAgentConfigData {
  id: string;
  name: string;
  description: string;
  tools: string[];
  model: string;
  path: string;
  content: string;
}

/** Response for listing agent configs */
export interface WorkspaceAgentConfigsResponse {
  configs: WorkspaceAgentConfigData[];
}

// ============================================================================
// Commands Types (slash commands from .claude/commands/)
// ============================================================================

/** Command data from .claude/commands/ */
export interface WorkspaceCommandData {
  id: string;
  namespace: string;
  name: string;
  path: string;
  content: string;
}

/** Response for listing commands */
export interface WorkspaceCommandsResponse {
  commands: WorkspaceCommandData[];
}

// ============================================================================
// Prompts Types (.claude/prompts/ or similar)
// ============================================================================

/** Prompt data from .claude/prompts/ */
export interface WorkspacePromptData {
  id: string;
  name: string;
  description: string;
  path: string;
  content: string;
}

/** Response for listing prompts */
export interface WorkspacePromptsResponse {
  prompts: WorkspacePromptData[];
}

// ============================================================================
// File Operations Types
// ============================================================================

/** File entry from directory listing */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_file: boolean;
  is_symlink: boolean;
  size: number;
  created_at: string;
  modified_at: string;
  extension?: string;
}

/** Response for listing files */
export interface FileListResponse {
  path: string;
  entries: FileEntry[];
  total: number;
}

/** Response for reading file content */
export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  encoding: string;
}

// ============================================================================
// Agent CRUD Types
// ============================================================================

/** Options for creating an agent */
export interface CreateAgentOptions {
  name: string;
  id?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  from_template?: string;
  /** Workspace path for workspace-scoped agents */
  base_path?: string;
}

/** @deprecated Use CreateAgentOptions instead */
export type CreateVibenAgentOptions = CreateAgentOptions;

/** Response from creating/updating an agent */
export interface AgentResponse {
  id: string;
  name: string;
  executor_type: string;
  source: string;
  workspace_path?: string;
  config_path?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_config?: Record<string, unknown>;
  /** MCP servers (may be omitted if empty due to skip_serializing_if) */
  mcp_servers?: string[];
  /** Skills (may be omitted if empty due to skip_serializing_if) */
  skills?: string[];
  /** Plan mode (defaults to false if omitted) */
  plan_mode?: boolean;
  /** Approvals (defaults to false if omitted) */
  approvals?: boolean;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use AgentResponse instead */
export type VibenAgentResponse = AgentResponse;

/** Options for updating an agent */
export interface UpdateAgentOptions {
  name?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: string[];
  skills?: string[];
  plan_mode?: boolean;
  approvals?: boolean;
  /** Workspace path for workspace-scoped agents */
  workspace_path?: string;
}

/** @deprecated Use UpdateAgentOptions instead */
export type UpdateVibenAgentOptions = UpdateAgentOptions;

/** Response for default agent */
export interface DefaultAgentResponse {
  default_agent_id: string | null;
}

/** Agent template */
export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  created_at: string;
}

/** @deprecated Use AgentTemplate instead */
export type VibenAgentTemplate = AgentTemplate;

/** Response for listing templates */
export interface ListTemplatesResponse {
  templates: AgentTemplate[];
  total: number;
}

// ============================================================================
// Chat List Types (Aggregated sidebar list)
// ============================================================================

/** Item type in chat list */
export type ChatListItemType = "group_chat" | "executor" | "agent";

/** A unified chat list item that can represent group chat, executor, or agent */
export interface ChatListItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Item type */
  item_type: ChatListItemType;
  /** Source: "global" or "workspace" */
  source: string;
  /** The workspace path this item belongs to */
  workspace_path: string;
  /** Description (optional) */
  description?: string;
  /** Icon/avatar hint (e.g., executor type, agent type) */
  icon_type?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Counts by item type */
export interface ChatListCounts {
  group_chats: number;
  executors: number;
  agents: number;
}

/** Response for chat list */
export interface ChatListResponse {
  workspace_path: string;
  items: ChatListItem[];
  total: number;
  counts: ChatListCounts;
}


/**
 * Check if an availability status indicates the agent is available
 */
export function isAgentAvailable(availability: AvailabilityInfo): boolean {
  return (
    availability.type === "LOGIN_DETECTED" ||
    availability.type === "INSTALLATION_FOUND"
  );
}

/**
 * Get human-readable availability status
 */
export function getAvailabilityStatus(
  availability: AvailabilityInfo
): {
  label: string;
  variant: "success" | "warning" | "error";
} {
  switch (availability.type) {
    case "LOGIN_DETECTED":
      return { label: "Logged In", variant: "success" };
    case "INSTALLATION_FOUND":
      return { label: "Installed", variant: "success" };
    case "NOT_FOUND":
      return { label: "Not Found", variant: "error" };
    default:
      return { label: "Unknown", variant: "warning" };
  }
}
