import { describe, expect, it } from "vitest";
import {
  filterModelsByExecutor,
  filterModelsByProvider,
  filterProvidersByExecutor,
  isProviderAllowed,
} from "./executor-constraints";

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

  it("filters providers by executor provider type constraints", () => {
    const providers = [
      { id: "anthropic-main", provider_type: "anthropic", category: "llm", surfaces: ["chat"], enabled: true },
      { id: "openai-main", provider_type: "openai", category: "llm", surfaces: ["chat"], enabled: true },
      { id: "anthropic-media", provider_type: "anthropic", category: "media", surfaces: ["image"], enabled: true },
      { id: "anthropic-disabled", provider_type: "anthropic", category: "llm", surfaces: ["chat"], enabled: false },
    ];

    expect(
      filterProvidersByExecutor(providers, "CLAUDE_CODE", {
        enabledOnly: true,
        chatOnly: true,
      }).map((provider) => provider.id)
    ).toEqual(["anthropic-main"]);
  });

  it("filters models by selected provider id", () => {
    const models = [
      { id: "claude-main", provider_id: "anthropic-main", provider_type: "anthropic" },
      { id: "claude-backup", provider_id: "anthropic-backup", provider_type: "anthropic" },
      { id: "gpt-main", provider_id: "openai-main", provider_type: "openai" },
    ];

    expect(filterModelsByProvider(models, "ANTHROPIC-MAIN").map((model) => model.id)).toEqual([
      "claude-main",
    ]);
  });
});
