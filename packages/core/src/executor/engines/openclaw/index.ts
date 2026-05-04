/**
 * OpenClaw Executor
 *
 * Executor implementation for OpenClaw AI assistant gateway.
 * Uses WebSocket (via @openclaw/sdk) instead of CLI subprocess.
 */

import type { AvailabilityInfo } from "../../../types";
import type {
  ExecutorCapability,
  SpawnOptions,
  ChatOptions,
  ExecutionResult,
  RunCommandOptions,
  SSEMessage,
} from "../../ops/types";
import { registerExecutor } from "../../ops/registry";
import { BaseExecutor } from "../base";
import type { OpenClawExecutorConfig } from "./types";
import { loadGatewayConfig } from "./config";
import { OpenClawProcessManager } from "./process-manager";
import { OpenClawConnectionManager } from "./connection";
import { OpenClawChatProxy } from "./chat-proxy";

export type { OpenClawExecutorConfig } from "./types";

class OpenClawExecutor extends BaseExecutor {
  readonly type = "OPENCLAW" as const;
  protected override config: OpenClawExecutorConfig;
  private processManager: OpenClawProcessManager | null = null;
  private connectionManager: OpenClawConnectionManager | null = null;

  constructor(config: OpenClawExecutorConfig = {}) {
    super(config);
    this.config = config;
  }

  // === Capability Detection ===

  getAvailabilityInfo(): AvailabilityInfo {
    const execPath = this.getExecutablePath();
    const configExists = this.checkAuthFile(
      this.getHomePath(".openclaw", "openclaw.json")
    );

    if (configExists) {
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
    return ["SPAWN", "CHAT", "CHAT_STREAMING", "SESSION_RESUME"];
  }

  // === Configuration ===

  defaultMcpConfigPath(): string | null {
    return this.getHomePath(".openclaw", "openclaw.json");
  }

  getConfigDirName(): string {
    return ".openclaw";
  }

  getCliName(): string {
    return "openclaw";
  }

  // === Command Building ===

  buildRunCommand(_options: RunCommandOptions): string[] {
    return [];
  }

  buildResumeCommand(_sessionId: string): string[] {
    return [];
  }

  getNonInteractiveEnv(): Record<string, string> {
    return {};
  }

  // === Feature Detection ===

  supportsSessionIdOnCreate(): boolean {
    return true;
  }

  supportsCLIAgents(): boolean {
    return false;
  }

  // === Private Helpers ===

  private getGatewayConfig() {
    return loadGatewayConfig({
      host: this.config.gateway?.host,
      port: this.config.gateway?.port,
      token: this.config.gateway?.token,
      password: this.config.gateway?.password,
      cliPath: this.config.cliPath,
      autoStart: this.config.autoStart,
    });
  }

  private async ensureConnected(): Promise<OpenClawConnectionManager> {
    const gwConfig = this.getGatewayConfig();

    if (!this.processManager) {
      this.processManager = new OpenClawProcessManager(gwConfig);
    }
    await this.processManager.ensureRunning();

    if (!this.connectionManager) {
      this.connectionManager = new OpenClawConnectionManager(gwConfig);
    }
    await this.connectionManager.connect();
    return this.connectionManager;
  }

  // === Execution Operations ===

  async spawn(options: SpawnOptions): Promise<ExecutionResult> {
    const { prompt, sessionId } = options;

    try {
      const connMgr = await this.ensureConnected();
      const client = connMgr.getClient();

      const session = await client.sessions.create({
        key: sessionId ?? `viben-task-${Date.now()}`,
      });

      const run = await session.send(prompt);
      const result = await run.wait();

      return {
        success: result.status === "completed",
        sessionId: session.key,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SDK_ERROR",
      };
    }
  }

  async chat(options: ChatOptions): Promise<ExecutionResult> {
    const { prompt, sessionId, resume } = options;

    try {
      const connMgr = await this.ensureConnected();
      const client = connMgr.getClient();

      const sessionKey = resume ?? sessionId ?? `viben-chat-${Date.now()}`;
      let session;
      if (resume) {
        session = await client.sessions.get(sessionKey);
      } else {
        session = await client.sessions.create({ key: sessionKey });
      }

      const run = await session.send(prompt);
      const result = await run.wait();

      return {
        success: result.status === "completed",
        sessionId: session.key,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: "SDK_ERROR",
      };
    }
  }

  async *chatStreaming(options: ChatOptions): AsyncGenerator<SSEMessage> {
    try {
      const connMgr = await this.ensureConnected();
      const client = connMgr.getClient();
      const proxy = new OpenClawChatProxy(client);

      yield* proxy.stream(options);
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async resume(
    sessionId: string,
    options?: Partial<SpawnOptions>
  ): Promise<ExecutionResult> {
    return this.chat({
      prompt: options?.prompt ?? "",
      resume: sessionId,
    });
  }
}

// Register executor
registerExecutor("OPENCLAW", (config) => new OpenClawExecutor(config));

export { OpenClawExecutor };
