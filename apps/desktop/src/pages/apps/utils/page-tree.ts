/**
 * Page tree building utilities.
 */

import type { PageConfig, PageIndex } from "@/lib/gateway/types/page";

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
 * Build a tree structure from flat page list using index.
 *
 * @param pages - Flat list of page configs
 * @param index - Page index (adjacency list format)
 */
export function buildPageTree(pages: PageConfig[], index: PageIndex): PageTreeNode[] {
  const pageMap = new Map(pages.map((p) => [p.uid, p]));
  const usedUids = new Set<string>();

  function buildNodes(uids: string[]): PageTreeNode[] {
    return uids
      .map((uid) => {
        const page = pageMap.get(uid);
        if (!page) return null;
        usedUids.add(uid);
        return {
          page,
          children: buildNodes(index[uid] ?? []),
        };
      })
      .filter((n): n is PageTreeNode => n !== null);
  }

  const tree = buildNodes(index.root ?? []);

  // Fallback: append pages not in index to root
  for (const page of pages) {
    if (!usedUids.has(page.uid)) {
      tree.push({ page, children: [] });
    }
  }

  return tree;
}
