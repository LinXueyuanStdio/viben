import { describe, expect, it, vi } from "vitest";
import {
  emitModelProviderDataChanged,
  shouldRefreshModelList,
  shouldRefreshProviderList,
  subscribeModelProviderDataChanged,
} from "./model-provider-events";

describe("model provider data change events", () => {
  it("notifies subscribers when provider or model settings change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeModelProviderDataChanged(listener);

    emitModelProviderDataChanged({ scope: "models", provider_id: "deepseek-openai" });

    expect(listener).toHaveBeenCalledWith({
      scope: "models",
      provider_id: "deepseek-openai",
    });

    unsubscribe();
    emitModelProviderDataChanged({ scope: "all" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("targets provider and model refreshes by scope and provider_id", () => {
    expect(shouldRefreshProviderList({ scope: "providers" })).toBe(true);
    expect(shouldRefreshProviderList({ scope: "all" })).toBe(true);
    expect(shouldRefreshProviderList({ scope: "models" })).toBe(false);

    expect(shouldRefreshModelList({ scope: "providers" }, "openai-main")).toBe(false);
    expect(shouldRefreshModelList({ scope: "models", provider_id: "openai-main" }, "openai-main")).toBe(true);
    expect(shouldRefreshModelList({ scope: "models", provider_id: "anthropic-main" }, "openai-main")).toBe(false);
    expect(shouldRefreshModelList({ scope: "models" }, "openai-main")).toBe(true);
    expect(shouldRefreshModelList({ scope: "models", provider_id: "openai-main" }, null)).toBe(true);
  });
});
