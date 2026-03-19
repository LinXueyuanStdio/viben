/**
 * Model Routes Integration Tests
 *
 * These tests use real ModelManager instances with temporary directories
 * to verify actual file system operations and end-to-end route behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTempDir } from "../../test/helpers/temp-dir";
import type { TempDirContext } from "../../test/helpers/temp-dir";

describe("Model Routes - Integration Tests", () => {
  let tempDir: TempDirContext;
  let app: FastifyInstance;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Save original env
    originalEnv = process.env.VIBEN_STATE_DIR;

    // Create temp directory
    tempDir = await createTempDir("viben-models-integration-");

    // Set the environment variable BEFORE importing the modules
    process.env.VIBEN_STATE_DIR = tempDir.root;

    // Dynamically import to get fresh module with new env
    const { registerModelRoutes } = await import("./models");

    // Create a new Fastify instance
    app = fastify({ logger: false });
    registerModelRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    // Cleanup
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await tempDir.cleanup();
    }
    // Restore environment variable
    if (originalEnv !== undefined) {
      process.env.VIBEN_STATE_DIR = originalEnv;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
  });

  describe("GET /api/models", () => {
    it("should return real model list with known models", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should have models array
      expect(body.models).toBeDefined();
      expect(Array.isArray(body.models)).toBe(true);

      // Should include known models (from KNOWN_MODELS)
      expect(body.models.length).toBeGreaterThan(0);

      // Check structure of a model
      const firstModel = body.models[0];
      expect(firstModel).toHaveProperty("id");
      expect(firstModel).toHaveProperty("name");
      expect(firstModel).toHaveProperty("provider");
      expect(firstModel).toHaveProperty("enabled");
      expect(firstModel).toHaveProperty("is_available");

      // Should have total count
      expect(body.total).toBe(body.models.length);
    });

    it("should include workspace_path in response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models?workspace_path=/test/path",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe("/test/path");
    });
  });

  describe("POST /api/models", () => {
    it("should create a new custom model and persist to file", async () => {
      const newModel = {
        id: "custom-model-1",
        name: "Custom Model 1",
        provider: "custom-provider",
        description: "A test custom model",
        context_window: 32000,
        max_output_tokens: 4096,
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/models",
        payload: newModel,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("custom-model-1");
      expect(body.name).toBe("Custom Model 1");
      expect(body.provider).toBe("custom-provider");

      // Verify file was created
      const fileExists = await tempDir.exists("models.yaml");
      expect(fileExists).toBe(true);

      // Read the file and verify content
      const content = await tempDir.readFile("models.yaml");
      expect(content).toContain("custom-model-1");
      expect(content).toContain("Custom Model 1");
    });

    it("should set model as default when set_as_default is true", async () => {
      const newModel = {
        id: "default-custom-model",
        name: "Default Custom Model",
        provider: "test-provider",
        set_as_default: true,
      };

      const createResponse = await app.inject({
        method: "POST",
        url: "/api/models",
        payload: newModel,
      });

      expect(createResponse.statusCode).toBe(201);

      // Check default was set
      const defaultResponse = await app.inject({
        method: "GET",
        url: "/api/models/default",
      });

      expect(defaultResponse.statusCode).toBe(200);
      const defaultBody = JSON.parse(defaultResponse.body);
      expect(defaultBody.default_model_id).toBe("default-custom-model");
    });
  });

  describe("GET /api/models/:id", () => {
    it("should return a known model by ID", async () => {
      // gpt-4o is a known model
      const response = await app.inject({
        method: "GET",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("gpt-4o");
      expect(body.provider).toBe("openai");
    });

    it("should return 404 for non-existent model", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/models/non-existent-model-xyz",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("not found");
    });
  });

  describe("Default Model Management", () => {
    it("should set and get default model", async () => {
      // Set default
      const setResponse = await app.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: { model_id: "gpt-4o" },
      });

      expect(setResponse.statusCode).toBe(200);
      const setBody = JSON.parse(setResponse.body);
      expect(setBody.success).toBe(true);
      expect(setBody.default_model_id).toBe("gpt-4o");

      // Get default
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/models/default",
      });

      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.default_model_id).toBe("gpt-4o");
    });
  });

  describe("Model Aliases", () => {
    it("should create and list aliases", async () => {
      // Create alias
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { alias: "best-model", model: "claude-3-5-sonnet-20241022" },
      });

      expect(createResponse.statusCode).toBe(201);

      // List aliases
      const listResponse = await app.inject({
        method: "GET",
        url: "/api/models/aliases",
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      expect(body.aliases["best-model"]).toBe("claude-3-5-sonnet-20241022");
    });

    it("should delete an alias", async () => {
      // Create alias first
      await app.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { alias: "temp-alias", model: "gpt-4o" },
      });

      // Delete alias
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: "/api/models/aliases/temp-alias",
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.success).toBe(true);
      expect(body.deleted).toBe("temp-alias");
    });
  });

  describe("Fallback Chain", () => {
    it("should manage fallback chain", async () => {
      // Add fallback
      const addResponse = await app.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: { model: "gpt-4o" },
      });

      expect(addResponse.statusCode).toBe(201);
      const addBody = JSON.parse(addResponse.body);
      expect(addBody.fallbacks).toContain("gpt-4o");

      // Get fallbacks
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/models/fallbacks",
      });

      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.fallbacks).toContain("gpt-4o");

      // Set fallbacks
      const setResponse = await app.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: { fallbacks: ["claude-3-5-sonnet-20241022", "gpt-4o"] },
      });

      expect(setResponse.statusCode).toBe(200);
      const setBody = JSON.parse(setResponse.body);
      expect(setBody.fallbacks).toEqual(["claude-3-5-sonnet-20241022", "gpt-4o"]);

      // Remove fallback
      const removeResponse = await app.inject({
        method: "DELETE",
        url: "/api/models/fallbacks/gpt-4o",
      });

      expect(removeResponse.statusCode).toBe(200);
      const removeBody = JSON.parse(removeResponse.body);
      expect(removeBody.fallbacks).not.toContain("gpt-4o");
    });

    it("should clear all fallbacks", async () => {
      // Add some fallbacks
      await app.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: { fallbacks: ["model-1", "model-2"] },
      });

      // Clear fallbacks
      const response = await app.inject({
        method: "DELETE",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fallbacks).toEqual([]);
    });
  });

  describe("Model Enable/Disable", () => {
    it("should disable and enable a known model", async () => {
      // Disable model
      const disableResponse = await app.inject({
        method: "POST",
        url: "/api/models/gpt-4o/disable",
      });

      expect(disableResponse.statusCode).toBe(200);
      const disableBody = JSON.parse(disableResponse.body);
      expect(disableBody.enabled).toBe(false);

      // Enable model
      const enableResponse = await app.inject({
        method: "POST",
        url: "/api/models/gpt-4o/enable",
      });

      expect(enableResponse.statusCode).toBe(200);
      const enableBody = JSON.parse(enableResponse.body);
      expect(enableBody.enabled).toBe(true);
    });
  });

  describe("Model Configuration", () => {
    it("should set and get model configuration", async () => {
      const config = {
        temperature: 0.8,
        maxTokens: 2048,
        topP: 0.95,
      };

      // Set config
      const setResponse = await app.inject({
        method: "PUT",
        url: "/api/models/claude-3-5-sonnet-20241022/config",
        payload: config,
      });

      expect(setResponse.statusCode).toBe(200);
      const setBody = JSON.parse(setResponse.body);
      expect(setBody.success).toBe(true);
      expect(setBody.config.temperature).toBe(0.8);

      // Get config
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/models/claude-3-5-sonnet-20241022/config",
      });

      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.config.temperature).toBe(0.8);
      expect(getBody.config.maxTokens).toBe(2048);
    });

    it("should delete model configuration", async () => {
      // First set a config
      await app.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: { temperature: 0.5 },
      });

      // Delete config
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o/config",
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.success).toBe(true);
    });
  });

  describe("File System Verification", () => {
    it("should persist changes to models.yaml file", async () => {
      // Create a custom model
      await app.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "persisted-model",
          name: "Persisted Model",
          provider: "test",
        },
      });

      // Set default
      await app.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: { model_id: "persisted-model" },
      });

      // Add fallbacks
      await app.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: { fallbacks: ["fallback-1", "fallback-2"] },
      });

      // Verify file content
      const content = await tempDir.readFile("models.yaml");

      expect(content).toContain("persisted-model");
      expect(content).toContain("Persisted Model");
      expect(content).toContain("default:");
      expect(content).toContain("fallbacks:");
    });
  });
});
