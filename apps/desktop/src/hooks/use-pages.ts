/**
 * React Query hooks for workspace pages API
 *
 * Endpoints used:
 * - POST /api/page/list      - List pages in workspace
 * - POST /api/page/view      - Get page by uid
 * - POST /api/page/create    - Create a new page
 * - POST /api/page/delete    - Delete a page
 * - POST /api/page/templates - List available page templates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGatewayUrl,
  listPages as listPagesApi,
  viewPage as viewPageApi,
  createPage as createPageApi,
  deletePage as deletePageApi,
  duplicatePage as duplicatePageApi,
  updatePageConfig as updatePageConfigApi,
  reorderPages as reorderPagesApi,
  listTemplates as listTemplatesApi,
  applyPageTemplate as applyPageTemplateApi,
} from "@/lib/gateway";
import type {
  ApplyPageTemplateParams,
  CreatePageParams,
  DuplicatePageParams,
  ReorderPagesParams,
  UpdatePageConfigParams,
} from "@/lib/gateway";

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
  PageTemplate,
  ApplyPageTemplateParams,
  CreatePageParams,
  UpdatePageConfigParams,
} from "@/lib/gateway";

// =============================================================================
// Query Keys
// =============================================================================

export const pageKeys = {
  all: ["pages"] as const,
  list: (workspacePath: string) => [...pageKeys.all, "list", workspacePath] as const,
  detail: (workspacePath: string, uid: string) =>
    [...pageKeys.all, "detail", workspacePath, uid] as const,
};

export const templateKeys = {
  all: ["page-templates"] as const,
  list: (workspacePath?: string) => [...templateKeys.all, "list", workspacePath ?? ""] as const,
};

// =============================================================================
// Page Hooks
// =============================================================================

/**
 * Hook for fetching pages in a workspace
 * Returns full result with pages and index
 *
 * @param workspacePath - The workspace path
 * @returns Query result with { pages, index, count }
 */
export function usePages(workspacePath: string | undefined) {
  return useQuery({
    queryKey: pageKeys.list(workspacePath ?? ""),
    queryFn: () => listPagesApi(getGatewayUrl(), workspacePath!),
    enabled: !!workspacePath,
  });
}

/**
 * Hook for fetching a single page by uid
 *
 * @param workspacePath - The workspace path
 * @param uid - The page uid
 * @returns Query result with page config
 */
export function usePage(workspacePath: string | undefined, uid: string | undefined) {
  return useQuery({
    queryKey: pageKeys.detail(workspacePath ?? "", uid ?? ""),
    queryFn: () => viewPageApi(getGatewayUrl(), workspacePath!, uid!),
    enabled: !!workspacePath && !!uid,
    select: (data) => data.page,
  });
}

/**
 * Hook for creating a new page
 *
 * @returns Mutation for creating a page
 */
export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreatePageParams) => createPageApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspace_path),
      });
    },
  });
}

/**
 * Hook for deleting a page
 *
 * @returns Mutation for deleting a page
 */
export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspacePath, uid }: { workspacePath: string; uid: string }) =>
      deletePageApi(getGatewayUrl(), workspacePath, uid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspacePath),
      });
    },
  });
}

/**
 * Hook for duplicating a page
 *
 * @returns Mutation for duplicating a page
 */
export function useDuplicatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: DuplicatePageParams) =>
      duplicatePageApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspace_path),
      });
    },
  });
}

/**
 * Hook for updating page config (name, description, icon)
 *
 * @returns Mutation for updating a page config
 */
export function useUpdatePageConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpdatePageConfigParams) =>
      updatePageConfigApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspace_path),
      });
      queryClient.invalidateQueries({
        queryKey: pageKeys.detail(variables.workspace_path, variables.uid),
      });
    },
  });
}

/**
 * Hook for reordering pages within a parent level
 *
 * @returns Mutation for reordering pages
 */
export function useReorderPages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ReorderPagesParams) =>
      reorderPagesApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspace_path),
      });
    },
  });
}

// =============================================================================
// Template Hooks
// =============================================================================

/**
 * Hook for fetching available page templates
 *
 * @param workspacePath - Optional workspace path for custom templates
 * @returns Query result with templates array
 */
export function usePageTemplates(workspacePath: string | undefined) {
  return useQuery({
    queryKey: templateKeys.list(workspacePath),
    queryFn: () => listTemplatesApi(getGatewayUrl(), workspacePath),
    select: (data) => data.templates,
  });
}

/**
 * Hook for applying a template to an existing empty markdown page.
 */
export function useApplyPageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ApplyPageTemplateParams) =>
      applyPageTemplateApi(getGatewayUrl(), params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(variables.workspace_path),
      });
      queryClient.invalidateQueries({
        queryKey: pageKeys.detail(variables.workspace_path, variables.uid),
      });
    },
  });
}
