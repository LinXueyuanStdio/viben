/**
 * Executor Operations Types
 *
 * Core type definitions for the unified executor module.
 */

import type { ExecutorType, AvailabilityStatus, AvailabilityInfo, AgentMcpServerEntry } from "../../types";

// Re-export for convenience
export type { ExecutorType, AvailabilityStatus, AvailabilityInfo };

// =============================================================================
// Capability Types
// =============================================================================

/**
 * Executor capabilities (UPPER_SNAKE_CASE to match AgentCapability)
 */
export type ExecutorCapability =
  | "SPAWN"           // Supports spawn process
  | "CHAT"            // Supports non-interactive chat
  | "CHAT_SDK"        // Supports SDK mode chat
  | "CHAT_STREAMING"  // Supports streaming chat
  | "SESSION_RESUME"  // Supports session resume
  | "SESSION_FORK"    // Supports session fork (matches existing AgentCapability)
  | "CONTEXT_USAGE"   // Supports context usage stats (matches existing AgentCapability)
  | "PLAN_MODE"       // Supports plan mode
  | "APPROVALS";      // Supports approval mode

// =============================================================================
// Spawn Types
// =============================================================================

/**
 * Spawn options for starting an executor process
 */
export interface SpawnOptions {
  /** Working directory */
  cwd: string;
  /** Prompt text */
  prompt: string;
  /** Agent name (required for buildRunCommand) */
  agent?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Session ID (for new session) */
  sessionId?: string;
  /** Model to use */
  model?: string;
  /** Skip permission checks (dangerous) */
  dangerouslySkipPermissions?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
  /** Use JSON output format */
  jsonOutput?: boolean;
  /** Run in background (detached) */
  detach?: boolean;
}

// =============================================================================
// Chat Types
// =============================================================================

/**
 * Input/output format for chat streaming
 */
export type ChatFormat = "text" | "stream-json";

/**
 * Chat options (merged from ChatOptions + ChatProxyOptions)
 */
export interface ChatOptions {
  /** Prompt text */
  prompt: string;
  /** Working directory */
  cwd?: string;
  /** Input format */
  inputFormat?: "text" | "stream-json";
  /** Output format */
  outputFormat?: "text" | "stream-json";
  /** Enable verbose output */
  verbose?: boolean;
  /** Session ID */
  sessionId?: string;
  /** Resume session ID */
  resume?: string;
  /** Model to use */
  model?: string;
  /** Skip permission checks (dangerous) */
  dangerouslySkipPermissions?: boolean;
  /** Environment variables */
  env?: Record<string, string>;
  /** Custom system prompt */
  systemPrompt?: string;
  /** Text appended to system prompt */
  appendPrompt?: string;
  /** Allowed tools list */
  allowedTools?: string[];
  /** Disallowed tools list */
  disallowedTools?: string[];
  /** MCP servers to use (string = name-only for registry lookup, object = full connection details) */
  mcpServers?: (string | AgentMcpServerEntry)[];
  /** Skills to use */
  skills?: string[];
  /** Permission mode */
  permissionMode?: string;
  /** Prefer SDK mode over spawn */
  preferSdk?: boolean;
  /** Sandbox configuration (session-level) */
  sandboxConfig?: {
    enabled: boolean;
    provider?: "native" | "codex" | "claude";
  };
}

// =============================================================================
// SSE Message Types (camelCase for internal TS, matches existing gateway code)
// =============================================================================

export interface SSETextMessage {
  type: "text";
  content: string;
}

export interface SSEToolUseMessage {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface SSEToolResultMessage {
  type: "tool_result";
  tool_use_id: string;
  output: string;
  is_error?: boolean;
}

export interface SSEResultMessage {
  type: "result";
  subtype?: "success" | "error";
  result?: string;
  cost?: number;
  duration?: number;
  exitCode?: number;
}

export interface SSEErrorMessage {
  type: "error";
  message: string;
}

export interface SSEQuestionMessage {
  type: "question";
  id: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
}

export interface SSESdkSessionMessage {
  type: "sdk_session";
  sdk_session_id: string;
}

export interface SSEThinkingMessage {
  type: "thinking";
  content: string;
}

export interface SSEExecApprovalMessage {
  type: "exec_approval";
  id: string;
  tool_call: {
    title?: string;
    kind?: "read" | "edit" | "execute";
    command?: string;
    cwd?: string;
  };
  options: Array<{ id: string; label: string }>;
}

export interface SSEContextUsageMessage {
  type: "context_usage";
  used: number;
  total: number;
}

export interface SSEAssistantMessage {
  type: "assistant";
  message: {
    role: string;
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: unknown }
    >;
  };
}

export interface SSEStreamEventMessage {
  type: "stream_event";
  event: string;
  data?: unknown;
}

export type SSEMessage =
  | SSETextMessage
  | SSEToolUseMessage
  | SSEToolResultMessage
  | SSEResultMessage
  | SSEErrorMessage
  | SSEQuestionMessage
  | SSESdkSessionMessage
  | SSEThinkingMessage
  | SSEExecApprovalMessage
  | SSEContextUsageMessage
  | SSEAssistantMessage
  | SSEStreamEventMessage;

// =============================================================================
// Result Types
// =============================================================================

/**
 * Executor error types
 */
export type ExecutorErrorType =
  | "NOT_FOUND"         // Executor not installed
  | "NOT_AUTHENTICATED" // Not logged in
  | "SPAWN_FAILED"      // Process spawn failed
  | "TIMEOUT"           // Execution timeout
  | "SDK_ERROR"         // SDK error
  | "PROCESS_CRASHED"   // Process crashed
  | "PERMISSION_DENIED" // Permission denied
  | "INVALID_CONFIG";   // Invalid configuration

/**
 * Unified execution result
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Exit code (process mode only) */
  exitCode?: number;
  /** Session ID */
  sessionId?: string;
  /** Process ID (spawn mode only) */
  pid?: number;
  /** Log file path (spawn mode only) */
  logFile?: string;
  /** Error message */
  error?: string;
  /** Error type */
  errorType?: ExecutorErrorType;
}

// Type aliases for semantic clarity
export type SpawnResult = ExecutionResult;
export type ChatResult = ExecutionResult;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Parsed command parts ready for execution
 */
export interface CommandParts {
  /** The program to execute */
  program: string;
  /** Arguments to pass to the program */
  args: string[];
  /** Environment variables to set */
  env: Record<string, string>;
}

/**
 * Command building options
 */
export interface RunCommandOptions {
  agent: string;
  prompt: string;
  sessionId?: string;
  dangerouslySkipPermissions?: boolean;
  verbose?: boolean;
  jsonOutput?: boolean;
}

/**
 * Executor configuration
 *
 * Priority: method options > ExecutorConfig > engine defaults
 */
export interface ExecutorConfig {
  model?: string;
  appendPrompt?: string;
  planMode?: boolean;
  approvals?: boolean;
  dangerouslySkipPermissions?: boolean;
  baseCommandOverride?: string;
  env?: Record<string, string>;
}

// =============================================================================
// Executor Interface
// =============================================================================

/**
 * Unified executor interface
 *
 * Method naming follows existing conventions:
 * - capabilities() not getCapabilities()
 * - defaultMcpConfigPath() not getMcpConfigPath()
 */
export interface Executor {
  /** Executor type identifier */
  readonly type: ExecutorType;

  // === Capability Detection ===

  /** Get availability information */
  getAvailabilityInfo(): AvailabilityInfo;

  /** Get supported capabilities */
  capabilities(): ExecutorCapability[];

  /** Check if capability is supported */
  supports(capability: ExecutorCapability): boolean;

  // === Configuration ===

  /** Get MCP config file path */
  defaultMcpConfigPath(): string | null;

  /** Get config directory name (e.g., .claude, .gemini) */
  getConfigDirName(): string;

  /** Get config directory full path */
  getConfigDir(projectRoot: string): string;

  /** Get agent config file path */
  getAgentConfigPath(agent: string, projectRoot: string): string;

  /** Get commands directory path */
  getCommandsPath(projectRoot: string, ...parts: string[]): string;

  /** Get viben command relative path */
  getVibenCommandPath(name: string): string;

  // === Command Building ===

  /** Get CLI executable name */
  getCliName(): string;

  /** Build run command */
  buildRunCommand(options: RunCommandOptions): string[];

  /** Build resume command */
  buildResumeCommand(sessionId: string): string[];

  /** Get resume command string for display */
  getResumeCommandStr(sessionId: string, cwd?: string): string;

  /** Get non-interactive environment variables */
  getNonInteractiveEnv(): Record<string, string>;

  /** Extract session ID from log content */
  extractSessionIdFromLog(logContent: string): string | null;

  // === Execution Operations ===

  /** Spawn interactive process (for task phase) */
  spawn(options: SpawnOptions): Promise<ExecutionResult>;

  /** Non-interactive chat (for CLI and Gateway) */
  chat(options: ChatOptions): Promise<ExecutionResult>;

  /** Streaming chat (for Gateway WebSocket/SSE) */
  chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage>;

  /** Resume session */
  resume(sessionId: string, options?: Partial<SpawnOptions>): Promise<ExecutionResult>;

  // === Feature Detection ===

  /** Whether session ID can be specified on create */
  supportsSessionIdOnCreate(): boolean;

  /** Whether CLI agent execution is supported */
  supportsCLIAgents(): boolean;
}
