import type { Provider } from "@/hooks/use-providers";
import type { ModelLike } from "@/lib/executor-constraints";
import type { ModelOption } from "./agent-config-panel";

export type { ModelLike };

export interface ClaudeCodeProviderSwitchInput {
  config: Record<string, unknown>;
  currentModel: string;
  providerId: string;
  providerModels: ModelLike[];
}

export interface ClaudeCodeProviderSwitchResult {
  config: Record<string, unknown>;
  currentModel: string;
}

export const ANTHROPIC_MODEL_ENV = "ANTHROPIC_MODEL";
export const ANTHROPIC_DEFAULT_SONNET_MODEL_ENV = "ANTHROPIC_DEFAULT_SONNET_MODEL";
export const ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV = "ANTHROPIC_DEFAULT_HAIKU_MODEL";
export const ANTHROPIC_DEFAULT_OPUS_MODEL_ENV = "ANTHROPIC_DEFAULT_OPUS_MODEL";
export const CLAUDE_CODE_SUBAGENT_MODEL_ENV = "CLAUDE_CODE_SUBAGENT_MODEL";
export const CLAUDE_CODE_MODEL_ENV_KEYS = new Set([
  ANTHROPIC_MODEL_ENV,
  ANTHROPIC_DEFAULT_SONNET_MODEL_ENV,
  ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV,
  ANTHROPIC_DEFAULT_OPUS_MODEL_ENV,
  CLAUDE_CODE_SUBAGENT_MODEL_ENV,
]);
export const CLAUDE_CODE_PROVIDER_ENV_KEYS = new Set(["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"]);

export function pickPreferredModel(models: ModelLike[], family: "sonnet" | "haiku" | "opus"): string | undefined {
  return models.find((model) => model.id.toLowerCase().includes(family))?.id ?? models[0]?.id;
}

export function buildClaudeCodeProviderSwitch({
  config,
  currentModel,
  providerId,
  providerModels,
}: ClaudeCodeProviderSwitchInput): ClaudeCodeProviderSwitchResult {
  const currentEnv = readEnvRecord(config.env);
  const preservedEnv = Object.fromEntries(
    Object.entries(currentEnv).filter(
      ([key]) => !CLAUDE_CODE_PROVIDER_ENV_KEYS.has(key) && !CLAUDE_CODE_MODEL_ENV_KEYS.has(key)
    )
  );
  const providerModelIds = new Set(providerModels.map((model) => model.id));
  const nextCurrentModel = pickValidProviderModel(currentEnv[ANTHROPIC_MODEL_ENV], providerModelIds)
    ?? pickValidProviderModel(currentModel, providerModelIds)
    ?? pickPreferredModel(providerModels, "sonnet")
    ?? providerModels[0]?.id
    ?? "";
  const sonnetModel = pickValidProviderModel(
    currentEnv[ANTHROPIC_DEFAULT_SONNET_MODEL_ENV],
    providerModelIds
  ) ?? pickPreferredModel(providerModels, "sonnet");
  const haikuModel = pickValidProviderModel(
    currentEnv[ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV],
    providerModelIds
  ) ?? pickPreferredModel(providerModels, "haiku");
  const opusModel = pickValidProviderModel(
    currentEnv[ANTHROPIC_DEFAULT_OPUS_MODEL_ENV],
    providerModelIds
  ) ?? pickPreferredModel(providerModels, "opus");
  const subagentModel = pickValidProviderModel(
    currentEnv[CLAUDE_CODE_SUBAGENT_MODEL_ENV],
    providerModelIds
  ) ?? haikuModel;

  const env = {
    ...preservedEnv,
    ...(nextCurrentModel ? { [ANTHROPIC_MODEL_ENV]: nextCurrentModel } : {}),
    ...(sonnetModel ? { [ANTHROPIC_DEFAULT_SONNET_MODEL_ENV]: sonnetModel } : {}),
    ...(haikuModel ? { [ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV]: haikuModel } : {}),
    ...(opusModel ? { [ANTHROPIC_DEFAULT_OPUS_MODEL_ENV]: opusModel } : {}),
    ...(subagentModel ? { [CLAUDE_CODE_SUBAGENT_MODEL_ENV]: subagentModel } : {}),
  };

  return {
    currentModel: nextCurrentModel,
    config: compactConfig({
      ...config,
      provider_id: providerId,
      env: Object.keys(env).length > 0 ? env : undefined,
    }),
  };
}

function pickValidProviderModel(value: string | undefined, providerModelIds: Set<string>): string | undefined {
  return value && providerModelIds.has(value) ? value : undefined;
}

export function readConfigString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function readEnvRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

export function compactConfig(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => {
      if (value === undefined || value === "") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return true;
    })
  );
}

export function isModelForSelectedProvider(model: { provider_id?: string }, provider: Provider): boolean {
  const modelProviderId = model.provider_id?.toLowerCase();
  const providerId = provider.id.toLowerCase();
  return modelProviderId === providerId;
}

export function toModelOption(model: ModelLike): ModelOption {
  return {
    id: model.id,
    name: model.name ?? model.id,
    provider_type: model.provider_type,
    provider_id: model.provider_id,
  };
}
