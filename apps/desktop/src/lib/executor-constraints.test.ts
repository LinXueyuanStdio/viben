import { describe, expect, it } from "vitest";
import { filterModelsByExecutor, isProviderAllowed } from "./executor-constraints";

describe("executor provider constraints", () => {
  it("allows OpenAI Responses wherever OpenAI-compatible providers are supported", () => {
    expect(isProviderAllowed("CODEX", "openai-responses")).toBe(true);
    expect(isProviderAllowed("QWEN_CODE", "openai-responses")).toBe(true);
    expect(isProviderAllowed("OPENCODE", "openai-responses")).toBe(true);
  });

  it("keeps OpenAI Responses models in Codex filtering", () => {
    const models = [
      { id: "gpt-5.1", provider_type: "openai" },
      { id: "gpt-5.1-codex", provider_type: "openai-responses" },
      { id: "claude-sonnet", provider_type: "anthropic" },
    ];

    expect(filterModelsByExecutor(models, "CODEX").map((model) => model.id)).toEqual([
      "gpt-5.1",
      "gpt-5.1-codex",
    ]);
  });
});
