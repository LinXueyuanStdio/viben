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

/**
 * Gemini CLI specific configuration
 */
export interface GeminiExecutorConfig extends ExecutorConfig {
  /** Model to use (e.g., "gemini-2.5-pro") */
  model?: string;
  /** Sandbox mode (e.g., docker, none) */
  sandbox?: string;
  /** Yolo mode - skip all confirmations */
  yolo?: boolean;
}

class GeminiExecutor extends BaseExecutor {
  protected override config: GeminiExecutorConfig;
  readonly type = "GEMINI" as const;

  constructor(config: GeminiExecutorConfig = {}) {
    super(config);
    this.config = config;
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
    return ["SPAWN", "CHAT"];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".gemini", "config.json");
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
    const args = ["gemini", "--prompt", prompt];
    if (this.config.model) {
      args.push("--model", this.config.model);
    }
    return args;
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {}; // Gemini doesn't need special env var
  }

  buildResumeCommand(_sessionId: string): string[] {
    return ["gemini"]; // Gemini doesn't support session resume
  }

  async resume(_sessionId: string, _options?: Partial<SpawnOptions>): Promise<ExecutionResult> {
    return {
      success: false,
      error: "Gemini does not support session resume",
      errorType: "INVALID_CONFIG",
    };
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
        error: "Gemini executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args: string[] = ["--prompt", prompt];
    if (this.config.model || options.model) {
      args.push("--model", options.model || this.config.model!);
    }
    if (options.outputFormat === "stream-json") {
      args.push("--output-format", "json");
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

      return { success: exitCode === 0, exitCode };
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

}

// Register executor
registerExecutor("GEMINI", (config) => new GeminiExecutor(config as GeminiExecutorConfig));

export { GeminiExecutor };
