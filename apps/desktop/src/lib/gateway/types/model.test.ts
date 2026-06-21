import { describe, expectTypeOf, it } from "vitest";
import type { CreateModelOptions, ProviderType } from "./model";

describe("gateway model types", () => {
  it("requires provider_id when creating models", () => {
    expectTypeOf<CreateModelOptions>().toHaveProperty("provider_id").toEqualTypeOf<string>();
  });

  it("matches supported core provider types", () => {
    expectTypeOf("openai-responses").toExtend<ProviderType>();
    expectTypeOf("custom-image").toExtend<ProviderType>();
    expectTypeOf("deepseek").not.toExtend<ProviderType>();
    expectTypeOf("custom").not.toExtend<ProviderType>();
  });
});
