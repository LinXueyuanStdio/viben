// packages/core/src/page/ops/serve.ts

/**
 * Page serving - serve page content
 *
 * Supports:
 * - static: serve files from page directory
 * - markdown: return SKILL.md content as markdown
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { getPageByUid } from "./discovery";
import { isStaticPage, isMarkdownPage } from "./types";
import type { ServePageResult, PageConfig } from "./types";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".md": "text/markdown",
};

export interface ServeOptions {
  workspace_path: string;
  uid: string;
  path?: string;
}

export async function servePage(options: ServeOptions): Promise<ServePageResult> {
  const { workspace_path, uid } = options;

  const page = await getPageByUid(workspace_path, uid);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  if (isStaticPage(page)) {
    return serveStaticFile(page, options.path);
  }

  if (isMarkdownPage(page)) {
    return serveMarkdownContent(page);
  }

  return {
    success: false,
    error: `Page type "${page.type}" requires server management, use server API instead`,
  };
}

function serveStaticFile(
  page: PageConfig & { type: "static"; file: string },
  requestedPath?: string
): ServePageResult {
  const relativePath = requestedPath || page.file;

  // SECURITY FIX: Resolve path and check within page directory
  const resolvedPath = resolve(page.path, relativePath);
  const pagePathWithSep = page.path.endsWith(sep) ? page.path : page.path + sep;

  if (!resolvedPath.startsWith(pagePathWithSep) && resolvedPath !== page.path) {
    return {
      success: false,
      error: "Invalid path: path traversal detected",
    };
  }

  if (!existsSync(resolvedPath)) {
    return {
      success: false,
      error: `File not found: ${relativePath}`,
    };
  }

  const stat = statSync(resolvedPath);
  if (!stat.isFile()) {
    return {
      success: false,
      error: `Not a file: ${relativePath}`,
    };
  }

  const content = readFileSync(resolvedPath);
  const ext = extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return {
    success: true,
    content,
    content_type: contentType,
  };
}

function serveMarkdownContent(
  page: PageConfig & { type: "markdown" }
): ServePageResult {
  if (!page.skill_content) {
    return {
      success: false,
      error: "Markdown page has no content",
    };
  }

  return {
    success: true,
    content: Buffer.from(page.skill_content, "utf-8"),
    content_type: "text/markdown",
  };
}

/**
 * @deprecated Use servePage instead
 */
export async function serveStaticFileCompat(
  options: ServeOptions
): Promise<ServePageResult> {
  return servePage(options);
}
