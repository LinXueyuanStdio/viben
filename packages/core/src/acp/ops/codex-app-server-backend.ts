import type {
  AgentCapabilities,
  PromptRequest,
  PromptResponse,
} from "@agentclientprotocol/sdk";
import type {
  AcpBackendAdapter,
  AcpBackendSession,
  AcpBackendStartContext,
} from "./backend-adapter";
import {
  addCodexProcessDiagnostics,
  CodexAppServerJsonRpcClient,
  CodexJsonRpcResponseError,
  type CodexAppServerProcess,
} from "./codex-app-server-client";
import {
  codexApprovalDecisionFromAcp,
  codexApprovalRequestToAcpPermission,
  codexNotificationToAcpSessionUpdate,
  codexTurnFailureMessage,
  codexTurnToStopReason,
} from "./codex-app-server-mapper";
import {
  asRecord,
  expectThreadResult,
  expectTurnResult,
  readNumber,
  readString,
  type CodexNotification,
  type CodexServerRequest,
  type CodexTurn,
} from "./codex-app-server-protocol";
import type { AgentConfigPayload } from "../types";
import type { SessionNotification } from "@agentclientprotocol/sdk";

const DEFAULT_INIT_TIMEOUT_MS = 120_000;

export interface CodexAppServerBackendDefinition {
  id: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  initTimeoutMs: number;
}

export interface CodexAppServerBackendAdapterOptions {
  definition?: Partial<CodexAppServerBackendDefinition>;
  spawnProcess?: (definition: CodexAppServerBackendDefinition, context: AcpBackendStartContext) => CodexAppServerProcess;
}

interface ActiveTurn {
  id: string;
  cancelRequested: boolean;
  resolve: (response: PromptResponse) => void;
  reject: (error: Error) => void;
}

type CodexPromptInput =
  | { type: "text"; text: string }
  | { type: "image"; url: string };

export class CodexAppServerBackendAdapter implements AcpBackendAdapter {
  readonly id = "codex-app-server";

  constructor(private readonly options: CodexAppServerBackendAdapterOptions = {}) {}

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    const definition = resolveCodexDefinition(context.agentConfig, this.options.definition);
    const processHandle = this.options.spawnProcess
      ? this.options.spawnProcess(definition, context)
      : CodexAppServerJsonRpcClient.spawn(definition.command, definition.args, context.cwd, definition.env);
    const client = new CodexAppServerJsonRpcClient(processHandle);

    try {
      client.onServerRequest(async (request) => {
        if (isApprovalRequest(request)) {
          const permission = codexApprovalRequestToAcpPermission(context.outerSessionId, request);
          const response = await context.connection.requestPermission(permission);
          return codexApprovalDecisionFromAcp(response);
        }
        throw new CodexJsonRpcResponseError(-32601, `Unsupported Codex app-server request: ${request.method}`);
      });

      await withTimeout(
        client.request("initialize", {
          clientInfo: {
            name: "viben",
            title: "Viben",
            version: "0.1.0",
          },
          capabilities: {
            experimentalApi: true,
          },
        }),
        definition.initTimeoutMs,
        "initialize"
      );
      client.notify("initialized", {});

      const threadResult = expectThreadResult(
        await withTimeout(
          client.request(threadMethod(context), threadParams(context)),
          definition.initTimeoutMs,
          "thread start"
        )
      );

      return new CodexAppServerBackendSession(
        context.outerSessionId,
        threadResult.thread.id,
        client,
        processHandle,
        context
      );
    } catch (error) {
      client.close();
      throw addCodexProcessDiagnostics(error, processHandle);
    }
  }
}

class CodexAppServerBackendSession implements AcpBackendSession {
  readonly agentCapabilities?: AgentCapabilities = {
    loadSession: true,
    sessionCapabilities: { list: {} },
  };

  private activeTurn: ActiveTurn | undefined;
  private readonly turnCompletedBeforeId = new Map<string, CodexTurn>();
  private notificationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly outerSessionId: string,
    readonly backendSessionId: string,
    private readonly client: CodexAppServerJsonRpcClient,
    private readonly processHandle: CodexAppServerProcess,
    context: AcpBackendStartContext
  ) {
    this.client.onNotification((notification) => {
      this.notificationQueue = this.notificationQueue
        .then(() => this.handleNotification(notification, context))
        .catch((error: unknown) => {
          const activeTurn = this.activeTurn;
          if (!activeTurn) return;
          this.activeTurn = undefined;
          activeTurn.reject(addCodexProcessDiagnostics(error, this.processHandle));
        });
    });
  }

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    const input = promptInput(request);
    return await new Promise<PromptResponse>((resolve, reject) => {
      const activeTurn: ActiveTurn = { id: "", cancelRequested: false, resolve, reject };
      this.activeTurn = activeTurn;
      this.client.request("turn/start", {
        threadId: this.backendSessionId,
        input,
      })
        .then((result) => {
          const turnStarted = expectTurnResult(result);
          activeTurn.id = turnStarted.turn.id;
          if (activeTurn.cancelRequested && this.activeTurn === activeTurn) {
            void this.interruptActiveTurn(activeTurn);
          }
          const completed = this.turnCompletedBeforeId.get(activeTurn.id);
          if (completed) {
            this.turnCompletedBeforeId.delete(activeTurn.id);
            this.completeTurn(completed);
          }
        })
        .catch((error: unknown) => {
          if (this.activeTurn === activeTurn) {
            this.activeTurn = undefined;
          }
          reject(addCodexProcessDiagnostics(error, this.processHandle));
        });
    });
  }

  async cancel(): Promise<void> {
    const activeTurn = this.activeTurn;
    if (!activeTurn) return;
    activeTurn.cancelRequested = true;
    if (!activeTurn.id) return;
    await this.interruptActiveTurn(activeTurn);
  }

  private async interruptActiveTurn(activeTurn: ActiveTurn): Promise<void> {
    await this.client.request("turn/interrupt", {
      threadId: this.backendSessionId,
      turnId: activeTurn.id,
    });
  }

  async close(): Promise<void> {
    this.client.close();
  }

  private async handleNotification(notification: CodexNotification, context: AcpBackendStartContext): Promise<void> {
    if (notification.method === "turn/started") {
      this.handleTurnStarted(notification);
    }

    const mapped = codexNotificationToAcpSessionUpdate(this.outerSessionId, notification);
    if (mapped) {
      await context.connection.sessionUpdate(mapped);
      await context.onSessionUpdate?.(mapped as unknown as SessionNotification);
    }

    if (notification.method !== "turn/completed") return;
    const turn = asRecord(asRecord(notification.params).turn) as CodexTurn;
    const turnId = readString(turn.id);
    if (!turnId || !this.activeTurn) return;
    if (!this.activeTurn.id) {
      this.turnCompletedBeforeId.set(turnId, turn);
      return;
    }
    if (turnId !== this.activeTurn.id) return;
    this.completeTurn(turn);
  }

  private handleTurnStarted(notification: CodexNotification): void {
    const activeTurn = this.activeTurn;
    if (!activeTurn || activeTurn.id) return;
    const turn = asRecord(asRecord(notification.params).turn);
    const turnId = readString(turn.id);
    if (!turnId) return;
    activeTurn.id = turnId;
    if (activeTurn.cancelRequested) {
      void this.interruptActiveTurn(activeTurn);
    }
  }

  private completeTurn(turn: CodexTurn): void {
    const turnId = readString(turn.id);
    if (!turnId || !this.activeTurn) return;
    if (this.activeTurn.id && turnId !== this.activeTurn.id) return;
    const activeTurn = this.activeTurn;
    this.activeTurn = undefined;
    const stopReason = codexTurnToStopReason(turn);
    if (stopReason) {
      activeTurn.resolve({ stopReason });
      return;
    }
    activeTurn.reject(addCodexProcessDiagnostics(new Error(codexTurnFailureMessage(turn)), this.processHandle));
  }
}

function resolveCodexDefinition(
  agentConfig: AgentConfigPayload | undefined,
  override: Partial<CodexAppServerBackendDefinition> | undefined
): CodexAppServerBackendDefinition {
  const config = asRecord(agentConfig?.executor_config);
  return {
    id: readString(config.id) ?? override?.id ?? "codex",
    command: readString(config.command) ?? override?.command ?? "codex",
    args: stringArray(config.args) ?? override?.args ?? ["app-server"],
    env: {
      ...envRecord(override?.env),
      ...envRecord(config.env),
    },
    initTimeoutMs: readNumber(config.init_timeout_ms)
      ?? readNumber(config.initTimeoutMs)
      ?? override?.initTimeoutMs
      ?? DEFAULT_INIT_TIMEOUT_MS,
  };
}

function threadMethod(context: AcpBackendStartContext): string {
  return isLoadSession(context) ? "thread/resume" : "thread/start";
}

function threadParams(context: AcpBackendStartContext): Record<string, unknown> {
  const base: Record<string, unknown> = {
    cwd: context.cwd,
    serviceName: "viben",
  };
  if (context.agentConfig?.model) {
    base.model = context.agentConfig.model;
  }
  const config = asRecord(context.agentConfig?.executor_config);
  const approvalPolicy = readString(config.approval_policy) ?? readString(config.approvalPolicy);
  if (approvalPolicy) base.approvalPolicy = approvalPolicy;
  const sandboxPolicy = asRecord(config.sandbox_policy);
  if (Object.keys(sandboxPolicy).length > 0) base.sandboxPolicy = sandboxPolicy;
  if (isLoadSession(context)) {
    return {
      ...base,
      threadId: context.request.sessionId,
    };
  }
  return base;
}

function isLoadSession(context: AcpBackendStartContext): context is AcpBackendStartContext & {
  request: { sessionId: string };
} {
  return typeof (context.request as { sessionId?: unknown }).sessionId === "string";
}

function promptInput(request: PromptRequest): CodexPromptInput[] {
  const input: CodexPromptInput[] = [];
  for (const block of request.prompt) {
    if (block.type === "text") {
      input.push({ type: "text", text: block.text });
      continue;
    }
    if (block.type === "image") {
      input.push({ type: "image", url: `data:${block.mimeType};base64,${block.data}` });
      continue;
    }
    if (block.type === "resource_link") {
      input.push({ type: "text", text: block.uri });
      continue;
    }
    input.push({ type: "text", text: JSON.stringify(block) });
  }
  return input;
}

function isApprovalRequest(request: CodexServerRequest): boolean {
  return request.method === "item/commandExecution/requestApproval"
    || request.method === "item/fileChange/requestApproval";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Codex app-server ${operation} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : undefined;
}

function envRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  const env: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === "string") {
      env[key] = item;
    }
  }
  return env;
}
