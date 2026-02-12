/**
 * Agent Template Management Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { TemplateManager, type CreateTemplateOptions } from "./templates";

// Mock the paths module to use temp directory
vi.mock("../config/paths", async () => {
  const actual = await vi.importActual("../config/paths");
  return {
    ...actual,
    getTemplatesDir: vi.fn(),
    getTemplateDir: vi.fn(),
  };
});

import { getTemplatesDir, getTemplateDir } from "../config/paths";

describe("TemplateManager", () => {
  let manager: TemplateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-template-test-"));
    const templatesDir = join(tempDir, "templates");
    await mkdir(templatesDir, { recursive: true });

    // Set up mocks
    vi.mocked(getTemplatesDir).mockReturnValue(templatesDir);
    vi.mocked(getTemplateDir).mockImplementation((id: string) => join(templatesDir, id));

    manager = new TemplateManager();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe("initialize", () => {
    it("should create templates directory", async () => {
      const newTempDir = await mkdtemp(join(tmpdir(), "viben-template-init-"));
      const newTemplatesDir = join(newTempDir, "templates");
      vi.mocked(getTemplatesDir).mockReturnValue(newTemplatesDir);

      await manager.initialize();

      expect(existsSync(newTemplatesDir)).toBe(true);
      await rm(newTempDir, { recursive: true, force: true });
    });
  });

  // ==========================================================================
  // List Tests
  // ==========================================================================

  describe("list", () => {
    it("should return empty array when no templates exist", async () => {
      const templates = await manager.list();
      expect(templates).toEqual([]);
    });

    it("should list all templates", async () => {
      await manager.create({
        name: "Template One",
        config: { name: "Template One", model: "gpt-4" },
      });
      await manager.create({
        name: "Template Two",
        config: { name: "Template Two", model: "claude-3" },
      });

      const templates = await manager.list();
      expect(templates).toHaveLength(2);
    });

    it("should sort templates by creation date (newest first)", async () => {
      await manager.create({
        id: "older",
        name: "Older Template",
        config: { name: "Older Template" },
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await manager.create({
        id: "newer",
        name: "Newer Template",
        config: { name: "Newer Template" },
      });

      const templates = await manager.list();
      expect(templates[0].id).toBe("newer");
      expect(templates[1].id).toBe("older");
    });
  });

  // ==========================================================================
  // Get Tests
  // ==========================================================================

  describe("get", () => {
    it("should return null for non-existent template", async () => {
      const template = await manager.get("non-existent");
      expect(template).toBeNull();
    });

    it("should return template by ID", async () => {
      await manager.create({
        id: "test-template",
        name: "Test Template",
        description: "A test template",
        config: {
          name: "Test Template",
          model: "gpt-4",
          temperature: 0.7,
        },
      });

      const template = await manager.get("test-template");
      expect(template).not.toBeNull();
      expect(template?.id).toBe("test-template");
      expect(template?.name).toBe("Test Template");
      expect(template?.description).toBe("A test template");
      expect(template?.config.model).toBe("gpt-4");
      expect(template?.config.temperature).toBe(0.7);
    });
  });

  // ==========================================================================
  // Exists Tests
  // ==========================================================================

  describe("exists", () => {
    it("should return false for non-existent template", async () => {
      const exists = await manager.exists("non-existent");
      expect(exists).toBe(false);
    });

    it("should return true for existing template", async () => {
      await manager.create({
        id: "test-template",
        name: "Test Template",
        config: { name: "Test Template" },
      });

      const exists = await manager.exists("test-template");
      expect(exists).toBe(true);
    });
  });

  // ==========================================================================
  // Create Tests
  // ==========================================================================

  describe("create", () => {
    it("should create a template with ID", async () => {
      const template = await manager.create({
        id: "my-template",
        name: "My Template",
        config: { name: "My Template" },
      });

      expect(template.id).toBe("my-template");
      expect(template.name).toBe("My Template");
    });

    it("should generate ID from name if not provided", async () => {
      const template = await manager.create({
        name: "Coding Assistant",
        config: { name: "Coding Assistant" },
      });

      expect(template.id).toBe("coding-assistant");
    });

    it("should throw error if template already exists", async () => {
      await manager.create({
        id: "duplicate",
        name: "Original",
        config: { name: "Original" },
      });

      await expect(
        manager.create({
          id: "duplicate",
          name: "Duplicate",
          config: { name: "Duplicate" },
        })
      ).rejects.toThrow('Template with ID "duplicate" already exists');
    });

    it("should create template with full configuration", async () => {
      const template = await manager.create({
        id: "full-config",
        name: "Full Config Template",
        description: "A template with all config options",
        config: {
          name: "Full Config Template",
          description: "Full description",
          model: "claude-3-opus",
          provider: "anthropic",
          systemPrompt: "You are a helpful assistant.",
          appendPrompt: "Please be concise.",
          temperature: 0.5,
          maxTokens: 4096,
          executorType: "CLAUDE_CODE",
          mcpServers: ["filesystem", "git"],
          skills: ["code-review"],
          planMode: true,
          approvals: false,
        },
      });

      expect(template.config.model).toBe("claude-3-opus");
      expect(template.config.provider).toBe("anthropic");
      expect(template.config.systemPrompt).toBe("You are a helpful assistant.");
      expect(template.config.temperature).toBe(0.5);
      expect(template.config.maxTokens).toBe(4096);
      expect(template.config.mcpServers).toEqual(["filesystem", "git"]);
      expect(template.config.planMode).toBe(true);
    });

    it("should set createdAt timestamp", async () => {
      const before = new Date().toISOString();
      const template = await manager.create({
        name: "Timestamped",
        config: { name: "Timestamped" },
      });
      const after = new Date().toISOString();

      expect(template.createdAt >= before).toBe(true);
      expect(template.createdAt <= after).toBe(true);
    });
  });

  // ==========================================================================
  // CreateFromAgentConfig Tests
  // ==========================================================================

  describe("createFromAgentConfig", () => {
    it("should create template from agent config", async () => {
      const agentConfig = {
        name: "My Agent",
        description: "Agent description",
        model: "gpt-4",
        provider: "openai",
        temperature: 0.8,
      };

      const template = await manager.createFromAgentConfig(
        "agent-template",
        agentConfig,
        "Template from agent"
      );

      expect(template.id).toBe("agent-template");
      expect(template.name).toBe("My Agent");
      expect(template.description).toBe("Template from agent");
      expect(template.config.model).toBe("gpt-4");
      expect(template.config.temperature).toBe(0.8);
    });

    it("should use agent description if custom description not provided", async () => {
      const agentConfig = {
        name: "My Agent",
        description: "Original agent description",
        model: "gpt-4",
      };

      const template = await manager.createFromAgentConfig("agent-template", agentConfig);

      expect(template.description).toBe("Original agent description");
    });
  });

  // ==========================================================================
  // Update Tests
  // ==========================================================================

  describe("update", () => {
    it("should throw error for non-existent template", async () => {
      await expect(manager.update("non-existent", { name: "Updated" })).rejects.toThrow(
        'Template "non-existent" not found'
      );
    });

    it("should update template name", async () => {
      await manager.create({
        id: "update-test",
        name: "Original Name",
        config: { name: "Original Name" },
      });

      const updated = await manager.update("update-test", { name: "Updated Name" });

      expect(updated.name).toBe("Updated Name");
    });

    it("should update template config", async () => {
      await manager.create({
        id: "update-config",
        name: "Original",
        config: { name: "Original", model: "gpt-3.5" },
      });

      const updated = await manager.update("update-config", {
        config: { model: "gpt-4", temperature: 0.9 },
      });

      expect(updated.config.model).toBe("gpt-4");
      expect(updated.config.temperature).toBe(0.9);
    });

    it("should preserve original values when not updated", async () => {
      await manager.create({
        id: "preserve-test",
        name: "Original",
        description: "Original description",
        config: { name: "Original", model: "gpt-4" },
      });

      const updated = await manager.update("preserve-test", { name: "New Name" });

      expect(updated.name).toBe("New Name");
      expect(updated.description).toBe("Original description");
      expect(updated.config.model).toBe("gpt-4");
    });
  });

  // ==========================================================================
  // Remove Tests
  // ==========================================================================

  describe("remove", () => {
    it("should throw error for non-existent template", async () => {
      await expect(manager.remove("non-existent")).rejects.toThrow(
        'Template "non-existent" not found'
      );
    });

    it("should remove existing template", async () => {
      await manager.create({
        id: "to-remove",
        name: "To Remove",
        config: { name: "To Remove" },
      });

      await manager.remove("to-remove");

      const template = await manager.get("to-remove");
      expect(template).toBeNull();
    });

    it("should remove template directory completely", async () => {
      await manager.create({
        id: "to-delete",
        name: "To Delete",
        config: { name: "To Delete" },
      });

      const templateDir = getTemplateDir("to-delete");
      expect(existsSync(templateDir)).toBe(true);

      await manager.remove("to-delete");

      expect(existsSync(templateDir)).toBe(false);
    });
  });

  // ==========================================================================
  // GetConfig Tests
  // ==========================================================================

  describe("getConfig", () => {
    it("should return null for non-existent template", async () => {
      const config = await manager.getConfig("non-existent");
      expect(config).toBeNull();
    });

    it("should return template config", async () => {
      await manager.create({
        id: "config-test",
        name: "Config Test",
        config: {
          name: "Config Test",
          model: "gpt-4",
          temperature: 0.7,
        },
      });

      const config = await manager.getConfig("config-test");
      expect(config).not.toBeNull();
      expect(config?.name).toBe("Config Test");
      expect(config?.model).toBe("gpt-4");
      expect(config?.temperature).toBe(0.7);
    });
  });

  // ==========================================================================
  // Apply Tests
  // ==========================================================================

  describe("apply", () => {
    it("should throw error for non-existent template", async () => {
      await expect(manager.apply("non-existent")).rejects.toThrow(
        'Template "non-existent" not found'
      );
    });

    it("should return config from template", async () => {
      await manager.create({
        id: "apply-test",
        name: "Apply Test",
        config: {
          name: "Apply Test",
          model: "gpt-4",
        },
      });

      const config = await manager.apply("apply-test");
      expect(config.name).toBe("Apply Test");
      expect(config.model).toBe("gpt-4");
    });

    it("should apply name override", async () => {
      await manager.create({
        id: "override-name",
        name: "Original",
        config: { name: "Original" },
      });

      const config = await manager.apply("override-name", {
        agentId: "new-agent",
        name: "Overridden Name",
      });

      expect(config.name).toBe("Overridden Name");
    });

    it("should apply config overrides", async () => {
      await manager.create({
        id: "override-config",
        name: "Original",
        config: {
          name: "Original",
          model: "gpt-3.5",
          temperature: 0.5,
        },
      });

      const config = await manager.apply("override-config", {
        agentId: "new-agent",
        overrides: {
          model: "gpt-4",
          maxTokens: 8192,
        },
      });

      expect(config.model).toBe("gpt-4");
      expect(config.maxTokens).toBe(8192);
      expect(config.temperature).toBe(0.5); // Preserved from template
    });
  });

  // ==========================================================================
  // Clone Tests
  // ==========================================================================

  describe("clone", () => {
    it("should throw error for non-existent source", async () => {
      await expect(manager.clone("non-existent", "new-template")).rejects.toThrow(
        'Source template "non-existent" not found'
      );
    });

    it("should clone template with new ID", async () => {
      await manager.create({
        id: "source",
        name: "Source Template",
        config: {
          name: "Source Template",
          model: "gpt-4",
          temperature: 0.7,
        },
      });

      const cloned = await manager.clone("source", "cloned");

      expect(cloned.id).toBe("cloned");
      expect(cloned.name).toBe("Source Template (Copy)");
      expect(cloned.config.model).toBe("gpt-4");
      expect(cloned.config.temperature).toBe(0.7);
    });

    it("should clone with custom name", async () => {
      await manager.create({
        id: "source",
        name: "Source Template",
        config: { name: "Source Template" },
      });

      const cloned = await manager.clone("source", "cloned", "Custom Cloned Name");

      expect(cloned.name).toBe("Custom Cloned Name");
    });
  });

  // ==========================================================================
  // Search Tests
  // ==========================================================================

  describe("search", () => {
    beforeEach(async () => {
      await manager.create({
        id: "coding-assistant",
        name: "Coding Assistant",
        description: "Helps with coding tasks",
        config: { name: "Coding Assistant" },
      });
      await manager.create({
        id: "research-helper",
        name: "Research Helper",
        description: "Assists with research",
        config: { name: "Research Helper" },
      });
      await manager.create({
        id: "code-reviewer",
        name: "Code Reviewer",
        description: "Reviews code quality",
        config: { name: "Code Reviewer" },
      });
    });

    it("should find templates by name", async () => {
      const results = await manager.search("coding");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("coding-assistant");
    });

    it("should find templates by description", async () => {
      const results = await manager.search("research");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("research-helper");
    });

    it("should be case-insensitive", async () => {
      // "Coding Assistant" and "Code Reviewer" both match "cod"
      const results = await manager.search("cod");
      expect(results).toHaveLength(2);
    });

    it("should return empty array for no matches", async () => {
      const results = await manager.search("nonexistent");
      expect(results).toEqual([]);
    });
  });

  // ==========================================================================
  // GetByExecutorType Tests
  // ==========================================================================

  describe("getByExecutorType", () => {
    beforeEach(async () => {
      await manager.create({
        id: "claude-template",
        name: "Claude Template",
        config: { name: "Claude Template", executorType: "CLAUDE_CODE" },
      });
      await manager.create({
        id: "gemini-template",
        name: "Gemini Template",
        config: { name: "Gemini Template", executorType: "GEMINI" },
      });
      await manager.create({
        id: "another-claude",
        name: "Another Claude",
        config: { name: "Another Claude", executorType: "CLAUDE_CODE" },
      });
    });

    it("should filter by executor type", async () => {
      const results = await manager.getByExecutorType("CLAUDE_CODE");
      expect(results).toHaveLength(2);
      expect(results.every((t) => t.config.executorType === "CLAUDE_CODE")).toBe(true);
    });

    it("should return empty array for no matches", async () => {
      const results = await manager.getByExecutorType("CODEX");
      expect(results).toEqual([]);
    });
  });
});
