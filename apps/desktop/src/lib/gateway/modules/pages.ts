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
  UpdatePageConfigParams,
  UpdatePageConfigResult,
  ReorderPagesParams,
  ReorderPagesResult,
  DuplicatePageParams,
  DuplicatePageResult,
  ListTemplatesResult,
} from "../types/page";

// Re-export types for convenience
export type {
  PageConfig,
  PageType,
  PagePermission,
  PageIndex,
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
  UpdatePageConfigParams,
  UpdatePageConfigResult,
  ReorderPagesParams,
  ReorderPagesResult,
  DuplicatePageParams,
  DuplicatePageResult,
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
 * View a specific page by uid
 */
export async function viewPage(
  baseUrl: string,
  workspacePath: string,
  uid: string
): Promise<ViewPageResult> {
  const response = await fetch(`${baseUrl}/api/page/view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath, uid }),
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
 * Delete a page by uid
 */
export async function deletePage(
  baseUrl: string,
  workspacePath: string,
  uid: string
): Promise<DeletePageResult> {
  const response = await fetch(`${baseUrl}/api/page/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath, uid }),
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
// Update Page Content
// =============================================================================

export interface UpdatePageContentResult {
  success: boolean;
  uid?: string;
  error?: string;
}

/**
 * Update page markdown content (preserves YAML frontmatter)
 */
export async function updatePageContent(
  baseUrl: string,
  workspacePath: string,
  uid: string,
  content: string
): Promise<UpdatePageContentResult> {
  const response = await fetch(`${baseUrl}/api/page/update-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ workspace_path: workspacePath, uid, content }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update page content: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// =============================================================================
// Update Page Config
// =============================================================================

/**
 * Update page config (name, description, icon)
 */
export async function updatePageConfig(
  baseUrl: string,
  params: UpdatePageConfigParams
): Promise<UpdatePageConfigResult> {
  const response = await fetch(`${baseUrl}/api/page/update-config`, {
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
      `Failed to update page config: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// =============================================================================
// Reorder Pages
// =============================================================================

/**
 * Reorder pages within a parent level
 */
export async function reorderPages(
  baseUrl: string,
  params: ReorderPagesParams
): Promise<ReorderPagesResult> {
  const response = await fetch(`${baseUrl}/api/page/reorder`, {
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
      `Failed to reorder pages: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// =============================================================================
// Duplicate Page
// =============================================================================

/**
 * Duplicate a page (copy all files with a new uid)
 */
export async function duplicatePage(
  baseUrl: string,
  params: DuplicatePageParams
): Promise<DuplicatePageResult> {
  const response = await fetch(`${baseUrl}/api/page/duplicate`, {
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
      `Failed to duplicate page: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// =============================================================================
// Upload Page Asset
// =============================================================================

/**
 * Upload a file asset for a page
 */
export async function uploadPageAsset(
  baseUrl: string,
  workspacePath: string,
  uid: string,
  file: File
): Promise<{ success: boolean; url?: string; filename?: string; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("workspace_path", workspacePath);
  formData.append("uid", uid);

  const response = await fetch(`${baseUrl}/api/page/asset/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to upload page asset: ${errorMessage}`,
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
  uid: string,
  path?: string
): string {
  const params = new URLSearchParams({
    workspace_path: workspacePath,
    uid,
  });
  if (path) {
    params.set("path", path);
  }
  return `${baseUrl}/api/page/serve?${params.toString()}`;
}

/**
 * Resolve a path inside a page's served content to an absolute URL.
 * Useful for nested markdown assets and page-scoped external previews.
 */
export function resolvePageServeUrl(
  baseUrl: string,
  workspacePath: string,
  uid: string,
  input: string
): string {
  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  if (input.startsWith("/")) {
    return `${baseUrl}${input}`;
  }

  return getPageServeUrl(baseUrl, workspacePath, uid, input);
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
