import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "yaml";
import { createTempDir, type TempDirContext } from "../test/helpers/temp-dir";
import { ProviderManager } from "../providers";
import { ModelManager } from "./index";

describe("provider and model unified YAML storage", () => {
  let tempDir: TempDirContext;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    originalStateDir = process.env.VIBEN_STATE_DIR;
    tempDir = await createTempDir("provider-model-storage-");
    process.env.VIBEN_STATE_DIR = tempDir.root;
  });

  afterEach(async () => {
    if (originalStateDir === undefined) {
      delete process.env.VIBEN_STATE_DIR;
    } else {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    }
    await tempDir.cleanup();
  });

  it("stores provider instances and their models in one models.yaml file", async () => {
    const providerManager = new ProviderManager();
    const modelManager = new ModelManager();

    const provider = await providerManager.createProvider({
      type: "openai-responses",
      name: "OpenAI Responses",
      apiKey: "sk-test",
      base_url: "https://api.openai.com/v1",
      setAsDefault: true,
    });

    await modelManager.enableModel("gpt-5.1", provider.type, provider.id);

    expect(await tempDir.exists("providers.yaml")).toBe(false);
    expect(await tempDir.exists("models.yaml")).toBe(true);

    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config[provider.id]).toEqual({
      id: provider.id,
      type: "openai-responses",
      base_url: "https://api.openai.com/v1",
      api_key: "sk-test",
      models: {
        "gpt-5.1": {
          name: "gpt-5.1",
          enabled: true,
        },
      },
    });

    await providerManager.reload();
    await modelManager.reload();

    await expect(providerManager.getProvider(provider.id)).resolves.toMatchObject({
      id: provider.id,
      type: "openai-responses",
      apiKey: "sk-test",
    });
    await expect(modelManager.getModelsByProviderId(provider.id)).resolves.toEqual([
      expect.objectContaining({
        id: "gpt-5.1",
        name: "gpt-5.1",
        provider: "openai-responses",
        provider_id: provider.id,
        enabled: true,
      }),
    ]);
  });

  it("keeps identical model IDs isolated by provider ID", async () => {
    const providerManager = new ProviderManager();
    const modelManager = new ModelManager();

    const firstProvider = await providerManager.createProvider({
      type: "openai",
      name: "First OpenAI",
      apiKey: "sk-first",
    });
    const secondProvider = await providerManager.createProvider({
      type: "openai-responses",
      name: "Second OpenAI",
      apiKey: "sk-second",
    });

    await modelManager.enableModel("gpt-5.1", firstProvider.type, firstProvider.id);
    await modelManager.enableModel("gpt-5.1", secondProvider.type, secondProvider.id);

    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config[firstProvider.id].models["gpt-5.1"]).toEqual({
      name: "gpt-5.1",
      enabled: true,
    });
    expect(config[secondProvider.id].models["gpt-5.1"]).toEqual({
      name: "gpt-5.1",
      enabled: true,
    });

    await expect(modelManager.getModelsByProviderId(firstProvider.id)).resolves.toEqual([
      expect.objectContaining({
        id: "gpt-5.1",
        provider: "openai",
        provider_id: firstProvider.id,
      }),
    ]);
    await expect(modelManager.getModelsByProviderId(secondProvider.id)).resolves.toEqual([
      expect.objectContaining({
        id: "gpt-5.1",
        provider: "openai-responses",
        provider_id: secondProvider.id,
      }),
    ]);
  });

  it("reads the requested provider/model shape from models.yaml", async () => {
    await tempDir.writeFile(
      "models.yaml",
      `anthropic-main:
  id: anthropic-main
  type: anthropic
  base_url: https://api.anthropic.com/v1
  api_key: sk-ant
  models:
    claude-sonnet-4-5:
      name: Claude Sonnet 4.5
      enabled: true
`
    );

    const providerManager = new ProviderManager();
    const modelManager = new ModelManager();

    await expect(providerManager.getProvider("anthropic-main")).resolves.toMatchObject({
      id: "anthropic-main",
      type: "anthropic",
      apiKey: "sk-ant",
    });
    await expect(modelManager.getModel("claude-sonnet-4-5")).resolves.toMatchObject({
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      provider: "anthropic",
      provider_id: "anthropic-main",
      enabled: true,
    });
  });

  it("normalizes legacy apiKey to api_key when provider config is saved", async () => {
    await tempDir.writeFile(
      "models.yaml",
      `openai-main:
  id: openai-main
  type: openai
  apiKey: sk-camel
  models: {}
`
    );

    const providerManager = new ProviderManager();
    await expect(providerManager.getProvider("openai-main")).resolves.toMatchObject({
      apiKey: "sk-camel",
    });

    await providerManager.updateProvider("openai-main", {
      name: "OpenAI Renamed",
    });

    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config["openai-main"].api_key).toBe("sk-camel");
    expect(config["openai-main"].apiKey).toBeUndefined();
  });

  it("does not read or merge legacy providers.yaml into model storage", async () => {
    await tempDir.writeFile(
      "providers.yaml",
      `default: legacy-openai
providers:
  legacy-openai:
    provider_type: openai
    name: Legacy OpenAI
    api_key: sk-legacy
`
    );

    const providerManager = new ProviderManager();
    const modelManager = new ModelManager();

    await expect(providerManager.listProviders()).resolves.toEqual([]);
    await expect(modelManager.listModels()).resolves.toEqual([]);
  });

  it("does not write __viben or legacy top-level metadata to models.yaml", async () => {
    const providerManager = new ProviderManager();
    const modelManager = new ModelManager();

    const provider = await providerManager.createProvider({
      type: "openai",
      name: "OpenAI Main",
      apiKey: "sk-test",
      setAsDefault: true,
    });
    await modelManager.createAlias("fast", "gpt-5.1");
    await modelManager.setDefault("gpt-5.1");
    await modelManager.setDefaultForSurface("chat", "gpt-5.1");
    await modelManager.setFallbacks(["gpt-5.1"]);
    await modelManager.enableModel("gpt-5.1", provider.type, provider.id);

    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config.__viben).toBeUndefined();
    expect(config.default).toBeUndefined();
    expect(config.default_provider).toBeUndefined();
    expect(config.defaults).toBeUndefined();
    expect(config.aliases).toBeUndefined();
    expect(config.fallbacks).toBeUndefined();
    expect(config.configs).toBeUndefined();
    expect(Object.keys(config)).toEqual([provider.id]);
  });

  it("requires provider_id for creating new models and never falls back to provider type", async () => {
    const modelManager = new ModelManager();

    await expect(modelManager.enableModel("gpt-5.1", "openai")).rejects.toThrow(
      "Provider ID is required"
    );
    expect(await tempDir.exists("models.yaml")).toBe(false);
  });

  it("throws on global model lookup and mutation when model_id exists in multiple providers", async () => {
    await tempDir.writeFile(
      "models.yaml",
      `openai-main:
  id: openai-main
  type: openai
  api_key: sk-openai
  models:
    shared-model:
      name: OpenAI Shared
      enabled: true
anthropic-main:
  id: anthropic-main
  type: anthropic
  api_key: sk-ant
  models:
    shared-model:
      name: Anthropic Shared
      enabled: true
`
    );

    const modelManager = new ModelManager();

    await expect(modelManager.getModel("shared-model")).rejects.toThrow(
      'Model "shared-model" exists in multiple providers'
    );
    await expect(modelManager.updateModel("shared-model", { name: "Renamed" })).rejects.toThrow(
      'Model "shared-model" exists in multiple providers'
    );
    await expect(modelManager.removeModel("shared-model")).rejects.toThrow(
      'Model "shared-model" exists in multiple providers'
    );

    await expect(
      modelManager.getModelForProvider("openai-main", "shared-model")
    ).resolves.toMatchObject({
      id: "shared-model",
      name: "OpenAI Shared",
      provider: "openai",
      provider_id: "openai-main",
    });

    await modelManager.updateModelForProvider("anthropic-main", "shared-model", {
      name: "Anthropic Renamed",
    });
    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config["openai-main"].models["shared-model"].name).toBe("OpenAI Shared");
    expect(config["anthropic-main"].models["shared-model"].name).toBe("Anthropic Renamed");
  });

  it("stores model configs under the resolved provider model instead of a global configs map", async () => {
    await tempDir.writeFile(
      "models.yaml",
      `openai-main:
  id: openai-main
  type: openai
  models:
    shared-model:
      name: OpenAI Shared
      enabled: true
anthropic-main:
  id: anthropic-main
  type: anthropic
  models:
    shared-model:
      name: Anthropic Shared
      enabled: true
`
    );

    const modelManager = new ModelManager();

    await modelManager.setModelConfigForProvider("openai-main", "shared-model", {
      temperature: 0.2,
    });
    await modelManager.setModelConfigForProvider("anthropic-main", "shared-model", {
      temperature: 0.8,
    });

    await expect(
      modelManager.getModelConfigForProvider("openai-main", "shared-model")
    ).resolves.toEqual({
      temperature: 0.2,
    });
    await expect(
      modelManager.getModelConfigForProvider("anthropic-main", "shared-model")
    ).resolves.toEqual({
      temperature: 0.8,
    });
    await expect(modelManager.getModelConfig("shared-model")).rejects.toThrow(
      'Model "shared-model" exists in multiple providers'
    );

    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config.configs).toBeUndefined();
    expect(config.__viben).toBeUndefined();
    expect(config["openai-main"].models["shared-model"].config.temperature).toBe(0.2);
    expect(config["anthropic-main"].models["shared-model"].config.temperature).toBe(0.8);
  });

  it("migrates legacy top-level configs and camelCase apiKey without saving metadata", async () => {
    await tempDir.writeFile(
      "models.yaml",
      `configs:
  gpt-5.1:
    temperature: 0.4
openai-main:
  id: openai-main
  type: openai
  apiKey: sk-camel
  models:
    gpt-5.1:
      name: GPT 5.1
      enabled: true
`
    );

    const modelManager = new ModelManager();

    await expect(modelManager.getModelConfig("gpt-5.1")).resolves.toEqual({
      temperature: 0.4,
    });

    await modelManager.setModelConfig("gpt-5.1", {
      temperature: 0.6,
      maxTokens: 4096,
    });

    const config = parse(await tempDir.readFile("models.yaml"));
    expect(config.configs).toBeUndefined();
    expect(config.__viben).toBeUndefined();
    expect(config["openai-main"].api_key).toBe("sk-camel");
    expect(config["openai-main"].apiKey).toBeUndefined();
    expect(config["openai-main"].models["gpt-5.1"].config).toEqual({
      temperature: 0.6,
      maxTokens: 4096,
    });
  });
});
