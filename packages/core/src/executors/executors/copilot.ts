/**
 * GitHub Copilot executor
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
  StandardCodingAgentExecutor,
  AgentCapability,
  AvailabilityInfo,
} from "../types";
import { ExecutorError } from "../../error";
import { which, whichSync } from "../utils";

const BASE_COMMAND = "gh copilot";

/**
 * Copilot executor configuration
 */
export interface CopilotConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

/**
 * GitHub Copilot executor
 */
export class Copilot implements StandardCodingAgentExecutor {
  readonly type = "COPILOT" as const;
  private config: CopilotConfig;

  constructor(config: CopilotConfig = {}) {
    this.config = config;
  }

  async spawn(
    currentDir: string,
    prompt: string,
    env: ExecutionEnv
  ): Promise<SpawnedChild> {
    let builder = CommandBuilder.new(this.config.baseCommandOverride || BASE_COMMAND)
      .addParams("suggest", prompt);

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
    };

    const child = spawn(programPath, fullArgs, {
      cwd: currentDir,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return { child };
  }

  async spawnFollowUp(
    _currentDir: string,
    _prompt: string,
    _sessionId: string,
    _resetToMessageId: string | undefined,
    _env: ExecutionEnv
  ): Promise<SpawnedChild> {
    throw ExecutorError.followUpNotSupported("Copilot");
  }

  defaultMcpConfigPath(): string | null {
    return join(homedir(), ".config", "gh-copilot", "config.json");
  }

  getAvailabilityInfo(): AvailabilityInfo {
    // Check if gh is installed (sync check)
    const ghPath = whichSync("gh");
    if (ghPath) {
      return { status: "INSTALLATION_FOUND" };
    }
    return { status: "NOT_FOUND" };
  }

  capabilities(): AgentCapability[] {
    return [];
  }
}

export function createCopilot(config?: CopilotConfig): Copilot {
  return new Copilot(config);
}
