/**
 * Amp CLI Executor
 *
 * Implementation of the Executor interface for Amp CLI (Sourcegraph).
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
 * Amp executor configuration
 */
export interface AmpExecutorConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

class AmpExecutor extends BaseExecutor {
  readonly type = "AMP" as const;
  protected override config: AmpExecutorConfig;

  constructor(config: AmpExecutorConfig = {}) {
    super(config);
    this.config = config;
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();
    const configPath = this.defaultMcpConfigPath();

    // Check if config file exists
    if (configPath && this.checkAuthFile(configPath)) {
      return {
        status: "INSTALLATION_FOUND",
        path: execPath ?? configPath,
      };
    }

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
    return ["SPAWN", "SESSION_RESUME", "SESSION_FORK"];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".amp", "config.json");
  }

  getConfigDirName(): string {
    return ".amp";
  }

  getCliName(): string {
    return "amp";
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const { prompt } = options;
    const args = ["amp", "--prompt", prompt];

    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    return args;
  }

  buildResumeCommand(sessionId: string): string[] {
    const args = ["amp", "--session", sessionId];

    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    return args;
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {}; // Amp doesn't need special env var
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return false; // Amp auto-generates session IDs
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
        error: "Amp executable not found",
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
        error: "Amp executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args: string[] = [];
    if (resume) {
      args.push("--session", resume);
    }
    args.push("--prompt", prompt);

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
    // Amp CLI doesn't support streaming chat
    yield {
      type: "error",
      message: "Amp does not support streaming chat",
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
        error: "Amp executable not found",
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
registerExecutor("AMP", (config) => new AmpExecutor(config as AmpExecutorConfig));

export { AmpExecutor };
