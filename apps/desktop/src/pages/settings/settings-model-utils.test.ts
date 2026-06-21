import { describe, expect, it } from "vitest";
import { buildProviderModelList } from "./settings-model-utils";
import type { Provider } from "@/hooks/use-providers";
import type { DiscoveredModel, ProviderModelResponse } from "@/hooks/use-models";

const provider: Provider = {
  id: "openai-main",
  provider_type: "openai",
  category: "llm",
  name: "OpenAI Main",
  surfaces: ["chat"],
  supports_custom_model: true,
  is_default: true,
  enabled: true,
  created_at: "2026-06-22T00:00:00.000Z",
  updated_at: "2026-06-22T00:00:00.000Z",
};

const discovered: DiscoveredModel[] = [
  {
    id: "gpt-5.1",
    name: "GPT 5.1",
  },
  {
    id: "gpt-5.1-mini",
    name: "GPT 5.1 mini",
  },
];

const configured: ProviderModelResponse[] = [
  {
    id: "gpt-5.1",
    name: "GPT 5.1",
    provider: "openai",
    enabled: true,
  },
  {
    id: "custom-disabled",
    name: "Custom disabled",
    provider: "openai",
    enabled: false,
  },
];

describe("settings model list builder", () => {
  it("keeps disabled configured models visible after refresh", () => {
    const result = buildProviderModelList({ provider, discovered, configured });

    expect(result.models.map((model) => [model.id, model.enabled, model.source])).toEqual([
      ["gpt-5.1", true, "discovered"],
      ["gpt-5.1-mini", false, "discovered"],
      ["custom-disabled", false, "manual"],
    ]);
    expect(result.enabledModelIds).toEqual(["gpt-5.1"]);
  });

  it("does not treat discovered-only models as configured or enabled", () => {
    const result = buildProviderModelList({
      provider,
      discovered,
      configured: [],
    });

    expect(result.models).toEqual([
      expect.objectContaining({ id: "gpt-5.1", enabled: false, source: "discovered" }),
      expect.objectContaining({ id: "gpt-5.1-mini", enabled: false, source: "discovered" }),
    ]);
    expect(result.enabledModelIds).toEqual([]);
  });
});
