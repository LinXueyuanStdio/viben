/**
 * Model Routes Integration Tests
 *
 * These tests use real ModelManager instances with temporary directories
 * to verify provider-scoped models.yaml behavior end to end.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTempDir } from "../../test/helpers/temp-dir";
import type { TempDirContext } from "../../test/helpers/temp-dir";

const MODELS_YAML = `
openai-main:
  id: openai-main
  type: openai
  name: OpenAI Main
  api_key: sk-openai
  enabled: true
  models:
    gpt-4o:
      name: GPT-4o
      enabled: true
anthropic-main:
  id: anthropic-main
  type: anthropic
  name: Anthropic Main
  api_key: sk-ant
  enabled: true
  models:
    gpt-4o:
      name: GPT-4o via Anthropic
      enabled: true
    claude-sonnet:
      name: Claude Sonnet
      enabled: true
openai-disabled:
  id: openai-disabled
  type: openai
  name: Disabled OpenAI
  api_key: sk-disabled
  enabled: false
  models:
    gpt-disabled:
      name: Disabled GPT
      enabled: true
`;

describe("Model Routes - Integration Tests", () => {
  let tempDir: TempDirContext;
  let app: FastifyInstance;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    originalEnv = process.env.VIBEN_STATE_DIR;
    tempDir = await createTempDir("viben-models-integration-");
    process.env.VIBEN_STATE_DIR = tempDir.root;
    await tempDir.writeFile("models.yaml", MODELS_YAML);

    const [{ registerModelRoutes }, { modelManager }, { providerManager }] = await Promise.all([
      import("./models"),
      import("../../models"),
      import("../../providers"),
    ]);
    await Promise.all([modelManager.reload(), providerManager.reload()]);

    app = fastify({ logger: false });
    registerModelRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await tempDir.cleanup();
    }
    if (originalEnv !== undefined) {
      process.env.VIBEN_STATE_DIR = originalEnv;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    const [{ modelManager }, { providerManager }] = await Promise.all([
      import("../../models"),
      import("../../providers"),
    ]);
    await Promise.all([modelManager.reload(), providerManager.reload()]);
  });

  describe("GET /api/models", () => {
    it("returns configured provider-scoped models only", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "gpt-4o",
            provider_id: "openai-main",
            provider_type: "openai",
            is_available: true,
          }),
          expect.objectContaining({
            id: "gpt-4o",
            provider_id: "anthropic-main",
            provider_type: "anthropic",
            is_available: true,
          }),
          expect.objectContaining({
            id: "gpt-disabled",
            provider_id: "openai-disabled",
            provider_type: "openai",
            is_available: false,
          }),
        ])
      );
      expect(body.total).toBe(4);
    });

    it("filters by provider_id", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models?provider_id=anthropic-main&workspace_path=/test/path",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe("/test/path");
      expect(body.models).toHaveLength(2);
      expect(body.models.every((model: { provider_id: string }) => model.provider_id === "anthropic-main")).toBe(true);
    });
  });

  describe("POST /api/models", () => {
    it("requires provider_id", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "missing-provider",
          name: "Missing Provider",
          provider: "openai",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain("Provider ID is required");
    });

    it("creates a model under the specified provider and persists provider-map YAML", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "manual-image",
          name: "Manual Image",
          provider_id: "openai-main",
          category: "media",
          surface: "image",
          capabilities: ["t2i"],
          description: "A manually configured image model",
          context_window: 32000,
          max_output_tokens: 4096,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: "manual-image",
        name: "Manual Image",
        provider_id: "openai-main",
        provider_type: "openai",
        category: "media",
        surface: "image",
      });

      const content = await tempDir.readFile("models.yaml");
      expect(content).toContain("openai-main:");
      expect(content).toContain("manual-image:");
      expect(content).toContain("name: Manual Image");
      expect(content).toContain("enabled: true");
      expect(content).not.toContain("__viben");
      expect(content).not.toContain("fallbacks:");
      expect(content).not.toContain("providers.yaml");
    });
  });

  describe("GET /api/models/:id", () => {
    it("returns 400 when model_id matches multiple providers without provider_id", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain("Provide provider_id");
    });

    it("uses provider_id to disambiguate duplicate model IDs", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o?provider_id=anthropic-main",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        id: "gpt-4o",
        name: "GPT-4o via Anthropic",
        provider_id: "anthropic-main",
        provider_type: "anthropic",
      });
    });

    it("returns 404 for non-existent model", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models/non-existent-model-xyz",
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).error).toContain("not found");
    });
  });

  describe("Model Aliases And Fallbacks", () => {
    it("does not persist custom aliases", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { alias: "best-model", model: "claude-sonnet" },
      });

      expect(createResponse.statusCode).toBe(201);

      const listResponse = await app.inject({
        method: "GET",
        url: "/api/models/aliases",
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      expect(body.aliases["best-model"]).toBeUndefined();
    });

    it("has no fallback API", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Model Enable/Disable", () => {
    it("disables and enables a model scoped by provider_id", async () => {
      const disableResponse = await app.inject({
        method: "POST",
        url: "/api/models/gpt-4o/disable?provider_id=openai-main",
      });

      expect(disableResponse.statusCode).toBe(200);
      expect(JSON.parse(disableResponse.body)).toMatchObject({
        provider_id: "openai-main",
        model_id: "gpt-4o",
        enabled: false,
      });

      const afterDisable = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o?provider_id=openai-main",
      });
      expect(JSON.parse(afterDisable.body).enabled).toBe(false);

      const enableResponse = await app.inject({
        method: "POST",
        url: "/api/models/gpt-4o/enable?provider_id=openai-main",
      });

      expect(enableResponse.statusCode).toBe(200);
      expect(JSON.parse(enableResponse.body)).toMatchObject({
        provider_id: "openai-main",
        model_id: "gpt-4o",
        enabled: true,
      });
    });
  });

  describe("Model Configuration", () => {
    it("sets, returns, and persists snake_case model configuration per provider", async () => {
      const setResponse = await app.inject({
        method: "PUT",
        url: "/api/models/claude-sonnet/config",
        payload: {
          provider_id: "anthropic-main",
          temperature: 0.8,
          max_tokens: 2048,
          top_p: 0.95,
        },
      });

      expect(setResponse.statusCode).toBe(200);
      const setBody = JSON.parse(setResponse.body);
      expect(setBody.config).toMatchObject({
        temperature: 0.8,
        max_tokens: 2048,
        top_p: 0.95,
      });
      expect(setBody.config.maxTokens).toBeUndefined();

      const getResponse = await app.inject({
        method: "GET",
        url: "/api/models/claude-sonnet/config?provider_id=anthropic-main",
      });

      expect(getResponse.statusCode).toBe(200);
      expect(JSON.parse(getResponse.body).config).toMatchObject({
        temperature: 0.8,
        max_tokens: 2048,
        top_p: 0.95,
      });

      const content = await tempDir.readFile("models.yaml");
      expect(content).toContain("config:");
      expect(content).toContain("max_tokens: 2048");
      expect(content).not.toContain("maxTokens");
    });

    it("requires provider_id for model configuration writes", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/models/claude-sonnet/config",
        payload: { temperature: 0.5 },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain("Provider ID is required");
    });

    it("deletes model configuration for a specific provider", async () => {
      await app.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: {
          provider_id: "openai-main",
          temperature: 0.5,
        },
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o/config?provider_id=openai-main",
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(JSON.parse(deleteResponse.body)).toMatchObject({
        success: true,
        provider_id: "openai-main",
        deleted: "gpt-4o",
      });

      const getResponse = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o/config?provider_id=openai-main",
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/models/:id", () => {
    it("requires provider_id", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/models/claude-sonnet",
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain("Provider ID is required");
    });

    it("deletes only the provider-scoped model configuration", async () => {
      await app.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: {
          provider_id: "openai-main",
          temperature: 0.4,
        },
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o?provider_id=openai-main",
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(JSON.parse(deleteResponse.body)).toMatchObject({
        success: true,
        provider_id: "openai-main",
        deleted: "gpt-4o",
      });

      const openaiResponse = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o?provider_id=openai-main",
      });
      expect(openaiResponse.statusCode).toBe(200);
      expect(JSON.parse(openaiResponse.body).config).toBeNull();

      const anthropicResponse = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o?provider_id=anthropic-main",
      });
      expect(anthropicResponse.statusCode).toBe(200);
    });
  });
});
