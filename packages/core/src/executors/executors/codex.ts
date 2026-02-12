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
import { which } from "../utils";

const BASE_COMMAND = "npx -y codex-cli@latest";

/**
 * Codex executor configuration
 */
export interface CodexConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
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
    let builder = CommandBuilder.new(this.config.baseCommandOverride || BASE_COMMAND)
      .addParams("--prompt", prompt);

    if (this.config.model) {
      builder = builder.addParams("--model", this.config.model);
    }

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

  async spawnFollowUp(
    currentDir: string,
    prompt: string,
    sessionId: string,
    _resetToMessageId: string | undefined,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    let builder = CommandBuilder.new(this.config.baseCommandOverride || BASE_COMMAND)
      .addParams("--prompt", prompt)
      .addParams("--session", sessionId);

    if (this.config.model) {
      builder = builder.addParams("--model", this.config.model);
    }

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
    const configPath = this.defaultMcpConfigPath();
    if (configPath && existsSync(configPath)) {
      return { status: "INSTALLATION_FOUND" };
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

    const args: string[] = ["-y", "codex-cli@latest"];

    if (prompt) {
      args.push("--prompt", prompt);
    }

    if (model || this.config.model) {
      args.push("--model", model || this.config.model!);
    }

    if (sessionId) {
      args.push("--session", sessionId);
    }

    if (verbose) {
      args.push("--verbose");
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
