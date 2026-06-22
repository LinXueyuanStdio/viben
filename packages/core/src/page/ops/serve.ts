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

  if (contentType === "text/html") {
    const html = content.toString("utf-8");
    const injected = injectConfigListener(html);
    return {
      success: true,
      content: Buffer.from(injected, "utf-8"),
      content_type: contentType,
    };
  }

  return {
    success: true,
    content,
    content_type: contentType,
  };
}

const CONFIG_LISTENER_SCRIPT = `<script>window.addEventListener("message",function(e){if(e.data&&e.data.type==="viben-config"){window.__VIBEN_CONFIG__=e.data.payload}});</script>`;

function injectConfigListener(html: string): string {
  const headClose = html.indexOf("</head>");
  if (headClose !== -1) {
    return html.slice(0, headClose) + CONFIG_LISTENER_SCRIPT + html.slice(headClose);
  }
  const htmlOpen = html.indexOf("<html");
  if (htmlOpen !== -1) {
    const tagEnd = html.indexOf(">", htmlOpen);
    if (tagEnd !== -1) {
      return html.slice(0, tagEnd + 1) + CONFIG_LISTENER_SCRIPT + html.slice(tagEnd + 1);
    }
  }
  return CONFIG_LISTENER_SCRIPT + html;
}

function serveMarkdownContent(
  page: PageConfig & { type: "markdown" }
): ServePageResult {
  if (page.skill_content === undefined || page.skill_content === null) {
    return {
      success: false,
      error: "Markdown page content is unavailable",
    };
  }

  return {
    success: true,
    content: Buffer.from(page.skill_content, "utf-8"),
    content_type: "text/markdown; charset=utf-8",
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
