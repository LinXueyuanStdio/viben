/**
 * Agent template management
 *
 * Templates are stored in ~/.viben/templates/{template-id}/
 * Each template contains:
 *   - config.yaml (template configuration)
 *
 * Templates can be created from existing agents and applied to create new agents.
 */
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { getTemplatesDir, getTemplateDir } from "../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../config/yaml";
import type { AgentConfig, AgentTemplate } from "../types";

/**
 * Template configuration file structure
 */
export interface TemplateConfigFile {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  executorConfig?: Record<string, unknown>;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
  createdAt: string;
}

/**
 * Options for creating a template
 */
export interface CreateTemplateOptions {
  /** Template ID (will be derived from name if not provided) */
  id?: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Configuration to use for the template */
  config: Partial<AgentConfig>;
}

/**
 * Options for applying a template
 */
export interface ApplyTemplateOptions {
  /** ID for the new agent */
  agentId: string;
  /** Optional: override template name */
  name?: string;
  /** Optional: override template description */
  description?: string;
  /** Optional: override other config values */
  overrides?: Partial<AgentConfig>;
}

/**
 * TemplateManager handles template CRUD operations
 */
export class TemplateManager {
  /**
   * Initialize the templates directory
   */
  async initialize(): Promise<void> {
    await ensureDir(getTemplatesDir());
  }

  /**
   * List all available templates
   */
  async list(): Promise<AgentTemplate[]> {
    const templatesDir = getTemplatesDir();
    if (!fileExists(templatesDir)) {
      return [];
    }

    const entries = await readdir(templatesDir, { withFileTypes: true });
    const templates: AgentTemplate[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const template = await this.get(entry.name);
        if (template) {
          templates.push(template);
        }
      }
    }

    // Sort by creation date (newest first)
    return templates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get a template by ID
   */
  async get(id: string): Promise<AgentTemplate | null> {
    const templateDir = getTemplateDir(id);
    const configPath = join(templateDir, "config.yaml");

    if (!fileExists(configPath)) {
      return null;
    }

    const config = await readYaml<TemplateConfigFile>(configPath);
    if (!config) {
      return null;
    }

    return {
      id,
      name: config.name,
      description: config.description,
      config: {
        name: config.name,
        description: config.description,
        model: config.model,
        provider: config.provider,
        systemPrompt: config.systemPrompt,
        appendPrompt: config.appendPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        executorType: config.executorType as AgentConfig["executorType"],
        executorConfig: config.executorConfig,
        mcpServers: config.mcpServers,
        skills: config.skills,
        planMode: config.planMode,
        approvals: config.approvals,
      },
      createdAt: config.createdAt,
    };
  }

  /**
   * Check if a template exists
   */
  async exists(id: string): Promise<boolean> {
    const templateDir = getTemplateDir(id);
    return fileExists(templateDir);
  }

  /**
   * Create a new template
   */
  async create(options: CreateTemplateOptions): Promise<AgentTemplate> {
    const id = options.id || this.generateTemplateId(options.name);
    const templateDir = getTemplateDir(id);

    // Check if template already exists
    if (fileExists(templateDir)) {
      throw new Error(`Template with ID "${id}" already exists`);
    }

    const now = new Date().toISOString();
    const config: TemplateConfigFile = {
      name: options.name,
      description: options.description ?? options.config.description,
      model: options.config.model,
      provider: options.config.provider,
      systemPrompt: options.config.systemPrompt,
      appendPrompt: options.config.appendPrompt,
      temperature: options.config.temperature,
      maxTokens: options.config.maxTokens,
      executorType: options.config.executorType,
      executorConfig: options.config.executorConfig,
      mcpServers: options.config.mcpServers,
      skills: options.config.skills,
      planMode: options.config.planMode,
      approvals: options.config.approvals,
      createdAt: now,
    };

    // Create template directory and config
    await ensureDir(templateDir);
    await writeYaml(join(templateDir, "config.yaml"), config);

    return {
      id,
      name: config.name,
      description: config.description,
      config: {
        name: config.name,
        description: config.description,
        model: config.model,
        provider: config.provider,
        systemPrompt: config.systemPrompt,
        appendPrompt: config.appendPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        executorType: config.executorType as AgentConfig["executorType"],
        executorConfig: config.executorConfig,
        mcpServers: config.mcpServers,
        skills: config.skills,
        planMode: config.planMode,
        approvals: config.approvals,
      },
      createdAt: now,
    };
  }

  /**
   * Create a template from an existing agent configuration
   */
  async createFromAgentConfig(
    templateId: string,
    agentConfig: AgentConfig & { name: string },
    description?: string
  ): Promise<AgentTemplate> {
    return this.create({
      id: templateId,
      name: agentConfig.name,
      description: description ?? agentConfig.description,
      config: agentConfig,
    });
  }

  /**
   * Update an existing template
   */
  async update(id: string, updates: Partial<CreateTemplateOptions>): Promise<AgentTemplate> {
    const template = await this.get(id);
    if (!template) {
      throw new Error(`Template "${id}" not found`);
    }

    const templateDir = getTemplateDir(id);
    const configPath = join(templateDir, "config.yaml");

    const existingConfig = await readYaml<TemplateConfigFile>(configPath);
    if (!existingConfig) {
      throw new Error(`Template "${id}" config file corrupted`);
    }

    // Merge updates
    const updatedConfig: TemplateConfigFile = {
      ...existingConfig,
      name: updates.name ?? existingConfig.name,
      description: updates.description ?? existingConfig.description,
      model: updates.config?.model ?? existingConfig.model,
      provider: updates.config?.provider ?? existingConfig.provider,
      systemPrompt: updates.config?.systemPrompt ?? existingConfig.systemPrompt,
      appendPrompt: updates.config?.appendPrompt ?? existingConfig.appendPrompt,
      temperature: updates.config?.temperature ?? existingConfig.temperature,
      maxTokens: updates.config?.maxTokens ?? existingConfig.maxTokens,
      executorType: updates.config?.executorType ?? existingConfig.executorType,
      executorConfig: updates.config?.executorConfig ?? existingConfig.executorConfig,
      mcpServers: updates.config?.mcpServers ?? existingConfig.mcpServers,
      skills: updates.config?.skills ?? existingConfig.skills,
      planMode: updates.config?.planMode ?? existingConfig.planMode,
      approvals: updates.config?.approvals ?? existingConfig.approvals,
    };

    await writeYaml(configPath, updatedConfig);

    return {
      id,
      name: updatedConfig.name,
      description: updatedConfig.description,
      config: {
        name: updatedConfig.name,
        description: updatedConfig.description,
        model: updatedConfig.model,
        provider: updatedConfig.provider,
        systemPrompt: updatedConfig.systemPrompt,
        appendPrompt: updatedConfig.appendPrompt,
        temperature: updatedConfig.temperature,
        maxTokens: updatedConfig.maxTokens,
        executorType: updatedConfig.executorType as AgentConfig["executorType"],
        executorConfig: updatedConfig.executorConfig,
        mcpServers: updatedConfig.mcpServers,
        skills: updatedConfig.skills,
        planMode: updatedConfig.planMode,
        approvals: updatedConfig.approvals,
      },
      createdAt: updatedConfig.createdAt,
    };
  }

  /**
   * Remove a template
   */
  async remove(id: string): Promise<void> {
    const templateDir = getTemplateDir(id);
    if (!fileExists(templateDir)) {
      throw new Error(`Template "${id}" not found`);
    }

    await rm(templateDir, { recursive: true, force: true });
  }

  /**
   * Get the configuration from a template that can be used to create an agent
   */
  async getConfig(id: string): Promise<AgentConfig | null> {
    const template = await this.get(id);
    if (!template) {
      return null;
    }
    return template.config;
  }

  /**
   * Apply a template to get agent configuration with optional overrides
   */
  async apply(id: string, options?: ApplyTemplateOptions): Promise<AgentConfig> {
    const template = await this.get(id);
    if (!template) {
      throw new Error(`Template "${id}" not found`);
    }

    const config: AgentConfig = {
      ...template.config,
      name: options?.name ?? template.config.name,
      description: options?.description ?? template.config.description,
      ...options?.overrides,
    };

    return config;
  }

  /**
   * Clone a template to create a new one
   */
  async clone(sourceId: string, targetId: string, name?: string): Promise<AgentTemplate> {
    const source = await this.get(sourceId);
    if (!source) {
      throw new Error(`Source template "${sourceId}" not found`);
    }

    return this.create({
      id: targetId,
      name: name ?? `${source.name} (Copy)`,
      description: source.description,
      config: source.config,
    });
  }

  /**
   * Search templates by name or description
   */
  async search(query: string): Promise<AgentTemplate[]> {
    const templates = await this.list();
    const lowerQuery = query.toLowerCase();

    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        (t.description?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }

  /**
   * Get templates filtered by executor type
   */
  async getByExecutorType(executorType: string): Promise<AgentTemplate[]> {
    const templates = await this.list();
    return templates.filter((t) => t.config.executorType === executorType);
  }

  /**
   * Generate a valid template ID from a name
   */
  private generateTemplateId(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) || `template-${Date.now()}`
    );
  }
}

// Export singleton instance
export const templateManager = new TemplateManager();
