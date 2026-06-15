/**
 * Skill management routes
 *
 * All endpoints share the same src/skill/ops implementation with CLI commands.
 * Naming convention follows CLI: viben skill xxx -> /api/skill/xxx
 *
 * Endpoints:
 * - GET  /api/skill/list      - List installed skills (viben skill list)
 * - GET  /api/skill/view/:name - Get skill by name (viben skill view <name>)
 * - POST /api/skill/install   - Install a skill (viben skill install <name>)
 * - POST /api/skill/uninstall - Uninstall a skill (viben skill uninstall <name>)
 * - POST /api/skill/enable    - Enable skill for agent (viben skill enable <name>)
 * - POST /api/skill/disable   - Disable skill for agent (viben skill disable <name>)
 * - GET  /api/skill/enabled   - Get enabled skills (viben skill enabled)
 * - GET  /api/skill/search    - Search skills in marketplace (viben skill search <query>)
 * - POST /api/skill/download  - Download skill (viben skill download <name>)
 * - GET  /api/skill/available - List available skills from marketplace
 * - GET  /api/skill/info/:id  - Get skill from marketplace
 */
import type { FastifyInstance } from "fastify";
import {
  listSkills,
  getSkill,
  installSkill,
  uninstallSkill,
  listAvailableSkills,
  enableSkill,
  disableSkill,
  getEnabledSkills,
  // Registry operations
  searchSkillRegistry,
  getSkillFromRegistry,
  downloadSkillFromRegistry,
} from "../../skill/ops";
import type {
  SkillTarget,
  InstallSkillResult,
  UninstallSkillResult,
  AgentSkillConfig,
  AvailableSkill,
  InstalledSkillInfo,
  SkillInfo,
} from "../../skill/ops/types";
import type { MarketplaceSkill } from "../../skill/ops/registry";

// ============================================================================
// Types
// ============================================================================

/**
 * Response for listing skills
 */
interface ListSkillsResponse {
  skills: InstalledSkillInfo[];
  count: number;
}

/**
 * Response for getting a single skill
 */
interface GetSkillResponse {
  skill: SkillInfo;
}

/**
 * Response for available skills
 */
interface AvailableSkillsResponse {
  skills: AvailableSkill[];
  count: number;
}

/**
 * Response for enabled skills
 */
interface EnabledSkillsResponse {
  skills: AgentSkillConfig[];
  count: number;
  agent_id: string;
}

/**
 * Error response
 */
interface ErrorResponse {
  error: string;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register skill management routes
 */
export function registerSkillRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/skill/list - List installed skills
   * CLI: viben skill list
   *
   * Query params:
   * - target: "agent" | "global" | "claude" | "custom" (optional)
   * - agent_id: string (required when target is "agent")
   * - custom_path: string (required when target is "custom")
   */
  fastify.get<{
    Querystring: {
      target?: SkillTarget;
      agent_id?: string;
      custom_path?: string;
    };
    Reply: ListSkillsResponse | ErrorResponse;
  }>("/api/skill/list", {
    schema: {
      description: "List installed skills",
      tags: ["skill"],
      querystring: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["agent", "global", "claude", "custom"],
            description: "Filter by installation target",
          },
          agent_id: {
            type: "string",
            description: "Agent ID (required when target is 'agent')",
          },
          custom_path: {
            type: "string",
            description: "Custom path (required when target is 'custom')",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  version: { type: "string" },
                  path: { type: "string" },
                  installed_at: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { target, agent_id, custom_path } = request.query;

    try {
      // Validate target-specific requirements
      if (target === "agent" && !agent_id) {
        reply.code(400);
        return { error: "agent_id is required when target is 'agent'" };
      }
      if (target === "custom" && !custom_path) {
        reply.code(400);
        return { error: "custom_path is required when target is 'custom'" };
      }

      const result = await listSkills(
        target
          ? {
              target,
              agentId: agent_id,
              customPath: custom_path,
            }
          : undefined
      );

      if (!result.success) {
        reply.code(400);
        return { error: result.error || "Failed to list skills" };
      }

      return {
        skills: result.skills,
        count: result.count,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to list skills: ${message}`);
      reply.code(500);
      return { error: message };
    }
  });

  /**
   * GET /api/skill/available - List available skills from marketplace
   */
  fastify.get<{
    Reply: AvailableSkillsResponse | ErrorResponse;
  }>("/api/skill/available", {
    schema: {
      description: "List available skills from marketplace",
      tags: ["skill"],
      response: {
        200: {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  version: { type: "string" },
                  description: { type: "string" },
                  author: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  downloadUrl: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      const result = await listAvailableSkills();
      if (!result.success) {
        reply.code(500);
        return { error: result.error || "Failed to list available skills" };
      }
      return {
        skills: result.skills,
        count: result.total,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to list available skills: ${message}`);
      reply.code(500);
      return { error: message };
    }
  });

  /**
   * GET /api/skill/enabled - Get enabled skills for an agent
   *
   * Query params:
   * - agent_id: string (required)
   */
  fastify.get<{
    Querystring: { agent_id: string };
    Reply: EnabledSkillsResponse | ErrorResponse;
  }>("/api/skill/enabled", {
    schema: {
      description: "Get enabled skills for an agent",
      tags: ["skill"],
      querystring: {
        type: "object",
        properties: {
          agent_id: {
            type: "string",
            description: "Agent ID (required)",
          },
        },
        required: ["agent_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skillName: { type: "string" },
                  enabled: { type: "boolean" },
                  agentId: { type: "string" },
                  enabledAt: { type: "string" },
                },
              },
            },
            count: { type: "number" },
            agent_id: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { agent_id } = request.query;

    if (!agent_id) {
      reply.code(400);
      return { error: "agent_id is required" };
    }

    try {
      const skills = await getEnabledSkills(agent_id);
      return {
        skills,
        count: skills.length,
        agent_id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to get enabled skills: ${message}`);
      reply.code(500);
      return { error: message };
    }
  });

  /**
   * GET /api/skill/view/:name - Get skill by name
   * CLI: viben skill view <name>
   *
   * Query params:
   * - target: "agent" | "global" | "claude" | "custom" (optional)
   * - agent_id: string (required when target is "agent")
   * - custom_path: string (required when target is "custom")
   */
  fastify.get<{
    Params: { name: string };
    Querystring: {
      target?: SkillTarget;
      agent_id?: string;
      custom_path?: string;
    };
    Reply: GetSkillResponse | ErrorResponse;
  }>("/api/skill/view/:name", {
    schema: {
      description: "Get skill by name",
      tags: ["skill"],
      params: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name" },
        },
        required: ["name"],
      },
      querystring: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["agent", "global", "claude", "custom"],
          },
          agent_id: { type: "string" },
          custom_path: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            skill: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                version: { type: "string" },
                path: { type: "string" },
                source: { type: "string" },
              },
            },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name } = request.params;
    const { target, agent_id, custom_path } = request.query;

    try {
      const result = await getSkill(
        name,
        target
          ? {
              target,
              agentId: agent_id,
              customPath: custom_path,
            }
          : undefined
      );

      if (!result.success || !result.skill) {
        reply.code(404);
        return { error: result.error || `Skill not found: ${name}` };
      }

      return { skill: result.skill };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to get skill: ${message}`);
      reply.code(500);
      return { error: message };
    }
  });

  /**
   * POST /api/skill/install - Install a skill
   *
   * Body:
   * - name: string (required) - Skill name or name@version
   * - target: "agent" | "global" | "claude" | "custom" (default: "global")
   * - agent_id: string (required when target is "agent")
   * - custom_path: string (required when target is "custom")
   * - source_path: string (optional) - Local source path
   * - zip_path: string (optional) - Zip file path
   * - version: string (optional) - Explicit version
   * - force: boolean (optional) - Force reinstall
   */
  fastify.post<{
    Body: {
      name: string;
      target?: SkillTarget;
      agent_id?: string;
      custom_path?: string;
      source_path?: string;
      zip_path?: string;
      version?: string;
      force?: boolean;
      registry?: "viben" | "clawhub";
    };
    Reply: InstallSkillResult | ErrorResponse;
  }>("/api/skill/install", {
    schema: {
      description: "Install a skill",
      tags: ["skill"],
      body: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name (or name@version)" },
          target: {
            type: "string",
            enum: ["agent", "global", "claude", "custom"],
            default: "global",
          },
          agent_id: { type: "string" },
          custom_path: { type: "string" },
          source_path: { type: "string", description: "Local source path" },
          zip_path: { type: "string", description: "Zip file path" },
          version: { type: "string" },
          force: { type: "boolean", default: false },
          registry: { type: "string", enum: ["viben", "clawhub"], description: "Registry source" },
        },
        required: ["name"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            name: { type: "string" },
            version: { type: "string" },
            path: { type: "string" },
            target: { type: "string" },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            name: { type: "string" },
            version: { type: "string" },
            path: { type: "string" },
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const {
      name,
      target = "global",
      agent_id,
      custom_path,
      source_path,
      zip_path,
      version,
      force = false,
      registry,
    } = request.body;

    if (!name) {
      reply.code(400);
      return { error: "name is required" };
    }

    // Validate target-specific requirements
    if (target === "agent" && !agent_id) {
      reply.code(400);
      return { error: "agent_id is required when target is 'agent'" };
    }
    if (target === "custom" && !custom_path) {
      reply.code(400);
      return { error: "custom_path is required when target is 'custom'" };
    }

    try {
      const result = await installSkill({
        name,
        target,
        agentId: agent_id,
        customPath: custom_path,
        sourcePath: source_path,
        zipPath: zip_path,
        version,
        force,
        registry,
      });

      if (!result.success) {
        reply.code(500);
        return {
          success: false,
          name: result.name,
          version: result.version,
          path: result.path,
          message: result.message,
          error: result.error || "Installation failed",
        };
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to install skill ${name}: ${message}`);

      // Determine error code
      let errorCode = "UNKNOWN_ERROR";
      if (error && typeof error === "object" && "name" in error) {
        const errorName = (error as { name: string }).name;
        if (errorName === "AlreadyExistsError") {
          errorCode = "ALREADY_EXISTS";
        } else if (errorName === "ValidationError") {
          errorCode = "VALIDATION_ERROR";
        } else if (errorName === "NotFoundError") {
          errorCode = "NOT_FOUND";
        }
      }

      reply.code(500);
      return {
        success: false,
        name,
        version: version || "1.0.0",
        path: "",
        message: "Installation failed",
        error: `${errorCode}: ${message}`,
      };
    }
  });

  /**
   * POST /api/skill/uninstall - Uninstall a skill
   * CLI: viben skill uninstall <name>
   *
   * Body:
   * - name: string (required)
   * - target: "agent" | "global" | "claude" | "custom" (default: "global")
   * - agent_id: string (required when target is "agent")
   * - custom_path: string (required when target is "custom")
   */
  fastify.post<{
    Body: {
      name: string;
      target?: SkillTarget;
      agent_id?: string;
      custom_path?: string;
    };
    Reply: UninstallSkillResult | ErrorResponse;
  }>("/api/skill/uninstall", {
    schema: {
      description: "Uninstall a skill",
      tags: ["skill"],
      body: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name" },
          target: {
            type: "string",
            enum: ["agent", "global", "claude", "custom"],
            default: "global",
          },
          agent_id: { type: "string" },
          custom_path: { type: "string" },
        },
        required: ["name"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            name: { type: "string" },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { name, target = "global", agent_id, custom_path } = request.body;

    if (!name) {
      reply.code(400);
      return { error: "name is required" };
    }

    // Validate target-specific requirements
    if (target === "agent" && !agent_id) {
      reply.code(400);
      return { error: "agent_id is required when target is 'agent'" };
    }
    if (target === "custom" && !custom_path) {
      reply.code(400);
      return { error: "custom_path is required when target is 'custom'" };
    }

    try {
      const result = await uninstallSkill({
        name,
        target,
        agentId: agent_id,
        customPath: custom_path,
      });

      if (!result.success) {
        reply.code(result.error?.includes("not found") ? 404 : 500);
        return {
          success: false,
          name: result.name,
          message: result.message,
          error: result.error || "Uninstallation failed",
        };
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to uninstall skill ${name}: ${message}`);

      // Check if it's a NotFoundError
      if (error && typeof error === "object" && "name" in error) {
        const errorName = (error as { name: string }).name;
        if (errorName === "NotFoundError") {
          reply.code(404);
          return {
            success: false,
            message: "Uninstallation failed",
            error: message,
          };
        }
      }

      reply.code(500);
      return {
        success: false,
        message: "Uninstallation failed",
        error: message,
      };
    }
  });

  /**
   * POST /api/skill/enable - Enable a skill for an agent
   * CLI: viben skill enable <name> --agent <id>
   *
   * Body:
   * - skill_name: string (required)
   * - agent_id: string (required)
   */
  fastify.post<{
    Body: {
      skill_name: string;
      agent_id: string;
    };
    Reply: { success: boolean; config: AgentSkillConfig; message: string } | ErrorResponse;
  }>("/api/skill/enable", {
    schema: {
      description: "Enable a skill for an agent",
      tags: ["skill"],
      body: {
        type: "object",
        properties: {
          skill_name: { type: "string", description: "Skill name" },
          agent_id: { type: "string", description: "Agent ID" },
        },
        required: ["skill_name", "agent_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            config: {
              type: "object",
              properties: {
                skillName: { type: "string" },
                enabled: { type: "boolean" },
                agentId: { type: "string" },
                enabledAt: { type: "string" },
              },
            },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { skill_name, agent_id } = request.body;

    if (!skill_name) {
      reply.code(400);
      return { error: "skill_name is required" };
    }
    if (!agent_id) {
      reply.code(400);
      return { error: "agent_id is required" };
    }

    try {
      const result = await enableSkill(skill_name, agent_id);
      if (!result.success) {
        reply.code(result.error?.includes("not found") ? 404 : 500);
        return { error: result.error || "Failed to enable skill" };
      }
      return {
        success: true,
        config: {
          skillName: result.skillName,
          enabled: result.enabled,
          agentId: result.agentId,
          enabledAt: result.enabledAt,
        },
        message: `Skill "${skill_name}" enabled for agent "${agent_id}"`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to enable skill: ${message}`);
      reply.code(500);
      return { error: message };
    }
  });

  /**
   * POST /api/skill/disable - Disable a skill for an agent
   *
   * Body:
   * - skill_name: string (required)
   * - agent_id: string (required)
   */
  fastify.post<{
    Body: {
      skill_name: string;
      agent_id: string;
    };
    Reply: { success: boolean; config: AgentSkillConfig; message: string } | ErrorResponse;
  }>("/api/skill/disable", {
    schema: {
      description: "Disable a skill for an agent",
      tags: ["skill"],
      body: {
        type: "object",
        properties: {
          skill_name: { type: "string", description: "Skill name" },
          agent_id: { type: "string", description: "Agent ID" },
        },
        required: ["skill_name", "agent_id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            config: {
              type: "object",
              properties: {
                skillName: { type: "string" },
                enabled: { type: "boolean" },
                agentId: { type: "string" },
                enabledAt: { type: "string" },
              },
            },
            message: { type: "string" },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { skill_name, agent_id } = request.body;

    if (!skill_name) {
      reply.code(400);
      return { error: "skill_name is required" };
    }
    if (!agent_id) {
      reply.code(400);
      return { error: "agent_id is required" };
    }

    try {
      const result = await disableSkill(skill_name, agent_id);
      if (!result.success) {
        reply.code(result.error?.includes("not found") ? 404 : 500);
        return { error: result.error || "Failed to disable skill" };
      }
      return {
        success: true,
        config: {
          skillName: result.skillName,
          enabled: result.enabled,
          agentId: result.agentId,
          enabledAt: result.enabledAt,
        },
        message: `Skill "${skill_name}" disabled for agent "${agent_id}"`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to disable skill: ${message}`);
      reply.code(500);
      return { error: message };
    }
  });

  // ========================================================================
  // Marketplace Operations
  // ========================================================================

  /**
   * GET /api/skill/search - Search skills in marketplace
   * CLI: viben skill search <query>
   */
  fastify.get<{
    Querystring: {
      query: string;
      limit?: string;
      page?: string;
      type?: "command" | "prompt" | "agent";
    };
  }>("/api/skill/search", {
    schema: {
      description: "Search skill packages in marketplace",
      tags: ["skill"],
      querystring: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (required)" },
          limit: { type: "string", description: "Maximum results" },
          page: { type: "string", description: "Page number" },
          type: {
            type: "string",
            enum: ["command", "prompt", "agent"],
            description: "Filter by skill type",
          },
        },
        required: ["query"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  slug: { type: "string" },
                  version: { type: "string" },
                  description: { type: "string" },
                  skill_type: { type: "string" },
                  downloads_count: { type: "number" },
                  favorites_count: { type: "number" },
                },
              },
            },
            total: { type: "number" },
            page: { type: "number" },
            total_pages: { type: "number" },
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
    const { query, limit, page, type } = request.query;

    if (!query) {
      reply.code(400);
      return { success: false, error: "query is required" };
    }

    try {
      const result = await searchSkillRegistry({
        query,
        limit: limit ? parseInt(limit, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
        type,
      });

      if (!result.success) {
        reply.code(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        skills: result.skills,
        total: result.total,
        page: result.page,
        total_pages: result.total_pages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to search marketplace: ${message}`);
      reply.code(500);
      return { success: false, error: message };
    }
  });

  /**
   * GET /api/skill/info/:idOrSlug - Get skill from marketplace
   * (No direct CLI equivalent, but useful for showing marketplace skill details)
   */
  fastify.get<{
    Params: { idOrSlug: string };
  }>("/api/skill/info/:idOrSlug", {
    schema: {
      description: "Get skill package details from marketplace",
      tags: ["skill"],
      params: {
        type: "object",
        properties: {
          idOrSlug: { type: "string", description: "Skill ID or slug" },
        },
        required: ["idOrSlug"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            skill: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
                version: { type: "string" },
                description: { type: "string" },
                skill_type: { type: "string" },
                downloads_count: { type: "number" },
                favorites_count: { type: "number" },
              },
            },
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
    const { idOrSlug } = request.params;

    try {
      const result = await getSkillFromRegistry(idOrSlug);

      if (!result.success || !result.skill) {
        reply.code(404);
        return { success: false, error: result.error || `Skill not found: ${idOrSlug}` };
      }

      return {
        success: true,
        skill: result.skill,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to get skill from marketplace: ${message}`);
      reply.code(500);
      return { success: false, error: message };
    }
  });

  /**
   * POST /api/skill/download - Download skill from marketplace
   * CLI: viben skill download <name> [version]
   */
  fastify.post<{
    Body: {
      name: string;
      version?: string;
      target_dir: string;
    };
  }>("/api/skill/download", {
    schema: {
      description: "Download skill package to a directory",
      tags: ["skill"],
      body: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name or ID" },
          version: { type: "string", description: "Version to download" },
          target_dir: { type: "string", description: "Target directory" },
        },
        required: ["name", "target_dir"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            path: { type: "string" },
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
    const { name, version, target_dir } = request.body;

    if (!name) {
      reply.code(400);
      return { success: false, error: "name is required" };
    }

    if (!target_dir) {
      reply.code(400);
      return { success: false, error: "target_dir is required" };
    }

    try {
      const result = await downloadSkillFromRegistry(name, version, target_dir);

      if (!result.success) {
        reply.code(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        path: target_dir,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Failed to download skill: ${message}`);
      reply.code(500);
      return { success: false, error: message };
    }
  });
}
