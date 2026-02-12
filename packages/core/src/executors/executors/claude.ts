/**
 * Claude Code executor (Anthropic)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CommandBuilder } from "../command";
import type {
  ExecutorConfig,
  SpawnedChild,
  ExecutionEnv,
  ExecutorApprovalService,
  StandardCodingAgentExecutor,
  AgentCapability,
  AvailabilityInfo,
  ChatOptions,
  ChatSpawnResult,
} from "../types";
import { ExecutorError } from "../../error";
import { which, whichSync } from "../utils";

/**
 * Base command for Claude Code
 */
const BASE_COMMAND = "npx -y @anthropic-ai/claude-code@latest";

/**
 * Claude Code executor configuration
 */
export interface ClaudeCodeConfig extends ExecutorConfig {
  /** Enable plan mode */
  planMode?: boolean;
  /** Enable approvals mode */
  approvals?: boolean;
}

/**
 * Claude Code executor
 */
export class ClaudeCode implements StandardCodingAgentExecutor {
  readonly type = "CLAUDE_CODE" as const;
  private config: ClaudeCodeConfig;
  private approvalsService?: ExecutorApprovalService;

  constructor(config: ClaudeCodeConfig = {}) {
    this.config = config;
  }

  useApprovals(approvals: ExecutorApprovalService): void {
    this.approvalsService = approvals;
  }

  async spawn(
    currentDir: string,
    prompt: string,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    const commandParts = this.buildCommandParts();

    return this.spawnInternal(currentDir, prompt, commandParts, env);
  }

  async spawnFollowUp(
    currentDir: string,
    prompt: string,
    sessionId: string,
    _resetToMessageId: string | undefined,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    const commandParts = this.buildCommandParts();
    commandParts.args.push("--resume", sessionId);

    return this.spawnInternal(currentDir, prompt, commandParts, env);
  }

  defaultMcpConfigPath(): string | null {
    return join(homedir(), ".claude.json");
  }

  getAvailabilityInfo(): AvailabilityInfo {
    const authFile = join(homedir(), ".claude.json");
    const execPath = whichSync("claude");

    if (existsSync(authFile)) {
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

  capabilities(): AgentCapability[] {
    return ["SESSION_FORK", "CONTEXT_USAGE"];
  }

  /**
   * Check if this executor supports non-interactive chat mode
   */
  supportsChat(): boolean {
    return true;
  }

  /**
   * Get the CLI command name used for chat
   */
  getChatCommand(): string {
    return "claude";
  }

  /**
   * Spawn a non-interactive chat process with transparent I/O streaming.
   * Uses stdio inherit for direct pass-through experience.
   */
  async spawnChat(options: ChatOptions): Promise<ChatSpawnResult> {
    const {
      prompt,
      cwd = process.cwd(),
      inputFormat = "text",
      outputFormat = "text",
      verbose = false,
      sessionId,
      resume,
      model,
      dangerouslySkipPermissions = false,
      env: extraEnv = {},
    } = options;

    // Resolve claude command path
    const programPath = await which("claude");
    if (!programPath) {
      throw ExecutorError.executableNotFound("claude");
    }

    // Build command arguments
    const args: string[] = ["-p"];

    // For text input format, prompt is passed as argument
    // For stream-json, prompt is sent via stdin
    if (inputFormat === "text" && prompt) {
      args.push(prompt);
    }

    // Format arguments
    if (inputFormat !== "text") {
      args.push("--input-format", inputFormat);
    }
    if (outputFormat !== "text") {
      args.push("--output-format", outputFormat);
    }

    // Optional arguments
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
    if (dangerouslySkipPermissions || this.config.dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    // Merge environment variables
    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
    };

    // Spawn with inherited stdio for transparent pass-through
    const child = spawn(programPath, args, {
      cwd,
      env: spawnEnv,
      stdio: "inherit",
    });

    // Create exit promise
    const exitPromise = new Promise<number>((resolve, reject) => {
      child.on("exit", (code) => {
        resolve(code ?? 1);
      });
      child.on("error", (err) => {
        reject(err);
      });
    });

    return { child, exitPromise };
  }

  private buildCommandParts() {
    const baseCmd = this.config.baseCommandOverride || BASE_COMMAND;

    let builder = CommandBuilder.new(baseCmd).addParams("-p");

    // Permission settings
    const planMode = this.config.planMode ?? false;
    const approvals = this.config.approvals ?? false;

    if (planMode || approvals) {
      builder = builder.extendParams([
        "--permission-prompt-tool=stdio",
        "--permission-mode=bypass",
      ]);
    }

    if (this.config.dangerouslySkipPermissions) {
      builder = builder.extendParams(["--dangerously-skip-permissions"]);
    }

    // Model selection
    if (this.config.model) {
      builder = builder.extendParams(["--model", this.config.model]);
    }

    // Output format for structured communication
    builder = builder.extendParams([
      "--verbose",
      "--output-format=stream-json",
      "--input-format=stream-json",
      "--include-partial-messages",
      "--replay-user-messages",
    ]);

    return builder.buildInitial();
  }

  private async spawnInternal(
    currentDir: string,
    _prompt: string,
    commandParts: { program: string; args: string[]; env: Record<string, string> },
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    // Parse the program and resolve path
    const programParts = commandParts.program.split(/\s+/);
    const program = programParts[0];

    // Resolve program path
    const programPath = await which(program);
    if (!programPath) {
      throw ExecutorError.executableNotFound(program);
    }

    // Build full args including remaining parts of base command
    const fullArgs = [...programParts.slice(1), ...commandParts.args];

    // Merge environment variables
    const spawnEnv = {
      ...process.env,
      ...env.vars,
      ...commandParts.env,
      ...(this.config.env || {}),
      NPM_CONFIG_LOGLEVEL: "error",
    };

    const child = spawn(programPath, fullArgs, {
      cwd: currentDir,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // NOTE: When using --input-format=stream-json, the prompt should NOT be passed as a CLI argument.
    // Instead, the user message must be sent via stdin after the process spawns.
    // Format: {"type":"user","message":{"role":"user","content":"..."}}

    return { child };
  }
}

/**
 * Create a Claude Code executor
 */
export function createClaudeCode(config?: ClaudeCodeConfig): ClaudeCode {
  return new ClaudeCode(config);
}
