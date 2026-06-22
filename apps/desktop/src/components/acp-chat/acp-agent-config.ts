import type { AgentInfo } from "@/lib/gateway";
import type { AgentConfigPayload } from "./acp-client";
import type { PermissionMode } from "@/lib/gateway/types/agent";

const CLIENT_SIDE_MCP_SERVER = "client_side";

export interface AcpProviderInfo {
  id: string;
  provider_type?: string;
  base_url?: string;
}

function mergeAgentMcpServers(servers: AgentInfo["mcp_servers"] | undefined): unknown[] {
  const entries = Array.isArray(servers) ? [...servers] : [];
  return entries.includes(CLIENT_SIDE_MCP_SERVER) ? entries : [...entries, CLIENT_SIDE_MCP_SERVER];
}

function executorBoolean(config: Record<string, unknown> | undefined, key: string): boolean | undefined {
  return config ? readBoolean(config[key]) : undefined;
}

function executorString(config: Record<string, unknown> | undefined, key: string): string | undefined {
  return config ? readString(config[key]) : undefined;
}

function executorPermissionMode(config: Record<string, unknown> | undefined): PermissionMode | undefined {
  const value = executorString(config, "permission_mode");
  return isPermissionMode(value) ? value : undefined;
}

export function getAcpAgentProviderId(agent?: AgentInfo): string | undefined {
  return readString(agent?.provider_id) ?? executorString(agent?.executor_config, "provider_id");
}

export function buildAcpAgentConfig(params: {
  agent?: AgentInfo;
  executorType: string;
  model: string;
  providerId: string | null;
  providers?: AcpProviderInfo[];
}): AgentConfigPayload {
  const { agent, executorType, model, providerId } = params;
  const selectedModel = model.trim() || agent?.model || undefined;
  const providerIdValue = providerId ?? getAcpAgentProviderId(agent);
  const executorConfig = withCodexProviderConfig(
    agent?.executor_config,
    agent?.executor_type ?? executorType,
    providerIdValue
  );
  return {
    name: agent?.name,
    executor_type: agent?.executor_type ?? executorType,
    provider_id: providerIdValue,
    model: selectedModel,
    system_prompt: agent?.system_prompt,
    append_prompt: agent?.append_prompt,
    temperature: agent?.temperature,
    max_tokens: agent?.max_tokens,
    executor_config: executorConfig,
    dangerously_skip_permissions: executorBoolean(executorConfig, "dangerously_skip_permissions"),
    permission_mode: agent?.permission_mode ?? executorPermissionMode(executorConfig) ?? "default",
    mcp_servers: mergeAgentMcpServers(agent?.mcp_servers),
    skills: agent?.skills,
  };
}

function withCodexProviderConfig(
  config: Record<string, unknown> | undefined,
  executorType: string,
  providerId: string | undefined
): Record<string, unknown> | undefined {
  if (executorType !== "CODEX" && executorType !== "CODEX_APP_SERVER") {
    return config;
  }
  if (!providerId) {
    return config;
  }
  if (!config) return undefined;
  const {
    provider_id,
    base_url,
    provider_name,
    wire_api,
    env_key,
    experimental_bearer_token,
    ...rest
  } = config;
  void provider_id;
  void base_url;
  void provider_name;
  void wire_api;
  void env_key;
  void experimental_bearer_token;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isPermissionMode(value: string | undefined): value is PermissionMode {
  return value === "default"
    || value === "bypassPermissions"
    || value === "auto"
    || value === "acceptEdits"
    || value === "dontAsk"
    || value === "plan";
}
