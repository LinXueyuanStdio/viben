import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Transform } from "node:stream";
import type { Readable, Writable } from "node:stream";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";
import type {
  Agent,
  Client,
  InitializeResponse,
  McpServer,
  NewSessionRequest,
  PromptRequest,
  PromptResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import type { AgentMcpServerEntry } from "../../types";
import { clientToolCompletionRegistry } from "../../services/client-tool-completion";
import { logger as globalLogger } from "../../telemetry";
import {
  CLIENT_SIDE_BASH_TOOL_NAME,
  CLIENT_SIDE_MCP_SERVER_NAME,
  GUI_EXECUTE_TOOL_NAME,
} from "./client-side-mcp-constants";
import { CodexAppServerBackendAdapter } from "./codex-app-server-backend";
import { AcpPromptError, normalizeAcpError } from "./errors";
import type {
  AcpAgentCapabilities,
  AcpConfigOption,
  AcpConnection,
  AcpLoadSessionRequest,
  AcpNewSessionRequest,
  AcpSandboxConfig,
  AgentConfigPayload,
} from "../types";

const log = globalLogger.child({ module: "acp-backend-adapter" });
const require = createRequire(import.meta.url);
const DEFAULT_BACKEND_INIT_TIMEOUT_MS = 120_000;
const OFFICIAL_CLAUDE_ACP_COMMAND = "claude-agent-acp";
const DEFAULT_ACP_EXECUTOR_TYPE = "CLAUDE_CODE";
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18790";
const CLAUDE_PERMISSION_MODES = new Set([
  "default",
  "acceptEdits",
  "dontAsk",
  "plan",
  "bypassPermissions",
]);

const BUILTIN_ACP_BACKENDS: Record<string, AcpBackendTemplate> = {
  CLAUDE_CODE: {
    id: "claude",
    registryId: "claude-acp",
    command: OFFICIAL_CLAUDE_ACP_COMMAND,
    args: [],
  },
  CLAUDE: {
    id: "claude",
    registryId: "claude-acp",
    command: OFFICIAL_CLAUDE_ACP_COMMAND,
    args: [],
  },
  CLAUDE_ACP: {
    id: "claude",
    registryId: "claude-acp",
    command: OFFICIAL_CLAUDE_ACP_COMMAND,
    args: [],
  },
  GEMINI: {
    id: "gemini",
    registryId: "gemini",
    command: "npx",
    args: ["@google/gemini-cli", "--acp"],
  },
  CODEX: {
    id: "codex",
    registryId: "codex-app-server",
    command: "codex",
    args: ["app-server"],
  },
  CODEX_APP_SERVER: {
    id: "codex",
    registryId: "codex-app-server",
    command: "codex",
    args: ["app-server"],
  },
  CODEX_ACP: {
    id: "codex",
    registryId: "codex-acp",
    command: "codex-acp",
    args: [],
  },
  OPENCODE: {
    id: "opencode",
    registryId: "opencode",
    command: "opencode",
    args: ["acp"],
  },
  OPENCLAW: {
    id: "openclaw",
    registryId: "openclaw",
    command: "openclaw",
    args: ["acp"],
  },
  OPENCLAW_ACP: {
    id: "openclaw",
    registryId: "openclaw",
    command: "openclaw",
    args: ["acp"],
  },
  QWEN_CODE: {
    id: "qwen-code",
    registryId: "qwen-code",
    command: "npx",
    args: ["@qwen-code/qwen-code", "--acp", "--experimental-skills"],
  },
  QWEN: {
    id: "qwen-code",
    registryId: "qwen-code",
    command: "npx",
    args: ["@qwen-code/qwen-code", "--acp", "--experimental-skills"],
  },
  COPILOT: {
    id: "github-copilot-cli",
    registryId: "github-copilot-cli",
    command: "npx",
    args: ["@github/copilot", "--acp"],
  },
  GITHUB_COPILOT_CLI: {
    id: "github-copilot-cli",
    registryId: "github-copilot-cli",
    command: "npx",
    args: ["@github/copilot", "--acp"],
  },
  AMP: {
    id: "amp",
    registryId: "amp-acp",
    command: "amp-acp",
    args: [],
  },
  AMP_ACP: {
    id: "amp",
    registryId: "amp-acp",
    command: "amp-acp",
    args: [],
  },
  CURSOR_AGENT: {
    id: "cursor",
    registryId: "cursor",
    command: "cursor-agent",
    args: ["acp"],
  },
  CURSOR: {
    id: "cursor",
    registryId: "cursor",
    command: "cursor-agent",
    args: ["acp"],
  },
  DROID: {
    id: "factory-droid",
    registryId: "factory-droid",
    command: "npx",
    args: ["droid", "exec", "--output-format", "acp"],
    env: {
      DROID_DISABLE_AUTO_UPDATE: "true",
      FACTORY_DROID_AUTO_UPDATE_ENABLED: "false",
    },
  },
  KILO: {
    id: "kilo",
    registryId: "kilo",
    command: "npx",
    args: ["@kilocode/cli", "acp"],
  },
  AUGGIE: {
    id: "auggie",
    registryId: "auggie",
    command: "npx",
    args: ["@augmentcode/auggie", "--acp"],
    env: {
      AUGMENT_DISABLE_AUTO_UPDATE: "1",
    },
  },
  AUTOHAND: {
    id: "autohand",
    registryId: "autohand",
    command: "npx",
    args: ["@autohandai/autohand-acp"],
  },
  CLINE: {
    id: "cline",
    registryId: "cline",
    command: "npx",
    args: ["cline", "--acp"],
  },
  CODEBUDDY: {
    id: "codebuddy-code",
    registryId: "codebuddy-code",
    command: "npx",
    args: ["@tencent-ai/codebuddy-code", "--acp"],
  },
  CODEBUDDY_CODE: {
    id: "codebuddy-code",
    registryId: "codebuddy-code",
    command: "npx",
    args: ["@tencent-ai/codebuddy-code", "--acp"],
  },
  CORUST_AGENT: {
    id: "corust-agent",
    registryId: "corust-agent",
    command: "corust-agent-acp",
    args: [],
  },
  CROW_CLI: {
    id: "crow-cli",
    registryId: "crow-cli",
    command: "uvx",
    args: ["crow-cli", "acp"],
  },
  DEEPAGENTS: {
    id: "deepagents",
    registryId: "deepagents",
    command: "npx",
    args: ["deepagents-acp"],
  },
  DIMCODE: {
    id: "dimcode",
    registryId: "dimcode",
    command: "npx",
    args: ["dimcode", "acp"],
  },
  GOOSE: {
    id: "goose",
    registryId: "goose",
    command: "goose",
    args: ["acp"],
  },
  JUNIE: {
    id: "junie",
    registryId: "junie",
    command: "junie",
    args: ["--acp=true"],
  },
  KIMI: {
    id: "kimi",
    registryId: "kimi",
    command: "kimi",
    args: ["acp"],
  },
  FAST_AGENT: {
    id: "fast-agent",
    registryId: "fast-agent",
    command: "uvx",
    args: ["fast-agent-acp", "-x"],
  },
  MINION_CODE: {
    id: "minion-code",
    registryId: "minion-code",
    command: "uvx",
    args: ["minion-code", "acp"],
  },
  MISTRAL_VIBE: {
    id: "mistral-vibe",
    registryId: "mistral-vibe",
    command: "vibe-acp",
    args: [],
  },
  NOVA: {
    id: "nova",
    registryId: "nova",
    command: "npx",
    args: ["@compass-ai/nova", "acp"],
  },
  PI_ACP: {
    id: "pi-acp",
    registryId: "pi-acp",
    command: "npx",
    args: ["pi-acp"],
  },
  PI: {
    id: "pi-acp",
    registryId: "pi-acp",
    command: "npx",
    args: ["pi-acp"],
  },
  QODER: {
    id: "qoder",
    registryId: "qoder",
    command: "npx",
    args: ["@qoder-ai/qodercli", "--acp"],
  },
  STAKPAK: {
    id: "stakpak",
    registryId: "stakpak",
    command: "stakpak",
    args: ["acp"],
  },
};

interface AcpBackendDefinition {
  id: string;
  registryId?: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  initTimeoutMs: number;
}

interface AcpBackendTemplate {
  id: string;
  registryId: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ResolvedBackendCommand {
  command: string;
  args: string[];
  diagnostics?: AcpBackendResolutionDiagnostics;
}

interface AcpBackendProcess {
  child: ChildProcessWithoutNullStreams;
  command: string;
  args: string[];
  cwd: string;
  cwdExists: boolean;
  stdoutTransform: Transform;
  stderr: RingBuffer;
  claudeConfigDir?: string;
  resolutionDiagnostics?: AcpBackendResolutionDiagnostics;
  kill(): void;
}

interface AcpBackendResolutionDiagnostics {
  requestedCommand: string;
  resolvedCommand: string;
  resolvedArgs: string[];
  attemptedPackage?: string;
  attemptedPackageEntry?: string;
  packageResolveError?: unknown;
  localBin?: string;
  localBinExists?: boolean;
  pathEnv?: string;
  installHint?: string;
}

export interface AcpBackendStartContext {
  outerSessionId: string;
  cwd: string;
  request: AcpNewSessionRequest | AcpLoadSessionRequest;
  connection: AcpConnection;
  agentConfig?: AgentConfigPayload;
  sandboxConfig?: AcpSandboxConfig;
  onSessionUpdate?: (notification: SessionNotification) => void | Promise<void>;
}

export interface AcpBackendSession {
  readonly backendSessionId: string;
  readonly agentCapabilities?: AcpAgentCapabilities;
  readonly configOptions?: AcpConfigOption[];
  prompt(request: PromptRequest): Promise<PromptResponse>;
  cancel(): Promise<void>;
  close(): Promise<void>;
}

export interface AcpBackendAdapter {
  readonly id: string;
  start(context: AcpBackendStartContext): Promise<AcpBackendSession>;
}

export interface AcpBackendInfo {
  executorType: string;
  id: string;
  registryId: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function createDefaultAcpBackendAdapter(): AcpBackendAdapter {
  return new RoutingAcpBackendAdapter();
}

export function listBuiltinAcpBackends(): AcpBackendInfo[] {
  return Object.entries(BUILTIN_ACP_BACKENDS).map(([executorType, backend]) => ({
    executorType,
    id: backend.id,
    registryId: backend.registryId,
    command: backend.command,
    args: backend.args,
    ...(backend.env ? { env: backend.env } : {}),
  }));
}

export function resolveBuiltinAcpBackend(executorType: string | undefined): AcpBackendInfo {
  const normalized = normalizeExecutorType(executorType);
  const backend = resolveBackendTemplate(normalized);
  return {
    executorType: BUILTIN_ACP_BACKENDS[normalized] ? normalized : DEFAULT_ACP_EXECUTOR_TYPE,
    id: backend.id,
    registryId: backend.registryId,
    command: backend.command,
    args: backend.args,
    ...(backend.env ? { env: backend.env } : {}),
  };
}

class RoutingAcpBackendAdapter implements AcpBackendAdapter {
  readonly id = "routing";
  private readonly subprocess = new SubprocessAcpBackendAdapter();
  private readonly codexAppServer = new CodexAppServerBackendAdapter();

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    const backend = await resolveBackendDefinition(context);
    if (backend.registryId === "codex-app-server") {
      return await this.codexAppServer.start(context);
    }
    return await this.subprocess.startWithDefinition(context, backend);
  }
}

class SubprocessAcpBackendAdapter implements AcpBackendAdapter {
  readonly id = "subprocess";

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    const backend = await resolveBackendDefinition(context);
    return await this.startWithDefinition(context, backend);
  }

  async startWithDefinition(
    context: AcpBackendStartContext,
    backend: AcpBackendDefinition
  ): Promise<AcpBackendSession> {
    const resolvedCommand = resolveBackendCommand(backend.command);
    const child = await spawnBackendProcess(context, backend, resolvedCommand);
    const stream = ndJsonStream(
      nodeToWebWritable(child.child.stdin),
      nodeToWebReadable(child.stdoutTransform)
    );
    const client = createBackendClient(context);
    const connection = new ClientSideConnection((_agent: Agent): Client => client, stream);

    try {
      const initResponse = await withBackendTimeout(
        connection.initialize({
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: {
            _meta: {
              terminal_output: true,
              _vibenClientTools: true,
            },
            fs: {
              readTextFile: false,
              writeTextFile: false,
            },
            terminal: false,
          },
        }),
        backend.initTimeoutMs,
        "initialize",
        child
      );

      log.info(
        {
          outerSessionId: context.outerSessionId,
          backend: backend.id,
          command: child.command,
          args: child.args,
          claudeConfigDir: child.claudeConfigDir,
          agentInfo: initResponse.agentInfo,
          agentCapabilities: initResponse.agentCapabilities,
        },
        "ACP backend initialized"
      );

      const sessionRequest = buildBackendSessionRequest(context);
      const sessionResponse = isLoadSessionRequest(context.request)
        ? await withBackendTimeout(
            connection.loadSession({
              ...sessionRequest,
              sessionId: resolveBackendSessionId(context),
            }),
            backend.initTimeoutMs,
            "session/load",
            child
          )
        : await withBackendTimeout(
            connection.newSession(sessionRequest),
            backend.initTimeoutMs,
            "session/new",
            child
          );

      const backendSessionId = getSessionResponseId(sessionResponse) ?? resolveBackendSessionId(context);

      const configOptions = await applyInitialConfigOptions(
        connection,
        backendSessionId,
        context.agentConfig,
        sessionResponse.configOptions ?? undefined
      );

      connection.closed.catch((error: unknown) => {
        log.debug(
          { err: error, outerSessionId: context.outerSessionId, backendSessionId },
          "ACP backend connection closed"
        );
      });

      return new SubprocessAcpBackendSession(
        connection,
        child,
        backendSessionId,
        initResponse,
        configOptions
      );
    } catch (error) {
      child.kill();
      throw addProcessDiagnostics(error, child, "Failed to start ACP backend");
    }
  }
}

class SubprocessAcpBackendSession implements AcpBackendSession {
  readonly agentCapabilities?: AcpAgentCapabilities;
  readonly configOptions?: AcpConfigOption[];

  constructor(
    private readonly connection: ClientSideConnection,
    private readonly process: AcpBackendProcess,
    readonly backendSessionId: string,
    initResponse: InitializeResponse,
    configOptions?: AcpConfigOption[]
  ) {
    this.agentCapabilities = initResponse.agentCapabilities as AcpAgentCapabilities | undefined;
    this.configOptions = configOptions;
  }

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    try {
      return await this.connection.prompt({
        ...request,
        sessionId: this.backendSessionId,
      });
    } catch (error) {
      throw addProcessDiagnostics(error, this.process, "ACP backend prompt failed");
    }
  }

  async cancel(): Promise<void> {
    await this.connection.cancel({ sessionId: this.backendSessionId });
  }

  async close(): Promise<void> {
    try {
      await this.connection.unstable_closeSession({ sessionId: this.backendSessionId });
    } catch (error) {
      log.debug({ err: error, backendSessionId: this.backendSessionId }, "ACP backend close failed");
    }
    this.process.kill();
  }
}

function createBackendClient(context: AcpBackendStartContext): Client {
  return {
    async sessionUpdate(params: SessionNotification): Promise<void> {
      const mapped = mapSessionNotification(params, context.outerSessionId);
      await context.connection.sessionUpdate(mapped);
      await context.onSessionUpdate?.(mapped);
    },

    async requestPermission(params) {
      return await context.connection.requestPermission({
        ...params,
        sessionId: context.outerSessionId,
      });
    },

    async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
      const response = await context.connection.requestClient(method, {
        ...params,
        sessionId: context.outerSessionId,
      });
      return normalizeExtResponse(response);
    },
  };
}

function buildBackendSessionRequest(context: AcpBackendStartContext): NewSessionRequest {
  const meta = buildBackendMeta(context.agentConfig, context.request);
  return {
    cwd: context.cwd,
    mcpServers: normalizeMcpServers(context, [
      ...(context.request.mcpServers ?? []),
      ...(context.agentConfig?.mcp_servers ?? []),
    ]),
    ...(meta ? { _meta: meta } : {}),
  };
}

function buildBackendMeta(
  agentConfig: AgentConfigPayload | undefined,
  request: AcpNewSessionRequest | AcpLoadSessionRequest
): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {
    ...(((request as { _meta?: Record<string, unknown> | null })._meta ?? {}) as Record<string, unknown>),
  };
  const claudeCode = isRecord(meta.claudeCode) ? { ...meta.claudeCode } : {};
  const options = isRecord(claudeCode.options) ? { ...claudeCode.options } : {};
  const backendConfig = getExecutorConfig(agentConfig);
  const claudeCodeOptions = isRecord(backendConfig.claude_code_options)
    ? backendConfig.claude_code_options
    : isRecord(backendConfig.claudeCodeOptions)
      ? backendConfig.claudeCodeOptions
      : undefined;

  if (claudeCodeOptions) {
    Object.assign(options, claudeCodeOptions);
  }
  const settingSources = stringArrayFromRecord(backendConfig, "setting_sources");
  if (settingSources.length > 0) {
    options.settingSources = settingSources;
  }
  if (agentConfig?.model) {
    options.model = agentConfig.model;
  }
  if (agentConfig?.append_prompt && !agentConfig.system_prompt) {
    meta.systemPrompt = { append: agentConfig.append_prompt };
  }
  if (agentConfig?.system_prompt) {
    meta.systemPrompt = agentConfig.append_prompt
      ? `${agentConfig.system_prompt}\n\n${agentConfig.append_prompt}`
      : agentConfig.system_prompt;
  }

  if (Object.keys(options).length > 0) {
    claudeCode.options = options;
  }
  if (Object.keys(claudeCode).length > 0) {
    meta.claudeCode = claudeCode;
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

async function applyInitialConfigOptions(
  connection: ClientSideConnection,
  backendSessionId: string,
  agentConfig: AgentConfigPayload | undefined,
  configOptions: AcpConfigOption[] | undefined
): Promise<AcpConfigOption[] | undefined> {
  let currentConfigOptions = configOptions;

  if (agentConfig?.permission_mode) {
    try {
      const response = await connection.setSessionConfigOption({
        sessionId: backendSessionId,
        configId: "mode",
        value: agentConfig.permission_mode,
      });
      currentConfigOptions = response.configOptions as AcpConfigOption[];
    } catch (error) {
      log.warn({ err: error, backendSessionId, mode: agentConfig.permission_mode }, "Failed to apply ACP backend permission mode");
    }
  }

  if (agentConfig?.model) {
    try {
      const response = await connection.setSessionConfigOption({
        sessionId: backendSessionId,
        configId: "model",
        value: agentConfig.model,
      });
      currentConfigOptions = response.configOptions as AcpConfigOption[];
    } catch (error) {
      log.warn({ err: error, backendSessionId, model: agentConfig.model }, "Failed to apply ACP backend model");
    }
  }

  return currentConfigOptions;
}

function normalizeMcpServers(
  context: AcpBackendStartContext,
  entries: (McpServer | string | AgentMcpServerEntry)[]
): McpServer[] {
  const servers: McpServer[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const server = normalizeMcpServer(context, entry);
    if (!server) continue;
    if (seen.has(server.name)) continue;
    seen.add(server.name);
    servers.push(server);
  }

  return servers;
}

function normalizeMcpServer(
  context: AcpBackendStartContext,
  entry: McpServer | string | AgentMcpServerEntry
): McpServer | null {
  if (typeof entry === "string") {
    if (entry === CLIENT_SIDE_MCP_SERVER_NAME) {
      return createClientSideMcpServer(context);
    }
    log.warn({ mcpServer: entry }, "Named in-process MCP server is not available through ACP backend adapters");
    return null;
  }

  if ("type" in entry && entry.type === "builtin") {
    if (entry.name === CLIENT_SIDE_MCP_SERVER_NAME) {
      return createClientSideMcpServer(context);
    }
    log.warn({ mcpServer: entry.name }, "Named builtin MCP server is not available through ACP backend adapters");
    return null;
  }

  if ("url" in entry && entry.url && (entry.type === "http" || entry.type === "sse")) {
    return {
      type: entry.type,
      name: entry.name,
      url: entry.url,
      headers: objectToHeaders(entry.headers),
    };
  }

  if ("command" in entry && entry.command) {
    return {
      name: entry.name,
      command: entry.command,
      args: entry.args ?? [],
      env: objectToEnv(entry.env),
    };
  }

  return null;
}

function createClientSideMcpServer(context: AcpBackendStartContext): McpServer {
  const entry = resolveClientSideMcpServerEntry();
  const gatewayUrl = resolveGatewayUrl(context);
  registerClientSideToolOptions();
  log.info(
    {
      outerSessionId: context.outerSessionId,
      gatewayUrl,
      entry,
    },
    "Mounted ACP client-side MCP bridge"
  );
  return {
    name: CLIENT_SIDE_MCP_SERVER_NAME,
    command: process.execPath,
    args: [entry],
    env: [
      { name: "VIBEN_ACP_SESSION_ID", value: context.outerSessionId },
      { name: "VIBEN_GATEWAY_URL", value: gatewayUrl },
    ],
  };
}

function registerClientSideToolOptions(): void {
  // Kept local to avoid importing Claude SDK MCP registration into ACP adapters.
  // Trusted prefixed tool names resolve to these base tool options.
  clientToolCompletionRegistry.registerToolOptions(GUI_EXECUTE_TOOL_NAME, { timeoutMs: 60_000 });
  clientToolCompletionRegistry.registerToolOptions(CLIENT_SIDE_BASH_TOOL_NAME, { timeoutMs: 60_000 });
}

function resolveClientSideMcpServerEntry(): string {
  const built = path.resolve(process.cwd(), "dist", "acp", "ops", "client-side-mcp-server.js");
  if (fs.existsSync(built)) return built;
  return fileURLToPath(new URL("./client-side-mcp-server.ts", import.meta.url));
}

function resolveGatewayUrl(context: AcpBackendStartContext): string {
  const configured = stringFromRecord(getExecutorConfig(context.agentConfig), "gateway_url")
    ?? stringFromRecord(getExecutorConfig(context.agentConfig), "gatewayUrl")
    ?? context.request.gateway_url
    ?? context.request.gatewayUrl
    ?? process.env.VIBEN_GATEWAY_URL;
  return typeof configured === "string" && configured.trim()
    ? configured.trim().replace(/\/+$/, "")
    : DEFAULT_GATEWAY_URL;
}

function objectToHeaders(headers: Record<string, string> | Array<{ name: string; value: string }> | undefined): Array<{ name: string; value: string }> {
  if (Array.isArray(headers)) return headers;
  return Object.entries(headers ?? {}).map(([name, value]) => ({ name, value }));
}

function objectToEnv(env: Record<string, string> | Array<{ name: string; value: string }> | undefined): Array<{ name: string; value: string }> {
  if (Array.isArray(env)) return env;
  return Object.entries(env ?? {}).map(([name, value]) => ({ name, value }));
}

function mapSessionNotification(
  notification: SessionNotification,
  outerSessionId: string
): SessionNotification {
  return {
    ...notification,
    sessionId: outerSessionId,
  };
}

function resolveBackendSessionId(context: AcpBackendStartContext): string {
  return (
    context.agentConfig?.executor_config?.backend_session_id as string | undefined
  ) ?? (
    context.request.persist_session_id ??
    context.request.persistSessionId ??
    context.outerSessionId
  );
}

function isLoadSessionRequest(
  request: AcpNewSessionRequest | AcpLoadSessionRequest
): request is AcpLoadSessionRequest {
  return typeof (request as AcpLoadSessionRequest).sessionId === "string";
}

function getSessionResponseId(response: unknown): string | undefined {
  return isRecord(response) && typeof response.sessionId === "string"
    ? response.sessionId
    : undefined;
}

function normalizeExtResponse(response: unknown): Record<string, unknown> {
  if (isRecord(response)) return response;
  return { value: response };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveBackendDefinition(context: AcpBackendStartContext): Promise<AcpBackendDefinition> {
  const executorType = normalizeExecutorType(context.agentConfig?.executor_type);
  const backendConfig = getExecutorConfig(context.agentConfig);
  const template = resolveBackendTemplate(executorType);
  const id = stringFromRecord(backendConfig, "id") ?? template.id;
  const command = stringFromRecord(backendConfig, "command") ?? template.command;
  const configuredArgs = stringArrayFromRecord(backendConfig, "args");
  const args = configuredArgs.length > 0 ? configuredArgs : [...template.args];
  const env = {
    ...(template.env ?? {}),
    ...envRecordFromValue(backendConfig.env),
  };
  const initTimeoutMs = numberFromRecord(backendConfig, "init_timeout_ms")
    ?? numberFromRecord(backendConfig, "initTimeoutMs")
    ?? DEFAULT_BACKEND_INIT_TIMEOUT_MS;

  if (template.registryId === "claude-acp" && command === OFFICIAL_CLAUDE_ACP_COMMAND && !env.CLAUDE_CONFIG_DIR) {
    env.CLAUDE_CONFIG_DIR = await prepareClaudeConfigDir(context);
  }

  return {
    id,
    registryId: template.registryId,
    command,
    args,
    env,
    initTimeoutMs,
  };
}

function getExecutorConfig(agentConfig: AgentConfigPayload | undefined): Record<string, unknown> {
  const config = isRecord(agentConfig?.executor_config)
    ? agentConfig.executor_config
    : {};
  return config;
}

function normalizeExecutorType(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_ACP_EXECUTOR_TYPE;
  }
  return value.trim().replace(/[-\s]+/g, "_").toUpperCase();
}

function resolveBackendTemplate(executorType: string): AcpBackendTemplate {
  const template = BUILTIN_ACP_BACKENDS[executorType];
  if (template) return template;
  log.warn(
    {
      executorType,
      defaultExecutorType: DEFAULT_ACP_EXECUTOR_TYPE,
      availableExecutorTypes: Object.keys(BUILTIN_ACP_BACKENDS),
    },
    "Unknown ACP executor_type, falling back to Claude ACP backend"
  );
  return BUILTIN_ACP_BACKENDS[DEFAULT_ACP_EXECUTOR_TYPE]!;
}

async function prepareClaudeConfigDir(context: AcpBackendStartContext): Promise<string> {
  const dir = path.join(os.tmpdir(), "viben-acp", "claude", `${context.outerSessionId}-${randomUUID()}`);
  await fs.promises.mkdir(dir, { recursive: true });

  const sourceSettings = await readJsonObject(path.join(os.homedir(), ".claude", "settings.json"));
  const sourcePermissions = isRecord(sourceSettings.permissions) ? sourceSettings.permissions : {};
  const requestedMode = normalizeClaudePermissionMode(context.agentConfig?.permission_mode);
  const defaultMode = requestedMode ?? normalizeClaudePermissionMode(sourcePermissions.defaultMode) ?? "default";

  const settings: Record<string, unknown> = {
    permissions: {
      defaultMode,
    },
  };
  if (isRecord(sourceSettings.env)) {
    settings.env = sourceSettings.env;
  }
  if (typeof sourceSettings.model === "string") {
    settings.model = sourceSettings.model;
  }

  await fs.promises.writeFile(
    path.join(dir, "settings.json"),
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf-8"
  );

  log.info(
    {
      outerSessionId: context.outerSessionId,
      claudeConfigDir: dir,
      permissionMode: defaultMode,
    },
    "Prepared isolated Claude ACP settings"
  );

  return dir;
}

function normalizeClaudePermissionMode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const aliases: Record<string, string> = {
    default: "default",
    acceptedits: "acceptEdits",
    dontask: "dontAsk",
    plan: "plan",
    bypass: "bypassPermissions",
    bypasspermissions: "bypassPermissions",
  };
  const normalized = aliases[trimmed.toLowerCase()] ?? trimmed;
  if (!CLAUDE_PERMISSION_MODES.has(normalized)) {
    log.warn({ mode: value }, "Ignoring unsupported Claude ACP permission mode");
    return undefined;
  }
  return normalized;
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveBackendCommand(command: string): ResolvedBackendCommand {
  const diagnostics: AcpBackendResolutionDiagnostics = {
    requestedCommand: command,
    resolvedCommand: command,
    resolvedArgs: [],
    pathEnv: process.env.PATH,
  };

  if (command === OFFICIAL_CLAUDE_ACP_COMMAND) {
    diagnostics.attemptedPackage = "@agentclientprotocol/claude-agent-acp";
    try {
      const packageJson = require.resolve("@agentclientprotocol/claude-agent-acp/package.json");
      const entry = path.join(path.dirname(packageJson), "dist", "index.js");
      diagnostics.attemptedPackageEntry = entry;
      if (fs.existsSync(entry)) {
        return {
          command: process.execPath,
          args: [entry],
          diagnostics: {
            ...diagnostics,
            resolvedCommand: process.execPath,
            resolvedArgs: [entry],
          },
        };
      }
    } catch (error) {
      diagnostics.packageResolveError = error;
      diagnostics.installHint = "Install @agentclientprotocol/claude-agent-acp in the package that runs the gateway, or set agent_config.executor_config.command to an absolute ACP backend command.";
      log.warn({ err: error, command, installHint: diagnostics.installHint }, "Failed to resolve official Claude ACP package entry");
    }
  }

  if (path.isAbsolute(command) && fs.existsSync(command)) {
    const resolved = commandForScript(command);
    return {
      ...resolved,
      diagnostics: {
        ...diagnostics,
        resolvedCommand: resolved.command,
        resolvedArgs: resolved.args,
      },
    };
  }

  const localBin = path.resolve(process.cwd(), "node_modules", ".bin", command);
  diagnostics.localBin = localBin;
  diagnostics.localBinExists = fs.existsSync(localBin);
  if (fs.existsSync(localBin)) {
    const resolved = commandForScript(localBin);
    return {
      ...resolved,
      diagnostics: {
        ...diagnostics,
        resolvedCommand: resolved.command,
        resolvedArgs: resolved.args,
      },
    };
  }

  return { command, args: [], diagnostics };
}

function commandForScript(filePath: string): ResolvedBackendCommand {
  if (process.platform === "win32" && [".cmd", ".bat"].includes(path.extname(filePath).toLowerCase())) {
    return { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", `"${filePath}"`] };
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.startsWith("#!/usr/bin/env node") || filePath.endsWith(".js")) {
      return { command: process.execPath, args: [filePath] };
    }
  } catch {
    // Binary files are used directly.
  }

  return { command: filePath, args: [] };
}

async function spawnBackendProcess(
  context: AcpBackendStartContext,
  definition: AcpBackendDefinition,
  resolvedCommand: ResolvedBackendCommand
): Promise<AcpBackendProcess> {
  const args = [...resolvedCommand.args, ...definition.args];
  const stderr = new RingBuffer(200);
  const stdoutTransform = new Transform({
    transform(chunk, _encoding, callback) {
      callback(null, chunk);
    },
  });
  const child = spawn(resolvedCommand.command, args, {
    cwd: context.cwd,
    env: {
      ...process.env,
      ...definition.env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout.pipe(stdoutTransform);
  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk: string) => {
    stderr.append(chunk);
    for (const line of chunk.split(/\r?\n/)) {
      if (line.trim()) {
        log.debug(
          {
            outerSessionId: context.outerSessionId,
            backend: definition.id,
            stderr: line.trim(),
          },
          "ACP backend stderr"
        );
      }
    }
  });

  const processHandle: AcpBackendProcess = {
    child,
    command: resolvedCommand.command,
    args,
    cwd: context.cwd,
    cwdExists: fs.existsSync(context.cwd),
    stdoutTransform,
    stderr,
    claudeConfigDir: definition.env.CLAUDE_CONFIG_DIR,
    resolutionDiagnostics: resolvedCommand.diagnostics,
    kill() {
      if (child.exitCode !== null || child.killed) return;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && !child.killed) {
          child.kill("SIGKILL");
        }
      }, 2_000).unref();
    },
  };

  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  }).catch((error) => {
    throw addProcessDiagnostics(error, processHandle, createSpawnFailureMessage(definition, processHandle));
  });

  log.info(
    {
      outerSessionId: context.outerSessionId,
      backend: definition.id,
      command: resolvedCommand.command,
      args,
      cwd: context.cwd,
      claudeConfigDir: definition.env.CLAUDE_CONFIG_DIR,
    },
    "ACP backend process spawned"
  );

  return processHandle;
}

async function withBackendTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
  processHandle: AcpBackendProcess
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            createBackendError(`ACP backend ${operation} timed out after ${timeoutMs}ms`, processHandle)
          );
        }, timeoutMs);
        timer.unref();
      }),
    ]);
  } catch (error) {
    throw addProcessDiagnostics(error, processHandle, `ACP backend ${operation} failed`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createAcpBackendDiagnosticError(
  error: unknown,
  processHandle: AcpBackendProcess,
  fallbackMessage: string
): Error {
  const base = error instanceof Error ? error : new AcpPromptError(normalizeAcpError(error));
  const diagnostic = base as Error & Record<string, unknown>;
  if (!diagnostic.message || isEnoentError(diagnostic)) {
    diagnostic.message = fallbackMessage;
  }
  diagnostic.stderr = diagnostic.stderr ?? processHandle.stderr.toString();
  diagnostic.exitCode = diagnostic.exitCode ?? processHandle.child.exitCode ?? undefined;
  diagnostic.signal = diagnostic.signal ?? processHandle.child.signalCode ?? undefined;
  diagnostic.command = diagnostic.command ?? processHandle.command;
  diagnostic.args = diagnostic.args ?? processHandle.args;
  diagnostic.cwd = diagnostic.cwd ?? processHandle.cwd;
  diagnostic.cwdExists = diagnostic.cwdExists ?? processHandle.cwdExists;
  diagnostic.claudeConfigDir = diagnostic.claudeConfigDir ?? processHandle.claudeConfigDir;
  diagnostic.resolution = diagnostic.resolution ?? processHandle.resolutionDiagnostics;
  diagnostic.hint = diagnostic.hint ?? createBackendFailureHint(processHandle);
  if (base instanceof AcpPromptError) {
    Object.assign(base.detail, {
      stderr: base.detail.stderr ?? diagnostic.stderr,
      exitCode: base.detail.exitCode ?? diagnostic.exitCode,
      signal: base.detail.signal ?? diagnostic.signal,
      command: base.detail.command ?? diagnostic.command,
      args: base.detail.args ?? diagnostic.args,
      cwd: base.detail.cwd ?? diagnostic.cwd,
      cwdExists: base.detail.cwdExists ?? diagnostic.cwdExists,
      claudeConfigDir: base.detail.claudeConfigDir ?? diagnostic.claudeConfigDir,
      resolution: base.detail.resolution ?? diagnostic.resolution,
      hint: base.detail.hint ?? diagnostic.hint,
    });
  }
  return base;
}

function addProcessDiagnostics(error: unknown, processHandle: AcpBackendProcess, fallbackMessage: string): Error {
  return createAcpBackendDiagnosticError(error, processHandle, fallbackMessage);
}

function createBackendError(message: string, processHandle: AcpBackendProcess): Error {
  return addProcessDiagnostics(new Error(message), processHandle, message);
}

function createSpawnFailureMessage(definition: AcpBackendDefinition, processHandle: AcpBackendProcess): string {
  if (!processHandle.cwdExists) {
    return [
      "Failed to start ACP backend.",
      `Working directory does not exist: ${processHandle.cwd}.`,
      "If the path came from a client, pass an absolute path or a path beginning with ~/ so Viben can expand it before spawning the backend.",
    ].join(" ");
  }
  if (definition.registryId === "claude-acp" && processHandle.command === OFFICIAL_CLAUDE_ACP_COMMAND) {
    return [
      "Failed to start Claude ACP backend.",
      "Could not resolve bundled @agentclientprotocol/claude-agent-acp, and no claude-agent-acp executable was found on PATH.",
      "Install @agentclientprotocol/claude-agent-acp in packages/core, or configure agent_config.executor_config.command with an absolute ACP backend command.",
    ].join(" ");
  }
  return `Failed to spawn ACP backend command: ${processHandle.command}`;
}

function createBackendFailureHint(processHandle: AcpBackendProcess): string | undefined {
  if (!processHandle.cwdExists) {
    return `Create the working directory or pass an existing cwd. Current cwd resolved to: ${processHandle.cwd}`;
  }
  const resolution = processHandle.resolutionDiagnostics;
  if (resolution?.installHint) return resolution.installHint;
  if (processHandle.command === OFFICIAL_CLAUDE_ACP_COMMAND) {
    return "Install @agentclientprotocol/claude-agent-acp or ensure claude-agent-acp is on PATH for the gateway process.";
  }
  if (resolution && !resolution.localBinExists && !path.isAbsolute(processHandle.command)) {
    return [
      `Install the ACP backend command "${processHandle.command}",`,
      "ensure it is on PATH for the gateway process,",
      "or configure agent_config.executor_config.command with an absolute command path.",
    ].join(" ");
  }
  return undefined;
}

function isEnoentError(error: Record<string, unknown>): boolean {
  return error.code === "ENOENT" || (typeof error.message === "string" && error.message.includes("ENOENT"));
}

function nodeToWebWritable(nodeStream: Writable): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        const ok = nodeStream.write(Buffer.from(chunk));
        if (ok) {
          resolve();
          return;
        }
        const onDrain = () => {
          nodeStream.removeListener("error", onError);
          resolve();
        };
        const onError = (error: Error) => {
          nodeStream.removeListener("drain", onDrain);
          reject(error);
        };
        nodeStream.once("drain", onDrain);
        nodeStream.once("error", onError);
      });
    },
    close() {
      nodeStream.end();
    },
    abort(reason) {
      nodeStream.destroy(reason instanceof Error ? reason : new Error(String(reason)));
    },
  });
}

function nodeToWebReadable(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (error) => controller.error(error));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

function stringFromRecord(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberFromRecord(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function stringArrayFromRecord(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function envRecordFromValue(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const env: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      env[key] = item;
    }
  }
  return env;
}

class RingBuffer {
  private readonly lines: string[] = [];

  constructor(private readonly maxLines: number) {}

  append(chunk: string): void {
    for (const line of chunk.split(/\r?\n/)) {
      if (!line.trim()) continue;
      this.lines.push(line);
    }
    while (this.lines.length > this.maxLines) {
      this.lines.shift();
    }
  }

  toString(): string {
    return this.lines.join("\n");
  }
}
