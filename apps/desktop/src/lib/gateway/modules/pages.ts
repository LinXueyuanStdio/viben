/**
 * Pages Module
 * 页面模块 API
 *
 * Gateway API client for page management operations.
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  CreatePageParams,
  ListTemplatesResult,
} from "../types/page";

// Re-export types for convenience
export type {
  PageConfig,
  PageType,
  PagePermission,
  StaticPageConfig,
  MarkdownPageConfig,
  ServerPageConfig,
  ProxyPageConfig,
  PageResult,
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  CreatePageParams,
  PageTemplate,
  ListTemplatesResult,
} from "../types/page";

// =============================================================================
// Page CRUD Operations
// =============================================================================

/**
 * List all pages in a workspace
 */
export async function listPages(
  baseUrl: string,
  workspacePath: string
): Promise<ListPagesResult> {
  const response = await fetch(`${baseUrl}/api/page/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list pages: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * View a specific page by slug
 */
export async function viewPage(
  baseUrl: string,
  workspacePath: string,
  slug: string
): Promise<ViewPageResult> {
  const response = await fetch(`${baseUrl}/api/page/view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath, slug }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to view page: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a new page
 */
export async function createPage(
  baseUrl: string,
  params: CreatePageParams
): Promise<CreatePageResult> {
  const response = await fetch(`${baseUrl}/api/page/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create page: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete a page by slug
 */
export async function deletePage(
  baseUrl: string,
  workspacePath: string,
  slug: string
): Promise<DeletePageResult> {
  const response = await fetch(`${baseUrl}/api/page/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath, slug }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete page: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// =============================================================================
// Page Serve URL Helper
// =============================================================================

/**
 * Get the URL for serving a page's content
 * This is a helper to construct the serve endpoint URL
 */
export function getPageServeUrl(
  baseUrl: string,
  workspacePath: string,
  slug: string,
  path?: string
): string {
  const params = new URLSearchParams({
    workspace_path: workspacePath,
    slug,
  });
  if (path) {
    params.set("path", path);
  }
  return `${baseUrl}/api/page/serve?${params.toString()}`;
}

// =============================================================================
// Templates API
// =============================================================================

/**
 * List available page templates
 */
export async function listTemplates(
  baseUrl: string,
  workspacePath?: string
): Promise<ListTemplatesResult> {
  const response = await fetch(`${baseUrl}/api/page/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list templates: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
