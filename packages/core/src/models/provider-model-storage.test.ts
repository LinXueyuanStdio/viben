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
    expect(config[provider.id]).toMatchObject({
      provider_name: "OpenAI Responses",
      provider_type: "openai-responses",
      base_url: "https://api.openai.com/v1",
      api_key: "sk-test",
      models: {
        "gpt-5.1": {
          model_name: "gpt-5.1",
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
      name: "OpenAI Responses",
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
    expect(config[firstProvider.id].models["gpt-5.1"]).toMatchObject({
      model_name: "gpt-5.1",
      enabled: true,
    });
    expect(config[secondProvider.id].models["gpt-5.1"]).toMatchObject({
      model_name: "gpt-5.1",
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
  provider_name: Anthropic Main
  provider_type: anthropic
  base_url: https://api.anthropic.com/v1
  api_key: sk-ant
  models:
    claude-sonnet-4-5:
      model_name: Claude Sonnet 4.5
`
    );

    const providerManager = new ProviderManager();
    const modelManager = new ModelManager();

    await expect(providerManager.getProvider("anthropic-main")).resolves.toMatchObject({
      id: "anthropic-main",
      type: "anthropic",
      name: "Anthropic Main",
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
  provider_name: OpenAI Main
  provider_type: openai
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
});
