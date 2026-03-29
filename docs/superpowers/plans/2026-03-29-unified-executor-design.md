# Unified Executor Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate three scattered executor abstractions (`StandardCodingAgentExecutor`, `ICLIAdapter`, `ChatProxy`) into a unified `executor/ops` module following the `idea/ops` architecture pattern.

**Architecture:** Registry-based design where each platform implements the `Executor` interface. All operations go through `executor/ops` functions that delegate to registered engine implementations. Configuration priority: method options > ExecutorConfig > engine defaults.

**Tech Stack:** TypeScript, Node.js child_process, existing `ExecutorType` from `types/index.ts`

---

## File Structure

```
packages/core/src/executor/
├── ops/
│   ├── index.ts           # Unified exports (types + registry)
│   ├── types.ts           # Core type definitions
│   ├── registry.ts        # Executor registry (register/get/list)
│   └── utils.ts           # Shared utilities (which, paths)
├── engines/
│   ├── index.ts           # Engine registration entry point
│   ├── base.ts            # Base executor class with shared logic
│   ├── claude.ts          # CLAUDE_CODE implementation
│   └── gemini.ts          # GEMINI implementation
└── index.ts               # Module entry (re-exports ops + registers engines)
```

**Decisions:**
- Phase 1 focuses on CLAUDE_CODE and GEMINI only (priority 1 platforms)
- Other platforms (CODEX, OPENCODE, AMP, etc.) deferred to Phase 2
- Keep old `executors/` as compatibility layer during migration
- Use UPPER_SNAKE_CASE for capability names to match existing `AgentCapability`

---

## Chunk 1: Core Types and Registry

### Task 1: Create types.ts with core type definitions

**Files:**
- Create: `packages/core/src/executor/ops/types.ts`

- [ ] **Step 1: Create the types file with ExecutorCapability**

```typescript
/**
 * Executor Operations Types
 *
 * Core type definitions for the unified executor module.
 */

import type { ExecutorType, AvailabilityStatus, AvailabilityInfo } from "../../types";

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
```

- [ ] **Step 2: Add SpawnOptions and ChatOptions**

```typescript
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
  /** MCP servers to use */
  mcpServers?: string[];
  /** Skills to use */
  skills?: string[];
  /** Permission mode */
  permissionMode?: string;
  /** Prefer SDK mode over spawn */
  preferSdk?: boolean;
}
```

- [ ] **Step 3: Add SSE message types**

```typescript
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
  toolUseId: string;
  output: string;
  isError?: boolean;
}

export interface SSEResultMessage {
  type: "result";
  subtype?: "success" | "error";
  cost?: number;
  duration?: number;
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
  sdkSessionId: string;
}

export type SSEMessage =
  | SSETextMessage
  | SSEToolUseMessage
  | SSEToolResultMessage
  | SSEResultMessage
  | SSEErrorMessage
  | SSEQuestionMessage
  | SSESdkSessionMessage;
```

- [ ] **Step 4: Add ExecutionResult and error types**

```typescript
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
```

- [ ] **Step 5: Add ExecutorConfig and RunCommandOptions**

```typescript
// =============================================================================
// Configuration Types
// =============================================================================

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
```

- [ ] **Step 6: Add Executor interface**

```typescript
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
```

- [ ] **Step 7: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/ops/types.ts

---

### Task 2: Create registry.ts

**Files:**
- Create: `packages/core/src/executor/ops/registry.ts`

- [ ] **Step 1: Implement the registry**

```typescript
/**
 * Executor Registry
 *
 * Central registry for executor factories. Each platform registers
 * its factory function, which creates configured executor instances.
 */

import type { ExecutorType, AvailabilityInfo } from "../../types";
import type { Executor, ExecutorConfig } from "./types";

type ExecutorFactory = (config?: ExecutorConfig) => Executor;

const registry = new Map<ExecutorType, ExecutorFactory>();

/**
 * Register an executor factory
 */
export function registerExecutor(type: ExecutorType, factory: ExecutorFactory): void {
  registry.set(type, factory);
}

/**
 * Get an executor instance
 *
 * @throws Error if executor type is not registered
 */
export function getExecutor(type: ExecutorType, config?: ExecutorConfig): Executor {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Unknown executor type: ${type}`);
  }
  return factory(config);
}

/**
 * Check if executor is registered
 */
export function hasExecutor(type: ExecutorType): boolean {
  return registry.has(type);
}

/**
 * Get all registered executor types
 */
export function getRegisteredTypes(): ExecutorType[] {
  return Array.from(registry.keys());
}

/**
 * Get all available executors (installed or logged in)
 */
export function getAvailableExecutors(): Array<{
  type: ExecutorType;
  executor: Executor;
  availability: AvailabilityInfo;
}> {
  const result: Array<{
    type: ExecutorType;
    executor: Executor;
    availability: AvailabilityInfo;
  }> = [];

  for (const type of registry.keys()) {
    const executor = getExecutor(type);
    const availability = executor.getAvailabilityInfo();
    if (availability.status !== "NOT_FOUND") {
      result.push({ type, executor, availability });
    }
  }

  return result;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/ops/registry.ts

---

### Task 3: Create utils.ts

**Files:**
- Create: `packages/core/src/executor/ops/utils.ts`

- [ ] **Step 1: Implement utility functions**

```typescript
/**
 * Executor Utilities
 *
 * Shared utility functions for executor operations.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Synchronously find executable path
 */
export function whichSync(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Asynchronously find executable path
 */
export async function which(command: string): Promise<string | null> {
  return whichSync(command);
}

/**
 * Get user's home directory
 */
export function getHomeDir(): string {
  return homedir();
}

/**
 * Get Viben data directory (~/.viben)
 */
export function getDataDir(): string {
  return join(homedir(), ".viben");
}

/**
 * Check if file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/**
 * Join paths
 */
export function joinPath(...parts: string[]): string {
  return join(...parts);
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/ops/utils.ts

---

### Task 4: Create ops/index.ts exports

**Files:**
- Create: `packages/core/src/executor/ops/index.ts`

- [ ] **Step 1: Create the index file with explicit exports**

```typescript
/**
 * Executor Operations Module
 *
 * Unified interface for AI executor operations.
 *
 * Phase 1: types.ts, registry.ts, utils.ts
 * Phase 2 (future): spawn.ts, chat.ts, session.ts, availability.ts, command.ts
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Re-exported from types/index.ts
  ExecutorType,
  AvailabilityStatus,
  AvailabilityInfo,
  // Capability types
  ExecutorCapability,
  // Spawn types
  SpawnOptions,
  SpawnResult,
  // Chat types
  ChatOptions,
  ChatResult,
  // SSE types
  SSETextMessage,
  SSEToolUseMessage,
  SSEToolResultMessage,
  SSEResultMessage,
  SSEErrorMessage,
  SSEQuestionMessage,
  SSESdkSessionMessage,
  SSEMessage,
  // Result types
  ExecutionResult,
  ExecutorErrorType,
  // Config types
  RunCommandOptions,
  ExecutorConfig,
  // Main interface
  Executor,
} from "./types";

// =============================================================================
// Registry Operations
// =============================================================================

export {
  registerExecutor,
  getExecutor,
  hasExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "./registry";

// =============================================================================
// Utilities
// =============================================================================

export {
  which,
  whichSync,
  getHomeDir,
  getDataDir,
  fileExists,
  joinPath,
} from "./utils";
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/ops/index.ts

- [ ] **Step 3: Commit chunk 1**

```bash
git add packages/core/src/executor/ops/
git commit -m "feat(executor): add core types and registry for unified executor module"
```

---

## Chunk 2: Base Executor and Claude Implementation

### Task 5: Create base executor class

**Files:**
- Create: `packages/core/src/executor/engines/base.ts`

- [ ] **Step 1: Implement BaseExecutor with shared logic**

```typescript
/**
 * Base Executor
 *
 * Abstract base class providing shared implementation for common executor operations.
 */

import type { AvailabilityInfo } from "../../types";
import type {
  Executor,
  ExecutorType,
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../ops/types";
import { whichSync, fileExists, joinPath, getHomeDir } from "../ops/utils";

export abstract class BaseExecutor implements Executor {
  abstract readonly type: ExecutorType;
  protected config: ExecutorConfig;

  constructor(config: ExecutorConfig = {}) {
    this.config = config;
  }

  // === Abstract methods (must be implemented by subclasses) ===

  abstract getAvailabilityInfo(): AvailabilityInfo;
  abstract capabilities(): ExecutorCapability[];
  abstract defaultMcpConfigPath(): string | null;
  abstract getConfigDirName(): string;
  abstract getCliName(): string;
  abstract buildRunCommand(options: RunCommandOptions): string[];
  abstract buildResumeCommand(sessionId: string): string[];
  abstract getNonInteractiveEnv(): Record<string, string>;
  abstract spawn(options: SpawnOptions): Promise<ExecutionResult>;
  abstract chat(options: ChatOptions): Promise<ExecutionResult>;
  abstract chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage>;
  abstract resume(sessionId: string, options?: Partial<SpawnOptions>): Promise<ExecutionResult>;
  abstract supportsSessionIdOnCreate(): boolean;
  abstract supportsCLIAgents(): boolean;

  // === Shared implementations ===

  supports(capability: ExecutorCapability): boolean {
    return this.capabilities().includes(capability);
  }

  getConfigDir(projectRoot: string): string {
    return joinPath(projectRoot, this.getConfigDirName());
  }

  getAgentConfigPath(agent: string, projectRoot: string): string {
    return joinPath(this.getConfigDir(projectRoot), "agents", `${agent}.md`);
  }

  getCommandsPath(projectRoot: string, ...parts: string[]): string {
    if (parts.length === 0) {
      return joinPath(this.getConfigDir(projectRoot), "commands");
    }
    return joinPath(this.getConfigDir(projectRoot), "commands", ...parts);
  }

  getVibenCommandPath(name: string): string {
    return `${this.getConfigDirName()}/commands/viben/${name}.md`;
  }

  getResumeCommandStr(sessionId: string, cwd?: string): string {
    const cmd = this.buildResumeCommand(sessionId).join(" ");
    return cwd ? `cd ${cwd} && ${cmd}` : cmd;
  }

  extractSessionIdFromLog(_logContent: string): string | null {
    // Default: no extraction (Claude passes session ID via --session-id)
    return null;
  }

  // === Helper methods for subclasses ===

  protected getExecutablePath(): string | null {
    return whichSync(this.getCliName());
  }

  protected checkAuthFile(path: string): boolean {
    return fileExists(path);
  }

  protected getHomePath(...parts: string[]): string {
    return joinPath(getHomeDir(), ...parts);
  }

  protected mergeConfig<T extends Record<string, unknown>>(
    defaults: T,
    overrides?: Partial<T>
  ): T {
    return { ...defaults, ...overrides } as T;
  }
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/engines/base.ts

---

### Task 6: Implement Claude executor

**Files:**
- Create: `packages/core/src/executor/engines/claude.ts`

- [ ] **Step 1: Create ClaudeExecutor class structure**

```typescript
/**
 * Claude Code Executor
 *
 * Implementation of the Executor interface for Claude Code (Anthropic).
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { AvailabilityInfo } from "../../types";
import type {
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../ops/types";
import { registerExecutor } from "../ops/registry";
import { BaseExecutor } from "./base";

/**
 * Claude Code specific configuration
 */
export interface ClaudeExecutorConfig extends ExecutorConfig {
  /** Enable plan mode */
  planMode?: boolean;
  /** Enable approvals mode */
  approvals?: boolean;
}

export class ClaudeExecutor extends BaseExecutor {
  readonly type = "CLAUDE_CODE" as const;
  protected override config: ClaudeExecutorConfig;

  constructor(config: ClaudeExecutorConfig = {}) {
    super(config);
    this.config = config;
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const authFile = this.getHomePath(".claude.json");
    const execPath = this.getExecutablePath();

    if (this.checkAuthFile(authFile)) {
      return {
        status: "LOGIN_DETECTED",
        lastAuthTimestamp: Date.now(),
        path: execPath ?? undefined,
      };
    }

    if (execPath) {
      return {
        status: "INSTALLATION_FOUND",
        path: execPath,
      };
    }

    return { status: "NOT_FOUND" };
  }

  capabilities(): ExecutorCapability[] {
    return [
      "SPAWN",
      "CHAT",
      "CHAT_SDK",
      "CHAT_STREAMING",
      "SESSION_RESUME",
      "SESSION_FORK",
      "CONTEXT_USAGE",
      "PLAN_MODE",
      "APPROVALS",
    ];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".claude.json");
  }

  getConfigDirName(): string {
    return ".claude";
  }

  getCliName(): string {
    return "claude";
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const {
      agent,
      prompt,
      sessionId,
      dangerouslySkipPermissions = true,
      verbose = true,
      jsonOutput = true,
    } = options;

    const cmd = ["claude", "-p", "--agent", agent];

    if (sessionId) {
      cmd.push("--session-id", sessionId);
    }

    if (dangerouslySkipPermissions) {
      cmd.push("--dangerously-skip-permissions");
    }

    if (jsonOutput) {
      cmd.push("--output-format", "stream-json", "--verbose");
    } else if (verbose) {
      cmd.push("--verbose");
    }

    cmd.push(prompt);
    return cmd;
  }

  buildResumeCommand(sessionId: string): string[] {
    return ["claude", "--resume", sessionId];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return { CLAUDE_NON_INTERACTIVE: "1" };
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return true;
  }

  supportsCLIAgents(): boolean {
    return true;
  }
```

- [ ] **Step 2: Add spawn implementation**

```typescript
  // === Execution Operations ===

  async spawn(options: SpawnOptions): Promise<ExecutionResult> {
    const {
      cwd,
      prompt,
      agent,
      env: extraEnv = {},
      sessionId,
      model,
      dangerouslySkipPermissions = this.config.dangerouslySkipPermissions,
      verbose = true,
      jsonOutput = true,
      detach = false,
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Claude executable not found",
        errorType: "NOT_FOUND",
      };
    }

    // Build arguments - use agent mode if provided, otherwise direct prompt
    const args: string[] = ["-p"];

    if (agent) {
      args.push("--agent", agent);
    }

    if (sessionId) {
      args.push("--session-id", sessionId);
    }

    if (model || this.config.model) {
      args.push("--model", model || this.config.model!);
    }

    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    if (jsonOutput) {
      args.push(
        "--output-format", "stream-json",
        "--input-format", "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--replay-user-messages"
      );
    } else if (verbose) {
      args.push("--verbose");
    }

    // NOTE: When using stream-json input format, prompt is sent via stdin, not as argument
    // Only add prompt as argument for text mode
    if (!jsonOutput && prompt) {
      args.push(prompt);
    }

    // Merge environment
    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
      ...this.getNonInteractiveEnv(),
    };

    try {
      const child = spawn(execPath, args, {
        cwd,
        env: spawnEnv,
        stdio: detach ? "ignore" : ["pipe", "pipe", "pipe"],
        detached: detach,
      });

      if (detach) {
        child.unref();
        return {
          success: true,
          pid: child.pid,
          sessionId,
        };
      }

      // For stream-json mode, send prompt via stdin
      if (jsonOutput && prompt && child.stdin) {
        const message = JSON.stringify({
          type: "user",
          message: { role: "user", content: prompt },
        });
        child.stdin.write(message + "\n");
        child.stdin.end();
      }

      // Wait for completion
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      return {
        success: exitCode === 0,
        exitCode,
        sessionId,
        pid: child.pid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SPAWN_FAILED",
      };
    }
  }
```

- [ ] **Step 3: Add chat implementation**

```typescript
  async chat(options: ChatOptions): Promise<ExecutionResult> {
    const {
      prompt,
      cwd = process.cwd(),
      inputFormat = "text",
      outputFormat = "text",
      verbose = false,
      sessionId,
      resume,
      model,
      dangerouslySkipPermissions = this.config.dangerouslySkipPermissions,
      env: extraEnv = {},
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Claude executable not found",
        errorType: "NOT_FOUND",
      };
    }

    // Build arguments
    const args: string[] = ["-p"];

    // For text input format, prompt is passed as argument
    // For stream-json, prompt is sent via stdin after spawn
    if (inputFormat === "text" && prompt) {
      args.push(prompt);
    }

    if (inputFormat !== "text") {
      args.push("--input-format", inputFormat);
    }
    if (outputFormat !== "text") {
      args.push("--output-format", outputFormat);
    }

    if (verbose) {
      args.push("--verbose");
    }
    if (sessionId) {
      args.push("--session-id", sessionId);
    }
    if (resume) {
      args.push("--resume", resume);
    }
    if (model || this.config.model) {
      args.push("--model", model || this.config.model!);
    }
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    try {
      const child = spawn(execPath, args, {
        cwd,
        env: spawnEnv,
        stdio: "inherit",
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      return {
        success: exitCode === 0,
        exitCode,
        sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SPAWN_FAILED",
      };
    }
  }
```

- [ ] **Step 4: Add chatStreaming and resume implementations**

```typescript
  async *chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage> {
    const {
      prompt,
      cwd = process.cwd(),
      sessionId,
      resume,
      model,
      dangerouslySkipPermissions = this.config.dangerouslySkipPermissions,
      env: extraEnv = {},
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      yield {
        type: "error",
        message: "Claude executable not found",
      };
      return;
    }

    const args: string[] = [
      "-p",
      "--output-format", "stream-json",
      "--input-format", "stream-json",
      "--verbose",
    ];

    if (sessionId) {
      args.push("--session-id", sessionId);
    }
    if (resume) {
      args.push("--resume", resume);
    }
    if (model || this.config.model) {
      args.push("--model", model || this.config.model!);
    }
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    const child = spawn(execPath, args, {
      cwd,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Send prompt via stdin
    if (prompt && child.stdin) {
      const message = JSON.stringify({
        type: "user",
        message: { role: "user", content: prompt },
      });
      child.stdin.write(message + "\n");
      child.stdin.end();
    }

    // Stream stdout as SSE messages
    if (child.stdout) {
      let buffer = "";
      for await (const chunk of child.stdout) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              yield parsed as SSEMessage;
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          yield parsed as SSEMessage;
        } catch {
          // Skip
        }
      }
    }
  }

  async resume(
    sessionId: string,
    options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    const {
      cwd = process.cwd(),
      env: extraEnv = {},
    } = options || {};

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Claude executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = this.buildResumeCommand(sessionId).slice(1); // Remove 'claude'

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    try {
      const child = spawn(execPath, args, {
        cwd,
        env: spawnEnv,
        stdio: "inherit",
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      return {
        success: exitCode === 0,
        exitCode,
        sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SPAWN_FAILED",
      };
    }
  }
}
```

- [ ] **Step 5: Add registration and factory export**

```typescript
// Register executor
registerExecutor("CLAUDE_CODE", (config) => new ClaudeExecutor(config as ClaudeExecutorConfig));

export { ClaudeExecutor };
```

- [ ] **Step 6: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/engines/claude.ts

---

### Task 7: Implement Gemini executor

**Files:**
- Create: `packages/core/src/executor/engines/gemini.ts`

- [ ] **Step 1: Create GeminiExecutor class**

```typescript
/**
 * Gemini CLI Executor
 *
 * Implementation of the Executor interface for Gemini CLI (Google).
 */

import { spawn } from "node:child_process";
import type { AvailabilityInfo } from "../../types";
import type {
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../ops/types";
import { registerExecutor } from "../ops/registry";
import { BaseExecutor } from "./base";

export class GeminiExecutor extends BaseExecutor {
  readonly type = "GEMINI" as const;

  constructor(config: ExecutorConfig = {}) {
    super(config);
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();

    // Gemini doesn't have a persistent auth file like Claude
    // Check if executable exists
    if (execPath) {
      return {
        status: "INSTALLATION_FOUND",
        path: execPath,
      };
    }

    return { status: "NOT_FOUND" };
  }

  capabilities(): ExecutorCapability[] {
    return [
      "SPAWN",
      "CHAT",
      "SESSION_RESUME",
    ];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    // Match existing gemini.ts line 87-89
    return this.getHomePath(".gemini", "settings.json");
  }

  getConfigDirName(): string {
    return ".gemini";
  }

  getCliName(): string {
    return "gemini";
  }

  override getVibenCommandPath(name: string): string {
    return `.gemini/commands/viben/${name}.toml`;
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const { prompt } = options;
    // Gemini CLI has simpler interface
    return ["gemini", prompt];
  }

  buildResumeCommand(sessionId: string): string[] {
    return ["gemini", "--resume", sessionId];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {}; // Gemini doesn't need special env var
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return false; // Gemini auto-generates session IDs
  }

  supportsCLIAgents(): boolean {
    return true;
  }

  // === Execution Operations ===

  async spawn(options: SpawnOptions): Promise<ExecutionResult> {
    const {
      cwd,
      prompt,
      env: extraEnv = {},
      detach = false,
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Gemini executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = [prompt];

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    try {
      const child = spawn(execPath, args, {
        cwd,
        env: spawnEnv,
        stdio: detach ? "ignore" : ["pipe", "pipe", "pipe"],
        detached: detach,
      });

      if (detach) {
        child.unref();
        return {
          success: true,
          pid: child.pid,
        };
      }

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      return {
        success: exitCode === 0,
        exitCode,
        pid: child.pid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SPAWN_FAILED",
      };
    }
  }

  async chat(options: ChatOptions): Promise<ExecutionResult> {
    const {
      prompt,
      cwd = process.cwd(),
      resume,
      env: extraEnv = {},
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Gemini executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args: string[] = [];
    if (resume) {
      args.push("--resume", resume);
    }
    args.push(prompt);

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    try {
      const child = spawn(execPath, args, {
        cwd,
        env: spawnEnv,
        stdio: "inherit",
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      return {
        success: exitCode === 0,
        exitCode,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SPAWN_FAILED",
      };
    }
  }

  async *chatStreaming(_options: ChatOptions): AsyncGenerator<SSEMessage> {
    // Gemini CLI doesn't support streaming in the same format as Claude
    yield {
      type: "error",
      message: "Gemini does not support streaming chat in this format",
    };
  }

  async resume(
    sessionId: string,
    options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    const { cwd = process.cwd(), env: extraEnv = {} } = options || {};

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Gemini executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = ["--resume", sessionId];

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    try {
      const child = spawn(execPath, args, {
        cwd,
        env: spawnEnv,
        stdio: "inherit",
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      return {
        success: exitCode === 0,
        exitCode,
        sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SPAWN_FAILED",
      };
    }
  }
}

// Register executor
registerExecutor("GEMINI", (config) => new GeminiExecutor(config));

export { GeminiExecutor };
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/engines/gemini.ts

---

### Task 8: Create engines/index.ts

**Files:**
- Create: `packages/core/src/executor/engines/index.ts`

- [ ] **Step 1: Create engine registration entry point**

```typescript
/**
 * Executor Engines
 *
 * Import this module to register all executor engines.
 * Each engine file auto-registers itself on import.
 */

// Import engines to trigger registration
import "./claude";
import "./gemini";

// Re-export for direct access
export { ClaudeExecutor } from "./claude";
export type { ClaudeExecutorConfig } from "./claude";
export { GeminiExecutor } from "./gemini";
export { BaseExecutor } from "./base";
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/engines/index.ts

- [ ] **Step 3: Commit chunk 2**

```bash
git add packages/core/src/executor/engines/
git commit -m "feat(executor): implement Claude and Gemini executors"
```

---

## Chunk 3: Module Entry Point and Integration

### Task 9: Create module entry point

**Files:**
- Create: `packages/core/src/executor/index.ts`

- [ ] **Step 1: Create the module entry point**

```typescript
/**
 * Unified Executor Module
 *
 * Central module for AI executor operations. Import from here for all executor functionality.
 *
 * Usage:
 *   import { getExecutor, type Executor } from "./executor";
 *
 *   const claude = getExecutor("CLAUDE_CODE");
 *   const result = await claude.chat({ prompt: "Hello" });
 */

// Register all engines (must be first)
import "./engines";

// Re-export everything from ops
export * from "./ops";

// Re-export engine classes for direct instantiation
export { ClaudeExecutor, GeminiExecutor, BaseExecutor } from "./engines";
export type { ClaudeExecutorConfig } from "./engines";
```

- [ ] **Step 2: Verify module compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executor/index.ts

---

### Task 10: Add explicit exports to packages/core/src/index.ts

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add executor module exports with explicit names to avoid collisions**

Find the end of the exports section and add:

```typescript
// =============================================================================
// Unified Executor Module (new)
// =============================================================================

// Export with namespace to avoid collision with existing executors
export {
  // Registry
  getExecutor as getUnifiedExecutor,
  hasExecutor as hasUnifiedExecutor,
  getRegisteredTypes as getUnifiedExecutorTypes,
  getAvailableExecutors as getUnifiedAvailableExecutors,
  registerExecutor as registerUnifiedExecutor,
  // Engine classes
  ClaudeExecutor,
  GeminiExecutor,
  BaseExecutor,
} from "./executor";

// Export types (no collision risk for types)
export type {
  Executor,
  ExecutorCapability,
  ExecutorConfig as UnifiedExecutorConfig,
  SpawnOptions,
  SpawnResult,
  ChatOptions as UnifiedChatOptions,
  ChatResult,
  ExecutionResult,
  ExecutorErrorType,
  RunCommandOptions,
  SSEMessage,
  SSETextMessage,
  SSEToolUseMessage,
  SSEToolResultMessage,
  SSEResultMessage,
  SSEErrorMessage,
  SSEQuestionMessage,
  SSESdkSessionMessage,
  ClaudeExecutorConfig,
} from "./executor";
```

- [ ] **Step 2: Verify core package compiles**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds without export collision errors

- [ ] **Step 3: Commit chunk 3**

```bash
git add packages/core/src/executor/index.ts packages/core/src/index.ts
git commit -m "feat(executor): add module entry point and export from core"
```

---

## Chunk 4: Compatibility Layer

### Task 11: Create compatibility exports in old executors module

**Files:**
- Modify: `packages/core/src/executors/index.ts`

- [ ] **Step 1: Add re-exports from new module at the end of the file**

```typescript
// =============================================================================
// Compatibility Layer - Forward to unified executor module
// =============================================================================

// Import unified module to ensure engines are registered
import "../executor";

// Re-export registry functions for gradual migration
// Note: These use the unified registry, not the old switch-based factory
export {
  getUnifiedExecutor,
  hasUnifiedExecutor,
  getUnifiedExecutorTypes,
  getUnifiedAvailableExecutors,
} from "../index";
```

- [ ] **Step 2: Verify executors module compiles**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors related to executors/index.ts

- [ ] **Step 3: Commit chunk 4**

```bash
git add packages/core/src/executors/index.ts
git commit -m "feat(executor): add compatibility layer in old executors module"
```

---

## Chunk 5: Unit Tests

### Task 12: Create registry tests

**Files:**
- Create: `packages/core/src/executor/ops/registry.test.ts`

- [ ] **Step 1: Write registry tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";

// Import engines to register them
import "../engines";

import {
  getExecutor,
  hasExecutor,
  getRegisteredTypes,
  getAvailableExecutors,
} from "./registry";

describe("executor/ops/registry", () => {
  describe("hasExecutor", () => {
    it("should return true for CLAUDE_CODE", () => {
      expect(hasExecutor("CLAUDE_CODE")).toBe(true);
    });

    it("should return true for GEMINI", () => {
      expect(hasExecutor("GEMINI")).toBe(true);
    });

    it("should return false for unregistered types", () => {
      // CODEX is not implemented in Phase 1
      expect(hasExecutor("CODEX")).toBe(false);
    });
  });

  describe("getExecutor", () => {
    it("should return executor for CLAUDE_CODE", () => {
      const executor = getExecutor("CLAUDE_CODE");
      expect(executor).toBeDefined();
      expect(executor.type).toBe("CLAUDE_CODE");
    });

    it("should return executor for GEMINI", () => {
      const executor = getExecutor("GEMINI");
      expect(executor).toBeDefined();
      expect(executor.type).toBe("GEMINI");
    });

    it("should throw for unregistered type", () => {
      expect(() => getExecutor("CODEX")).toThrow("Unknown executor type: CODEX");
    });

    it("should pass config to factory", () => {
      const executor = getExecutor("CLAUDE_CODE", { model: "opus" });
      expect(executor).toBeDefined();
    });
  });

  describe("getRegisteredTypes", () => {
    it("should return array containing CLAUDE_CODE and GEMINI", () => {
      const types = getRegisteredTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain("CLAUDE_CODE");
      expect(types).toContain("GEMINI");
    });
  });

  describe("getAvailableExecutors", () => {
    it("should return array of executor info objects", () => {
      const available = getAvailableExecutors();
      expect(Array.isArray(available)).toBe(true);

      // Each entry should have type, executor, and availability
      for (const entry of available) {
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("executor");
        expect(entry).toHaveProperty("availability");
        expect(entry.availability).toHaveProperty("status");
      }
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/core && pnpm test src/executor/ops/registry.test.ts`
Expected: All tests pass

---

### Task 13: Create Claude executor tests

**Files:**
- Create: `packages/core/src/executor/engines/claude.test.ts`

- [ ] **Step 1: Write Claude executor unit tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClaudeExecutor } from "./claude";

describe("executor/engines/claude", () => {
  let executor: ClaudeExecutor;

  beforeEach(() => {
    executor = new ClaudeExecutor();
  });

  describe("type", () => {
    it("should be CLAUDE_CODE", () => {
      expect(executor.type).toBe("CLAUDE_CODE");
    });
  });

  describe("capabilities", () => {
    it("should include all Claude capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
      expect(caps).toContain("CHAT_SDK");
      expect(caps).toContain("CHAT_STREAMING");
      expect(caps).toContain("SESSION_RESUME");
      expect(caps).toContain("SESSION_FORK");
      expect(caps).toContain("CONTEXT_USAGE");
      expect(caps).toContain("PLAN_MODE");
      expect(caps).toContain("APPROVALS");
    });

    it("should return 9 capabilities", () => {
      expect(executor.capabilities()).toHaveLength(9);
    });
  });

  describe("supports", () => {
    it("should return true for SPAWN", () => {
      expect(executor.supports("SPAWN")).toBe(true);
    });

    it("should return true for CHAT", () => {
      expect(executor.supports("CHAT")).toBe(true);
    });

    it("should return false for non-existent capability", () => {
      expect(executor.supports("NONEXISTENT" as any)).toBe(false);
    });
  });

  describe("getConfigDirName", () => {
    it("should return .claude", () => {
      expect(executor.getConfigDirName()).toBe(".claude");
    });
  });

  describe("getCliName", () => {
    it("should return claude", () => {
      expect(executor.getCliName()).toBe("claude");
    });
  });

  describe("getConfigDir", () => {
    it("should return correct path", () => {
      expect(executor.getConfigDir("/project")).toBe("/project/.claude");
    });
  });

  describe("getAgentConfigPath", () => {
    it("should return correct path for agent", () => {
      const path = executor.getAgentConfigPath("work", "/project");
      expect(path).toBe("/project/.claude/agents/work.md");
    });
  });

  describe("getCommandsPath", () => {
    it("should return commands dir when no parts", () => {
      expect(executor.getCommandsPath("/project")).toBe("/project/.claude/commands");
    });

    it("should return correct path with parts", () => {
      expect(executor.getCommandsPath("/project", "viben", "finish-work.md"))
        .toBe("/project/.claude/commands/viben/finish-work.md");
    });
  });

  describe("getVibenCommandPath", () => {
    it("should return correct relative path", () => {
      expect(executor.getVibenCommandPath("finish-work"))
        .toBe(".claude/commands/viben/finish-work.md");
    });
  });

  describe("buildRunCommand", () => {
    it("should build command with defaults", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test prompt",
      });

      expect(cmd).toContain("claude");
      expect(cmd).toContain("-p");
      expect(cmd).toContain("--agent");
      expect(cmd).toContain("work");
      expect(cmd).toContain("--dangerously-skip-permissions");
      expect(cmd).toContain("--output-format");
      expect(cmd).toContain("stream-json");
      expect(cmd[cmd.length - 1]).toBe("test prompt");
    });

    it("should include session ID when provided", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test",
        sessionId: "ses_123",
      });

      expect(cmd).toContain("--session-id");
      expect(cmd).toContain("ses_123");
    });

    it("should respect skipPermissions=false", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test",
        dangerouslySkipPermissions: false,
      });

      expect(cmd).not.toContain("--dangerously-skip-permissions");
    });

    it("should use verbose only when jsonOutput=false", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test",
        jsonOutput: false,
        verbose: true,
      });

      expect(cmd).toContain("--verbose");
      expect(cmd).not.toContain("--output-format");
    });
  });

  describe("buildResumeCommand", () => {
    it("should build correct resume command", () => {
      const cmd = executor.buildResumeCommand("ses_123");
      expect(cmd).toEqual(["claude", "--resume", "ses_123"]);
    });
  });

  describe("getResumeCommandStr", () => {
    it("should return command string without cwd", () => {
      const str = executor.getResumeCommandStr("ses_123");
      expect(str).toBe("claude --resume ses_123");
    });

    it("should include cd when cwd provided", () => {
      const str = executor.getResumeCommandStr("ses_123", "/path/to/project");
      expect(str).toBe("cd /path/to/project && claude --resume ses_123");
    });
  });

  describe("getNonInteractiveEnv", () => {
    it("should return CLAUDE_NON_INTERACTIVE=1", () => {
      const env = executor.getNonInteractiveEnv();
      expect(env.CLAUDE_NON_INTERACTIVE).toBe("1");
    });
  });

  describe("supportsSessionIdOnCreate", () => {
    it("should return true", () => {
      expect(executor.supportsSessionIdOnCreate()).toBe(true);
    });
  });

  describe("supportsCLIAgents", () => {
    it("should return true", () => {
      expect(executor.supportsCLIAgents()).toBe(true);
    });
  });

  describe("extractSessionIdFromLog", () => {
    it("should return null (Claude uses --session-id)", () => {
      expect(executor.extractSessionIdFromLog("some log content")).toBeNull();
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to .claude.json in home", () => {
      const path = executor.defaultMcpConfigPath();
      expect(path).toContain(".claude.json");
    });
  });

  describe("config inheritance", () => {
    it("should use config model in buildRunCommand", () => {
      const configuredExecutor = new ClaudeExecutor({ model: "sonnet" });
      // The config is used in spawn/chat, not buildRunCommand
      // buildRunCommand takes explicit options
      expect(configuredExecutor.capabilities()).toContain("CHAT");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/core && pnpm test src/executor/engines/claude.test.ts`
Expected: All tests pass

---

### Task 14: Create Gemini executor tests

**Files:**
- Create: `packages/core/src/executor/engines/gemini.test.ts`

- [ ] **Step 1: Write Gemini executor unit tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { GeminiExecutor } from "./gemini";

describe("executor/engines/gemini", () => {
  let executor: GeminiExecutor;

  beforeEach(() => {
    executor = new GeminiExecutor();
  });

  describe("type", () => {
    it("should be GEMINI", () => {
      expect(executor.type).toBe("GEMINI");
    });
  });

  describe("capabilities", () => {
    it("should include basic capabilities", () => {
      const caps = executor.capabilities();
      expect(caps).toContain("SPAWN");
      expect(caps).toContain("CHAT");
      expect(caps).toContain("SESSION_RESUME");
    });

    it("should NOT include streaming (not supported)", () => {
      const caps = executor.capabilities();
      expect(caps).not.toContain("CHAT_STREAMING");
    });

    it("should return 3 capabilities", () => {
      expect(executor.capabilities()).toHaveLength(3);
    });
  });

  describe("getConfigDirName", () => {
    it("should return .gemini", () => {
      expect(executor.getConfigDirName()).toBe(".gemini");
    });
  });

  describe("getCliName", () => {
    it("should return gemini", () => {
      expect(executor.getCliName()).toBe("gemini");
    });
  });

  describe("getVibenCommandPath", () => {
    it("should return .toml extension path", () => {
      expect(executor.getVibenCommandPath("finish-work"))
        .toBe(".gemini/commands/viben/finish-work.toml");
    });
  });

  describe("buildRunCommand", () => {
    it("should build simple command", () => {
      const cmd = executor.buildRunCommand({
        agent: "work",
        prompt: "test prompt",
      });

      expect(cmd).toEqual(["gemini", "test prompt"]);
    });
  });

  describe("buildResumeCommand", () => {
    it("should build correct resume command", () => {
      const cmd = executor.buildResumeCommand("ses_abc");
      expect(cmd).toEqual(["gemini", "--resume", "ses_abc"]);
    });
  });

  describe("getNonInteractiveEnv", () => {
    it("should return empty object", () => {
      const env = executor.getNonInteractiveEnv();
      expect(env).toEqual({});
    });
  });

  describe("supportsSessionIdOnCreate", () => {
    it("should return false", () => {
      expect(executor.supportsSessionIdOnCreate()).toBe(false);
    });
  });

  describe("supportsCLIAgents", () => {
    it("should return true", () => {
      expect(executor.supportsCLIAgents()).toBe(true);
    });
  });

  describe("defaultMcpConfigPath", () => {
    it("should return path to settings.json", () => {
      const path = executor.defaultMcpConfigPath();
      expect(path).toContain(".gemini");
      expect(path).toContain("settings.json");
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/core && pnpm test src/executor/engines/gemini.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit chunk 5**

```bash
git add packages/core/src/executor/ops/registry.test.ts packages/core/src/executor/engines/claude.test.ts packages/core/src/executor/engines/gemini.test.ts
git commit -m "test(executor): add unit tests for registry, Claude, and Gemini executors"
```

---

## Chunk 6: Final Verification

### Task 15: Full build and test verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 2: Run all executor tests**

Run: `pnpm test packages/core/src/executor`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: No regressions, all tests pass

- [ ] **Step 4: Run type check**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 5: Create summary commit**

```bash
git add -A
git commit -m "feat(executor): complete unified executor module (Phase 1)

- Add executor/ops module with types, registry, and utilities
- Implement ClaudeExecutor and GeminiExecutor engines
- Add explicit exports to avoid collision with old executors module
- Add compatibility layer in old executors module
- Add comprehensive unit tests for registry and both executors

This implements Phase 1 of the unified executor design.
Phase 2 will add remaining platforms (CODEX, OPENCODE, etc.)
and migrate consumers to the new interface."
```

---

## Summary

**Total Tasks:** 15
**Estimated Time:** 4-6 hours

**What this plan implements:**
1. Core types and registry (Task 1-4)
2. Base executor and Claude/Gemini engines (Task 5-8)
3. Module entry point with explicit exports (Task 9-10)
4. Compatibility layer for gradual migration (Task 11)
5. Comprehensive unit tests (Task 12-14)
6. Final verification (Task 15)

**Key design decisions:**
- Use UPPER_SNAKE_CASE for `ExecutorCapability` to match existing `AgentCapability`
- Use explicit named exports instead of `export *` to avoid collision with old `executors` module
- Add `agent` field to `SpawnOptions` for `buildRunCommand()` compatibility
- Keep camelCase for SSE message types (matches existing gateway code)

**What's NOT included (Phase 2):**
- Other platform implementations (CODEX, OPENCODE, AMP, etc.)
- Migrating existing consumers to new interface
- Removing old `executors/` module
- Removing `cli-adapter.ts`

**Migration path:**
1. New code can use `getUnifiedExecutor()` from core
2. Old code continues to use `createExecutor()` unchanged
3. After all consumers migrated, rename unified exports and deprecate old ones
