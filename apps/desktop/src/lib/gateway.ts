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
      // Use a simple test endpoint - try events stream
      const ws = new WebSocket(`${wsUrl}/api/events`);
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
   */
  async listGroupChats(): Promise<GroupChat[]> {
    const response = await fetch(`${this.baseUrl}/api/group-chats`, {
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
      throw new GatewayError(
        `Failed to create group chat: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a group chat by ID with its members
   */
  async getGroupChat(groupChatId: string): Promise<GroupChatWithMembers> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}`,
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
   */
  async updateGroupChat(
    groupChatId: string,
    request: UpdateGroupChatRequest
  ): Promise<GroupChat> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}`,
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
   */
  async deleteGroupChat(groupChatId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}`,
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
   */
  async listGroupChatMembers(groupChatId: string): Promise<GroupChatMember[]> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/members`,
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
   */
  async addGroupChatMember(
    groupChatId: string,
    request: AddMemberRequest
  ): Promise<GroupChatMember> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/members`,
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
   */
  async removeGroupChatMember(
    groupChatId: string,
    memberId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/members/${memberId}`,
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

  /**
   * Leave a group chat
   */
  async leaveGroupChat(groupChatId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/leave`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to leave group chat: ${response.statusText}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Group Chat Messages
  // ==========================================================================

  /**
   * List messages in a group chat
   */
  async listGroupChatMessages(
    groupChatId: string,
    params?: ListGroupChatMessagesParams
  ): Promise<GroupChatMessage[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.before) searchParams.set("before", params.before);
    if (params?.after) searchParams.set("after", params.after);

    const queryString = searchParams.toString();
    const url = queryString
      ? `${this.baseUrl}/api/group-chats/${groupChatId}/messages?${queryString}`
      : `${this.baseUrl}/api/group-chats/${groupChatId}/messages`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new GatewayError(
        `Failed to list group chat messages: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.messages as GroupChatMessage[];
  }

  /**
   * Send a message to a group chat
   */
  async sendGroupChatMessage(
    groupChatId: string,
    request: SendGroupChatMessageRequest
  ): Promise<GroupChatMessage> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/messages`,
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

    const data = await response.json();
    return data.message as GroupChatMessage;
  }

  /**
   * Delete a message from a group chat
   */
  async deleteGroupChatMessage(
    groupChatId: string,
    messageId: string
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/group-chats/${groupChatId}/messages/${messageId}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new GatewayError(
        `Failed to delete message: ${response.statusText}`,
        response.status
      );
    }
  }

  // ==========================================================================
  // Group Chat WebSocket
  // ==========================================================================

  /**
   * Connect to a group chat WebSocket for real-time updates
   *
   * @param groupChatId - The group chat ID
   * @param memberType - Type of the connecting member (human/agent/executor)
   * @param memberId - ID of the connecting member
   * @returns WebSocket connection
   */
  connectGroupChatWs(
    groupChatId: string,
    memberType: string,
    memberId: string
  ): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    const url = `${wsUrl}/api/group-chats/${groupChatId}/ws?member_type=${encodeURIComponent(memberType)}&member_id=${encodeURIComponent(memberId)}`;
    return new WebSocket(url);
  }
}

// ============================================================================
// Group Chat Types (for gateway client)
// ============================================================================

/** Group chat entity */
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  task_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Member type in a group chat */
export type MemberType = "human" | "agent" | "executor";

/** Role of a member in a group chat */
export type MemberRole = "owner" | "admin" | "member";

/** Member of a group chat */
export interface GroupChatMember {
  id: string;
  group_chat_id: string;
  member_type: MemberType;
  member_id: string;
  display_name: string;
  role: MemberRole;
  joined_at: string;
  last_seen_at?: string;
}

/** Type of message content */
export type MessageContentType = "text" | "code" | "file" | "system" | "tool_call";

/** Message in a group chat */
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

/** Request to create a group chat */
export interface CreateGroupChatRequest {
  name: string;
  description?: string;
  task_id?: string;
  created_by: string;
  initial_members?: {
    member_type: MemberType;
    member_id: string;
    display_name?: string;
    role?: MemberRole;
  }[];
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
  member_type: MemberType;
  member_id: string;
  display_name?: string;
  role?: MemberRole;
}

/** Parameters for listing messages */
export interface ListGroupChatMessagesParams {
  limit?: number;
  before?: string;
  after?: string;
}

/** Request to send a message */
export interface SendGroupChatMessageRequest {
  content_type?: MessageContentType;
  content: string;
  mentions?: string[];
  reply_to?: string;
  metadata?: Record<string, unknown>;
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
