/**
 * Claude Code Executor
 *
 * Implementation of the Executor interface for Claude Code (Anthropic).
 */

import { spawn } from "node:child_process";
import type { AcpPermissionMode, AvailabilityInfo } from "../../types";
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
  /** Permission mode for Claude tool handling */
  permissionMode?: AcpPermissionMode;
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

    if (this.config.permissionMode === "bypassPermissions") {
      args.push("--dangerously-skip-permissions");
    } else if (this.config.permissionMode === "auto") {
      args.push("--permission-prompt-tool", "stdio");
      args.push("--permission-mode", "auto");
    }
    // "default" mode: no extra flags needed, uses default permission behavior

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
      NPM_CONFIG_LOGLEVEL: "error",
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

      // Capture stderr for error reporting
      let stderr = "";
      if (child.stderr) {
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });
      }

      // Wait for completion
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", reject);
      });

      if (exitCode !== 0) {
        return {
          success: false,
          exitCode,
          sessionId,
          pid: child.pid,
          error: stderr.trim() || `Process exited with code ${exitCode}`,
          errorType: "PROCESS_CRASHED",
        };
      }

      return {
        success: true,
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
      "--include-partial-messages",
      "--replay-user-messages",
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
      NPM_CONFIG_LOGLEVEL: "error",
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

// Register executor
registerExecutor("CLAUDE_CODE", (config) => new ClaudeExecutor(config as ClaudeExecutorConfig));
