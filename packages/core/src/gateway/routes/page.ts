/**
 * Page management routes
 *
 * All endpoints share the same src/page/ops implementation with CLI commands.
 * Naming convention follows CLI: viben page xxx -> /api/page/xxx
 *
 * Endpoints:
 * - POST /api/page/list      - List pages in workspace
 * - POST /api/page/view      - Get page by uid
 * - POST /api/page/create    - Create a new page
 * - POST /api/page/delete    - Delete a page
 * - POST /api/page/serve     - Serve page content (POST for body params)
 * - GET  /api/page/serve     - Serve page content (GET for query params)
 * - POST /api/page/update-content - Update page markdown content (preserves YAML frontmatter)
 * - POST /api/page/update-config - Update page config (name, description, icon)
 * - POST /api/page/templates - List available page templates
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
import type { FastifyInstance } from "fastify";
import { VibenClient, ApiError } from "@viben/api-client";
import {
  // CRUD operations
  listPages,
  viewPage,
  createPage,
  deletePage,
  duplicatePage,
  updatePageContent,
  updatePageConfig,
  uploadPageAsset,
  reorderPages,
  // Serve
  servePage,
  // Templates
  listTemplatesResult,
  // Types
  PAGE_TYPES,
  PAGE_PERMISSIONS,
} from "../../page/ops";
import { proxyFetch } from "../../http";
import type {
  PageConfig,
  PageType,
  PageWidth,
  PageTemplate,
  IconData,
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  UpdatePageContentResult,
  UpdatePageConfigResult,
  ReorderPagesResult,
  DuplicatePageResult,
  ServePageResult,
  ListTemplatesResult,
} from "../../page/ops";

const currentDir = dirname(fileURLToPath(import.meta.url));
const VIBEN_WEB_URL = "https://viben-web.vercel.app";

function getUnknownErrorDetails(error: unknown): unknown {
  if (error && typeof error === "object" && "details" in error) {
    return (error as { details?: unknown }).details;
  }
  return undefined;
}

async function parseProxyJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text };
  }
}

async function forwardPagePublishRequest(
  endpoint: string,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  const response = await proxyFetch(`${VIBEN_WEB_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  return {
    status: response.status,
    body: await parseProxyJsonResponse(response),
  };
}

function readPageSdkAsset(filename: string): string {
  const mapping: Record<string, string> = {
    "viben-page-sdk.js": "@viben/page-sdk/assets/viben-page-sdk.js",
    "viben-page-tokens.css": "@viben/page-sdk/assets/viben-page-tokens.css",
  };

  const packagePath = mapping[filename];
  if (packagePath) {
    try {
      const resolved = require.resolve(packagePath);
      return readFileSync(resolved, "utf-8");
    } catch {
      // fallback below
    }
  }

  // Fallback: search local paths (for development before build)
  const candidates = [
    join(currentDir, "assets", filename),
    join(currentDir, "../assets", filename),
    join(currentDir, "../../assets", filename),
    join(currentDir, "../../../assets", filename),
    join(process.cwd(), "dist/assets", filename),
    join(process.cwd(), "packages/page-sdk/dist/assets", filename),
    join(process.cwd(), "packages/page-sdk/assets", filename),
    join(process.cwd(), "packages/core/dist/assets", filename),
    join(process.cwd(), "assets", filename),
    join(process.cwd(), "packages/core/assets", filename),
  ];

  const assetPath = candidates.find((candidate) => existsSync(candidate));
  if (!assetPath) {
    throw new Error(`Page SDK asset not found: ${filename}`);
  }

  return readFileSync(assetPath, "utf-8");
}

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

const iconDataSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["lucide", "emoji", "image"] },
    value: { type: "string" },
  },
  nullable: true,
} as const;

const pageConfigSchema = {
  type: "object",
  properties: {
    uid: { type: "string" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    icon: iconDataSchema,
    cover: { type: "string", nullable: true },
    page_width: { type: "string", nullable: true, enum: ["default", "wide", "full"] },
    show_toc: { type: "boolean", nullable: true },
    type: pageTypeSchema,
    permission: pagePermissionSchema,
    path: { type: "string" },
    skill_content: { type: "string", nullable: true },
    updated_at: { type: "string", nullable: true },
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

const pageIndexSchema = {
  type: "object",
  additionalProperties: { type: "array", items: { type: "string" } },
  description: "Page index mapping parent keys to child uids",
} as const;

const listPagesResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    pages: { type: "array", items: pageConfigSchema },
    index: pageIndexSchema,
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
    uid: { type: "string", nullable: true },
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
    details: {},
  },
} as const;

const publishPageResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    page_uid: { type: "string", nullable: true },
    url: { type: "string", nullable: true },
    updated: { type: "boolean", nullable: true },
    error: { type: "string", nullable: true },
  },
} as const;

const publishPageStatusResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    published: { type: "boolean" },
    url: { type: "string", nullable: true },
    error: { type: "string", nullable: true },
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
      return { success: false, error: "workspace_path is required", pages: [], index: { root: [] }, count: 0 };
    }

    const result = await listPages({ workspace_path });

    if (!result.success) {
      reply.code(400);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/view - Get page by uid
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; uid: string };
    Reply: ViewPageResult;
  }>("/api/page/view", {
    schema: {
      description: "Get page by uid",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Page uid (required)" },
        },
        required: ["workspace_path", "uid"],
      },
      response: {
        200: viewPageResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, uid } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    const result = await viewPage({ workspace_path, uid });

    if (!result.success) {
      reply.code(404);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/publish - Publish a static page through viben-web
  // ============================================================================
  fastify.post<{
    Body: {
      access_token: string;
      uid: string;
      title: string;
      icon?: IconData | null;
      description?: string | null;
      html: string;
    };
  }>("/api/page/publish", {
    schema: {
      description: "Publish a static page to viben-web through proxy-aware api-client",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Viben web access token" },
          uid: { type: "string", description: "Page uid" },
          title: { type: "string", description: "Page title" },
          icon: iconDataSchema,
          description: { type: "string", nullable: true },
          html: { type: "string", description: "Static HTML content" },
        },
        required: ["access_token", "uid", "title", "html"],
      },
      response: {
        200: publishPageResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { access_token, uid, title, icon, description, html } = request.body;

    if (!access_token.trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid.trim() || !title.trim() || !html) {
      reply.code(400);
      return { success: false, error: "uid, title, and html are required" };
    }

    try {
      const client = new VibenClient({
        baseUrl: VIBEN_WEB_URL,
        apiKey: access_token,
        fetch: proxyFetch,
      });
      return await client.pages.publish({
        uid,
        title,
        icon: icon ?? null,
        description: description ?? null,
        html,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        reply.code(error.status || 500);
        return { success: false, error: error.message, details: error.details };
      }
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to publish page",
        details: getUnknownErrorDetails(error),
      };
    }
  });

  // ============================================================================
  // POST /api/page/publish-status - Check a published page by public slug URL
  // ============================================================================
  fastify.post<{
    Body: {
      access_token: string;
      user_slug: string;
      uid: string;
    };
  }>("/api/page/publish-status", {
    schema: {
      description: "Check whether a static page is published on viben-web",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Viben web access token" },
          user_slug: { type: "string", description: "Public user slug" },
          uid: { type: "string", description: "Page uid" },
        },
        required: ["access_token", "user_slug", "uid"],
      },
      response: {
        200: publishPageStatusResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { access_token, user_slug, uid } = request.body;

    if (!access_token.trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!user_slug.trim() || !uid.trim()) {
      reply.code(400);
      return { success: false, error: "user_slug and uid are required" };
    }

    const url = `/page/${encodeURIComponent(user_slug)}/${encodeURIComponent(uid)}`;

    try {
      const response = await proxyFetch(`${VIBEN_WEB_URL}${url}`, {
        method: "HEAD",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (response.status === 404) {
        return { success: true, published: false, url: null };
      }

      if (!response.ok) {
        reply.code(response.status || 500);
        return { success: false, error: `Publish status check failed: HTTP ${response.status}` };
      }

      return { success: true, published: true, url };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check publish status",
      };
    }
  });

  // ============================================================================
  // POST /api/page/publish-history - Load append-only publish records
  // ============================================================================
  fastify.post<{
    Body: {
      access_token: string;
      uid: string;
    };
  }>("/api/page/publish-history", {
    schema: {
      description: "Load publish history from viben-web through proxyFetch",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Viben web access token" },
          uid: { type: "string", description: "Page uid" },
        },
        required: ["access_token", "uid"],
      },
      response: {
        200: { type: "object", additionalProperties: true },
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { access_token, uid } = request.body;

    if (!access_token.trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid.trim()) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    try {
      const result = await forwardPagePublishRequest(
        "/api/pages/publish-history",
        access_token,
        { uid }
      );
      reply.code(result.status);
      return result.body;
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load publish history",
        details: getUnknownErrorDetails(error),
      };
    }
  });

  // ============================================================================
  // POST /api/page/publish-version - Load one immutable published version
  // ============================================================================
  fastify.post<{
    Body: {
      access_token: string;
      uid: string;
      version: number;
    };
  }>("/api/page/publish-version", {
    schema: {
      description: "Load a published page version from viben-web through proxyFetch",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Viben web access token" },
          uid: { type: "string", description: "Page uid" },
          version: { type: "number", description: "Published version number" },
        },
        required: ["access_token", "uid", "version"],
      },
      response: {
        200: { type: "object", additionalProperties: true },
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { access_token, uid, version } = request.body;

    if (!access_token.trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid.trim() || !Number.isInteger(version) || version < 1) {
      reply.code(400);
      return { success: false, error: "uid and version are required" };
    }

    try {
      const result = await forwardPagePublishRequest(
        "/api/pages/publish-version",
        access_token,
        { uid, version }
      );
      reply.code(result.status);
      return result.body;
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load publish version",
        details: getUnknownErrorDetails(error),
      };
    }
  });

  // ============================================================================
  // POST /api/page/publish-rollback - Roll back current cloud page to a version
  // ============================================================================
  fastify.post<{
    Body: {
      access_token: string;
      uid: string;
      version: number;
    };
  }>("/api/page/publish-rollback", {
    schema: {
      description: "Rollback published page on viben-web through proxyFetch",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          access_token: { type: "string", description: "Viben web access token" },
          uid: { type: "string", description: "Page uid" },
          version: { type: "number", description: "Published version number" },
        },
        required: ["access_token", "uid", "version"],
      },
      response: {
        200: { type: "object", additionalProperties: true },
        400: errorResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { access_token, uid, version } = request.body;

    if (!access_token.trim()) {
      reply.code(401);
      return { success: false, error: "access_token is required" };
    }

    if (!uid.trim() || !Number.isInteger(version) || version < 1) {
      reply.code(400);
      return { success: false, error: "uid and version are required" };
    }

    try {
      const result = await forwardPagePublishRequest(
        "/api/pages/publish-rollback",
        access_token,
        { uid, version }
      );
      reply.code(result.status);
      return result.body;
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to rollback published page",
        details: getUnknownErrorDetails(error),
      };
    }
  });

  // ============================================================================
  // POST /api/page/create - Create a new page
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      slug?: string;
      name?: string;
      description?: string;
      icon?: IconData;
      type: PageType;
      parent_uid?: string;
      template_id?: string;
      content?: string;
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
          slug: { type: "string", description: "Page slug (optional, used to generate uid)" },
          name: { type: "string", description: "Page name" },
          description: { type: "string", description: "Page description" },
          icon: { ...iconDataSchema, description: "Page icon data" },
          type: { ...pageTypeSchema, description: "Page type (required)" },
          parent_uid: { type: "string", description: "Parent page uid for creating subpages" },
          template_id: { type: "string", nullable: true, description: "Page template id" },
          content: { type: "string", nullable: true, description: "Initial markdown content" },
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
        required: ["workspace_path", "type"],
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
      icon,
      type,
      parent_uid,
      template_id,
      content,
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

    if (!type) {
      reply.code(400);
      return { success: false, error: "type is required" };
    }

    const result = await createPage({
      workspace_path,
      slug,
      name,
      description,
      icon,
      type,
      parent_uid,
      template_id,
      content,
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
    Body: { workspace_path: string; uid: string };
    Reply: DeletePageResult;
  }>("/api/page/delete", {
    schema: {
      description: "Delete a page",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Page uid (required)" },
        },
        required: ["workspace_path", "uid"],
      },
      response: {
        200: deletePageResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, uid } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    const result = await deletePage({ workspace_path, uid });

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/update-content - Update page markdown content
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; uid: string; content: string };
    Reply: UpdatePageContentResult;
  }>("/api/page/update-content", {
    schema: {
      description: "Update page markdown content (preserves YAML frontmatter)",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Page uid (required)" },
          content: { type: "string", description: "New markdown content (required)" },
        },
        required: ["workspace_path", "uid", "content"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            uid: { type: "string", nullable: true },
            error: { type: "string", nullable: true },
          },
        },
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, uid, content } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    if (content === undefined || content === null) {
      reply.code(400);
      return { success: false, error: "content is required" };
    }

    const result = await updatePageContent({ workspace_path, uid, content });

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
    Body: { workspace_path: string; uid: string; path?: string };
  }>("/api/page/serve", {
    schema: {
      description: "Serve page content",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Page uid (required)" },
          path: { type: "string", description: "File path within the page (optional)" },
        },
        required: ["workspace_path", "uid"],
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
    const { workspace_path, uid, path } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    const result = await servePage({ workspace_path, uid, path });

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
    Querystring: { workspace_path: string; uid: string; path?: string };
  }>("/api/page/serve", {
    schema: {
      description: "Serve page content",
      tags: ["page"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Page uid (required)" },
          path: { type: "string", description: "File path within the page (optional)" },
        },
        required: ["workspace_path", "uid"],
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
    const { workspace_path, uid, path } = request.query;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    const result = await servePage({ workspace_path, uid, path });

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
  // POST /api/page/update-config - Update page config (name, description, icon, cover, page_width, show_toc)
  // ============================================================================
  fastify.post<{
    Body: {
      workspace_path: string;
      uid: string;
      name?: string;
      description?: string | null;
      icon?: IconData | null;
      cover?: string | null;
      page_width?: PageWidth | null;
      show_toc?: boolean | null;
    };
    Reply: UpdatePageConfigResult;
  }>("/api/page/update-config", {
    schema: {
      description: "Update page config (name, description, icon, cover, page_width, show_toc)",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Page uid (required)" },
          name: { type: "string", description: "New page name" },
          description: { type: "string", nullable: true, description: "New page description (null to remove)" },
          icon: { ...iconDataSchema, description: "New page icon (null to remove)" },
          cover: { type: "string", nullable: true, description: "Cover image URL (null to remove)" },
          page_width: { type: "string", nullable: true, enum: ["default", "wide", "full"], description: "Page width (null to reset)" },
          show_toc: { type: "boolean", nullable: true, description: "Show table of contents sidebar (null to reset)" },
        },
        required: ["workspace_path", "uid"],
      },
      response: {
        200: viewPageResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, uid, name, description, icon, cover, page_width, show_toc } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    const result = await updatePageConfig({ workspace_path, uid, name, description, icon, cover, page_width, show_toc });

    if (!result.success) {
      reply.code(result.error?.includes("not found") ? 404 : 400);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/reorder - Reorder pages within a parent level
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; parent_uid: string | null; ordered_uids: string[] };
    Reply: ReorderPagesResult;
  }>("/api/page/reorder", {
    schema: {
      description: "Reorder pages within a parent level",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          parent_uid: { type: "string", nullable: true, description: "Parent page uid (null for root level)" },
          ordered_uids: {
            type: "array",
            items: { type: "string" },
            description: "Ordered list of page uids",
          },
        },
        required: ["workspace_path", "ordered_uids"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string", nullable: true },
          },
        },
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, parent_uid, ordered_uids } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!ordered_uids || !Array.isArray(ordered_uids)) {
      reply.code(400);
      return { success: false, error: "ordered_uids is required and must be an array" };
    }

    const result = await reorderPages({
      workspace_path,
      parent_uid: parent_uid ?? null,
      ordered_uids,
    });

    if (!result.success) {
      reply.code(400);
      return result;
    }

    return result;
  });

  // ============================================================================
  // POST /api/page/duplicate - Duplicate a page
  // ============================================================================
  fastify.post<{
    Body: { workspace_path: string; uid: string };
    Reply: DuplicatePageResult;
  }>("/api/page/duplicate", {
    schema: {
      description: "Duplicate a page (copy all files with a new uid)",
      tags: ["page"],
      body: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path (required)" },
          uid: { type: "string", description: "Source page uid to duplicate" },
        },
        required: ["workspace_path", "uid"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string", nullable: true },
            page: pageConfigSchema,
          },
        },
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workspace_path, uid } = request.body;

    if (!workspace_path) {
      reply.code(400);
      return { success: false, error: "workspace_path is required" };
    }

    if (!uid) {
      reply.code(400);
      return { success: false, error: "uid is required" };
    }

    const result = await duplicatePage({ workspace_path, uid });

    if (!result.success) {
      reply.code(400);
      return result;
    }

    return result;
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

  // ============================================================================
  // POST /api/page/asset/upload - Upload a file asset for a page
  // ============================================================================
  fastify.post("/api/page/asset/upload", async (request, reply) => {
    // Handle multipart form data
    const contentType = request.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      reply.code(400);
      return { success: false, error: "Expected multipart/form-data" };
    }

    // Type assertion for multipart-enabled request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multipartRequest = request as any;
    if (typeof multipartRequest.parts !== "function") {
      reply.code(400);
      return {
        success: false,
        error: "Multipart upload not configured. Please ensure @fastify/multipart is registered.",
      };
    }

    const parts = multipartRequest.parts();
    let fileData: Buffer | null = null;
    let filename = "unnamed";
    let wsPath = "";
    let uidStr = "";

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "file") {
        filename = part.filename || "unnamed";
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        fileData = Buffer.concat(chunks);
      } else if (part.type === "field" && part.fieldname === "workspace_path") {
        wsPath = part.value as string;
      } else if (part.type === "field" && part.fieldname === "uid") {
        uidStr = part.value as string;
      }
    }

    if (!fileData) {
      reply.code(400);
      return { success: false, error: "No file uploaded" };
    }

    if (!wsPath || !uidStr) {
      reply.code(400);
      return { success: false, error: "workspace_path and uid are required" };
    }

    const result = await uploadPageAsset({
      workspace_path: wsPath,
      uid: uidStr,
      filename,
      data: fileData,
    });

    if (!result.success) {
      reply.code(400);
      return result;
    }

    // Construct the serve URL
    const serveUrl = `/api/page/serve?workspace_path=${encodeURIComponent(wsPath)}&uid=${encodeURIComponent(uidStr)}&path=_assets/${encodeURIComponent(result.filename!)}`;

    return {
      success: true,
      url: serveUrl,
      filename: result.filename,
    };
  });

  // ============================================================================
  // GET /api/page/_sdk/v1/viben-page-sdk.js - Serve page SDK
  // ============================================================================
  fastify.get("/api/page/_sdk/v1/viben-page-sdk.js", {
    schema: {
      description: "Serve viben-page-sdk.js",
      tags: ["page"],
    },
  }, async (_request, reply) => {
    const content = readPageSdkAsset("viben-page-sdk.js");
    reply.type("application/javascript; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(content);
  });

  // ============================================================================
  // GET /api/page/_sdk/v1/viben-page-tokens.css - Serve page tokens CSS
  // ============================================================================
  fastify.get("/api/page/_sdk/v1/viben-page-tokens.css", {
    schema: {
      description: "Serve viben-page-tokens.css",
      tags: ["page"],
    },
  }, async (_request, reply) => {
    const content = readPageSdkAsset("viben-page-tokens.css");
    reply.type("text/css; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(content);
  });
}
