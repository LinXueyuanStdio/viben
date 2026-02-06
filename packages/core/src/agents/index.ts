/**
 * Agent management for Viben
 */
import { readdir, rm, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import {
  getAgentsDir,
  getAgentDir,
  getAgentConfigPath,
  getAgentSessionsDir,
  getAgentMemoryDir,
  getTemplatesDir,
  getTemplateDir,
} from "../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../config/yaml";
import { configManager } from "../config";
import type {
  Agent,
  AgentConfig,
  AgentTemplate,
  AgentSession,
  AgentMemory,
  DailyLog,
  LogEntry,
  CreateAgentOptions,
} from "../types";
import type { AgentConfigFile, SessionFile } from "./types";

export * from "./types";

/**
 * AgentManager handles agent CRUD operations
 */
export class AgentManager {
  /**
   * Initialize the agents directory
   */
  async initialize(): Promise<void> {
    await ensureDir(getAgentsDir());
    await ensureDir(getTemplatesDir());
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<Agent[]> {
    const agentsDir = getAgentsDir();
    if (!fileExists(agentsDir)) {
      return [];
    }

    const entries = await readdir(agentsDir, { withFileTypes: true });
    const agents: Agent[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const agent = await this.getAgent(entry.name);
        if (agent) {
          agents.push(agent);
        }
      }
    }

    return agents;
  }

  /**
   * Get an agent by ID
   */
  async getAgent(id: string): Promise<Agent | null> {
    const configPath = getAgentConfigPath(id);
    if (!fileExists(configPath)) {
      return null;
    }

    const config = await readYaml<AgentConfigFile>(configPath);
    if (!config) {
      return null;
    }

    return {
      id,
      name: config.name,
      description: config.description,
      model: config.model,
      provider: config.provider,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Create a new agent
   */
  async createAgent(options: CreateAgentOptions): Promise<Agent> {
    const id = options.id || this.generateAgentId(options.name);
    const agentDir = getAgentDir(id);

    // Check if agent already exists
    if (fileExists(agentDir)) {
      throw new Error(`Agent with ID "${id}" already exists`);
    }

    // Create from template if specified
    let baseConfig: Partial<AgentConfig> = {};
    if (options.fromTemplate) {
      const template = await this.getTemplate(options.fromTemplate);
      if (template) {
        baseConfig = template.config;
      }
    }

    const now = new Date().toISOString();
    const config: AgentConfigFile = {
      name: options.name,
      description: options.description || baseConfig.description,
      model: options.model || baseConfig.model,
      provider: options.provider || baseConfig.provider,
      systemPrompt: options.systemPrompt || baseConfig.systemPrompt,
      temperature: options.temperature ?? baseConfig.temperature,
      maxTokens: options.maxTokens ?? baseConfig.maxTokens,
      createdAt: now,
      updatedAt: now,
    };

    // Create agent directory and config
    await ensureDir(agentDir);
    await writeYaml(getAgentConfigPath(id), config);

    // Create subdirectories
    await ensureDir(getAgentSessionsDir(id));
    await ensureDir(getAgentMemoryDir(id));

    return {
      id,
      ...config,
    };
  }

  /**
   * Remove an agent
   */
  async removeAgent(id: string): Promise<void> {
    const agentDir = getAgentDir(id);
    if (!fileExists(agentDir)) {
      throw new Error(`Agent "${id}" not found`);
    }

    // Check if this is the default agent
    const defaultAgent = await configManager.getDefaultAgent();
    if (defaultAgent === id) {
      await configManager.setDefaultAgent(undefined);
    }

    await rm(agentDir, { recursive: true, force: true });
  }

  /**
   * Update an agent
   */
  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<Agent> {
    const agent = await this.getAgent(id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found`);
    }

    const config: AgentConfigFile = {
      name: updates.name ?? agent.name,
      description: updates.description ?? agent.description,
      model: updates.model ?? agent.model,
      provider: updates.provider ?? agent.provider,
      systemPrompt: updates.systemPrompt ?? agent.systemPrompt,
      temperature: updates.temperature ?? agent.temperature,
      maxTokens: updates.maxTokens ?? agent.maxTokens,
      createdAt: agent.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await writeYaml(getAgentConfigPath(id), config);

    return {
      id,
      ...config,
    };
  }

  /**
   * Set the default agent
   */
  async setDefault(id: string): Promise<void> {
    const agent = await this.getAgent(id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found`);
    }
    await configManager.setDefaultAgent(id);
  }

  /**
   * Get the default agent ID
   */
  async getDefault(): Promise<string | undefined> {
    return configManager.getDefaultAgent();
  }

  // ========================================================================
  // Templates
  // ========================================================================

  /**
   * List all templates
   */
  async listTemplates(): Promise<AgentTemplate[]> {
    const templatesDir = getTemplatesDir();
    if (!fileExists(templatesDir)) {
      return [];
    }

    const entries = await readdir(templatesDir, { withFileTypes: true });
    const templates: AgentTemplate[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const template = await this.getTemplate(entry.name);
        if (template) {
          templates.push(template);
        }
      }
    }

    return templates;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<AgentTemplate | null> {
    const templateDir = getTemplateDir(id);
    const configPath = join(templateDir, "config.yaml");

    if (!fileExists(configPath)) {
      return null;
    }

    const config = await readYaml<AgentConfigFile & { createdAt: string }>(configPath);
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
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      createdAt: config.createdAt,
    };
  }

  /**
   * Create a template from an agent
   */
  async createTemplate(agentId: string, templateId: string): Promise<AgentTemplate> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    const templateDir = getTemplateDir(templateId);
    if (fileExists(templateDir)) {
      throw new Error(`Template "${templateId}" already exists`);
    }

    const now = new Date().toISOString();
    const config = {
      name: agent.name,
      description: agent.description,
      model: agent.model,
      provider: agent.provider,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      createdAt: now,
    };

    await ensureDir(templateDir);
    await writeYaml(join(templateDir, "config.yaml"), config);

    return {
      id: templateId,
      name: config.name,
      description: config.description,
      config: {
        name: config.name,
        description: config.description,
        model: config.model,
        provider: config.provider,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      createdAt: now,
    };
  }

  /**
   * Create an agent from a template
   */
  async createAgentFromTemplate(templateId: string, agentId: string): Promise<Agent> {
    return this.createAgent({
      id: agentId,
      name: agentId,
      fromTemplate: templateId,
    });
  }

  // ========================================================================
  // Sessions
  // ========================================================================

  /**
   * List sessions for an agent
   */
  async listSessions(agentId: string): Promise<AgentSession[]> {
    const sessionsDir = getAgentSessionsDir(agentId);
    if (!fileExists(sessionsDir)) {
      return [];
    }

    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const sessions: AgentSession[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sessionFile = await readYaml<SessionFile>(
          join(sessionsDir, entry.name, "session.yaml")
        );
        if (sessionFile) {
          sessions.push({
            id: entry.name,
            agentId,
            name: sessionFile.name,
            createdAt: sessionFile.createdAt,
            lastAccessedAt: sessionFile.lastAccessedAt,
          });
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
    );
  }

  /**
   * Create a new session
   */
  async createSession(agentId: string, name?: string): Promise<AgentSession> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    const sessionId = randomUUID();
    const sessionDir = join(getAgentSessionsDir(agentId), sessionId);
    const now = new Date().toISOString();

    const session: SessionFile = {
      id: sessionId,
      name,
      createdAt: now,
      lastAccessedAt: now,
    };

    await ensureDir(sessionDir);
    await writeYaml(join(sessionDir, "session.yaml"), session);

    return {
      id: sessionId,
      agentId,
      name,
      createdAt: now,
      lastAccessedAt: now,
    };
  }

  /**
   * Remove a session
   */
  async removeSession(agentId: string, sessionId: string): Promise<void> {
    const sessionDir = join(getAgentSessionsDir(agentId), sessionId);
    if (!fileExists(sessionDir)) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    await rm(sessionDir, { recursive: true, force: true });
  }

  // ========================================================================
  // Memory
  // ========================================================================

  /**
   * Get agent memory
   */
  async getMemory(agentId: string): Promise<AgentMemory> {
    const memoryPath = join(getAgentMemoryDir(agentId), "CLAUDE.md");

    if (!fileExists(memoryPath)) {
      return {
        agentId,
        content: "",
        updatedAt: new Date().toISOString(),
      };
    }

    const content = await readFile(memoryPath, "utf-8");
    return {
      agentId,
      content,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Append content to agent memory
   */
  async appendMemory(agentId: string, content: string): Promise<void> {
    const memoryDir = getAgentMemoryDir(agentId);
    const memoryPath = join(memoryDir, "CLAUDE.md");

    await ensureDir(memoryDir);

    if (fileExists(memoryPath)) {
      await appendFile(memoryPath, "\n" + content, "utf-8");
    } else {
      await writeFile(memoryPath, content, "utf-8");
    }
  }

  /**
   * Get daily logs for an agent
   */
  async getDailyLogs(agentId: string, days = 7): Promise<DailyLog[]> {
    const memoryDir = getAgentMemoryDir(agentId);
    const logsDir = join(memoryDir, "logs");

    if (!fileExists(logsDir)) {
      return [];
    }

    const entries = await readdir(logsDir);
    const logs: DailyLog[] = [];

    // Get logs from the last N days
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const logPath = join(logsDir, `${dateStr}.yaml`);

      if (fileExists(logPath)) {
        const logEntries = await readYaml<LogEntry[]>(logPath);
        if (logEntries) {
          logs.push({ date: dateStr, entries: logEntries });
        }
      }
    }

    return logs;
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Generate a valid agent ID from a name
   */
  private generateAgentId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || `agent-${Date.now()}`;
  }
}

// Export singleton instance
export const agentManager = new AgentManager();
