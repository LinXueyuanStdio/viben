/**
 * Codex executor (OpenAI)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CommandBuilder } from "../command";
import { getConfigDir } from "../utils";
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
 * Codex CLI command - using the official @openai/codex package
 *
 * Command structure:
 * - Interactive: codex [OPTIONS] [PROMPT]
 * - Non-interactive: codex exec [OPTIONS] [PROMPT]
 * - Resume: codex resume [OPTIONS] [SESSION_ID] [PROMPT]
 * - Non-interactive resume: codex exec resume [OPTIONS] [SESSION_ID]
 */
const BASE_COMMAND = "npx -y @openai/codex";

/**
 * Codex executor configuration
 */
export interface CodexConfig extends ExecutorConfig {
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

/**
 * Codex executor
 */
export class Codex implements StandardCodingAgentExecutor {
  readonly type = "CODEX" as const;
  private config: CodexConfig;
  private approvalsService?: ExecutorApprovalService;

  constructor(config: CodexConfig = {}) {
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
    // Build command: codex exec [OPTIONS] [PROMPT]
    let builder = CommandBuilder.new(this.config.baseCommandOverride || BASE_COMMAND)
      .addParams("exec");

    // Add options before prompt
    builder = this.addCommonOptions(builder);

    // Add JSON output for programmatic parsing
    builder = builder.addParams("--json");

    // Prompt must be the last argument
    builder = builder.addParams(prompt);

    const commandParts = builder.buildInitial();

    // Parse the program and resolve path
    const programParts = commandParts.program.split(/\s+/);
    const program = programParts[0];

    const programPath = await which(program);
    if (!programPath) {
      throw ExecutorError.executableNotFound(program);
    }

    const fullArgs = [...programParts.slice(1), ...commandParts.args];

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

    return { child };
  }

  /**
   * Add common CLI options to the command builder
   */
  private addCommonOptions(builder: CommandBuilder): CommandBuilder {
    if (this.config.model) {
      builder = builder.addParams("-m", this.config.model);
    }

    if (this.config.profile) {
      builder = builder.addParams("-p", this.config.profile);
    }

    if (this.config.sandbox) {
      builder = builder.addParams("-s", this.config.sandbox);
    }

    if (this.config.fullAuto) {
      builder = builder.addParams("--full-auto");
    }

    if (this.config.dangerouslyBypassApprovalsAndSandbox) {
      builder = builder.addParams("--dangerously-bypass-approvals-and-sandbox");
    }

    return builder;
  }

  async spawnFollowUp(
    currentDir: string,
    prompt: string,
    sessionId: string,
    _resetToMessageId: string | undefined,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    // Build command: codex exec resume [OPTIONS] [SESSION_ID]
    // Note: exec resume doesn't support additional prompt, it just continues the session
    let builder = CommandBuilder.new(this.config.baseCommandOverride || BASE_COMMAND)
      .addParams("exec", "resume");

    // Add options
    builder = this.addCommonOptions(builder);

    // Add JSON output for programmatic parsing
    builder = builder.addParams("--json");

    // Session ID as positional argument
    builder = builder.addParams(sessionId);

    const commandParts = builder.buildInitial();

    const programParts = commandParts.program.split(/\s+/);
    const program = programParts[0];

    const programPath = await which(program);
    if (!programPath) {
      throw ExecutorError.executableNotFound(program);
    }

    const fullArgs = [...programParts.slice(1), ...commandParts.args];

    const spawnEnv = {
      ...process.env,
      ...env.vars,
      ...commandParts.env,
      ...(this.config.env || {}),
      NPM_CONFIG_LOGLEVEL: "error",
      // Pass the prompt as environment variable for the session to pick up
      CODEX_FOLLOWUP_PROMPT: prompt,
    };

    const child = spawn(programPath, fullArgs, {
      cwd: currentDir,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return { child };
  }

  defaultMcpConfigPath(): string | null {
    return join(getConfigDir(), "codex", "config.json");
  }

  getAvailabilityInfo(): AvailabilityInfo {
    const programPath = whichSync("codex");
    const configPath = this.defaultMcpConfigPath();

    if (configPath && existsSync(configPath)) {
      return { status: "INSTALLATION_FOUND", path: programPath ?? configPath };
    }
    if (programPath) {
      return { status: "INSTALLATION_FOUND", path: programPath };
    }
    return { status: "NOT_FOUND" };
  }

  capabilities(): AgentCapability[] {
    return ["SESSION_FORK", "SETUP_HELPER", "CONTEXT_USAGE"];
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
    return "codex";
  }

  /**
   * Spawn a non-interactive chat process with transparent I/O streaming.
   *
   * Uses `codex exec` for non-interactive execution or `codex resume` for continuing sessions.
   */
  async spawnChat(options: ChatOptions): Promise<ChatSpawnResult> {
    const {
      prompt,
      cwd = process.cwd(),
      verbose = false,
      sessionId,
      model,
      env: extraEnv = {},
    } = options;

    const programPath = await which("npx");
    if (!programPath) {
      throw ExecutorError.executableNotFound("npx");
    }

    const args: string[] = ["-y", "@openai/codex"];

    if (sessionId) {
      // Resume existing session: codex resume [OPTIONS] [SESSION_ID] [PROMPT]
      args.push("resume");

      // Add model option if specified
      if (model || this.config.model) {
        args.push("-m", model || this.config.model!);
      }

      // Add full-auto for non-interactive
      if (this.config.fullAuto) {
        args.push("--full-auto");
      } else if (this.config.dangerouslyBypassApprovalsAndSandbox) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }

      // Session ID
      args.push(sessionId);

      // Optional prompt for the resumed session
      if (prompt) {
        args.push(prompt);
      }
    } else {
      // New non-interactive session: codex exec [OPTIONS] [PROMPT]
      args.push("exec");

      // Add model option if specified
      if (model || this.config.model) {
        args.push("-m", model || this.config.model!);
      }

      // Add full-auto for non-interactive
      if (this.config.fullAuto) {
        args.push("--full-auto");
      } else if (this.config.dangerouslyBypassApprovalsAndSandbox) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
      }

      // Add prompt
      if (prompt) {
        args.push(prompt);
      }
    }

    // Note: Codex CLI doesn't have a --verbose flag, but we can use config overrides
    if (verbose) {
      // Could add debug config if needed in the future
    }

    const spawnEnv = {
      ...process.env,
      ...this.config.env,
      ...extraEnv,
      NPM_CONFIG_LOGLEVEL: "error",
    };

    const child = spawn(programPath, args, {
      cwd,
      env: spawnEnv,
      stdio: "inherit",
    });

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
}

export function createCodex(config?: CodexConfig): Codex {
  return new Codex(config);
}
