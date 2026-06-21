import type {
  DiscoveredModel,
  ModelSurface,
  ProviderModelResponse,
} from "@/hooks/use-models";
import type { Provider, ProviderSurface } from "@/hooks/use-providers";

type ModelCapabilities = {
  chat?: boolean;
  code?: boolean;
  vision?: boolean;
  tools?: boolean;
};

export interface SettingsModel extends Omit<DiscoveredModel, "capabilities"> {
  source: "discovered" | "manual";
  surface?: ModelSurface;
  enabled: boolean;
  capabilities?: ModelCapabilities;
}

function isDiscoveredModelForProviderSurface(
  provider: Provider,
  model: DiscoveredModel,
): boolean {
  const providerSurfaceSet = new Set(provider.surfaces);
  if (providerSurfaceSet.size === 0) return true;

  const surface = model.id.toLowerCase();
  if (providerSurfaceSet.has("image") && /image|dall|flux|stable|sd|nano/.test(surface)) return true;
  if (providerSurfaceSet.has("video") && /video|veo|seedance|kling|runway/.test(surface)) return true;
  if (providerSurfaceSet.has("music") && /music|song|suno|udio/.test(surface)) return true;
  if ((providerSurfaceSet.has("speech") || providerSurfaceSet.has("sfx")) && /voice|speech|tts|sfx|audio/.test(surface)) return true;
  return provider.category === "llm";
}

function normalizeConfiguredModel(model: ProviderModelResponse): SettingsModel {
  return {
    id: model.id,
    name: model.name || model.id,
    description: model.description,
    context_window: model.context_window,
    max_output_tokens: model.max_output_tokens,
    source: "manual",
    enabled: model.enabled,
    capabilities: model.capabilities,
  };
}

export function buildProviderModelList({
  provider,
  discovered,
  configured,
}: {
  provider?: Provider;
  discovered: DiscoveredModel[];
  configured: ProviderModelResponse[];
}): {
  models: SettingsModel[];
  apiDiscoveredIds: Set<string>;
  enabledModelIds: string[];
} {
  const filteredDiscovered = provider
    ? discovered.filter((model) => isDiscoveredModelForProviderSurface(provider, model))
    : discovered;
  const configuredById = new Map(configured.map((model) => [model.id, model]));
  const discoveredIds = new Set(filteredDiscovered.map((model) => model.id));
  const models = filteredDiscovered.map((model): SettingsModel => {
    const configuredModel = configuredById.get(model.id);
    return {
      ...model,
      source: "discovered",
      enabled: configuredModel?.enabled ?? false,
      capabilities: configuredModel?.capabilities ?? model.capabilities,
    };
  });

  for (const configuredModel of configured) {
    if (!discoveredIds.has(configuredModel.id)) {
      models.push(normalizeConfiguredModel(configuredModel));
    }
  }

  return {
    models,
    apiDiscoveredIds: discoveredIds,
    enabledModelIds: configured.filter((model) => model.enabled).map((model) => model.id),
  };
}

export function getProviderSurfaces(provider?: Provider | null): ProviderSurface[] {
  if (!provider) return ["chat"];
  if (provider.surfaces.length > 0) return provider.surfaces;
  return provider.category === "media"
    ? ["image", "video", "music", "speech", "sfx"]
    : ["chat"];
}
