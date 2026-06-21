import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CreateModelOptions,
  CreateProviderOptions,
  ProviderType,
  ProviderUpdate,
} from "./model";

describe("gateway model types", () => {
  it("requires provider_id when creating models", () => {
    expectTypeOf<CreateModelOptions>().toHaveProperty("provider_id").toEqualTypeOf<string>();
  });

  it("matches supported core provider types", () => {
    const openaiResponsesProvider: ProviderType = "openai-responses";

    expect(openaiResponsesProvider).toBe("openai-responses");

    // @ts-expect-error deepseek is a stale fallback, not a core provider type.
    const deepseekProvider: ProviderType = "deepseek";
    // @ts-expect-error custom is a stale fallback, not a core provider type.
    const customProvider: ProviderType = "custom";
    // @ts-expect-error custom-image was removed as a provider type.
    const customImageProvider: ProviderType = "custom-image";
    void deepseekProvider;
    void customProvider;
    void customImageProvider;
  });

  it("uses snake_case provider request fields", () => {
    const createProviderOptions: CreateProviderOptions = {
      type: "openai",
      name: "OpenAI",
      api_key: "sk-test",
      base_url: "https://api.openai.com/v1",
      api_version: "2026-01",
      max_retries: 2,
      supports_custom_model: true,
      set_as_default: true,
    };
    const providerUpdate: ProviderUpdate = {
      api_key: "sk-updated",
      base_url: "https://api.example.com/v1",
      api_version: "2026-02",
      max_retries: 3,
      supports_custom_model: false,
    };

    expect(createProviderOptions.api_key).toBe("sk-test");
    expect(providerUpdate.api_key).toBe("sk-updated");

    // @ts-expect-error apiKey was removed from gateway provider request types.
    const legacyCreateProviderOptions: CreateProviderOptions = { type: "openai", name: "OpenAI", apiKey: "sk-test" };
    // @ts-expect-error apiKey was removed from gateway provider update types.
    const legacyProviderUpdate: ProviderUpdate = { apiKey: "sk-test" };
    void legacyCreateProviderOptions;
    void legacyProviderUpdate;
  });
});
