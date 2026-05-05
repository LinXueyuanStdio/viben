/**
 * OpenClaw Executor
 *
 * Executor implementation for OpenClaw AI assistant gateway.
 * Uses direct WebSocket (protocol v3) instead of CLI subprocess or SDK.
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
import { resetEventMapper } from "./event-mapper";

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

      const sessionKey = sessionId ?? `viben-task-${Date.now()}`;
      const session = await client.sessions.reset({ key: sessionKey, reason: "new" });

      // Send and wait for completion via events
      resetEventMapper();
      await client.chat.send({ sessionKey: session.key, message: prompt });

      // Wait for final event
      for await (const frame of client.events((f) =>
        f.event === "chat" || f.event === "chat.event"
      )) {
        const payload = frame.payload as { state?: string } | undefined;
        if (
          payload?.state === "final" ||
          payload?.state === "aborted" ||
          payload?.state === "error"
        ) {
          return {
            success: payload.state === "final",
            sessionId: session.key,
          };
        }
      }

      return { success: true, sessionId: session.key };
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
        session = await client.sessions.resolve({ key: sessionKey });
      } else {
        session = await client.sessions.reset({ key: sessionKey, reason: "new" });
      }

      resetEventMapper();
      await client.chat.send({ sessionKey: session.key, message: prompt });

      // Wait for final
      for await (const frame of client.events((f) =>
        f.event === "chat" || f.event === "chat.event"
      )) {
        const payload = frame.payload as { state?: string } | undefined;
        if (
          payload?.state === "final" ||
          payload?.state === "aborted" ||
          payload?.state === "error"
        ) {
          return {
            success: payload.state === "final",
            sessionId: session.key,
          };
        }
      }

      return { success: true, sessionId: session.key };
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

      yield* proxy.stream({
        prompt: options.prompt,
        sessionId: options.sessionId,
        resume: options.resume,
      });
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
