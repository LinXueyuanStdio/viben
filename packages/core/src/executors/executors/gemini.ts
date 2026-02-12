/**
 * Gemini executor (Google)
 */
import { spawn } from "node:child_process";
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

const BASE_COMMAND = "gemini";

/**
 * Gemini executor configuration
 */
export interface GeminiConfig extends ExecutorConfig {
  /** Model to use (e.g., gemini-pro, gemini-1.5-pro) */
  model?: string;
}

/**
 * Gemini executor
 */
export class Gemini implements StandardCodingAgentExecutor {
  readonly type = "GEMINI" as const;
  private config: GeminiConfig;

  constructor(config: GeminiConfig = {}) {
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
    throw ExecutorError.followUpNotSupported("Gemini");
  }

  defaultMcpConfigPath(): string | null {
    return join(homedir(), ".gemini", "config.json");
  }

  getAvailabilityInfo(): AvailabilityInfo {
    const programPath = whichSync("gemini");
    if (programPath) {
      return { status: "INSTALLATION_FOUND" };
    }
    return { status: "NOT_FOUND" };
  }

  capabilities(): AgentCapability[] {
    return ["SESSION_FORK"];
  }
}

export function createGemini(config?: GeminiConfig): Gemini {
  return new Gemini(config);
}
