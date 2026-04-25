/**
 * Page tree building utilities.
 */

import type { PageConfig } from "@/hooks/use-pages";

// =============================================================================
// Types
// =============================================================================

export interface PageTreeNode {
  page: PageConfig;
  children: PageTreeNode[];
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Build a tree structure from flat page list.
 * Pages with slugs like "parent/child" are nested under "parent".
 */
export function buildPageTree(pages: PageConfig[]): PageTreeNode[] {
  const sortedPages = [...pages].sort((a, b) => a.slug.localeCompare(b.slug));

  const nodeMap = new Map<string, PageTreeNode>();
  const rootNodes: PageTreeNode[] = [];

  // First pass: create all nodes
  for (const page of sortedPages) {
    nodeMap.set(page.slug, { page, children: [] });
  }

  // Second pass: build tree structure
  for (const page of sortedPages) {
    const node = nodeMap.get(page.slug)!;
    const parts = page.slug.split("/");

    if (parts.length === 1) {
      rootNodes.push(node);
    } else {
      const parentSlug = parts.slice(0, -1).join("/");
      const parentNode = nodeMap.get(parentSlug);

      if (parentNode) {
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
}
