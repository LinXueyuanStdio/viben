import { describe, expect, expectTypeOf, it } from "vitest";
import type { CreateModelOptions, ProviderType } from "./model";

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
});
