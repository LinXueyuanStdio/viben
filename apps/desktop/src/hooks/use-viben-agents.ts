/**
 * Hook for managing viben-core Agents via Tauri commands
 */
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types (matching Rust viben-core types)
// ============================================================================

export interface Agent {
  id: string;
  /** Absolute path to the agent directory (e.g., ~/.viben/agents/hello-agent) */
  path?: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers: string[];
  skills: string[];
  plan_mode: boolean;
  approvals: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentOptions {
  id?: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  from_template?: string;
}

export interface AgentUpdate {
  name?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  append_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  executor_type?: string;
  executor_config?: Record<string, unknown>;
  mcp_servers?: string[];
  skills?: string[];
  plan_mode?: boolean;
  approvals?: boolean;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  config: AgentTemplateConfig;
  created_at: string;
}

export interface AgentTemplateConfig {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AgentSession {
  id: string;
  agent_id: string;
  name?: string;
  created_at: string;
  last_accessed_at: string;
}

export interface AgentMemory {
  agent_id: string;
  content: string;
  updated_at: string;
}

// ============================================================================
// Hook
// ============================================================================

export interface UseVibenAgentsReturn {
  // Data
  agents: Agent[];
  defaultAgentId: string | null;
  templates: AgentTemplate[];

  // Loading states
  loading: boolean;
  error: string | null;

  // Agent CRUD
  refresh: () => Promise<void>;
  getAgent: (id: string) => Promise<Agent | null>;
  createAgent: (options: CreateAgentOptions) => Promise<Agent>;
  updateAgent: (id: string, updates: AgentUpdate) => Promise<Agent>;
  removeAgent: (id: string) => Promise<void>;
  setDefaultAgent: (id: string) => Promise<void>;

  // Templates
  refreshTemplates: () => Promise<void>;
  getTemplate: (id: string) => Promise<AgentTemplate | null>;
  createTemplate: (agentId: string, templateId: string) => Promise<AgentTemplate>;
  createFromTemplate: (templateId: string, agentId: string) => Promise<Agent>;

  // Sessions (not used in settings, but exposed for completeness)
  listSessions: (agentId: string) => Promise<AgentSession[]>;
  createSession: (agentId: string, name?: string) => Promise<AgentSession>;
  removeSession: (agentId: string, sessionId: string) => Promise<void>;

  // Memory (not used in settings, but exposed for completeness)
  getMemory: (agentId: string) => Promise<AgentMemory>;
  appendMemory: (agentId: string, content: string) => Promise<void>;
}

export function useVibenAgents(): UseVibenAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load agents and default
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsList, defaultId] = await Promise.all([
        invoke<Agent[]>("viben_list_agents"),
        invoke<string | null>("viben_get_default_agent"),
      ]);
      setAgents(agentsList);
      setDefaultAgentId(defaultId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load templates
  const refreshTemplates = useCallback(async () => {
    setError(null);
    try {
      const templatesList = await invoke<AgentTemplate[]>("viben_list_templates");
      setTemplates(templatesList);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  // Get single agent
  const getAgent = useCallback(async (id: string): Promise<Agent | null> => {
    try {
      return await invoke<Agent | null>("viben_get_agent", { id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Create agent
  const createAgent = useCallback(async (options: CreateAgentOptions): Promise<Agent> => {
    setError(null);
    try {
      const agent = await invoke<Agent>("viben_create_agent", { options });
      await refresh();
      return agent;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [refresh]);

  // Update agent
  const updateAgent = useCallback(async (id: string, updates: AgentUpdate): Promise<Agent> => {
    setError(null);
    try {
      const agent = await invoke<Agent>("viben_update_agent", { id, updates });
      setAgents((prev) =>
        prev.map((a) => (a.id === id ? agent : a))
      );
      return agent;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Remove agent
  const removeAgent = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_remove_agent", { id });
      setAgents((prev) => prev.filter((a) => a.id !== id));
      if (defaultAgentId === id) {
        const newDefault = await invoke<string | null>("viben_get_default_agent");
        setDefaultAgentId(newDefault);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [defaultAgentId]);

  // Set default agent
  const setDefaultAgent = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_set_default_agent", { id });
      setDefaultAgentId(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Get template
  const getTemplate = useCallback(async (id: string): Promise<AgentTemplate | null> => {
    try {
      return await invoke<AgentTemplate | null>("viben_get_template", { id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Create template from agent
  const createTemplate = useCallback(async (agentId: string, templateId: string): Promise<AgentTemplate> => {
    setError(null);
    try {
      const template = await invoke<AgentTemplate>("viben_create_template", {
        agent_id: agentId,
        template_id: templateId,
      });
      await refreshTemplates();
      return template;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [refreshTemplates]);

  // Create agent from template
  const createFromTemplate = useCallback(async (templateId: string, agentId: string): Promise<Agent> => {
    setError(null);
    try {
      const agent = await invoke<Agent>("viben_create_from_template", {
        template_id: templateId,
        agent_id: agentId,
      });
      await refresh();
      return agent;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [refresh]);

  // List sessions
  const listSessions = useCallback(async (agentId: string): Promise<AgentSession[]> => {
    try {
      return await invoke<AgentSession[]>("viben_list_sessions", { agent_id: agentId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Create session
  const createSession = useCallback(async (agentId: string, name?: string): Promise<AgentSession> => {
    try {
      return await invoke<AgentSession>("viben_create_session", {
        agent_id: agentId,
        name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Remove session
  const removeSession = useCallback(async (agentId: string, sessionId: string): Promise<void> => {
    try {
      await invoke("viben_remove_session", {
        agent_id: agentId,
        session_id: sessionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Get memory
  const getMemory = useCallback(async (agentId: string): Promise<AgentMemory> => {
    try {
      return await invoke<AgentMemory>("viben_get_memory", { agent_id: agentId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Append memory
  const appendMemory = useCallback(async (agentId: string, content: string): Promise<void> => {
    try {
      await invoke("viben_append_memory", {
        agent_id: agentId,
        content,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
    refreshTemplates();
  }, [refresh, refreshTemplates]);

  return {
    agents,
    defaultAgentId,
    templates,
    loading,
    error,
    refresh,
    getAgent,
    createAgent,
    updateAgent,
    removeAgent,
    setDefaultAgent,
    refreshTemplates,
    getTemplate,
    createTemplate,
    createFromTemplate,
    listSessions,
    createSession,
    removeSession,
    getMemory,
    appendMemory,
  };
}
