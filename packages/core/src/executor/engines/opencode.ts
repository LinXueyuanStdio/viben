/**
 * OpenCode Executor
 *
 * Implementation of the Executor interface for OpenCode CLI.
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

/**
 * OpenCode executor configuration
 */
export interface OpencodeExecutorConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

class OpencodeExecutor extends BaseExecutor {
  readonly type = "OPENCODE" as const;

  constructor(config: ExecutorConfig = {}) {
    super(config);
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();
    const configPath = this.defaultMcpConfigPath();

    // Check if config file exists first
    if (configPath && this.checkAuthFile(configPath)) {
      return {
        status: "INSTALLATION_FOUND",
        path: execPath ?? configPath,
      };
    }

    // Fall back to checking executable
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
      "SESSION_RESUME",
      "SESSION_FORK",
      "CONTEXT_USAGE",
    ];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".opencode", "config.json");
  }

  getConfigDirName(): string {
    return ".opencode";
  }

  getCliName(): string {
    return "opencode";
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const { prompt } = options;
    const args = ["opencode", "--prompt", prompt];

    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    return args;
  }

  buildResumeCommand(sessionId: string): string[] {
    const args = ["opencode", "--session", sessionId];

    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    return args;
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {}; // OpenCode doesn't need special env var for non-interactive mode
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return false; // OpenCode auto-generates session IDs
  }

  supportsCLIAgents(): boolean {
    return false;
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
        error: "OpenCode executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = ["--prompt", prompt];

    if (this.config.model) {
      args.push("--model", this.config.model);
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
        error: "OpenCode executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args: string[] = ["--prompt", prompt];

    if (resume) {
      args.push("--session", resume);
    }

    if (this.config.model) {
      args.push("--model", this.config.model);
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
    // OpenCode doesn't support streaming chat
    yield {
      type: "error",
      message: "Opencode does not support streaming chat",
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
        error: "OpenCode executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = ["--session", sessionId];

    if (this.config.model) {
      args.push("--model", this.config.model);
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
}

// Register executor
registerExecutor("OPENCODE", (config) => new OpencodeExecutor(config));

export { OpencodeExecutor };
