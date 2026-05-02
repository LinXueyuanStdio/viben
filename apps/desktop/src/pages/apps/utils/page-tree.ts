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

/** Page order data keyed by parent ("root" for top-level, or parent slug) */
export interface PageOrderMap {
  [parentKey: string]: string[];
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Sort nodes using custom order when available, falling back to alphabetical.
 */
function sortNodes(nodes: PageTreeNode[], order: string[] | undefined): PageTreeNode[] {
  if (!order || order.length === 0) {
    return nodes.sort((a, b) => a.page.slug.localeCompare(b.page.slug));
  }

  const indexMap = new Map<string, number>();
  for (let i = 0; i < order.length; i++) {
    indexMap.set(order[i], i);
  }

  return nodes.sort((a, b) => {
    // Extract the last segment of the slug for matching within this level
    const aKey = a.page.slug;
    const bKey = b.page.slug;
    const aIdx = indexMap.get(aKey);
    const bIdx = indexMap.get(bKey);

    // Both have custom order
    if (aIdx !== undefined && bIdx !== undefined) {
      return aIdx - bIdx;
    }
    // Only a has custom order - it goes first
    if (aIdx !== undefined) return -1;
    // Only b has custom order - it goes first
    if (bIdx !== undefined) return 1;
    // Neither has custom order - alphabetical
    return aKey.localeCompare(bKey);
  });
}

/**
 * Build a tree structure from flat page list.
 * Pages with slugs like "parent/child" are nested under "parent".
 *
 * @param pages - Flat list of page configs
 * @param orderMap - Optional custom ordering map from .page-order.json
 */
export function buildPageTree(pages: PageConfig[], orderMap?: PageOrderMap): PageTreeNode[] {
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

  // Third pass: apply custom ordering
  if (orderMap) {
    // Sort root nodes
    sortNodes(rootNodes, orderMap["root"]);

    // Sort children of each parent
    for (const [, node] of nodeMap) {
      if (node.children.length > 0) {
        sortNodes(node.children, orderMap[node.page.slug]);
      }
    }
  }

  return rootNodes;
}
