import { describe, expect, it } from "vitest";
import {
  buildClaudeCodeProviderSwitch,
  filterProviderModels,
  filterSelectorProviders,
} from "./provider-model-selection";

const providers = [
  {
    id: "anthropic-main",
    provider_type: "anthropic",
    category: "llm",
    name: "Anthropic Main",
    surfaces: ["chat"],
    enabled: true,
    is_default: true,
  },
  {
    id: "anthropic-disabled",
    provider_type: "anthropic",
    category: "llm",
    name: "Disabled Anthropic",
    surfaces: ["chat"],
    enabled: false,
    is_default: false,
  },
  {
    id: "image-only",
    provider_type: "anthropic",
    category: "media",
    name: "Image Only",
    surfaces: ["image"],
    enabled: true,
    is_default: false,
  },
  {
    id: "openai-main",
    provider_type: "openai",
    category: "llm",
    name: "OpenAI Main",
    surfaces: ["chat"],
    enabled: true,
    is_default: false,
  },
];

const models = [
  {
    id: "claude-sonnet-main",
    name: "Claude Sonnet Main",
    provider_type: "anthropic",
    provider_id: "anthropic-main",
    is_available: true,
  },
  {
    id: "claude-haiku-main",
    name: "Claude Haiku Main",
    provider_type: "anthropic",
    provider_id: "anthropic-main",
    is_available: true,
  },
  {
    id: "claude-opus-main",
    name: "Claude Opus Main",
    provider_type: "anthropic",
    provider_id: "anthropic-main",
    is_available: true,
  },
  {
    id: "claude-sonnet-disabled-provider",
    name: "Claude Sonnet Disabled",
    provider_type: "anthropic",
    provider_id: "anthropic-disabled",
    is_available: true,
  },
  {
    id: "gpt-5.1",
    name: "GPT 5.1",
    provider_type: "openai",
    provider_id: "openai-main",
    is_available: true,
  },
];

describe("provider model selection", () => {
  it("keeps only enabled LLM/chat providers allowed for an executor", () => {
    expect(filterSelectorProviders(providers, ["anthropic"]).map((provider) => provider.id)).toEqual([
      "anthropic-main",
    ]);
  });

  it("filters model options by the selected provider id", () => {
    expect(filterProviderModels(models, "anthropic-main").map((model) => model.id)).toEqual([
      "claude-sonnet-main",
      "claude-haiku-main",
      "claude-opus-main",
    ]);
  });

  it("moves Claude Code current and family models to the selected provider models", () => {
    const result = buildClaudeCodeProviderSwitch({
      config: {
        env: {
          CLAUDE_CODE_EFFORT_LEVEL: "high",
          CLAUDE_CODE_SUBAGENT_MODEL: "legacy-subagent",
          ANTHROPIC_MODEL: "gpt-5.1",
          ANTHROPIC_DEFAULT_SONNET_MODEL: "gpt-5.1",
          ANTHROPIC_DEFAULT_HAIKU_MODEL: "gpt-5.1",
          ANTHROPIC_DEFAULT_OPUS_MODEL: "gpt-5.1",
          ANTHROPIC_BASE_URL: "https://old.example.com",
          ANTHROPIC_AUTH_TOKEN: "old-token",
          CUSTOM_FLAG: "1",
        },
      },
      currentModel: "gpt-5.1",
      providerId: "anthropic-main",
      providerModels: filterProviderModels(models, "anthropic-main"),
    });

    expect(result.currentModel).toBe("claude-sonnet-main");
    expect(result.config.model_provider).toBe("anthropic-main");
    expect(result.config.env).toEqual({
      CLAUDE_CODE_EFFORT_LEVEL: "high",
      CLAUDE_CODE_SUBAGENT_MODEL: "claude-haiku-main",
      ANTHROPIC_MODEL: "claude-sonnet-main",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-main",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-main",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-main",
      CUSTOM_FLAG: "1",
    });
  });
});
