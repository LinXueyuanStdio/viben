/**
 * Codex Executor (OpenAI)
 *
 * Implementation of the Executor interface for OpenAI Codex CLI.
 *
 * Command structure:
 * - Interactive: codex [OPTIONS] [PROMPT]
 * - Non-interactive: codex exec [OPTIONS] [PROMPT]
 * - Resume: codex resume [OPTIONS] [SESSION_ID] [PROMPT]
 * - Non-interactive resume: codex exec resume [OPTIONS] [SESSION_ID]
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
import { whichSync, fileExists, joinPath, getHomeDir } from "../ops/utils";

/**
 * Base command for Codex CLI - using the official @openai/codex package
 */
const BASE_COMMAND = "npx";
const CODEX_PACKAGE = "@openai/codex";

/**
 * Codex executor configuration
 */
export interface CodexExecutorConfig extends ExecutorConfig {
  /** Model to use (e.g., "o3", "gpt-5-codex") */
  model?: string;
  /** Configuration profile from config.toml */
  profile?: string;
  /** Sandbox mode: "read-only", "workspace-write", "danger-full-access" */
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  /** Enable full-auto mode (--full-auto: -a on-request, --sandbox workspace-write) */
  fullAuto?: boolean;
  /** Skip all confirmation prompts (--dangerously-bypass-approvals-and-sandbox) */
  dangerouslyBypassApprovalsAndSandbox?: boolean;
}

export class CodexExecutor extends BaseExecutor {
  readonly type = "CODEX" as const;
  protected override config: CodexExecutorConfig;

  constructor(config: CodexExecutorConfig = {}) {
    super(config);
    this.config = config;
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    // Codex can be run via npx without local installation
    const npxPath = whichSync("npx");
    const codexPath = whichSync("codex");
    const configPath = this.defaultMcpConfigPath();

    // Check if config exists (indicates setup)
    if (configPath && fileExists(configPath)) {
      return {
        status: "INSTALLATION_FOUND",
        path: codexPath ?? npxPath ?? configPath,
      };
    }

    // Check for local codex installation
    if (codexPath) {
      return {
        status: "INSTALLATION_FOUND",
        path: codexPath,
      };
    }

    // npx is available, so codex can be run
    if (npxPath) {
      return {
        status: "INSTALLATION_FOUND",
        path: npxPath,
      };
    }

    return { status: "NOT_FOUND" };
  }

  capabilities(): ExecutorCapability[] {
    return [
      "SPAWN",
      "CHAT",
      "SESSION_RESUME",
      "SESSION_FORK",
      "CONTEXT_USAGE",
    ];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return joinPath(getHomeDir(), "codex", "config.json");
  }

  getConfigDirName(): string {
    return "codex";
  }

  getCliName(): string {
    return "codex";
  }

  // === Command Building ===

  buildRunCommand(options: RunCommandOptions): string[] {
    const {
      agent,
      prompt,
      sessionId,
      dangerouslySkipPermissions = false,
      verbose = false,
      jsonOutput = true,
    } = options;

    // Codex uses exec for non-interactive mode
    const cmd = ["codex", "exec"];

    // Add model if configured
    if (this.config.model) {
      cmd.push("-m", this.config.model);
    }

    // Add profile if configured
    if (this.config.profile) {
      cmd.push("-p", this.config.profile);
    }

    // Add sandbox mode if configured
    if (this.config.sandbox) {
      cmd.push("-s", this.config.sandbox);
    }

    // Add full-auto mode
    if (this.config.fullAuto) {
      cmd.push("--full-auto");
    }

    // Handle dangerous bypass (maps to codex's flag)
    if (dangerouslySkipPermissions || this.config.dangerouslyBypassApprovalsAndSandbox) {
      cmd.push("--dangerously-bypass-approvals-and-sandbox");
    }

    // Add JSON output for programmatic parsing
    if (jsonOutput) {
      cmd.push("--json");
    }

    // Note: Codex doesn't support --agent flag like Claude
    // Agent name could be passed via prompt prefix if needed
    if (agent) {
      // Include agent context in prompt
      cmd.push(`[Agent: ${agent}] ${prompt}`);
    } else {
      cmd.push(prompt);
    }

    return cmd;
  }

  buildResumeCommand(sessionId: string): string[] {
    const cmd = ["codex", "resume"];

    // Add model if configured
    if (this.config.model) {
      cmd.push("-m", this.config.model);
    }

    // Add full-auto mode
    if (this.config.fullAuto) {
      cmd.push("--full-auto");
    } else if (this.config.dangerouslyBypassApprovalsAndSandbox) {
      cmd.push("--dangerously-bypass-approvals-and-sandbox");
    }

    cmd.push(sessionId);
    return cmd;
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {
      NPM_CONFIG_LOGLEVEL: "error",
    };
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    // Codex generates session IDs internally
    return false;
  }

  supportsCLIAgents(): boolean {
    // Codex doesn't have built-in agent support like Claude
    return false;
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
      dangerouslySkipPermissions = this.config.dangerouslyBypassApprovalsAndSandbox,
      verbose = false,
      jsonOutput = true,
      detach = false,
    } = options;

    const npxPath = whichSync("npx");
    if (!npxPath) {
      return {
        success: false,
        error: "npx executable not found",
        errorType: "NOT_FOUND",
      };
    }

    // Build arguments: npx -y @openai/codex exec [OPTIONS] [PROMPT]
    const args: string[] = ["-y", CODEX_PACKAGE, "exec"];

    // Add model option
    if (model || this.config.model) {
      args.push("-m", model || this.config.model!);
    }

    // Add profile if configured
    if (this.config.profile) {
      args.push("-p", this.config.profile);
    }

    // Add sandbox mode if configured
    if (this.config.sandbox) {
      args.push("-s", this.config.sandbox);
    }

    // Add full-auto mode
    if (this.config.fullAuto) {
      args.push("--full-auto");
    }

    // Handle dangerous bypass
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    // Add JSON output for programmatic parsing
    if (jsonOutput) {
      args.push("--json");
    }

    // Add prompt (with optional agent prefix)
    if (agent) {
      args.push(`[Agent: ${agent}] ${prompt}`);
    } else {
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
      const child = spawn(npxPath, args, {
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

  async chat(options: ChatOptions): Promise<ExecutionResult> {
    const {
      prompt,
      cwd = process.cwd(),
      verbose = false,
      sessionId,
      resume,
      model,
      dangerouslySkipPermissions = this.config.dangerouslyBypassApprovalsAndSandbox,
      env: extraEnv = {},
    } = options;

    const npxPath = whichSync("npx");
    if (!npxPath) {
      return {
        success: false,
        error: "npx executable not found",
        errorType: "NOT_FOUND",
      };
    }

    const args: string[] = ["-y", CODEX_PACKAGE];

    if (resume || sessionId) {
      // Resume existing session: codex resume [OPTIONS] [SESSION_ID] [PROMPT]
      args.push("resume");

      // Add model option
      if (model || this.config.model) {
        args.push("-m", model || this.config.model!);
      }

      // Add full-auto for non-interactive
      if (this.config.fullAuto) {
        args.push("--full-auto");
      } else if (dangerouslySkipPermissions) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }

      // Session ID
      args.push(resume || sessionId!);

      // Optional prompt for the resumed session
      if (prompt) {
        args.push(prompt);
      }
    } else {
      // New session: npx -y @openai/codex exec [OPTIONS] [PROMPT]
      args.push("exec");

      if (model || this.config.model) {
        args.push("-m", model || this.config.model!);
      }

      // Add full-auto mode
      if (this.config.fullAuto) {
        args.push("--full-auto");
      } else if (dangerouslySkipPermissions) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }

      if (prompt) {
        args.push(prompt);
      }
    }

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
      ...this.getNonInteractiveEnv(),
    };

    try {
      const child = spawn(npxPath, args, {
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
        sessionId: resume || sessionId,
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
      dangerouslySkipPermissions = this.config.dangerouslyBypassApprovalsAndSandbox,
      env: extraEnv = {},
    } = options;

    const npxPath = whichSync("npx");
    if (!npxPath) {
      yield {
        type: "error",
        message: "npx executable not found",
      };
      return;
    }

    const args: string[] = ["-y", CODEX_PACKAGE];

    if (resume || sessionId) {
      // Resume with exec for non-interactive streaming: codex exec resume [OPTIONS] [SESSION_ID]
      args.push("exec", "resume");

      if (model || this.config.model) {
        args.push("-m", model || this.config.model!);
      }

      if (this.config.fullAuto) {
        args.push("--full-auto");
      } else if (dangerouslySkipPermissions) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }

      // Add JSON output for streaming
      args.push("--json");

      args.push(resume || sessionId!);
    } else {
      // Non-interactive with JSON output: codex exec [OPTIONS] [PROMPT]
      args.push("exec");

      if (model || this.config.model) {
        args.push("-m", model || this.config.model!);
      }

      if (this.config.fullAuto) {
        args.push("--full-auto");
      } else if (dangerouslySkipPermissions) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }

      // Add JSON output for streaming
      args.push("--json");

      if (prompt) {
        args.push(prompt);
      }
    }

    const spawnEnv: Record<string, string | undefined> = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
      ...this.getNonInteractiveEnv(),
    };

    // Inject follow-up prompt as env var when resuming with a prompt
    if ((resume || sessionId) && prompt) {
      spawnEnv.CODEX_FOLLOWUP_PROMPT = prompt;
    }

    const child = spawn(npxPath, args, {
      cwd,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

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
              // Map Codex JSON output to SSEMessage format
              yield this.mapToSSEMessage(parsed);
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
          yield this.mapToSSEMessage(parsed);
        } catch {
          // Skip
        }
      }
    }
  }

  /**
   * Map Codex JSON output to SSEMessage format
   */
  private mapToSSEMessage(parsed: unknown): SSEMessage {
    // Codex output format may differ from Claude
    // This provides a basic mapping
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;

      if (obj.type === "message" && typeof obj.content === "string") {
        return { type: "text", content: obj.content };
      }

      if (obj.type === "tool_call" || obj.type === "tool_use") {
        return {
          type: "tool_use",
          id: String(obj.id || ""),
          name: String(obj.name || ""),
          input: obj.input || obj.arguments || {},
        };
      }

      if (obj.type === "tool_result") {
        return {
          type: "tool_result",
          tool_use_id: String(obj.tool_use_id || obj.id || ""),
          output: String(obj.output || obj.result || ""),
          is_error: Boolean(obj.is_error || obj.error),
        };
      }

      if (obj.type === "error") {
        return {
          type: "error",
          message: String(obj.message || obj.error || "Unknown error"),
        };
      }

      if (obj.type === "result" || obj.type === "done") {
        return {
          type: "result",
          subtype: obj.success === false ? "error" : "success",
        };
      }
    }

    // Default: treat as text content
    return {
      type: "text",
      content: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
    };
  }

  async resume(
    sessionId: string,
    options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    const {
      cwd = process.cwd(),
      env: extraEnv = {},
    } = options || {};

    const npxPath = whichSync("npx");
    if (!npxPath) {
      return {
        success: false,
        error: "npx executable not found",
        errorType: "NOT_FOUND",
      };
    }

    // Build resume command: npx -y @openai/codex resume [OPTIONS] [SESSION_ID]
    const args: string[] = ["-y", CODEX_PACKAGE, "resume"];

    if (this.config.model) {
      args.push("-m", this.config.model);
    }

    if (this.config.fullAuto) {
      args.push("--full-auto");
    } else if (this.config.dangerouslyBypassApprovalsAndSandbox) {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }

    args.push(sessionId);

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
      ...this.getNonInteractiveEnv(),
    };

    try {
      const child = spawn(npxPath, args, {
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
registerExecutor("CODEX", (config) => new CodexExecutor(config as CodexExecutorConfig));
