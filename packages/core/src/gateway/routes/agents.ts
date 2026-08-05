/**
 * Agent routes
 *
 * Provides HTTP API for:
 * - Agent CRUD operations
 * - Default agent management
 * - Agent templates (list, get, create, instantiate)
 * - Agent sessions (file-based persistence)
 * - Session messages (rollout and UI messages)
 */
import type { FastifyInstance } from "fastify";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agentManager } from "../../agents";
import type { AppState } from "../state";
import type { SessionMessage, SessionConfig, UIMessage } from "../../services/session-store";
import { createSessionConfigWithAgentInfo } from "../../services/session-store";
import type { AcpPermissionMode, ExecutorType, AgentMcpServerEntry } from "../../types";
import {
  encodeWorkspacePath,
  getClaudeProjectsDir,
  readClaudeCodeSessionMessages,
} from "./executors";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve the agent's directory path from agent ID and optional workspace path
 * Returns the path to the agent's directory if found, undefined otherwise
 * Note: This returns the directory path (e.g., /path/to/agents/myagent),
 * NOT the config file path (e.g., /path/to/agents/myagent/AGENTS.md)
 */
async function resolveAgentDir(agentId: string, workspacePath?: string): Promise<string | undefined> {
  // 1. Try workspace agent first
  if (workspacePath) {
    const workspaceAgentsDir = join(workspacePath, ".viben", "agents");
    const agent = await agentManager.getAgentFromDir(workspaceAgentsDir, agentId);
    if (agent?.path) {
      return agent.path;
    }
  }

  // 2. Try global agent
  const agent = await agentManager.getAgent(agentId);
  if (agent?.path) {
    return agent.path;
  }

  return undefined;
}

function isCommandAvailable(command: string): boolean {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Response Transformers (camelCase to snake_case for API consistency)
// ============================================================================

/**
 * Transform session config to snake_case response format (to match Rust gateway)
 */
function toSnakeCaseSession(s: SessionConfig) {
  return {
    id: s.id,
    agent_id: s.agentId,
    agent_dir: s.agentDir,
    agent_config: s.agent_config,
    task_id: s.taskId,
    prompt: s.prompt,
    status: s.status,
    workspace_path: s.workspace_path,
    created_at: s.created_at,
    updated_at: s.updated_at,
    metadata: s.metadata,
  };
}

/**
 * Transform session message to snake_case response format
 */
function toSnakeCaseMessage(m: SessionMessage) {
  return {
    timestamp: m.timestamp,
    role: m.role,
    content: m.content,
    tool_calls: m.toolCalls,
    tool_result: m.toolResult,
  };
}

/**
 * Transform UI message to snake_case response format
 */
function toSnakeCaseUIMessage(m: UIMessage) {
  return {
    id: m.id,
    timestamp: m.timestamp,
    type: m.type,
    content: m.content,
    tool_use_id: m.toolUseId,
    tool_name: m.toolName,
    tool_input: m.toolInput,
    tool_output: m.toolOutput,
    is_error: m.isError,
    attachments: m.attachments,
    sdk_session_id: m.sdkSessionId,
  };
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register agent routes
 */
export function registerAgentRoutes(fastify: FastifyInstance, state: AppState): void {
  // ========================================================================
  // Agent CRUD
  // ========================================================================

  /**
   * List all agents
   * GET /api/agent
   *
   * Query params:
   * - workspace_path: Optional workspace path to include workspace agents
   * - include_global: Whether to include global agents (default: true)
   *
   * Returns workspace-scoped agents with snake_case fields to match Rust gateway format.
   * When workspace_path is provided, workspace agents take priority (deduped by ID).
   */
  fastify.get<{
    Querystring: {
      workspace_path?: string;
      include_global?: string;
    };
  }>("/api/agent", {
    schema: {
      description: "List all agents",
      tags: ["agent"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path to include workspace agents" },
          include_global: { type: "string", description: "Include global agents (default: true)" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            agents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  agent_type: { type: "string" },
                  source: { type: "string", enum: ["global", "workspace"] },
                  agent_dir: { type: "string" },
                  workspace_path: { type: "string" },
                  config_path: { type: "string" },
                  description: { type: "string" },
                  model: { type: "string" },
                  provider_id: { type: "string" },
                  executor_type: { type: "string" },
                },
              },
            },
            total: { type: "number" },
          },
        },
      },
    },
  }, async (request) => {
    const { workspace_path, include_global } = request.query;
    const includeGlobal = include_global !== "false"; // Default: true
    const homeDir = homedir();

    // Helper to transform agent to API response format
    const transformAgent = (a: Awaited<ReturnType<typeof agentManager.getAgent>>, sourceOverride?: "global" | "workspace", workspacePathOverride?: string) => {
      if (!a) return null;

      // Determine source based on path (global = ~/.viben/agents/, workspace = elsewhere)
      const source = sourceOverride || (
        a.path && a.path.startsWith(homeDir) && a.path.includes("/.viben/agents/")
          ? "global"
          : "workspace"
      );

      return {
        id: a.id,
        name: a.name,
        agent_type: "viben",
        source,
        agent_dir: a.path,
        workspace_path: source === "workspace" ? workspacePathOverride : undefined,
        config_path: a.path ? `${a.path}/AGENTS.md` : undefined,
        description: a.description,
        model: a.model,
        provider_id: a.provider_id,
        system_prompt: a.systemPrompt,
        append_prompt: a.appendPrompt,
        temperature: a.temperature,
        max_tokens: a.maxTokens,
        executor_type: a.executorType,
        executor_config: a.executorConfig,
        mcp_servers: a.mcpServers,
        skills: a.skills,
        permission_mode: a.permissionMode,
        created_at: a.created_at,
        updated_at: a.updated_at,
      };
    };

    // Map to store agents by ID (for deduplication, workspace takes priority)
    const agentMap = new Map<string, ReturnType<typeof transformAgent>>();

    // 1. Load global agents first (if includeGlobal)
    if (includeGlobal) {
      const globalAgents = await agentManager.listAgents();
      for (const agent of globalAgents) {
        const transformed = transformAgent(agent, "global");
        if (transformed) {
          agentMap.set(agent.id, transformed);
        }
      }
    }

    // 2. Load workspace agents (if workspace_path provided)
    // Workspace agents override global agents with the same ID
    if (workspace_path) {
      const workspaceAgentsDir = join(workspace_path, ".viben", "agents");
      const workspaceAgents = await agentManager.listAgentsFromDir(workspaceAgentsDir);

      for (const agent of workspaceAgents) {
        const transformed = transformAgent(agent, "workspace", workspace_path);
        if (transformed) {
          agentMap.set(agent.id, transformed);
        }
      }
    }

    const agents = Array.from(agentMap.values()).filter(Boolean);

    return {
      agents,
      total: agents.length,
    };
  });

  /**
   * Create a new agent
   * POST /api/agent
   *
   * Returns agent with snake_case fields to match Rust gateway format
   */
  fastify.post<{
    Body: {
      name: string;
      id?: string;
      description?: string;
      model?: string;
      provider_id?: string;
      system_prompt?: string;
      append_prompt?: string;
      temperature?: number;
      max_tokens?: number;
      from_template?: string;
      base_path?: string;
      executor_type?: string;
      executor_config?: Record<string, unknown>;
      mcp_servers?: string[];
      skills?: string[];
      permission_mode?: AcpPermissionMode;
    };
  }>("/api/agent", async (request, reply) => {
    const body = request.body;
    try {
      const agent = await agentManager.createAgent({
        id: body.id,
        name: body.name,
        description: body.description,
        model: body.model,
        provider_id: body.provider_id,
        system_prompt: body.system_prompt,
        append_prompt: body.append_prompt,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        from_template: body.from_template,
        base_path: body.base_path,
        executor_type: body.executor_type as ExecutorType | undefined,
        executor_config: body.executor_config,
        mcp_servers: body.mcp_servers,
        skills: body.skills,
        permission_mode: body.permission_mode,
      });
      reply.code(201);

      const homeDir = homedir();
      // Determine source based on path (global = ~/.viben/agents/, workspace = elsewhere)
      const isGlobalAgent = agent.path && agent.path.startsWith(homeDir) && agent.path.includes("/.viben/agents/");
      const agentSource = isGlobalAgent ? "global" : "workspace";

      // Extract workspace path from agent path (remove /.viben/agents/{id} suffix)
      const agentWorkspacePath = !isGlobalAgent && agent.path
        ? agent.path.replace(/\/.viben\/agents\/[^/]+$/, "")
        : undefined;

      // Return agent with snake_case fields
      return {
        id: agent.id,
        name: agent.name,
        agent_type: "viben",
        source: agentSource,
        agent_dir: agent.path,
        workspace_path: agentWorkspacePath,
        config_path: agent.path ? `${agent.path}/AGENTS.md` : undefined,
        description: agent.description,
        model: agent.model,
        provider_id: agent.provider_id,
        system_prompt: agent.systemPrompt,
        append_prompt: agent.appendPrompt,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        executor_type: agent.executorType,
        executor_config: agent.executorConfig,
        mcp_servers: agent.mcpServers,
        skills: agent.skills,
        permission_mode: agent.permissionMode,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create agent" };
    }
  });

  // ========================================================================
  // Default Agent Management
  // ========================================================================

  /**
   * Get default agent
   * GET /api/agent/default
   */
  fastify.get("/api/agent/default", async () => {
    const defaultAgentId = await agentManager.getDefault();
    return { default_agent_id: defaultAgentId || null };
  });

  /**
   * Set default agent
   * PUT /api/agent/default
   */
  fastify.put<{ Body: { agent_id: string } }>(
    "/api/agent/default",
    async (request, reply) => {
      const { agent_id } = request.body;
      try {
        await agentManager.setDefault(agent_id);
        return { success: true, default_agent_id: agent_id };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to set default agent" };
      }
    }
  );

  // ========================================================================
  // Templates
  // ========================================================================

  /**
   * List all templates
   * GET /api/agent/templates
   *
   * Query params:
   * - workspace_path: Optional workspace path to include workspace templates
   */
  fastify.get<{
    Querystring: {
      workspace_path?: string;
    };
  }>("/api/agent/templates", async (request) => {
    const { workspace_path } = request.query;
    const templates = await agentManager.listTemplates(workspace_path);
    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || t.templateDescription,
        is_template: t.isTemplate,
        template_description: t.templateDescription,
        model: t.model,
        provider_id: t.provider_id,
        executor_type: t.executorType,
        created_at: t.created_at,
        updated_at: t.updated_at,
      })),
      total: templates.length,
    };
  });

  /**
   * Mark an agent as template (or unmark)
   * POST /api/agent/templates
   */
  fastify.post<{ Body: { agent_id: string; is_template: boolean; template_description?: string; workspace_path?: string } }>(
    "/api/agent/templates",
    async (request, reply) => {
      const { agent_id, is_template, template_description, workspace_path } = request.body;
      try {
        const agent = await agentManager.setAsTemplate(agent_id, is_template, template_description, workspace_path);
        reply.code(200);
        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          is_template: agent.isTemplate,
          template_description: agent.templateDescription,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
        };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to update template status" };
      }
    }
  );

  /**
   * Get a template by ID
   * GET /api/agent/templates/:id
   */
  fastify.get<{ Params: { id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/templates/:id",
    async (request, reply) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const template = await agentManager.getTemplate(id, workspace_path);
      if (!template) {
        reply.code(404);
        return { error: `Template not found: ${id}` };
      }
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        is_template: template.isTemplate,
        template_description: template.templateDescription,
        model: template.model,
        provider_id: template.provider_id,
        executor_type: template.executorType,
        system_prompt: template.systemPrompt,
        created_at: template.created_at,
        updated_at: template.updated_at,
      };
    }
  );

  /**
   * Create an agent from a template
   * POST /api/agent/templates/:id/instantiate
   *
   * Returns agent with snake_case fields to match Rust gateway format
   */
  fastify.post<{ Params: { id: string }; Body: { agent_id: string; name: string; base_path?: string; template_workspace_path?: string } }>(
    "/api/agent/templates/:id/instantiate",
    async (request, reply) => {
      const { id } = request.params;
      const { agent_id, name, base_path, template_workspace_path } = request.body;
      try {
        const agent = await agentManager.createFromTemplate(id, agent_id, { name, base_path }, template_workspace_path);
        reply.code(201);

        const homeDir = homedir();
        // Determine source based on path (global = ~/.viben/agents/, workspace = elsewhere)
        const isGlobalAgent = agent.path && agent.path.startsWith(homeDir) && agent.path.includes("/.viben/agents/");
        const agentSource = isGlobalAgent ? "global" : "workspace";

        // Extract workspace path from agent path (remove /.viben/agents/{id} suffix)
        const agentWorkspacePath = !isGlobalAgent && agent.path
          ? agent.path.replace(/\/.viben\/agents\/[^/]+$/, "")
          : undefined;

        // Return agent with snake_case fields
        return {
          id: agent.id,
          name: agent.name,
          agent_type: "viben",
          source: agentSource,
          agent_dir: agent.path,
          workspace_path: agentWorkspacePath,
          config_path: agent.path ? `${agent.path}/AGENTS.md` : undefined,
          description: agent.description,
          model: agent.model,
          provider_id: agent.provider_id,
          system_prompt: agent.systemPrompt,
          append_prompt: agent.appendPrompt,
          temperature: agent.temperature,
          max_tokens: agent.maxTokens,
          executor_type: agent.executorType,
          executor_config: agent.executorConfig,
          mcp_servers: agent.mcpServers,
          skills: agent.skills,
          permission_mode: agent.permissionMode,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
        };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to instantiate template" };
      }
    }
  );

  /**
   * Promote a workspace template to global
   * POST /api/agent/:id/promote
   *
   * Body:
   * - new_id: Optional new ID for the global agent
   * - workspace_path: Required workspace path where the template is located
   *
   * Returns agent with snake_case fields to match Rust gateway format
   */
  fastify.post<{
    Params: { id: string };
    Body: { new_id?: string; workspace_path: string };
  }>("/api/agent/:id/promote", async (request, reply) => {
    const { id } = request.params;
    const { new_id, workspace_path } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { error: "workspace_path is required" };
    }

    try {
      const agent = await agentManager.promoteToGlobal(workspace_path, id, new_id);
      reply.code(201);

      // Global agents always have source="global" and no workspace_path
      return {
        id: agent.id,
        name: agent.name,
        agent_type: "viben",
        source: "global",
        agent_dir: agent.path,
        workspace_path: undefined,
        config_path: agent.path ? `${agent.path}/AGENTS.md` : undefined,
        description: agent.description,
        model: agent.model,
        provider_id: agent.provider_id,
        system_prompt: agent.systemPrompt,
        append_prompt: agent.appendPrompt,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        executor_type: agent.executorType,
        executor_config: agent.executorConfig,
        mcp_servers: agent.mcpServers,
        skills: agent.skills,
        permission_mode: agent.permissionMode,
        is_template: agent.isTemplate,
        template_description: agent.templateDescription,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to promote template" };
    }
  });

  // ========================================================================
  // Agent Sessions (file-based)
  // ========================================================================

  /**
   * List sessions for an agent
   * GET /api/agent/:id/sessions
   *
   * Lists sessions from both workspace and global locations to ensure
   * compatibility with sessions created before the workspace-first fix.
   */
  fastify.get<{ Params: { id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/:id/sessions",
    async (request, reply) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      try {
        // Collect sessions from both workspace and global locations
        const allSessions: SessionConfig[] = [];
        const seenIds = new Set<string>();

        // 1. Try workspace agent first (if workspace_path provided)
        if (workspace_path) {
          const workspaceAgentsDir = join(workspace_path, ".viben", "agents");
          const workspaceAgent = await agentManager.getAgentFromDir(workspaceAgentsDir, id);
          if (workspaceAgent?.path) {
            // Pass the agent directory path directly (not AGENTS.md file path)
            // session-store expects agentDir to be the agent directory
            const workspaceSessions = await state.sessionStore.listSessions(id, workspaceAgent.path);
            for (const session of workspaceSessions) {
              if (!seenIds.has(session.id)) {
                seenIds.add(session.id);
                allSessions.push(session);
              }
            }
          }
        }

        // 2. Also check global agent (for backward compatibility)
        const globalAgent = await agentManager.getAgent(id);
        if (globalAgent?.path) {
          // Pass the agent directory path directly
          const globalSessions = await state.sessionStore.listSessions(id, globalAgent.path);
          for (const session of globalSessions) {
            if (!seenIds.has(session.id)) {
              seenIds.add(session.id);
              allSessions.push(session);
            }
          }
        }

        // Sort by created_at descending
        allSessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return {
          sessions: allSessions.map(toSnakeCaseSession),
          total: allSessions.length,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to list sessions" };
      }
    }
  );

  /**
   * Create a session for an agent
   * POST /api/agent/:id/sessions
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      session_id?: string;
      prompt?: string;
      task_id?: string;
      agent_dir?: string;
      agent_config?: Record<string, unknown>;
      workspace_path?: string;
    };
  }>("/api/agent/:id/sessions", async (request, reply) => {
    const { id } = request.params;
    const body = request.body;
    const sessionId = body.session_id || randomUUID();

    try {
      // Resolve agent directory: use provided agent_dir, or resolve from workspace_path
      // This ensures sessions are created in project level when workspace_path is provided
      const agentDir = body.agent_dir || await resolveAgentDir(id, body.workspace_path);

      const config = createSessionConfigWithAgentInfo(
        sessionId,
        id,
        agentDir,
        body.agent_config,
        body.workspace_path
      );
      config.prompt = body.prompt;
      config.taskId = body.task_id;

      await state.sessionStore.createSession(config);
      reply.code(201);
      return toSnakeCaseSession(config);
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to create session" };
    }
  });

  /**
   * Get a session
   * GET /api/agent/:id/sessions/:session_id
   */
  fastify.get<{ Params: { id: string; session_id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/:id/sessions/:session_id",
    async (request, reply) => {
      const { id, session_id } = request.params;
      const { workspace_path } = request.query;
      try {
        const agentDir = await resolveAgentDir(id, workspace_path);
        const session = await state.sessionStore.getSession(id, session_id, agentDir);
        return toSnakeCaseSession(session);
      } catch (e) {
        reply.code(404);
        return { error: e instanceof Error ? e.message : "Session not found" };
      }
    }
  );

  /**
   * Delete a session
   * DELETE /api/agent/:id/sessions/:session_id
   */
  fastify.delete<{ Params: { id: string; session_id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/:id/sessions/:session_id",
    async (request, reply) => {
      const { id, session_id } = request.params;
      const { workspace_path } = request.query;
      try {
        const agentDir = await resolveAgentDir(id, workspace_path);
        await state.sessionStore.deleteSession(id, session_id, agentDir);
        return { deleted: session_id, agent_id: id };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to delete session" };
      }
    }
  );

  // ========================================================================
  // Session Messages
  // ========================================================================

  /**
   * List messages in a session
   * GET /api/agent/:id/sessions/:session_id/messages
   */
  fastify.get<{ Params: { id: string; session_id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/:id/sessions/:session_id/messages",
    async (request, reply) => {
      const { id, session_id } = request.params;
      const { workspace_path } = request.query;
      try {
        const agentDir = await resolveAgentDir(id, workspace_path);
        const messages = await state.sessionStore.readMessages(id, session_id, agentDir);
        return {
          messages: messages.map(toSnakeCaseMessage),
          total: messages.length,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to read messages" };
      }
    }
  );

  /**
   * Append a message to a session
   * POST /api/agent/:id/sessions/:session_id/messages
   */
  fastify.post<{
    Params: { id: string; session_id: string };
    Querystring: { workspace_path?: string };
    Body: {
      role: string;
      content: string;
      tool_calls?: unknown;
      tool_result?: unknown;
    };
  }>("/api/agent/:id/sessions/:session_id/messages", async (request, reply) => {
    const { id, session_id } = request.params;
    const { workspace_path } = request.query;
    const body = request.body;

    try {
      const agentDir = await resolveAgentDir(id, workspace_path);
      const message: SessionMessage = {
        timestamp: new Date().toISOString(),
        role: body.role,
        content: body.content,
        toolCalls: body.tool_calls,
        toolResult: body.tool_result,
      };

      await state.sessionStore.appendMessage(id, session_id, message, agentDir);
      reply.code(201);
      return toSnakeCaseMessage(message);
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to append message" };
    }
  });

  // ========================================================================
  // UI Messages (for frontend rendering)
  // ========================================================================

  /**
   * List UI messages in a session
   * GET /api/agent/:id/sessions/:session_id/ui-messages
   */
  fastify.get<{ Params: { id: string; session_id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/:id/sessions/:session_id/ui-messages",
    async (request, reply) => {
      const { id, session_id } = request.params;
      const { workspace_path } = request.query;
      try {
        const agentDir = await resolveAgentDir(id, workspace_path);
        const messages = await state.sessionStore.readUIMessages(id, session_id, agentDir);
        if (messages.length > 0) {
          return {
            messages: messages.map(toSnakeCaseUIMessage),
            total: messages.length,
          };
        }

        // Fallback: read from Claude Code's native session file
        // When tasks are started via `viben task start`, the detached process writes
        // to Claude Code's own session storage (~/.claude/projects/<encoded>/<sessionId>.jsonl)
        // but not to the viben SessionStore. This fallback reads from Claude Code's native format.
        if (workspace_path) {
          try {
            const projectsDir = getClaudeProjectsDir();
            const encodedPath = encodeWorkspacePath(workspace_path);
            const filePath = join(projectsDir, encodedPath, `${session_id}.jsonl`);
            if (existsSync(filePath)) {
              const executorMessages = await readClaudeCodeSessionMessages(filePath);
              if (executorMessages.length > 0) {
                return {
                  messages: executorMessages,
                  total: executorMessages.length,
                };
              }
            }
          } catch {
            // Fallback failed, return empty
          }
        }

        return { messages: [], total: 0 };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to read UI messages" };
      }
    }
  );

  // ========================================================================
  // Agent Availability Check
  // ========================================================================

  /**
   * Check agent/executor availability
   * GET /api/agent/:id/availability
   *
   * Returns availability info for executor-type agents (CLAUDE_CODE, CODEX, etc.)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/agent/:id/availability",
    async (request, reply) => {
      const { id } = request.params;
      const homeDir = homedir();

      // Known executor types that support availability check
      const executorTypes = [
        "CLAUDE_CODE",
        "CODEX",
        "AMP",
        "GEMINI",
        "OPENCODE",
        "CURSOR_AGENT",
        "QWEN_CODE",
        "COPILOT",
        "DROID",
        "OPENCLAW",
        "WINDSURF",
        "GOOSE",
        "ROOCODE",
        "AIDE",
        "AUGMENT",
        "CLINE",
        "CONTINUE",
        "TRAE",
        "MELTY",
        "ZENCODER",
        "MARSCODE",
        "VOID",
        "AIDER",
        "PLANDEX",
        "MENTAT",
        "GPT_ENGINEER",
        "AGENT_CODE",
        "SWEEP",
        "MICRO_AGENT",
        "AUTODEBUG",
        "DEVON",
        "SWEBENCH",
        "GPTPILOT",
        "DEVIN",
        "MAGIC",
        "PYTHAGORA",
        "FINE",
        "AI2WARE",
        "SOURCEGRAPH_CODY",
      ];

      // Check if this is a known executor type
      const upperCaseId = id.toUpperCase().replace(/-/g, "_");
      if (executorTypes.includes(upperCaseId)) {
        // Check actual availability based on executor type
        let availability: { type: string; last_auth_timestamp?: number } = { type: "NOT_FOUND" };

        switch (upperCaseId) {
          case "CLAUDE_CODE": {
            const claudeDir = join(homeDir, ".claude");
            const authFile = join(claudeDir, "config.json");
            if (existsSync(authFile)) {
              try {
                const stat = statSync(authFile);
                availability = {
                  type: "LOGIN_DETECTED",
                  last_auth_timestamp: Math.floor(stat.mtimeMs),
                };
              } catch {
                availability = { type: "INSTALLATION_FOUND" };
              }
            } else if (existsSync(claudeDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "CODEX": {
            const codexDir = join(homeDir, ".codex");
            if (isCommandAvailable("codex")) {
              availability = { type: "INSTALLATION_FOUND" };
            } else if (existsSync(codexDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "CURSOR_AGENT": {
            const cursorPaths = [
              join(homeDir, ".cursor"),
              join(homeDir, "Library/Application Support/Cursor"),
            ];
            for (const p of cursorPaths) {
              if (existsSync(p)) {
                availability = { type: "INSTALLATION_FOUND" };
                break;
              }
            }
            break;
          }
          case "AMP": {
            const ampDir = join(homeDir, ".amp");
            if (existsSync(ampDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "GEMINI": {
            const geminiDir = join(homeDir, ".gemini");
            if (existsSync(geminiDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "OPENCLAW": {
            const openClawDir = join(homeDir, ".openclaw");
            const openClawConfig = join(openClawDir, "openclaw.json");
            if (existsSync(openClawConfig)) {
              try {
                const stat = statSync(openClawConfig);
                availability = {
                  type: "LOGIN_DETECTED",
                  last_auth_timestamp: Math.floor(stat.mtimeMs),
                };
              } catch {
                availability = { type: "INSTALLATION_FOUND" };
              }
            } else if (existsSync(openClawDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "WINDSURF": {
            const windsurfDir = join(homeDir, ".windsurf");
            if (existsSync(windsurfDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "GOOSE": {
            const gooseDir = join(homeDir, ".goose");
            if (existsSync(gooseDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          case "AIDER": {
            const aiderDir = join(homeDir, ".aider");
            if (existsSync(aiderDir)) {
              availability = { type: "INSTALLATION_FOUND" };
            }
            break;
          }
          // Add more executors as needed
        }

        return availability;
      }

      // Check if it's a Viben agent
      const agent = await agentManager.getAgent(id);
      if (agent) {
        return {
          type: "VIBEN_AGENT",
          available: true,
          agent_id: agent.id,
          name: agent.name,
        };
      }

      reply.code(404);
      return { error: `Agent or executor not found: ${id}` };
    }
  );

  // ========================================================================
  // Single Agent Operations (must be after /sessions and /availability routes)
  // ========================================================================

  /**
   * Get a specific agent
   * GET /api/agent/:id
   *
   * Query params:
   * - workspace_path: Optional workspace path to check workspace agents first
   *
   * Returns agent with snake_case fields to match Rust gateway format.
   * When workspace_path is provided, checks workspace first, then falls back to global.
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { workspace_path?: string };
  }>("/api/agent/:id", async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;
    const homeDir = homedir();

    let agent = null;
    let source: "global" | "workspace" = "global";

    // 1. Check workspace first (if workspace_path provided)
    if (workspace_path) {
      const workspaceAgentsDir = join(workspace_path, ".viben", "agents");
      agent = await agentManager.getAgentFromDir(workspaceAgentsDir, id);
      if (agent) {
        source = "workspace";
      }
    }

    // 2. Fall back to global agent
    if (!agent) {
      agent = await agentManager.getAgent(id);
      if (agent) {
        // Determine source based on path (global = ~/.viben/agents/, workspace = elsewhere)
        source = agent.path && agent.path.startsWith(homeDir) && agent.path.includes("/.viben/agents/")
          ? "global"
          : "workspace";
      }
    }

    if (!agent) {
      reply.code(404);
      return { error: `Agent not found: ${id}` };
    }

    // Extract workspace path from agent path (remove /.viben/agents/{id} suffix)
    const agentWorkspacePath = source === "workspace" && agent.path
      ? agent.path.replace(/\/.viben\/agents\/[^/]+$/, "")
      : undefined;

    // Return agent with snake_case fields
    return {
      id: agent.id,
      name: agent.name,
      agent_type: "viben",
      source,
      agent_dir: agent.path,
      workspace_path: agentWorkspacePath,
      config_path: agent.path ? `${agent.path}/AGENTS.md` : undefined,
      description: agent.description,
      model: agent.model,
      provider_id: agent.provider_id,
      system_prompt: agent.systemPrompt,
      append_prompt: agent.appendPrompt,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
      executor_type: agent.executorType,
      executor_config: agent.executorConfig,
      mcp_servers: agent.mcpServers,
      skills: agent.skills,
      permission_mode: agent.permissionMode,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    };
  });

  /**
   * Update an agent
   * PATCH /api/agent/:id
   *
   * Returns agent with snake_case fields to match Rust gateway format
   */
  fastify.patch<{
    Params: { id: string };
    Querystring: { workspace_path?: string };
    Body: {
      name?: string;
      description?: string;
      model?: string;
      provider_id?: string;
      system_prompt?: string;
      append_prompt?: string;
      temperature?: number;
      max_tokens?: number;
      executor_type?: string;
      executor_config?: Record<string, unknown>;
      mcp_servers?: (string | AgentMcpServerEntry)[];
      skills?: string[];
      permission_mode?: AcpPermissionMode;
      is_template?: boolean;
      template_description?: string;
    };
  }>("/api/agent/:id", async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;
    const body = request.body;
    const updates = {
      name: body.name,
      description: body.description,
      model: body.model,
      provider_id: body.provider_id,
      systemPrompt: body.system_prompt,
      appendPrompt: body.append_prompt,
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      executorType: body.executor_type as ExecutorType | undefined,
      executorConfig: body.executor_config,
      mcpServers: body.mcp_servers,
      skills: body.skills,
      permissionMode: body.permission_mode,
      isTemplate: body.is_template,
      templateDescription: body.template_description,
    };
    try {
      const agent = await agentManager.updateAgent(id, updates, workspace_path);

      const homeDir = homedir();
      // Determine source based on path (global = ~/.viben/agents/, workspace = elsewhere)
      const isGlobalAgent = agent.path && agent.path.startsWith(homeDir) && agent.path.includes("/.viben/agents/");
      const agentSource = isGlobalAgent ? "global" : "workspace";

      // Extract workspace path from agent path (remove /.viben/agents/{id} suffix)
      const agentWorkspacePath = !isGlobalAgent && agent.path
        ? agent.path.replace(/\/.viben\/agents\/[^/]+$/, "")
        : undefined;

      // Return agent with snake_case fields
      return {
        id: agent.id,
        name: agent.name,
        agent_type: "viben",
        source: agentSource,
        agent_dir: agent.path,
        workspace_path: agentWorkspacePath,
        config_path: agent.path ? `${agent.path}/AGENTS.md` : undefined,
        description: agent.description,
        model: agent.model,
        provider_id: agent.provider_id,
        system_prompt: agent.systemPrompt,
        append_prompt: agent.appendPrompt,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        executor_type: agent.executorType,
        executor_config: agent.executorConfig,
        mcp_servers: agent.mcpServers,
        skills: agent.skills,
        permission_mode: agent.permissionMode,
        is_template: agent.isTemplate,
        template_description: agent.templateDescription,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update agent" };
    }
  });

  /**
   * Delete an agent
   * DELETE /api/agent/:id
   *
   * Query params:
   * - workspace_path: Optional workspace path to check for workspace-scoped agents first
   */
  fastify.delete<{ Params: { id: string }; Querystring: { workspace_path?: string } }>(
    "/api/agent/:id",
    async (request, reply) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      try {
        await agentManager.removeAgent(id, workspace_path);
        return { success: true, deleted: id };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to delete agent" };
      }
    }
  );
}
