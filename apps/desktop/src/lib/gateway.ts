/**
 * Gateway HTTP/SSE Client
 *
 * Connects Desktop frontend to viben-gateway for real AI agent execution.
 */

import type { AgentMessage } from "@/types";

// ============================================================================
// Configuration
// ============================================================================

/** Default Gateway port */
const DEFAULT_GATEWAY_PORT = 18790;

/** Candidate ports to try when auto-discovering Gateway */
const DISCOVERY_PORTS = [18790, 18791, 18800, 3790, 8790];

/** Default Gateway URL */
const DEFAULT_GATEWAY_URL = `http://localhost:${DEFAULT_GATEWAY_PORT}`;

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

  // Try discovery ports
  for (const port of DISCOVERY_PORTS) {
    const url = `http://localhost:${port}`;
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
// Types (matching Rust types from viben-executors)
// ============================================================================

/** All supported AI coding agent types */
export type BaseCodingAgent =
  | "CLAUDE_CODE"
  | "AMP"
  | "GEMINI"
  | "CODEX"
  | "OPENCODE"
  | "CURSOR_AGENT"
  | "QWEN_CODE"
  | "COPILOT"
  | "DROID";

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
  type: "user" | "text" | "tool_use" | "tool_result" | "thinking" | "error";
  content?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  is_error?: boolean;
  attachments?: Record<string, unknown>[];
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
  | "text"
  | "tool_use"
  | "tool_result"
  | "plan"
  | "result"
  | "error"
  | "done";

/** Base SSE event */
export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
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

export type SSEMessageEvent =
  | SSETextEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEPlanEvent
  | SSEResultEvent
  | SSEErrorEvent
  | SSEDoneEvent;

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
    websocket: boolean;
  }> {
    const result = {
      reachable: false,
      healthCheck: false,
      version: null as string | null,
      service: null as string | null,
      timestamp: null as string | null,
      url: this.baseUrl,
      endpoints: [] as { path: string; available: boolean }[],
      websocket: false,
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
      // Test specific HTTP endpoints
      const testEndpoints = [
        "/api/agents",
        "/api/sessions",
        "/api/cron",
        "/api/group-chats",
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

      // Test WebSocket connectivity
      result.websocket = await this.testWebSocket();
    }

    return result;
  }

  /**
   * Test WebSocket connectivity to the Gateway
   */
  private async testWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      const wsUrl = this.baseUrl.replace(/^http/, "ws");
      // The Gateway WebSocket endpoint is at /ws (not /api/events)
      const ws = new WebSocket(`${wsUrl}/ws`);
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
  async listAgents(): Promise<BaseCodingAgent[]> {
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
    return data.agents as BaseCodingAgent[];
  }

  /**
   * Get agent details by type
   */
  async getAgent(agentType: BaseCodingAgent): Promise<AgentDetails> {
    const response = await fetch(`${this.baseUrl}/api/agents/${agentType}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to get agent: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Check agent availability
   */
  async checkAvailability(agentType: BaseCodingAgent): Promise<AvailabilityInfo> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentType}/availability`,
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
    agentType: BaseCodingAgent,
    request: SpawnAgentRequest
  ): Promise<SpawnAgentResponse> {
    const url = `${this.baseUrl}/api/agents/${agentType}/spawn`;
    console.log("[GatewayClient] Spawn request:", { url, agentType, request });

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
    agentType: BaseCodingAgent,
    request: SpawnAgentRequest
  ): AsyncGenerator<SSEMessageEvent, void, unknown> {
    // Cancel any existing stream
    this.cancelStream();

    this.abortController = new AbortController();

    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentType}/spawn`,
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
    agentType: BaseCodingAgent,
    sessionId: string
  ): Promise<void> {
    // Cancel any ongoing stream
    this.cancelStream();

    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentType}/stop`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ session_id: sessionId }),
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
   * Continue an existing session
   */
  async continueSession(
    agentType: BaseCodingAgent,
    request: ContinueSessionRequest
  ): Promise<SpawnAgentResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentType}/continue`,
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
    agentType: BaseCodingAgent,
    request: ContinueSessionRequest
  ): AsyncGenerator<SSEMessageEvent, void, unknown> {
    // Cancel any existing stream
    this.cancelStream();

    this.abortController = new AbortController();

    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentType}/continue`,
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
   * @param executorType - The executor type (e.g., "claude-code")
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
   * @param executorType - The executor type (e.g., "claude-code")
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
   */
  async listAgentSessions(agentId: string): Promise<FileSession[]> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

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
   */
  async listSessionUIMessages(
    agentId: string,
    sessionId: string
  ): Promise<UIMessage[]> {
    const response = await fetch(
      `${this.baseUrl}/api/agents/${agentId}/sessions/${sessionId}/ui-messages`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

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
  /** Executor type (e.g., "claude-code") */
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
  /** Executor ID (e.g., "CLAUDE_CODE") */
  id: BaseCodingAgent;
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
  /** Executor ID (e.g., "CLAUDE_CODE") */
  id: BaseCodingAgent;
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

/** Workspace model info */
export interface WorkspaceModel {
  /** Model ID */
  id: string;
  /** Display name */
  name: string;
  /** Provider ID */
  provider_id: string;
  /** Provider name */
  provider_name: string;
  /** Model capabilities */
  capabilities?: string[];
  /** Context window size */
  context_window?: number;
  /** Whether model is available (API key configured) */
  is_available: boolean;
  /** Workspace-specific override exists */
  has_workspace_override: boolean;
}

/** Response for workspace models */
export interface WorkspaceModelsResponse {
  workspace_path: string;
  models: WorkspaceModel[];
  total: number;
}

/** Workspace agent type */
export type WorkspaceAgentType =
  | "viben"
  | "claude_code"
  | "cursor"
  | "vscode"
  | "continue"
  | "zed"
  | "windsurf"
  | "other";

/** Agent info */
export interface AgentInfo {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent type */
  agent_type: WorkspaceAgentType;
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
  agent_type: WorkspaceAgentType;
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
