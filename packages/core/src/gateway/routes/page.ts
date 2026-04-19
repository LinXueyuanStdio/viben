/**
 * Page management routes
 *
 * All endpoints share the same src/page/ops implementation with CLI commands.
 * Naming convention follows CLI: viben page xxx -> /api/page/xxx
 *
 * Endpoints:
 * - POST /api/page/list      - List pages in workspace
 * - POST /api/page/view      - Get page by slug
 * - POST /api/page/create    - Create a new page
 * - POST /api/page/delete    - Delete a page
 * - POST /api/page/serve     - Serve page content (POST for body params)
 * - GET  /api/page/serve     - Serve page content (GET for query params)
 * - POST /api/page/templates - List available page templates
 */
import type { FastifyInstance } from "fastify";
import {
  // CRUD operations
  listPages,
  viewPage,
  createPage,
  deletePage,
  // Serve
  servePage,
  // Templates
  listTemplatesResult,
  // Types
  PAGE_TYPES,
  PAGE_PERMISSIONS,
} from "../../page/ops";
import type {
  PageConfig,
  PageType,
  PageTemplate,
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  ServePageResult,
  ListTemplatesResult,
} from "../../page/ops";

// ============================================================================
// Schema Definitions
// ============================================================================

const pageTypeSchema = {
  type: "string",
  enum: PAGE_TYPES,
  description: "Page type",
} as const;

const pagePermissionSchema = {
  type: "array",
  items: { type: "string", enum: PAGE_PERMISSIONS },
  description: "Page permissions",
} as const;

const pageConfigSchema = {
  type: "object",
  properties: {
    slug: { type: "string" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    icon: { type: "string", nullable: true },
    type: pageTypeSchema,
    permission: pagePermissionSchema,
    path: { type: "string" },
    skill_content: { type: "string", nullable: true },
    // Static-specific
    file: { type: "string", nullable: true },
    // Server-specific
    command: { type: "string", nullable: true },
    port: { type: "number", nullable: true },
    ready_pattern: { type: "string", nullable: true },
    timeout: { type: "number", nullable: true },
    // Proxy-specific
    url: { type: "string", nullable: true },
    headers: { type: "object", additionalProperties: { type: "string" }, nullable: true },
  },
} as const;

const listPagesResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    pages: { type: "array", items: pageConfigSchema },
    count: { type: "number" },
    error: { type: "string", nullable: true },
  },
} as const;

const viewPageResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    page: { ...pageConfigSchema, nullable: true },
    error: { type: "string", nullable: true },
  },
} as const;

const createPageResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    page: { ...pageConfigSchema, nullable: true },
    error: { type: "string", nullable: true },
  },
} as const;

const deletePageResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    slug: { type: "string", nullable: true },
    deleted_path: { type: "string", nullable: true },
    error: { type: "string", nullable: true },
  },
} as const;

const templateSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    type: pageTypeSchema,
    default_config: { type: "object" },
    install_command: { type: "string", nullable: true },
    source: { type: "string", enum: ["builtin", "custom"] },
  },
} as const;

const listTemplatesResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    templates: { type: "array", items: templateSchema },
    error: { type: "string", nullable: true },
  },
} as const;

const errorResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
  },
} as const;

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register page management routes
 */
export function registerPageRoutes(fastify: FastifyInstance): void {
  // ============================================================================
  // POST /api/page/list - List pages in workspace
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string };
    Reply: ListPagesResult;
  }>("/api/page/list", {
    schema: {
      description: "List pages in workspace",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
        },
        required: ["workspace_path"],
      },
      response: {
        200: listPagesResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required", pages: [], count: 0 };
    }

    const result = await listPages({ workspace_path });

    if (!result.success) {
      reply.code(400);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/view - Get page by slug
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; slug: string };
    Reply: ViewPageResult;
  }>("/api/page/view", {
    schema: {
      description: "Get page by slug",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          slug: { type: "string", description: "Page slug (required)" },
        },
        required: ["workspace_path", "slug"],
      },
      response: {
        200: viewPageResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, slug } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!slug) {
      reply.code(400);
      return { success: false, error: "slug is required" };
    }

    const result = await viewPage({ workspace_path, slug });

    if (!result.success) {
      reply.code(404);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/create - Create a new page
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      slug: string;
      name: string;
      description?: string;
      type: PageType;
      // Static-specific
      file?: string;
      // Server-specific
      command?: string;
      port?: number;
      ready_pattern?: string;
      timeout?: number;
      // Proxy-specific
      url?: string;
      headers?: Record<string, string>;
    };
    Reply: CreatePageResult;
  }>("/api/page/create", {
    schema: {
      description: "Create a new page",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          slug: { type: "string", description: "Page slug (required)" },
          name: { type: "string", description: "Page name (required)" },
          description: { type: "string", description: "Page description" },
          type: { ...pageTypeSchema, description: "Page type (required)" },
          // Static-specific
          file: { type: "string", description: "Entry file for static pages" },
          // Server-specific
          command: { type: "string", description: "Start command for server pages" },
          port: { type: "number", description: "Port for server pages" },
          ready_pattern: { type: "string", description: "Ready pattern for server pages" },
          timeout: { type: "number", description: "Timeout for server pages" },
          // Proxy-specific
          url: { type: "string", description: "URL for proxy pages" },
          headers: { type: "object", additionalProperties: { type: "string" }, description: "Headers for proxy pages" },
        },
        required: ["workspace_path", "slug", "name", "type"],
      },
      response: {
        201: createPageResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const {
      workspace_path,
      slug,
      name,
      description,
      type,
      file,
      command,
      port,
      ready_pattern,
      timeout,
      url,
      headers,
    } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!slug) {
      reply.code(400);
      return { success: false, error: "slug is required" };
    }

    if (!name) {
      reply.code(400);
      return { success: false, error: "name is required" };
    }

    if (!type) {
      reply.code(400);
      return { success: false, error: "type is required" };
    }

    const result = await createPage({
      workspace_path,
      slug,
      name,
      description,
      type,
      file,
      command,
      port,
      ready_pattern,
      timeout,
      url,
      headers,
    });

    if (!result.success) {
      reply.code(400);
      return result;
    }

    reply.code(201);
    return result;
  });

  // ============================================================================
  // POST /api/page/delete - Delete a page
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; slug: string };
    Reply: DeletePageResult;
  }>("/api/page/delete", {
    schema: {
      description: "Delete a page",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          slug: { type: "string", description: "Page slug (required)" },
        },
        required: ["workspace_path", "slug"],
      },
      response: {
        200: deletePageResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, slug } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!slug) {
      reply.code(400);
      return { success: false, error: "slug is required" };
    }

    const result = await deletePage({ workspace_path, slug });

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/serve - Serve page content (POST for body params)
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; slug: string; path?: string };
  }>("/api/page/serve", {
    schema: {
      description: "Serve page content",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          slug: { type: "string", description: "Page slug (required)" },
          path: { type: "string", description: "File path within the page (optional)" },
        },
        required: ["workspace_path", "slug"],
      },
      response: {
        200: {
          description: "Page content",
          content: {
            "*/*": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, slug, path } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!slug) {
      reply.code(400);
      return { success: false, error: "slug is required" };
    }

    const result = await servePage({ workspace_path, slug, path });

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return { success: false, error: result.error };
    }

    if (result.content && result.content_type) {
      reply.type(result.content_type);
      return reply.send(result.content);
    }

    reply.code(500);
    return { success: false, error: "No content returned" };
  });

  // ============================================================================
  // GET /api/page/serve - Serve page content (GET for query params)
  // ============================================================================
  fastify.get<{
    Querystring: { workspace_path: string; slug: string; path?: string };
  }>("/api/page/serve", {
    schema: {
      description: "Serve page content",
      tags: ["page"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          slug: { type: "string", description: "Page slug (required)" },
          path: { type: "string", description: "File path within the page (optional)" },
        },
        required: ["workspace_path", "slug"],
      },
      response: {
        200: {
          description: "Page content",
          content: {
            "*/*": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, slug, path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!slug) {
      reply.code(400);
      return { success: false, error: "slug is required" };
    }

    const result = await servePage({ workspace_path, slug, path });

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return { success: false, error: result.error };
    }

    if (result.content && result.content_type) {
      reply.type(result.content_type);
      return reply.send(result.content);
    }

    reply.code(500);
    return { success: false, error: "No content returned" };
  });

  // ============================================================================
  // POST /api/page/templates - List available page templates
  // ============================================================================
  fastify.post<{
    Body: { workspace_path?: string };
    Reply: ListTemplatesResult;
  }>("/api/page/templates", {
    schema: {
      description: "List available page templates",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (optional, for custom templates)" },
        },
      },
      response: {
        200: listTemplatesResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path } = request.body;

    const result = await listTemplatesResult(workspace_path);

    if (!result.success) {
      reply.code(400);
      return result;
    }

    return result;
  });
}
