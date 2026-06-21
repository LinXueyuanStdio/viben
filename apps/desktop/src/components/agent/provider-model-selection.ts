import type { Provider } from "@/hooks/use-providers";
import type { ProviderId } from "@/lib/executor-constraints";
import type { ModelOption } from "./agent-config-panel";

export interface ProviderLike {
  id: string;
  provider_type: string;
  category: string;
  name: string;
  surfaces: string[];
  enabled: boolean;
  is_default: boolean;
}

export interface ModelLike {
  id: string;
  name: string;
  provider_type?: string;
  provider_id?: string;
  is_available?: boolean;
}

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
export const PROVIDER_OWNED_CLAUDE_ENV_KEYS = new Set(["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"]);

export function filterSelectorProviders<T extends ProviderLike>(
  providers: T[],
  allowedProviderIds?: readonly ProviderId[]
): T[] {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const filteredProviders = !allowedProviderIds || allowedProviderIds.length === 0
    ? enabledProviders
    : enabledProviders.filter((provider) =>
        allowedProviderIds.includes(provider.provider_type as ProviderId)
      );

  return filteredProviders
    .filter((provider) => provider.category === "llm" || provider.surfaces.includes("chat"))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name));
}

export function filterProviderModels<T extends ModelLike>(models: T[], providerId: string): T[] {
  const normalizedProviderId = providerId.toLowerCase();
  return models.filter((model) => model.provider_id?.toLowerCase() === normalizedProviderId);
}

export function pickPreferredModel(models: ModelLike[], family: "sonnet" | "haiku" | "opus"): string | undefined {
  return models.find((model) => model.id.toLowerCase().includes(family))?.id ?? models[0]?.id;
}

export function buildClaudeCodeProviderSwitch({
  config,
  currentModel,
  providerId,
  providerModels,
}: ClaudeCodeProviderSwitchInput): ClaudeCodeProviderSwitchResult {
  const sonnetModel = pickPreferredModel(providerModels, "sonnet");
  const haikuModel = pickPreferredModel(providerModels, "haiku");
  const opusModel = pickPreferredModel(providerModels, "opus");
  const providerModelIds = new Set(providerModels.map((model) => model.id));
  const nextCurrentModel = providerModelIds.has(currentModel)
    ? currentModel
    : sonnetModel ?? providerModels[0]?.id ?? "";

  const env = {
    ...removeEnvKeys(readEnvRecord(config.env), PROVIDER_OWNED_CLAUDE_ENV_KEYS),
    ...(nextCurrentModel ? { [ANTHROPIC_MODEL_ENV]: nextCurrentModel } : {}),
    ...(sonnetModel ? { [ANTHROPIC_DEFAULT_SONNET_MODEL_ENV]: sonnetModel } : {}),
    ...(haikuModel ? { [ANTHROPIC_DEFAULT_HAIKU_MODEL_ENV]: haikuModel } : {}),
    ...(opusModel ? { [ANTHROPIC_DEFAULT_OPUS_MODEL_ENV]: opusModel } : {}),
    ...(haikuModel ? { [CLAUDE_CODE_SUBAGENT_MODEL_ENV]: haikuModel } : {}),
  };

  return {
    currentModel: nextCurrentModel,
    config: compactConfig({
      ...config,
      model_provider: providerId,
      env: Object.keys(env).length > 0 ? env : undefined,
    }),
  };
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

export function removeEnvKeys(
  env: Record<string, string>,
  keys: ReadonlySet<string>
): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !keys.has(key)));
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
    name: model.name,
    provider_type: model.provider_type,
    provider_id: model.provider_id,
  };
}
