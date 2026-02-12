/**
 * Executor types for AI coding agents
 */
import type { ChildProcess } from "child_process";
import type { ExecutorType, AgentCapability, AvailabilityInfo } from "../types";

export type { ExecutorType, AgentCapability, AvailabilityInfo };

// ============================================================================
// Chat Types (Non-interactive streaming)
// ============================================================================

/**
 * Input/output format for chat streaming
 */
export type ChatFormat = "text" | "stream-json";

/**
 * Options for non-interactive chat mode
 */
export interface ChatOptions {
  /** Prompt text (reads from stdin if not provided) */
  prompt?: string;
  /** Working directory */
  cwd?: string;
  /** Input format (default: text) */
  inputFormat?: ChatFormat;
  /** Output format (default: text) */
  outputFormat?: ChatFormat;
  /** Enable verbose output */
  verbose?: boolean;
  /** Session ID for new session */
  sessionId?: string;
  /** Resume existing session */
  resume?: string;
  /** Model to use (if executor supports) */
  model?: string;
  /** Skip permission checks (dangerous) */
  dangerouslySkipPermissions?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Result of spawning a chat process
 */
export interface ChatSpawnResult {
  /** The spawned child process */
  child: ChildProcess;
  /** Promise that resolves when process exits with exit code */
  exitPromise: Promise<number>;
}

/**
 * Repository context for executor operations
 */
export interface RepoContext {
  /** Root path of the workspace */
  workspaceRoot: string;
  /** Names of repositories in the workspace (subdirectory names) */
  repoNames: string[];
}

/**
 * Environment variables and context for execution
 */
export interface ExecutionEnv {
  /** Environment variables */
  vars: Record<string, string>;
  /** Repository context */
  repoContext: RepoContext;
  /** Whether to remind agent to commit changes */
  commitReminder: boolean;
  /** Custom commit reminder prompt */
  commitReminderPrompt: string;
}

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
 * Result of executor exit
 */
export type ExecutorExitResult = "success" | "failure";

/**
 * Spawned child process with control channels
 */
export interface SpawnedChild {
  /** The spawned process */
  child: ChildProcess;
  /** Promise that resolves when process exits */
  exitPromise?: Promise<ExecutorExitResult>;
  /** Function to cancel the process */
  cancel?: () => void;
}

/**
 * Process running status
 */
export type ProcessRunStatus = "running" | "completed" | "failed" | "cancelled";

/**
 * Process state tracking
 */
export interface ProcessState {
  sessionId: string;
  agentType: string;
  workdir: string;
  pid?: number;
  status: ProcessRunStatus;
}

/**
 * Executor configuration options
 */
export interface ExecutorConfig {
  /** Model to use */
  model?: string;
  /** Text appended to prompts */
  appendPrompt?: string;
  /** Enable plan mode (Claude Code) */
  planMode?: boolean;
  /** Enable approvals mode (Claude Code) */
  approvals?: boolean;
  /** Skip permission checks (dangerous) */
  dangerouslySkipPermissions?: boolean;
  /** Override base command */
  baseCommandOverride?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Interface for executor approval service
 */
export interface ExecutorApprovalService {
  /** Request approval for an action */
  requestApproval(action: string): Promise<boolean>;
}

/**
 * Standard coding agent executor interface
 */
export interface StandardCodingAgentExecutor {
  /** Get executor type */
  readonly type: ExecutorType;

  /** Set the approval service for permission handling */
  useApprovals?(approvals: ExecutorApprovalService): void;

  /** Spawn a new agent process */
  spawn(
    currentDir: string,
    prompt: string,
    env: ExecutionEnv
  ): Promise<SpawnedChild>;

  /** Continue an existing session */
  spawnFollowUp(
    currentDir: string,
    prompt: string,
    sessionId: string,
    resetToMessageId: string | undefined,
    env: ExecutionEnv
  ): Promise<SpawnedChild>;

  /**
   * Spawn a non-interactive chat process with transparent I/O streaming.
   * The process inherits stdin/stdout/stderr from the parent for direct pass-through.
   * This is designed for CLI usage like `viben executor chat -n CLAUDE_CODE -p "prompt"`.
   */
  spawnChat?(options: ChatOptions): Promise<ChatSpawnResult>;

  /**
   * Check if this executor supports non-interactive chat mode
   */
  supportsChat?(): boolean;

  /**
   * Get the CLI command name used for chat (e.g., "claude" for Claude Code)
   */
  getChatCommand?(): string | null;

  /** Get the default MCP configuration file path */
  defaultMcpConfigPath(): string | null;

  /** Get agent availability information */
  getAvailabilityInfo(): AvailabilityInfo;

  /** Get agent capabilities */
  capabilities(): AgentCapability[];
}

/**
 * Create default execution environment
 */
export function createExecutionEnv(
  workspaceRoot = "",
  repoNames: string[] = []
): ExecutionEnv {
  return {
    vars: {},
    repoContext: {
      workspaceRoot,
      repoNames,
    },
    commitReminder: false,
    commitReminderPrompt: "",
  };
}

/**
 * Apply execution environment to a spawn options object
 */
export function applyEnvToSpawnOptions(
  env: ExecutionEnv,
  options: { env?: NodeJS.ProcessEnv }
): void {
  options.env = {
    ...process.env,
    ...env.vars,
    ...options.env,
  };
}
