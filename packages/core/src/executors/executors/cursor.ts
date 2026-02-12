/**
 * Cursor Agent executor
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
  StandardCodingAgentExecutor,
  AgentCapability,
  AvailabilityInfo,
} from "../types";
import { ExecutorError } from "../../error";
import { which } from "../utils";

const BASE_COMMAND = "cursor";

/**
 * Cursor Agent executor configuration
 */
export interface CursorAgentConfig extends ExecutorConfig {
  /** Model to use */
  model?: string;
}

/**
 * Cursor Agent executor
 */
export class CursorAgent implements StandardCodingAgentExecutor {
  readonly type = "CURSOR_AGENT" as const;
  private config: CursorAgentConfig;

  constructor(config: CursorAgentConfig = {}) {
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
    _currentDir: string,
    _prompt: string,
    _sessionId: string,
    _resetToMessageId: string | undefined,
    _env: ExecutionEnv
  ): Promise<SpawnedChild> {
    throw ExecutorError.followUpNotSupported("CursorAgent");
  }

  defaultMcpConfigPath(): string | null {
    return join(getConfigDir(), "Cursor", "User", "settings.json");
  }

  getAvailabilityInfo(): AvailabilityInfo {
    const configPath = this.defaultMcpConfigPath();
    if (configPath && existsSync(configPath)) {
      return { status: "INSTALLATION_FOUND" };
    }
    return { status: "NOT_FOUND" };
  }

  capabilities(): AgentCapability[] {
    return ["SETUP_HELPER"];
  }
}

export function createCursorAgent(config?: CursorAgentConfig): CursorAgent {
  return new CursorAgent(config);
}
