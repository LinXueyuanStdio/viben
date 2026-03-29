/**
 * Base Executor
 *
 * Abstract base class providing shared implementation for common executor operations.
 */

import type { AvailabilityInfo } from "../../types";
import type {
  Executor,
  ExecutorType,
  ExecutorCapability,
  ExecutorConfig,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../ops/types";
import { whichSync, fileExists, joinPath, getHomeDir } from "../ops/utils";

export abstract class BaseExecutor implements Executor {
  abstract readonly type: ExecutorType;
  protected config: ExecutorConfig;

  constructor(config: ExecutorConfig = {}) {
    this.config = config;
  }

  // === Abstract methods (must be implemented by subclasses) ===

  abstract getAvailabilityInfo(): AvailabilityInfo;
  abstract capabilities(): ExecutorCapability[];
  abstract defaultMcpConfigPath(): string | null;
  abstract getConfigDirName(): string;
  abstract getCliName(): string;
  abstract buildRunCommand(options: RunCommandOptions): string[];
  abstract buildResumeCommand(sessionId: string): string[];
  abstract getNonInteractiveEnv(): Record<string, string>;
  abstract spawn(options: SpawnOptions): Promise<ExecutionResult>;
  abstract chat(options: ChatOptions): Promise<ExecutionResult>;
  abstract chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage>;
  abstract resume(sessionId: string, options?: Partial<SpawnOptions>): Promise<ExecutionResult>;
  abstract supportsSessionIdOnCreate(): boolean;
  abstract supportsCLIAgents(): boolean;

  // === Shared implementations ===

  supports(capability: ExecutorCapability): boolean {
    return this.capabilities().includes(capability);
  }

  getConfigDir(projectRoot: string): string {
    return joinPath(projectRoot, this.getConfigDirName());
  }

  getAgentConfigPath(agent: string, projectRoot: string): string {
    return joinPath(this.getConfigDir(projectRoot), "agents", `${agent}.md`);
  }

  getCommandsPath(projectRoot: string, ...parts: string[]): string {
    if (parts.length === 0) {
      return joinPath(this.getConfigDir(projectRoot), "commands");
    }
    return joinPath(this.getConfigDir(projectRoot), "commands", ...parts);
  }

  getVibenCommandPath(name: string): string {
    return `${this.getConfigDirName()}/commands/viben/${name}.md`;
  }

  getResumeCommandStr(sessionId: string, cwd?: string): string {
    const cmd = this.buildResumeCommand(sessionId).join(" ");
    return cwd ? `cd ${cwd} && ${cmd}` : cmd;
  }

  extractSessionIdFromLog(_logContent: string): string | null {
    // Default: no extraction (Claude passes session ID via --session-id)
    return null;
  }

  // === Helper methods for subclasses ===

  protected getExecutablePath(): string | null {
    return whichSync(this.getCliName());
  }

  protected checkAuthFile(path: string): boolean {
    return fileExists(path);
  }

  protected getHomePath(...parts: string[]): string {
    return joinPath(getHomeDir(), ...parts);
  }

  protected mergeConfig<T extends Record<string, unknown>>(
    defaults: T,
    overrides?: Partial<T>
  ): T {
    return { ...defaults, ...overrides } as T;
  }
}
