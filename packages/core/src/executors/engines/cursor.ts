/**
 * Cursor Agent Executor
 *
 * Implementation of the Executor interface for Cursor Agent.
 * Note: Cursor Agent doesn't support session resume.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
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
 * Cursor Agent executor configuration
 */
interface CursorAgentExecutorConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

/**
 * Get config directory based on platform (for Cursor app config)
 */
function getAppConfigDir(): string {
  const home = homedir();

  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support");
    case "win32":
      return process.env.APPDATA || join(home, "AppData", "Roaming");
    default:
      return process.env.XDG_CONFIG_HOME || join(home, ".config");
  }
}

export class CursorAgentExecutor extends BaseExecutor {
  readonly type = "CURSOR_AGENT" as const;

  constructor(config: CursorAgentExecutorConfig = {}) {
    super(config);
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();
    const configPath = this.defaultMcpConfigPath();

    // Check if config file exists (Cursor installation indicator)
    if (configPath && existsSync(configPath)) {
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
    return ["SPAWN"];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return join(getAppConfigDir(), "Cursor", "User", "settings.json");
  }

  getConfigDirName(): string {
    return "Cursor";
  }

  getCliName(): string {
    return "cursor";
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const { prompt } = options;
    const args = ["--prompt", prompt];

    const config = this.config as CursorAgentExecutorConfig;
    if (config.model) {
      args.unshift("--model", config.model);
    }

    return ["cursor", ...args];
  }

  buildResumeCommand(_sessionId: string): string[] {
    // Cursor doesn't support session resume
    return ["cursor"];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {}; // Cursor doesn't need special env var
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
        error: "Cursor executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = ["--prompt", prompt];

    const config = this.config as CursorAgentExecutorConfig;
    if (config.model) {
      args.unshift("--model", config.model);
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
      env: extraEnv = {},
    } = options;

    const execPath = this.getExecutablePath();
    if (!execPath) {
      return {
        success: false,
        error: "Cursor executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args = ["--prompt", prompt];

    const config = this.config as CursorAgentExecutorConfig;
    if (config.model) {
      args.unshift("--model", config.model);
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
      message: "CursorAgent does not support streaming chat",
    };
  }

  async resume(
    _sessionId: string,
    _options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    return {
      success: false,
      error: "CursorAgent doesn't support session resume",
      errorType: "INVALID_CONFIG",
    };
  }
}

// Register executor
registerExecutor("CURSOR_AGENT", (config) => new CursorAgentExecutor(config));

export type { CursorAgentExecutorConfig };
