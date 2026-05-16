/**
 * GitHub Copilot Executor
 *
 * Implementation of the Executor interface for GitHub Copilot CLI.
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
 * Copilot executor configuration
 */
export interface CopilotExecutorConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

class CopilotExecutor extends BaseExecutor {
  readonly type = "COPILOT" as const;
  protected override config: CopilotExecutorConfig;

  constructor(config: CopilotExecutorConfig = {}) {
    super(config);
    this.config = config;
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();

    if (execPath) {
      return {
        status: "INSTALLATION_FOUND",
        path: execPath,
      };
    }

    return { status: "NOT_FOUND" };
  }

  capabilities(): ExecutorCapability[] {
    return ["SPAWN"];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".config", "gh-copilot", "config.json");
  }

  getConfigDirName(): string {
    return ".config/gh-copilot";
  }

  getCliName(): string {
    return "gh";
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const { prompt } = options;
    // gh copilot suggest requires -t flag for shell type
    const args = ["gh", "copilot", "suggest", "-t", "shell", prompt];

    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    return args;
  }

  buildResumeCommand(_sessionId: string): string[] {
    // Copilot doesn't support session resume
    return ["gh", "copilot", "suggest"];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {};
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return false;
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
        error: "GitHub CLI (gh) executable not found",
        errorType: "NOT_FOUND",
      };
    }

    // gh copilot suggest requires -t flag for shell type
    const args = ["copilot", "suggest", "-t", "shell", prompt];

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

      // Capture stderr for error reporting
      let stderr = "";
      if (child.stderr) {
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });
      }

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      if (exitCode !== 0) {
        return {
          success: false,
          exitCode,
          pid: child.pid,
          error: stderr.trim() || `Process exited with code ${exitCode}`,
          errorType: "PROCESS_CRASHED",
        };
      }

      return {
        success: true,
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
      env: extraEnv = {},
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "GitHub CLI (gh) executable not found",
        errorType: "NOT_FOUND",
      };
    }

    // gh copilot suggest requires -t flag for shell type
    const args = ["copilot", "suggest", "-t", "shell", prompt];

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
    yield {
      type: "error",
      message: "GitHub Copilot does not support streaming chat",
    };
  }

  async resume(
    _sessionId: string,
    _options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    return {
      success: false,
      error: "GitHub Copilot does not support session resume",
      errorType: "INVALID_CONFIG",
    };
  }
}

// Register executor
registerExecutor("COPILOT", (config) => new CopilotExecutor(config));

export { CopilotExecutor };
