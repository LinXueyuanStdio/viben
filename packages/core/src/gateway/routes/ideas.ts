/**
 * Idea REST API routes
 *
 * Provides REST-style endpoints for AI-generated idea management:
 * - GET /api/ideas - List all ideas (requires workspace_path)
 * - GET /api/ideas/:id - Get idea by ID
 * - POST /api/ideas/generate - Generate ideas using AI
 * - POST /api/ideas/:id/promote - Promote idea to task
 * - POST /api/ideas/:id/dismiss - Dismiss an idea
 * - DELETE /api/ideas/:id - Remove an idea
 * - DELETE /api/ideas - Remove ideas by type or all
 * - GET /api/idea-types - List available idea types
 *
 * All endpoints share the same src/idea/ops implementation with CLI commands.
 */
import type { FastifyInstance } from "fastify";
import { logger as globalLogger } from "../../telemetry";

// Import from idea/ops module - shared with CLI
import {
  // Types
  type Idea,
  type IdeaType,
  type EffortLevel,
  type IdeaStatus,
  type IdeaListOptions,
  type IdeaPromoteOptions,
  type IdeaRemoveOptions,
  type IdeaGenerateOptions,
  type IdeaTypeInput,
  EFFORT_LEVELS,
  IDEA_STATUSES,
  // CRUD operations
  listIdeas,
  listTypes,
  viewIdea,
  promoteIdea,
  removeIdeas,
  dismissIdea,
  validateIdeaTypes,
  // Idea Type CRUD operations
  createIdeaTypeOp,
  updateIdeaTypeOp,
  deleteIdeaTypeOp,
  // Generator
  generateIdeas,
} from "../../idea/ops";

// Module-level logger
const log = globalLogger.child({ module: "ideas" });

// =============================================================================
// Response Transformers (snake_case for API)
// =============================================================================

/**
 * Transform Idea to snake_case API response format
 */
function toSnakeCaseIdea(idea: Idea) {
  return {
    id: idea.id,
    type: idea.type,
    name: idea.name ?? null,
    title: idea.title,
    description: idea.description,
    rationale: idea.rationale,
    estimated_effort: idea.estimatedEffort,
    status: idea.status,
    promoted_to: idea.promotedTo ?? null,
    created_at: idea.createdAt,
    // Optional fields
    affected_files: idea.affectedFiles ?? null,
    existing_patterns: idea.existingPatterns ?? null,
    builds_upon: idea.buildsUpon ?? null,
    implementation_approach: idea.implementationApproach ?? null,
    category: idea.category ?? null,
    severity: idea.severity ?? null,
    target_audience: idea.targetAudience ?? null,
    related_docs: idea.relatedDocs ?? null,
    metrics: idea.metrics ?? null,
    ui_components: idea.uiComponents ?? null,
    user_stories: idea.userStories ?? null,
  };
}

/**
 * Transform IdeaType to snake_case API response format
 */
function toSnakeCaseIdeaType(ideaType: IdeaType) {
  return {
    name: ideaType.name,
    description: ideaType.description,
    max_ideas: ideaType.maxIdeas ?? null,
    source: ideaType.source,
    prompt_path: ideaType.promptPath,
  };
}

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register idea routes
 */
export function registerIdeaRoutes(fastify: FastifyInstance): void {
  // ============================================================================
  // GET /api/ideas - List all ideas
  // ============================================================================
  fastify.get<{
    Querystring: {
      workspace_path: string;
      type?: string;
      effort?: string;
      status?: string;
    };
  }>("/api/ideas", {
    schema: {
      description: "List all ideas for a workspace with optional filtering",
      tags: ["ideas"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          type: { type: "string", description: "Filter by idea type" },
          effort: {
            type: "string",
            enum: [...EFFORT_LEVELS],
            description: "Filter by effort level",
          },
          status: {
            type: "string",
            enum: [...IDEA_STATUSES],
            description: "Filter by status",
          },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            ideas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  name: { type: "string", nullable: true },
                  title: { type: "string" },
                  description: { type: "string" },
                  rationale: { type: "string" },
                  estimated_effort: { type: "string" },
                  status: { type: "string" },
                  promoted_to: { type: "string", nullable: true },
                  created_at: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, type, effort, status } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.debug({ workspacePath: workspace_path, type, effort, status }, "Listing ideas");

    const options: IdeaListOptions = {
      type,
      effort: effort as EffortLevel | undefined,
      status: status as IdeaStatus | undefined,
    };

    const result = listIdeas(workspace_path, options);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      ideas: result.ideas.map(toSnakeCaseIdea),
      count: result.count,
    };
  });

  // ============================================================================
  // GET /api/ideas/:id - Get idea by ID
  // ============================================================================
  fastify.get<{
    Params: { id: string };
    Querystring: { workspace_path: string };
  }>("/api/ideas/:id", {
    schema: {
      description: "Get a specific idea by ID",
      tags: ["ideas"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Idea ID" },
        },
        required: ["id"],
      },
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            idea: { type: "object" },
            session_dir: { type: "string", nullable: true },
            file_path: { type: "string", nullable: true },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.debug({ ideaId: id, workspacePath: workspace_path }, "Getting idea");

    const result = viewIdea(workspace_path, id);

    if (!result.success || !result.idea) {
      reply.code(404);
      return { success: false, error: result.error || `Idea not found: ${id}` };
    }

    return {
      success: true,
      idea: toSnakeCaseIdea(result.idea),
      session_dir: result.sessionDir ?? null,
      file_path: result.filePath ?? null,
    };
  });

  // ============================================================================
  // POST /api/ideas/generate - Generate ideas using AI
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      types: string[];
      output?: string;
      model?: string;
      max_ideas?: number;
      append?: boolean;
      override?: boolean;
    };
  }>("/api/ideas/generate", {
    schema: {
      description: "Generate ideas by analyzing the codebase using AI",
      tags: ["ideas"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          types: {
            type: "array",
            items: { type: "string" },
            description: "Idea types to generate",
          },
          output: { type: "string", description: "Output directory" },
          model: { type: "string", description: "AI model to use" },
          max_ideas: { type: "number", description: "Maximum ideas per type" },
          append: { type: "boolean", description: "Append to existing ideas" },
          override: { type: "boolean", description: "Force regenerate all types" },
        },
        required: ["workspace_path", "types"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            session_id: { type: "string" },
            session_dir: { type: "string" },
            ideas: { type: "array", items: { type: "object" } },
            by_type: { type: "object" },
            total_ideas: { type: "number" },
            errors: { type: "array", items: { type: "string" } },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, types, output, model, max_ideas, append, override } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!types || types.length === 0) {
      reply.code(400);
      return { success: false, error: "types array is required and must not be empty" };
    }

    log.info({ workspacePath: workspace_path, types }, "Generating ideas");

    // Validate types
    const validation = validateIdeaTypes(workspace_path, types);
    if (!validation.valid) {
      reply.code(400);
      return {
        success: false,
        error: `Unknown idea type(s): ${validation.invalidTypes.join(", ")}. Use GET /api/idea-types to see available types.`,
      };
    }

    const options: IdeaGenerateOptions = {
      types,
      output,
      model,
      maxIdeas: max_ideas ?? 5,
      append,
      override,
    };

    try {
      const result = await generateIdeas(workspace_path, options);

      if (!result.success && result.ideas.length === 0) {
        reply.code(400);
        return { success: false, error: result.errors.join("\n") };
      }

      return {
        success: true,
        session_id: result.sessionId,
        session_dir: result.sessionDir,
        ideas: result.ideas.map(toSnakeCaseIdea),
        by_type: result.byType,
        total_ideas: result.totalIdeas,
        errors: result.errors,
      };
    } catch (error) {
      log.error({ err: error }, "Error generating ideas");
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate ideas",
      };
    }
  });

  // ============================================================================
  // POST /api/ideas/:id/promote - Promote idea to task
  // ============================================================================
  fastify.post<{
    Params: { id: string };
    Body: {
      workspace_path: string;
      slug?: string;
      priority?: string;
      assignee?: string;
      branch?: string;
      description?: string;
      agent?: string;
      executor?: string;
      model?: string;
      start?: boolean;
      worktree?: boolean;
    };
  }>("/api/ideas/:id/promote", {
    schema: {
      description: "Promote an idea to a task",
      tags: ["ideas"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Idea ID" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          slug: { type: "string", description: "Task slug" },
          priority: { type: "string", description: "Task priority" },
          assignee: { type: "string", description: "Task assignee" },
          branch: { type: "string", description: "Custom branch name" },
          description: { type: "string", description: "Task description override" },
          agent: { type: "string", description: "Agent configuration" },
          executor: { type: "string", description: "Executor type" },
          model: { type: "string", description: "Model to use" },
          start: { type: "boolean", description: "Auto-start task" },
          worktree: { type: "boolean", description: "Run in worktree" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            idea_id: { type: "string" },
            idea_title: { type: "string" },
            task_id: { type: "string" },
            task_dir: { type: "string" },
            priority: { type: "string" },
            status: { type: "string" },
            worktree: { type: "boolean" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      workspace_path,
      slug,
      priority,
      assignee,
      branch,
      description,
      agent,
      executor,
      model,
      start,
      worktree,
    } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.info({ ideaId: id, workspacePath: workspace_path }, "Promoting idea to task");

    // Validate priority if provided
    const validPriorities = ["urgent", "high", "medium", "low", "none"];
    if (priority && !validPriorities.includes(priority)) {
      reply.code(400);
      return {
        success: false,
        error: `Invalid priority: ${priority}. Must be one of: ${validPriorities.join(", ")}`,
      };
    }

    const options: IdeaPromoteOptions = {
      slug,
      priority,
      assignee,
      branch,
      description,
      agent,
      executor,
      model,
      start,
      worktree,
    };

    const result = promoteIdea(workspace_path, id, options);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      idea_id: result.ideaId,
      idea_title: result.ideaTitle,
      task_id: result.taskId,
      task_dir: result.taskDir,
      dir_name: result.dirName,
      priority: result.priority,
      status: result.status,
      worktree: result.worktree,
    };
  });

  // ============================================================================
  // POST /api/ideas/:id/dismiss - Dismiss an idea
  // ============================================================================
  fastify.post<{
    Params: { id: string };
    Body: { workspace_path: string };
  }>("/api/ideas/:id/dismiss", {
    schema: {
      description: "Dismiss an idea (mark as not worth pursuing)",
      tags: ["ideas"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Idea ID" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            idea_id: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.debug({ ideaId: id, workspacePath: workspace_path }, "Dismissing idea");

    const result = dismissIdea(workspace_path, id);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return { success: false, error: result.error };
    }

    return { success: true, idea_id: id };
  });

  // ============================================================================
  // DELETE /api/ideas/:id - Remove a single idea
  // ============================================================================
  fastify.delete<{
    Params: { id: string };
    Querystring: { workspace_path: string };
  }>("/api/ideas/:id", {
    schema: {
      description: "Remove a single idea by ID",
      tags: ["ideas"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Idea ID" },
        },
        required: ["id"],
      },
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            removed: { type: "array", items: { type: "string" } },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.debug({ ideaId: id, workspacePath: workspace_path }, "Removing idea");

    const result = removeIdeas(workspace_path, [id]);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      removed: result.removed,
      count: result.count,
    };
  });

  // ============================================================================
  // DELETE /api/ideas - Remove ideas by type or all
  // ============================================================================
  fastify.delete<{
    Querystring: {
      workspace_path: string;
      type?: string;
      all?: string;
    };
  }>("/api/ideas", {
    schema: {
      description: "Remove ideas by type or all ideas",
      tags: ["ideas"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          type: { type: "string", description: "Remove all ideas of this type" },
          all: { type: "string", description: "Set to 'true' to remove all ideas" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            removed: { type: "array", items: { type: "string" } },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, type, all } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    // Require either type or all
    if (!type && all !== "true") {
      reply.code(400);
      return { success: false, error: "Must specify type or all=true" };
    }

    log.info({ workspacePath: workspace_path, type, all }, "Removing ideas");

    const options: IdeaRemoveOptions = {
      type,
      all: all === "true",
    };

    const result = removeIdeas(workspace_path, [], options);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      removed: result.removed,
      count: result.count,
    };
  });

  // ============================================================================
  // GET /api/idea-types - List available idea types
  // ============================================================================
  fastify.get<{
    Querystring: { workspace_path: string };
  }>("/api/idea-types", {
    schema: {
      description: "List available idea types (builtin + custom)",
      tags: ["ideas"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            types: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  max_ideas: { type: "number", nullable: true },
                  source: { type: "string", enum: ["builtin", "custom"] },
                  prompt_path: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.debug({ workspacePath: workspace_path }, "Listing idea types");

    const result = listTypes(workspace_path);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      types: result.types.map(toSnakeCaseIdeaType),
      count: result.count,
    };
  });

  // ============================================================================
  // POST /api/idea-types - Create a new idea type
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      name: string;
      description: string;
      max_ideas?: number;
      prompt_content: string;
    };
  }>("/api/idea-types", {
    schema: {
      description: "Create a new custom idea type",
      tags: ["ideas"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          name: { type: "string", description: "Type name (snake_case)" },
          description: { type: "string", description: "Human-readable description" },
          max_ideas: { type: "number", description: "Maximum ideas to generate" },
          prompt_content: { type: "string", description: "Prompt template content" },
        },
        required: ["workspace_path", "name", "description", "prompt_content"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            idea_type: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                max_ideas: { type: "number", nullable: true },
                source: { type: "string" },
                prompt_path: { type: "string" },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { workspace_path, name, description, max_ideas, prompt_content } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.info({ workspacePath: workspace_path, name }, "Creating idea type");

    const input: IdeaTypeInput = {
      name,
      description,
      maxIdeas: max_ideas,
      promptContent: prompt_content,
    };

    const result = createIdeaTypeOp(workspace_path, input);

    if (!result.success) {
      reply.code(400);
      return { success: false, error: result.error };
    }

    reply.code(201);
    return {
      success: true,
      idea_type: result.ideaType ? toSnakeCaseIdeaType(result.ideaType) : null,
    };
  });

  // ============================================================================
  // PUT /api/idea-types/:name - Update an idea type
  // ============================================================================
  fastify.put<{
    Params: { name: string };
    Body: {
      workspace_path: string;
      description?: string;
      max_ideas?: number;
      prompt_content?: string;
    };
  }>("/api/idea-types/:name", {
    schema: {
      description: "Update an existing idea type",
      tags: ["ideas"],
      params: {
        type: "object",
        properties: {
          name: { type: "string", description: "Type name" },
        },
        required: ["name"],
      },
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          description: { type: "string", description: "Human-readable description" },
          max_ideas: { type: "number", description: "Maximum ideas to generate" },
          prompt_content: { type: "string", description: "Prompt template content" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            idea_type: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                max_ideas: { type: "number", nullable: true },
                source: { type: "string" },
                prompt_path: { type: "string" },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const { workspace_path, description, max_ideas, prompt_content } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.info({ workspacePath: workspace_path, name }, "Updating idea type");

    const input: Partial<IdeaTypeInput> = {
      description,
      maxIdeas: max_ideas,
      promptContent: prompt_content,
    };

    const result = updateIdeaTypeOp(workspace_path, name, input);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      idea_type: result.ideaType ? toSnakeCaseIdeaType(result.ideaType) : null,
    };
  });

  // ============================================================================
  // DELETE /api/idea-types/:name - Delete an idea type
  // ============================================================================
  fastify.delete<{
    Params: { name: string };
    Querystring: { workspace_path: string };
  }>("/api/idea-types/:name", {
    schema: {
      description: "Delete a custom idea type",
      tags: ["ideas"],
      params: {
        type: "object",
        properties: {
          name: { type: "string", description: "Type name" },
        },
        required: ["name"],
      },
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            name: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const { workspace_path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    log.info({ workspacePath: workspace_path, name }, "Deleting idea type");

    const result = deleteIdeaTypeOp(workspace_path, name);

    if (!result.success) {
      const isNotFound = result.error?.includes("not found");
      reply.code(isNotFound ? 404 : 400);
      return { success: false, error: result.error };
    }

    return {
      success: true,
      name: result.name,
    };
  });
}
