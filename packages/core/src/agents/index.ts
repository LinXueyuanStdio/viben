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
} from "../config/paths";
import { readYaml, writeYaml, ensureDir, fileExists } from "../config/yaml";
import { readMarkdownConfig, writeMarkdownConfig } from "../config/markdown";
import { configManager } from "../config";
import type {
  Agent,
  AgentConfig,
  AgentSession,
  AgentMemory,
  DailyLog,
  LogEntry,
  CreateAgentOptions,
  AgentUpdate,
} from "../types";
import type { AgentConfigFile, SessionFile } from "./types";

// Re-export types
export * from "./types";

// Export memory management
export {
  MemoryManager,
  memoryManager,
  type MemoryContent,
  type DailyLogContent,
  type ParsedLogEntry,
  type AppendLogOptions,
} from "./memory";

// Export variable resolver
export {
  extractVariables,
  resolveVariables,
  PREDEFINED_VARIABLES,
  type VariableContext,
  type ExtractedVariables,
  type ResolveResult,
  type PredefinedVariable,
} from "./variable-resolver";

function agentConfigFileToAgent(
  id: string,
  agentDir: string,
  config: AgentConfigFile,
  systemPrompt: string
): Agent {
  return {
    id,
    name: config.name,
    path: agentDir,
    description: config.description,
    tools: config.tools ?? [],
    model: config.model,
    provider: config.provider,
    systemPrompt: systemPrompt || undefined,
    appendPrompt: config.append_prompt,
    temperature: config.temperature,
    maxTokens: config.max_tokens,
    executorType: config.executor_type as Agent["executorType"],
    executorConfig: config.executor_config,
    mcpServers: config.mcp_servers ?? [],
    skills: config.skills ?? [],
    approvalMode: config.approval_mode ?? "rules",
    isTemplate: config.is_template,
    templateDescription: config.template_description,
    templateTags: config.template_tags,
    customVariables: config.custom_variables?.map(v => ({
      name: v.name,
      defaultValue: v.default_value,
      description: v.description,
    })),
    envVariables: config.env_variables,
    created_at: config.created_at,
    updated_at: config.updated_at,
  };
}

function agentToConfigFile(
  agent: Agent,
  overrides: {
    name?: string;
    description?: string;
    tools?: string[];
    model?: string;
    provider?: string;
    appendPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    executorType?: Agent["executorType"];
    executorConfig?: Record<string, unknown>;
    mcpServers?: Agent["mcpServers"];
    skills?: string[];
    approvalMode?: "bypass" | "rules" | "ai";
    isTemplate?: boolean;
    templateDescription?: string;
    templateTags?: Agent["templateTags"];
    customVariables?: Agent["customVariables"];
    envVariables?: string[];
    created_at?: string;
    updated_at?: string;
  }
): AgentConfigFile {
  const customVariables = overrides.customVariables ?? agent.customVariables;
  return {
    name: overrides.name ?? agent.name,
    description: overrides.description ?? agent.description,
    tools: overrides.tools ?? agent.tools,
    model: overrides.model ?? agent.model,
    provider: overrides.provider ?? agent.provider,
    append_prompt: overrides.appendPrompt ?? agent.appendPrompt,
    temperature: overrides.temperature ?? agent.temperature,
    max_tokens: overrides.maxTokens ?? agent.maxTokens,
    executor_type: overrides.executorType ?? agent.executorType,
    executor_config: overrides.executorConfig ?? agent.executorConfig,
    mcp_servers: overrides.mcpServers ?? agent.mcpServers,
    skills: overrides.skills ?? agent.skills,
    approval_mode: overrides.approvalMode ?? agent.approvalMode,
    is_template: overrides.isTemplate ?? agent.isTemplate,
    template_description: overrides.templateDescription ?? agent.templateDescription,
    template_tags: overrides.templateTags ?? agent.templateTags,
    custom_variables: customVariables?.map(v => ({
      name: v.name,
      default_value: v.defaultValue,
      description: v.description,
    })),
    env_variables: overrides.envVariables ?? agent.envVariables,
    created_at: overrides.created_at ?? agent.created_at,
    updated_at: overrides.updated_at ?? agent.updated_at,
  };
}

/**
 * AgentManager handles agent CRUD operations
 */
export class AgentManager {
  /**
   * Initialize the agents directory
   */
  async initialize(): Promise<void> {
    await ensureDir(getAgentsDir());
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

    const result = await readMarkdownConfig<AgentConfigFile>(configPath);
    if (!result) {
      return null;
    }

    const { frontmatter: config, body: systemPrompt } = result;

    return agentConfigFileToAgent(id, getAgentDir(id), config, systemPrompt);
  }

  /**
   * Create a new agent
   */
  async createAgent(options: CreateAgentOptions): Promise<Agent> {
    const id = options.id || this.generateAgentId(options.name);
    // Use base_path for workspace-scoped agents, otherwise global
    const agentDir = options.base_path
      ? join(options.base_path, ".viben", "agents", id)
      : getAgentDir(id);

    // Check if agent already exists
    if (fileExists(agentDir)) {
      throw new Error(`Agent with ID "${id}" already exists`);
    }

    // Create from template if specified
    let baseConfig: Partial<AgentConfig> = {};
    if (options.from_template) {
      const template = await this.getTemplate(options.from_template);
      if (template) {
        baseConfig = {
          description: template.description,
          tools: template.tools,
          model: template.model,
          provider: template.provider,
          systemPrompt: template.systemPrompt,
          appendPrompt: template.appendPrompt,
          temperature: template.temperature,
          maxTokens: template.maxTokens,
          executorType: template.executorType,
          executorConfig: template.executorConfig,
          mcpServers: template.mcpServers,
          skills: template.skills,
          approvalMode: template.approvalMode,
        };
      }
    }

    const now = new Date().toISOString();
    const systemPrompt = options.system_prompt || baseConfig.systemPrompt || "";
    const config: AgentConfigFile = {
      name: options.name,
      description: options.description || baseConfig.description,
      tools: options.tools ?? [],
      model: options.model || baseConfig.model,
      provider: options.provider || baseConfig.provider,
      append_prompt: options.append_prompt ?? baseConfig.appendPrompt,
      temperature: options.temperature ?? baseConfig.temperature,
      max_tokens: options.max_tokens ?? baseConfig.maxTokens,
      executor_type: options.executor_type ?? baseConfig.executorType,
      executor_config: options.executor_config ?? baseConfig.executorConfig,
      mcp_servers: options.mcp_servers ?? baseConfig.mcpServers ?? [],
      skills: options.skills ?? [],
      approval_mode: options.approval_mode ?? "rules",
      is_template: false,
      template_tags: baseConfig.templateTags,
      custom_variables: baseConfig.customVariables?.map(v => ({
        name: v.name,
        default_value: v.defaultValue,
        description: v.description,
      })),
      env_variables: baseConfig.envVariables,
      created_at: now,
      updated_at: now,
    };

    // Create agent directory and config (AGENTS.md)
    await ensureDir(agentDir);
    await writeMarkdownConfig(join(agentDir, "AGENTS.md"), config, systemPrompt);

    // Create subdirectories
    await ensureDir(join(agentDir, ".agent_sessions"));
    await ensureDir(join(agentDir, "memory"));

    return agentConfigFileToAgent(id, agentDir, config, systemPrompt);
  }

  /**
   * Remove an agent
   *
   * @param id - The agent ID
   * @param workspacePath - Optional workspace path for workspace-scoped agents
   */
  async removeAgent(id: string, workspacePath?: string): Promise<void> {
    // Try workspace agent first if workspace path provided
    if (workspacePath) {
      const workspaceAgentsDir = join(workspacePath, ".viben", "agents");
      const workspaceAgent = await this.getAgentFromDir(workspaceAgentsDir, id);
      if (workspaceAgent) {
        const agentDir = join(workspaceAgentsDir, id);
        await rm(agentDir, { recursive: true, force: true });
        return;
      }
    }

    // Fall back to global agent
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
   *
   * @param id - The agent ID
   * @param updates - The updates to apply
   * @param workspacePath - Optional workspace path for workspace-scoped agents
   */
  async updateAgent(id: string, updates: Partial<AgentConfig>, workspacePath?: string): Promise<Agent> {
    // Try workspace agent first if workspace path provided
    if (workspacePath) {
      const workspaceAgentsDir = join(workspacePath, ".viben", "agents");
      const workspaceAgent = await this.getAgentFromDir(workspaceAgentsDir, id);
      if (workspaceAgent) {
        return this.updateAgentInDir(workspaceAgentsDir, id, updates);
      }
    }

    // Fall back to global agent
    const agent = await this.getAgent(id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found`);
    }

    const systemPrompt = updates.systemPrompt ?? agent.systemPrompt ?? "";
    const config = agentToConfigFile(agent, {
      ...updates,
      created_at: agent.created_at,
      updated_at: new Date().toISOString(),
    });

    await writeMarkdownConfig(getAgentConfigPath(id), config, systemPrompt);

    return agentConfigFileToAgent(id, getAgentDir(id), config, systemPrompt);
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
   * List all templates (agents with isTemplate=true)
   * Merges global templates and workspace templates if workspacePath provided
   */
  async listTemplates(workspacePath?: string): Promise<Agent[]> {
    const globalAgents = await this.listAgents();
    const workspaceAgents = workspacePath
      ? await this.listAgentsFromDir(join(workspacePath, ".viben", "agents"))
      : [];

    return [...globalAgents, ...workspaceAgents]
      .filter((agent) => agent.isTemplate === true)
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  }

  /**
   * Get a template by ID (an agent with isTemplate=true)
   */
  async getTemplate(id: string, workspacePath?: string): Promise<Agent | null> {
    // Try workspace first
    if (workspacePath) {
      const agent = await this.getAgentFromDir(join(workspacePath, ".viben", "agents"), id);
      if (agent?.isTemplate) return agent;
    }
    // Fall back to global
    const agent = await this.getAgent(id);
    return agent?.isTemplate ? agent : null;
  }

  /**
   * Mark an existing agent as template
   */
  async setAsTemplate(
    id: string,
    isTemplate: boolean,
    templateDescription?: string,
    workspacePath?: string
  ): Promise<Agent> {
    return this.updateAgent(id, { isTemplate, templateDescription }, workspacePath);
  }

  /**
   * Create a new agent from a template (full config copy)
   */
  async createFromTemplate(
    templateId: string,
    newAgentId: string,
    options: {
      name: string;
      base_path?: string; // workspace path, undefined for global
    },
    templateWorkspacePath?: string // where to find the template
  ): Promise<Agent> {
    const template = await this.getTemplate(templateId, templateWorkspacePath);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }

    // Determine target directory
    const targetDir = options.base_path
      ? join(options.base_path, ".viben", "agents")
      : getAgentsDir();

    const agentDir = join(targetDir, newAgentId);
    if (fileExists(agentDir)) {
      throw new Error(`Agent "${newAgentId}" already exists`);
    }

    const now = new Date().toISOString();
    const config: AgentConfigFile = {
      name: options.name,
      description: template.description,
      tools: template.tools,
      model: template.model,
      provider: template.provider,
      append_prompt: template.appendPrompt,
      temperature: template.temperature,
      max_tokens: template.maxTokens,
      executor_type: template.executorType,
      executor_config: template.executorConfig,
      mcp_servers: template.mcpServers,
      skills: template.skills,
      approval_mode: template.approvalMode,
      is_template: false, // New agent is NOT a template
      template_tags: template.templateTags,
      custom_variables: template.customVariables?.map(v => ({
        name: v.name,
        default_value: v.defaultValue,
        description: v.description,
      })),
      env_variables: template.envVariables,
      created_at: now,
      updated_at: now,
    };

    await ensureDir(agentDir);
    await writeMarkdownConfig(join(agentDir, "AGENTS.md"), config, template.systemPrompt || "");
    await ensureDir(join(agentDir, ".agent_sessions"));
    await ensureDir(join(agentDir, "memory"));

    return (await this.getAgentFromDir(targetDir, newAgentId)) as Agent;
  }

  /**
   * Promote a workspace template to global
   */
  async promoteToGlobal(
    workspacePath: string,
    agentId: string,
    newGlobalId?: string
  ): Promise<Agent> {
    const workspaceAgentsDir = join(workspacePath, ".viben", "agents");
    const agent = await this.getAgentFromDir(workspaceAgentsDir, agentId);

    if (!agent) {
      throw new Error(`Agent "${agentId}" not found in workspace`);
    }
    if (!agent.isTemplate) {
      throw new Error(`Agent "${agentId}" is not a template`);
    }

    const globalId = newGlobalId || agentId;
    const globalDir = getAgentDir(globalId);

    if (fileExists(globalDir)) {
      throw new Error(`Global agent "${globalId}" already exists`);
    }

    // Copy to global
    const now = new Date().toISOString();
    const config: AgentConfigFile = {
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
      model: agent.model,
      provider: agent.provider,
      append_prompt: agent.appendPrompt,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
      executor_type: agent.executorType,
      executor_config: agent.executorConfig,
      mcp_servers: agent.mcpServers,
      skills: agent.skills,
      approval_mode: agent.approvalMode,
      is_template: true,
      template_description: agent.templateDescription,
      template_tags: agent.templateTags,
      custom_variables: agent.customVariables?.map(v => ({
        name: v.name,
        default_value: v.defaultValue,
        description: v.description,
      })),
      env_variables: agent.envVariables,
      created_at: now,
      updated_at: now,
    };

    await ensureDir(globalDir);
    await writeMarkdownConfig(getAgentConfigPath(globalId), config, agent.systemPrompt || "");
    await ensureDir(getAgentSessionsDir(globalId));
    await ensureDir(getAgentMemoryDir(globalId));

    return (await this.getAgent(globalId)) as Agent;
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
            agent_id: agentId,
            name: sessionFile.name,
            created_at: sessionFile.created_at,
            last_accessed_at: sessionFile.last_accessed_at,
          });
        }
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime()
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
      created_at: now,
      last_accessed_at: now,
    };

    await ensureDir(sessionDir);
    await writeYaml(join(sessionDir, "session.yaml"), session);

    return {
      id: sessionId,
      agent_id: agentId,
      name,
      created_at: now,
      last_accessed_at: now,
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
        agent_id: agentId,
        content: "",
        updated_at: new Date().toISOString(),
      };
    }

    const content = await readFile(memoryPath, "utf-8");
    return {
      agent_id: agentId,
      content,
      updated_at: new Date().toISOString(),
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
  // Directory-based Operations (for workspace agents)
  // ========================================================================

  /**
   * List agents from a specific agents directory
   * Used for listing workspace agents from {workspace}/.viben/agents/
   *
   * @param agentsDir - The agents directory path (e.g., /path/to/workspace/.viben/agents/)
   */
  async listAgentsFromDir(agentsDir: string): Promise<Agent[]> {
    if (!fileExists(agentsDir)) {
      return [];
    }

    const entries = await readdir(agentsDir, { withFileTypes: true });
    const agents: Agent[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const agent = await this.getAgentFromDir(agentsDir, entry.name);
        if (agent) {
          agents.push(agent);
        }
      }
    }

    return agents;
  }

  /**
   * Get an agent from a specific agents directory
   * Used for getting workspace agents from {workspace}/.viben/agents/
   *
   * @param agentsDir - The agents directory path (e.g., /path/to/workspace/.viben/agents/)
   * @param id - The agent ID (directory name)
   */
  async getAgentFromDir(agentsDir: string, id: string): Promise<Agent | null> {
    const agentDir = join(agentsDir, id);
    const configPath = join(agentDir, "AGENTS.md");

    if (!fileExists(configPath)) {
      return null;
    }

    const result = await readMarkdownConfig<AgentConfigFile>(configPath);
    if (!result) {
      return null;
    }

    const { frontmatter: config, body: systemPrompt } = result;

    return agentConfigFileToAgent(id, agentDir, config, systemPrompt);
  }

  /**
   * Update an agent in a specific agents directory
   * Used for updating workspace agents in {workspace}/.viben/agents/
   *
   * @param agentsDir - The agents directory path (e.g., /path/to/workspace/.viben/agents/)
   * @param id - The agent ID (directory name)
   * @param updates - The updates to apply
   */
  async updateAgentInDir(agentsDir: string, id: string, updates: Partial<AgentConfig>): Promise<Agent> {
    const agent = await this.getAgentFromDir(agentsDir, id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found in ${agentsDir}`);
    }

    const agentDir = join(agentsDir, id);
    const configPath = join(agentDir, "AGENTS.md");

    const systemPrompt = updates.systemPrompt ?? agent.systemPrompt ?? "";
    const config = agentToConfigFile(agent, {
      ...updates,
      created_at: agent.created_at,
      updated_at: new Date().toISOString(),
    });

    await writeMarkdownConfig(configPath, config, systemPrompt);

    return agentConfigFileToAgent(id, agentDir, config, systemPrompt);
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
      .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || `agent-${Date.now()}`;
  }
}

// Export singleton instance
export const agentManager = new AgentManager();
