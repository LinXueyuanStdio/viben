import { describe, expect, it } from "vitest";
import { resolveAgentProviderDefault } from "./use-agent-model-selection";

describe("resolveAgentProviderDefault", () => {
  it("waits for selected agent detail before falling back when list data has no provider", () => {
    expect(resolveAgentProviderDefault({
      selectedAgentId: "deepseek-claudecode",
      hasCurrentSelectedAgentDetail: false,
      selectedAgentProviderId: null,
      selectedProviderId: null,
      preferredAgentProviderId: "本地-claude",
      filteredProviderIds: ["本地-claude", "deepseek-anthropic"],
    })).toBeNull();
  });

  it("overrides a temporary provider with the selected agent configured provider", () => {
    expect(resolveAgentProviderDefault({
      selectedAgentId: "deepseek-claudecode",
      hasCurrentSelectedAgentDetail: true,
      selectedAgentProviderId: "deepseek-anthropic",
      selectedProviderId: "本地-claude",
      preferredAgentProviderId: "deepseek-anthropic",
      filteredProviderIds: ["本地-claude", "deepseek-anthropic"],
    })).toBe("deepseek-anthropic");
  });
});
