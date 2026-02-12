/**
 * Droid executor
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
import { which } from "../utils";

const BASE_COMMAND = "droid";

/**
 * Droid executor configuration
 */
export interface DroidConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

/**
 * Droid executor
 */
export class Droid implements StandardCodingAgentExecutor {
  readonly type = "DROID" as const;
  private config: DroidConfig;

  constructor(config: DroidConfig = {}) {
    this.config = config;
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

    const programPath = await which(commandParts.program);
    if (!programPath) {
      throw ExecutorError.executableNotFound(commandParts.program);
    }

    const spawnEnv = {
      ...process.env,
      ...env.vars,
      ...commandParts.env,
      ...(this.config.env || {}),
    };

    const child = spawn(programPath, commandParts.args, {
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

    const programPath = await which(commandParts.program);
    if (!programPath) {
      throw ExecutorError.executableNotFound(commandParts.program);
    }

    const spawnEnv = {
      ...process.env,
      ...env.vars,
      ...commandParts.env,
      ...(this.config.env || {}),
    };

    const child = spawn(programPath, commandParts.args, {
      cwd: currentDir,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return { child };
  }

  defaultMcpConfigPath(): string | null {
    return join(homedir(), ".droid", "config.json");
  }

  getAvailabilityInfo(): AvailabilityInfo {
    const configPath = this.defaultMcpConfigPath();
    if (configPath && existsSync(configPath)) {
      return { status: "INSTALLATION_FOUND" };
    }
    return { status: "NOT_FOUND" };
  }

  capabilities(): AgentCapability[] {
    return ["SESSION_FORK"];
  }
}

export function createDroid(config?: DroidConfig): Droid {
  return new Droid(config);
}
