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
import { providerManager } from "../../providers";
import type { AgentConfigPayload } from "../types";
import type { SessionNotification } from "@agentclientprotocol/sdk";
import type { Provider } from "../../types";

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
  lookupProvider?: (providerId: string) => Promise<CodexProviderDetails | null | undefined>;
  spawnProcess?: (definition: CodexAppServerBackendDefinition, context: AcpBackendStartContext) => CodexAppServerProcess;
}

interface CodexProviderDetails {
  id: string;
  name?: string;
  type?: string;
  base_url?: string;
  api_key?: string;
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
    const definition = await resolveCodexDefinition(context.agentConfig, this.options.definition, this.options.lookupProvider);
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
  private readonly turnStartParams: Record<string, unknown>;

  constructor(
    private readonly outerSessionId: string,
    readonly backendSessionId: string,
    private readonly client: CodexAppServerJsonRpcClient,
    private readonly processHandle: CodexAppServerProcess,
    context: AcpBackendStartContext
  ) {
    this.turnStartParams = buildTurnStartParams(context);
    this.client.onFailure((error) => {
      const activeTurn = this.activeTurn;
      if (!activeTurn) return;
      this.activeTurn = undefined;
      activeTurn.reject(addCodexProcessDiagnostics(error, this.processHandle));
    });
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
        ...this.turnStartParams,
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
  override: Partial<CodexAppServerBackendDefinition> | undefined,
  lookupProvider: ((providerId: string) => Promise<CodexProviderDetails | null | undefined>) | undefined
): Promise<CodexAppServerBackendDefinition> {
  return resolveCodexDefinitionAsync(agentConfig, override, lookupProvider);
}

async function resolveCodexDefinitionAsync(
  agentConfig: AgentConfigPayload | undefined,
  override: Partial<CodexAppServerBackendDefinition> | undefined,
  lookupProvider: ((providerId: string) => Promise<CodexProviderDetails | null | undefined>) | undefined
): Promise<CodexAppServerBackendDefinition> {
  const config = asRecord(agentConfig?.executor_config);
  const provider = await resolveCodexProvider(agentConfig, lookupProvider);
  const env = {
    ...envRecord(override?.env),
    ...envRecord(config.env),
  };
  if (provider?.api_key && !env.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = provider.api_key;
  }
  return {
    id: readString(config.id) ?? override?.id ?? "codex",
    command: readString(config.command) ?? override?.command ?? "codex",
    args: codexArgs(agentConfig, stringArray(config.args) ?? override?.args ?? ["app-server"], provider),
    env,
    initTimeoutMs: readNumber(config.init_timeout_ms)
      ?? override?.initTimeoutMs
      ?? DEFAULT_INIT_TIMEOUT_MS,
  };
}

async function resolveCodexProvider(
  agentConfig: AgentConfigPayload | undefined,
  lookupProvider: ((providerId: string) => Promise<CodexProviderDetails | null | undefined>) | undefined
): Promise<CodexProviderDetails | undefined> {
  const providerId = agentConfig?.provider_id;
  if (!providerId) return undefined;
  const provider = lookupProvider
    ? await lookupProvider(providerId)
    : providerToCodexDetails(await providerManager.getProvider(providerId));
  return provider ?? undefined;
}

function providerToCodexDetails(provider: Provider | null): CodexProviderDetails | undefined {
  if (!provider) return undefined;
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    base_url: provider.base_url,
    api_key: provider.apiKey,
  };
}

function codexArgs(
  agentConfig: AgentConfigPayload | undefined,
  baseArgs: string[],
  provider: CodexProviderDetails | undefined
): string[] {
  const config = asRecord(agentConfig?.executor_config);
  const providerId = codexProviderId(agentConfig);
  const baseUrl = provider?.base_url ?? readString(config.base_url);
  const providerName = readString(config.provider_name)
    ?? provider?.name
    ?? providerId;
  const wireApi = readString(config.wire_api) ?? "responses";
  const envKey = readString(config.env_key) ?? (provider?.api_key ? "OPENAI_API_KEY" : undefined);
  const args = [...baseArgs];
  if (providerId) {
    args.push("-c", `model_provider=${tomlString(providerId)}`);
  }
  if (providerId && baseUrl && providerName) {
    if (!isTomlBareKey(providerId)) {
      args.push("-c", `model_providers=${tomlInlineTable({
        [providerId]: providerConfigRecord(providerName, wireApi, baseUrl, envKey),
      })}`);
      return args;
    }
    args.push(
      "-c",
      `model_providers.${providerId}.name=${tomlString(providerName)}`,
      "-c",
      `model_providers.${providerId}.wire_api=${tomlString(wireApi)}`,
      "-c",
      `model_providers.${providerId}.base_url=${tomlString(baseUrl)}`
    );
    if (envKey) {
      args.push("-c", `model_providers.${providerId}.env_key=${tomlString(envKey)}`);
    }
  }
  return args;
}

function codexProviderId(agentConfig: AgentConfigPayload | undefined): string | undefined {
  const config = asRecord(agentConfig?.executor_config);
  return readString(agentConfig?.provider_id) ?? readString(config.provider_id);
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function providerConfigRecord(
  name: string,
  wireApi: string,
  baseUrl: string,
  envKey: string | undefined
): Record<string, string> {
  return envKey
    ? { name, wire_api: wireApi, base_url: baseUrl, env_key: envKey }
    : { name, wire_api: wireApi, base_url: baseUrl };
}

function tomlInlineTable(record: Record<string, string | Record<string, string>>): string {
  const entries = Object.entries(record).map(([key, value]) => {
    const tomlValue = typeof value === "string" ? tomlString(value) : tomlInlineTable(value);
    return `${tomlInlineKey(key)}=${tomlValue}`;
  });
  return `{${entries.join(", ")}}`;
}

function tomlInlineKey(value: string): string {
  return isTomlBareKey(value) ? value : tomlString(value);
}

function isTomlBareKey(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
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
  const modelProvider = codexProviderId(context.agentConfig);
  if (modelProvider) {
    base.modelProvider = modelProvider;
  }
  const config = asRecord(context.agentConfig?.executor_config);
  const approvalPolicy = codexApprovalPolicy(context.agentConfig);
  if (approvalPolicy) base.approvalPolicy = approvalPolicy;
  const personality = readString(config.personality);
  if (personality) base.personality = personality;
  const sandbox = normalizeCodexSandbox(readString(config.sandbox) ?? sessionSandbox(context));
  if (sandbox) base.sandbox = sandbox;
  const settings = agentSettings(context.agentConfig);
  if (Object.keys(settings).length > 0) base.settings = settings;
  if (isLoadSession(context)) {
    return {
      ...base,
      threadId: context.request.sessionId,
    };
  }
  return base;
}

function buildTurnStartParams(context: AcpBackendStartContext): Record<string, unknown> {
  const config = asRecord(context.agentConfig?.executor_config);
  const params: Record<string, unknown> = {};
  if (context.agentConfig?.model) {
    params.model = context.agentConfig.model;
  }
  const modelProvider = codexProviderId(context.agentConfig);
  if (modelProvider) {
    params.modelProvider = modelProvider;
  }
  const personality = readString(config.personality);
  if (personality) params.personality = personality;
  const settings = agentSettings(context.agentConfig);
  if (Object.keys(settings).length > 0) {
    params.settings = settings;
  }
  const sandboxPolicy = asRecord(config.sandbox_policy);
  if (Object.keys(sandboxPolicy).length > 0) {
    params.sandboxPolicy = normalizeCodexSandboxPolicy(sandboxPolicy);
  } else if (context.sandboxConfig) {
    params.sandboxPolicy = sessionSandboxPolicy(context);
  }
  return params;
}

function codexApprovalPolicy(agentConfig: AgentConfigPayload | undefined): string | undefined {
  const config = asRecord(agentConfig?.executor_config);
  const explicit = readString(config.approval_policy);
  if (explicit) return explicit;
  if (agentConfig?.dangerously_skip_permissions === true || agentConfig?.approval_mode === "bypass") {
    return "never";
  }
  const permissionMode = agentConfig?.permission_mode;
  switch (permissionMode) {
    case "bypass":
    case "none":
    case "never":
      return "never";
    case "plan":
    case "default":
    case undefined:
      return undefined;
    default:
      return permissionMode;
  }
}

function sessionSandbox(context: AcpBackendStartContext): string | undefined {
  if (!context.sandboxConfig) return undefined;
  return context.sandboxConfig.enabled ? "workspace-write" : "read-only";
}

function sessionSandboxPolicy(context: AcpBackendStartContext): Record<string, unknown> {
  return context.sandboxConfig?.enabled
    ? { type: "workspaceWrite" }
    : { type: "readOnly" };
}

function normalizeCodexSandbox(value: string | undefined): string | undefined {
  switch (value) {
    case "readOnly":
    case "read_only":
      return "read-only";
    case "workspaceWrite":
    case "workspace_write":
      return "workspace-write";
    case "dangerFullAccess":
    case "danger_full_access":
      return "danger-full-access";
    default:
      return value;
  }
}

function normalizeCodexSandboxPolicy(policy: Record<string, unknown>): Record<string, unknown> {
  const type = normalizeCodexSandboxPolicyType(readString(policy.type));
  return type ? { ...policy, type } : policy;
}

function normalizeCodexSandboxPolicyType(value: string | undefined): string | undefined {
  switch (value) {
    case "read-only":
    case "read_only":
      return "readOnly";
    case "workspace-write":
    case "workspace_write":
      return "workspaceWrite";
    case "danger-full-access":
    case "danger_full_access":
      return "dangerFullAccess";
    default:
      return value;
  }
}

function agentSettings(agentConfig: AgentConfigPayload | undefined): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  const developerInstructions = developerInstructionsFromAgent(agentConfig);
  if (developerInstructions) {
    settings.developer_instructions = developerInstructions;
  }
  const executorConfig = asRecord(agentConfig?.executor_config);
  const reasoningEffort = readString(executorConfig.reasoning_effort);
  if (reasoningEffort) {
    settings.reasoning_effort = reasoningEffort;
  }
  if (typeof agentConfig?.temperature === "number" && Number.isFinite(agentConfig.temperature)) {
    settings.temperature = agentConfig.temperature;
  }
  if (typeof agentConfig?.max_tokens === "number" && Number.isFinite(agentConfig.max_tokens)) {
    settings.max_output_tokens = agentConfig.max_tokens;
  }
  return settings;
}

function developerInstructionsFromAgent(agentConfig: AgentConfigPayload | undefined): string | undefined {
  const parts = [
    readString(agentConfig?.system_prompt),
    readString(agentConfig?.append_prompt),
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.length > 0 ? parts.join("\n\n") : undefined;
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
