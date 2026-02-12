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
import { randomUUID } from "node:crypto";
import { agentManager, templateManager } from "../../agents";
import type { AppState } from "../state";
import type { SessionMessage } from "../../services/session-store";
import { createSessionConfigWithAgentInfo } from "../../services/session-store";
import type { ExecutorType } from "../../types";

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
   * GET /api/agents
   */
  fastify.get("/api/agents", async () => {
    const agents = await agentManager.listAgents();
    return {
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        model: a.model,
        provider: a.provider,
        systemPrompt: a.systemPrompt,
        appendPrompt: a.appendPrompt,
        temperature: a.temperature,
        maxTokens: a.maxTokens,
        executorType: a.executorType,
        executorConfig: a.executorConfig,
        mcpServers: a.mcpServers,
        skills: a.skills,
        planMode: a.planMode,
        approvals: a.approvals,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    };
  });

  /**
   * Create a new agent
   * POST /api/agents
   */
  fastify.post<{
    Body: {
      name: string;
      id?: string;
      description?: string;
      model?: string;
      provider?: string;
      systemPrompt?: string;
      appendPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      fromTemplate?: string;
      basePath?: string;
      executorType?: string;
      executorConfig?: Record<string, unknown>;
      mcpServers?: string[];
      skills?: string[];
      planMode?: boolean;
      approvals?: boolean;
    };
  }>("/api/agents", async (request, reply) => {
    const body = request.body;
    try {
      const agent = await agentManager.createAgent({
        id: body.id,
        name: body.name,
        description: body.description,
        model: body.model,
        provider: body.provider,
        systemPrompt: body.systemPrompt,
        appendPrompt: body.appendPrompt,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        fromTemplate: body.fromTemplate,
        executorType: body.executorType as ExecutorType | undefined,
        executorConfig: body.executorConfig,
        mcpServers: body.mcpServers,
        skills: body.skills,
        planMode: body.planMode,
        approvals: body.approvals,
      });
      reply.code(201);
      return { agent };
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
   * GET /api/agents/default
   */
  fastify.get("/api/agents/default", async () => {
    const defaultAgentId = await agentManager.getDefault();
    return { default_agent_id: defaultAgentId || null };
  });

  /**
   * Set default agent
   * PUT /api/agents/default
   */
  fastify.put<{ Body: { agent_id: string } }>(
    "/api/agents/default",
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
   * GET /api/agents/templates
   */
  fastify.get("/api/agents/templates", async () => {
    const templates = await agentManager.listTemplates();
    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        config: t.config,
        createdAt: t.createdAt,
      })),
      total: templates.length,
    };
  });

  /**
   * Create a template from an agent
   * POST /api/agents/templates
   */
  fastify.post<{ Body: { agent_id: string; template_id: string } }>(
    "/api/agents/templates",
    async (request, reply) => {
      const { agent_id, template_id } = request.body;
      try {
        const template = await agentManager.createTemplate(agent_id, template_id);
        reply.code(201);
        return {
          id: template.id,
          name: template.name,
          description: template.description,
          config: template.config,
          createdAt: template.createdAt,
        };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to create template" };
      }
    }
  );

  /**
   * Get a template by ID
   * GET /api/agents/templates/:id
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/agents/templates/:id",
    async (request, reply) => {
      const { id } = request.params;
      const template = await agentManager.getTemplate(id);
      if (!template) {
        reply.code(404);
        return { error: `Template not found: ${id}` };
      }
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        config: template.config,
        createdAt: template.createdAt,
      };
    }
  );

  /**
   * Create an agent from a template
   * POST /api/agents/templates/:id/instantiate
   */
  fastify.post<{ Params: { id: string }; Body: { agent_id: string } }>(
    "/api/agents/templates/:id/instantiate",
    async (request, reply) => {
      const { id } = request.params;
      const { agent_id } = request.body;
      try {
        const agent = await agentManager.createAgentFromTemplate(id, agent_id);
        reply.code(201);
        return { agent };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to instantiate template" };
      }
    }
  );

  // ========================================================================
  // Agent Sessions (file-based)
  // ========================================================================

  /**
   * List sessions for an agent
   * GET /api/agents/:id/sessions
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/agents/:id/sessions",
    async (request, reply) => {
      const { id } = request.params;
      try {
        const sessions = await state.sessionStore.listSessions(id);
        return {
          sessions: sessions.map((s) => ({
            id: s.id,
            agentId: s.agentId,
            agentPath: s.agentPath,
            agentConfig: s.agentConfig,
            taskId: s.taskId,
            prompt: s.prompt,
            status: s.status,
            workspacePath: s.workspacePath,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            metadata: s.metadata,
          })),
          total: sessions.length,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to list sessions" };
      }
    }
  );

  /**
   * Create a session for an agent
   * POST /api/agents/:id/sessions
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      session_id?: string;
      prompt?: string;
      task_id?: string;
      agent_path?: string;
      agent_config?: Record<string, unknown>;
      workspace_path?: string;
    };
  }>("/api/agents/:id/sessions", async (request, reply) => {
    const { id } = request.params;
    const body = request.body;
    const sessionId = body.session_id || randomUUID();

    try {
      const config = createSessionConfigWithAgentInfo(
        sessionId,
        id,
        body.agent_path,
        body.agent_config,
        body.workspace_path
      );
      config.prompt = body.prompt;
      config.taskId = body.task_id;

      await state.sessionStore.createSession(config);
      reply.code(201);
      return {
        id: config.id,
        agentId: config.agentId,
        agentPath: config.agentPath,
        agentConfig: config.agentConfig,
        taskId: config.taskId,
        prompt: config.prompt,
        status: config.status,
        workspacePath: config.workspacePath,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        metadata: config.metadata,
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to create session" };
    }
  });

  /**
   * Get a session
   * GET /api/agents/:id/sessions/:session_id
   */
  fastify.get<{ Params: { id: string; session_id: string } }>(
    "/api/agents/:id/sessions/:session_id",
    async (request, reply) => {
      const { id, session_id } = request.params;
      try {
        const session = await state.sessionStore.getSession(id, session_id);
        return {
          id: session.id,
          agentId: session.agentId,
          agentPath: session.agentPath,
          agentConfig: session.agentConfig,
          taskId: session.taskId,
          prompt: session.prompt,
          status: session.status,
          workspacePath: session.workspacePath,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          metadata: session.metadata,
        };
      } catch (e) {
        reply.code(404);
        return { error: e instanceof Error ? e.message : "Session not found" };
      }
    }
  );

  /**
   * Delete a session
   * DELETE /api/agents/:id/sessions/:session_id
   */
  fastify.delete<{ Params: { id: string; session_id: string } }>(
    "/api/agents/:id/sessions/:session_id",
    async (request, reply) => {
      const { id, session_id } = request.params;
      try {
        await state.sessionStore.deleteSession(id, session_id);
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
   * GET /api/agents/:id/sessions/:session_id/messages
   */
  fastify.get<{ Params: { id: string; session_id: string } }>(
    "/api/agents/:id/sessions/:session_id/messages",
    async (request, reply) => {
      const { id, session_id } = request.params;
      try {
        const messages = await state.sessionStore.readMessages(id, session_id);
        return {
          messages: messages.map((m) => ({
            timestamp: m.timestamp,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls,
            toolResult: m.toolResult,
          })),
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
   * POST /api/agents/:id/sessions/:session_id/messages
   */
  fastify.post<{
    Params: { id: string; session_id: string };
    Body: {
      role: string;
      content: string;
      tool_calls?: unknown;
      tool_result?: unknown;
    };
  }>("/api/agents/:id/sessions/:session_id/messages", async (request, reply) => {
    const { id, session_id } = request.params;
    const body = request.body;

    try {
      const message: SessionMessage = {
        timestamp: new Date().toISOString(),
        role: body.role,
        content: body.content,
        toolCalls: body.tool_calls,
        toolResult: body.tool_result,
      };

      await state.sessionStore.appendMessage(id, session_id, message);
      reply.code(201);
      return {
        timestamp: message.timestamp,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        toolResult: message.toolResult,
      };
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
   * GET /api/agents/:id/sessions/:session_id/ui-messages
   */
  fastify.get<{ Params: { id: string; session_id: string } }>(
    "/api/agents/:id/sessions/:session_id/ui-messages",
    async (request, reply) => {
      const { id, session_id } = request.params;
      try {
        const messages = await state.sessionStore.readUIMessages(id, session_id);
        return {
          messages: messages.map((m) => ({
            id: m.id,
            timestamp: m.timestamp,
            type: m.type,
            content: m.content,
            toolUseId: m.toolUseId,
            toolName: m.toolName,
            toolInput: m.toolInput,
            toolOutput: m.toolOutput,
            isError: m.isError,
            attachments: m.attachments,
          })),
          total: messages.length,
        };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to read UI messages" };
      }
    }
  );

  // ========================================================================
  // Single Agent Operations (must be after /sessions routes)
  // ========================================================================

  /**
   * Get a specific agent
   * GET /api/agents/:id
   */
  fastify.get<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
    const { id } = request.params;
    const agent = await agentManager.getAgent(id);
    if (!agent) {
      reply.code(404);
      return { error: `Agent not found: ${id}` };
    }
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        model: agent.model,
        provider: agent.provider,
        systemPrompt: agent.systemPrompt,
        appendPrompt: agent.appendPrompt,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        executorType: agent.executorType,
        executorConfig: agent.executorConfig,
        mcpServers: agent.mcpServers,
        skills: agent.skills,
        planMode: agent.planMode,
        approvals: agent.approvals,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    };
  });

  /**
   * Update an agent
   * PATCH /api/agents/:id
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
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
    };
  }>("/api/agents/:id", async (request, reply) => {
    const { id } = request.params;
    const updates = {
      ...request.body,
      executorType: request.body.executorType as ExecutorType | undefined,
    };
    try {
      const agent = await agentManager.updateAgent(id, updates);
      return {
        agent: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          model: agent.model,
          provider: agent.provider,
          systemPrompt: agent.systemPrompt,
          appendPrompt: agent.appendPrompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          executorType: agent.executorType,
          executorConfig: agent.executorConfig,
          mcpServers: agent.mcpServers,
          skills: agent.skills,
          planMode: agent.planMode,
          approvals: agent.approvals,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        },
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update agent" };
    }
  });

  /**
   * Delete an agent
   * DELETE /api/agents/:id
   */
  fastify.delete<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      await agentManager.removeAgent(id);
      return { success: true, deleted: id };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete agent" };
    }
  });
}
