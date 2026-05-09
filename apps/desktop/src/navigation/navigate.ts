// apps/desktop/src/navigation/navigate.ts
import { registry } from "./route-registry";
import { buildColdStartBreadcrumb, deriveAncestorsFromPrefix, buildBreadcrumbItem, type NavigateHeaders, type BreadcrumbStackItem } from "./breadcrumb-builder";
import type { RouteMatch } from "./route-compiler";

export type NavigateMethod = "push" | "replace" | "reset";

/**
 * Build the leaf BreadcrumbStackItem for a given URL.
 * Used by the navigate function and can be used standalone.
 */
export function buildNavigateLeaf(url: string, headers?: NavigateHeaders): BreadcrumbStackItem {
  const match = registry.match(url);
  const fallbackLabel = url.split("/").filter(Boolean).pop() ?? url;

  return {
    id: headers?.id ?? url,
    label: headers?.label ?? match?.title ?? fallbackLabel,
    icon: headers?.icon ?? match?.icon,
    pattern: match?.pattern,
    href: url,
    sourceNodeId: headers?.sourceNodeId,
    parentNodeId: headers?.parentNodeId,
    meta: headers?.meta,
  };
}

/**
 * Unified navigate function — the primary API for all navigation.
 *
 * Called from use-desktop-routing hooks. Dispatches to the appropriate
 * tab store action based on method.
 *
 * @param method - "push" appends leaf to stack, "replace" replaces top, "reset" rebuilds from cold-start
 * @param url - The target URL (built via registry.build)
 * @param headers - Optional overrides for the breadcrumb leaf (label, icon, meta, etc.)
 * @param tabStore - Tab store actions (injected by hook to avoid module-level coupling)
 */
export function navigate(
  method: NavigateMethod,
  url: string,
  headers: NavigateHeaders | undefined,
  tabStore: {
    activeTabId: string;
    pushNavigation: (tabId: string, url: string, leaf: BreadcrumbStackItem) => void;
    replaceNavigation: (tabId: string, url: string, leaf: BreadcrumbStackItem) => void;
    resetNavigation: (tabId: string, url: string, stack: BreadcrumbStackItem[]) => void;
  },
): void {
  const { activeTabId } = tabStore;
  const leaf = buildNavigateLeaf(url, headers);

  switch (method) {
    case "push":
      tabStore.pushNavigation(activeTabId, url, leaf);
      break;
    case "replace":
      tabStore.replaceNavigation(activeTabId, url, leaf);
      break;
    case "reset": {
      const stack = buildColdStartBreadcrumb(url, headers);
      tabStore.resetNavigation(activeTabId, url, stack);
      break;
    }
  }
}

/**
 * Breadcrumb click handler — pops to the Nth breadcrumb item.
 * Deduplicates: if a matching entry already exists in backward history, jumps there.
 * Otherwise inserts before current position.
 */
export function popToBreadcrumb(
  index: number,
  tabStore: {
    activeTabId: string;
    getCurrentState: (tabId: string) => { breadcrumbStack: BreadcrumbStackItem[]; url: string } | null;
    findHistoryEntryByUrl: (tabId: string, url: string) => number;
    jumpToHistory: (tabId: string, historyIndex: number) => void;
    insertHistoryBeforeCurrent: (tabId: string, state: { url: string; breadcrumbStack: BreadcrumbStackItem[] }) => void;
  },
): void {
  const { activeTabId } = tabStore;
  const current = tabStore.getCurrentState(activeTabId);
  if (!current) return;

  const targetItem = current.breadcrumbStack[index];
  if (!targetItem?.href) return;

  // Dedup: check if backward history already has this URL
  const existingIndex = tabStore.findHistoryEntryByUrl(activeTabId, targetItem.href);
  if (existingIndex >= 0) {
    tabStore.jumpToHistory(activeTabId, existingIndex);
    return;
  }

  // No match → insert new state before current (preserves forward history)
  tabStore.insertHistoryBeforeCurrent(activeTabId, {
    url: targetItem.href,
    breadcrumbStack: current.breadcrumbStack.slice(0, index + 1),
  });
}

/**
 * Check whether the current breadcrumb stack is a valid prefix of the target match.
 * Used by Tab-Router Bridge for smart push vs cold-start reset decision.
 */
export function isStackPrefixOf(stack: BreadcrumbStackItem[], match: RouteMatch): boolean {
  if (stack.length === 0) return false;
  const topPattern = stack[stack.length - 1]?.pattern;
  if (!topPattern) return false;
  const ancestors = deriveAncestorsFromPrefix(match.pattern);
  return ancestors.includes(topPattern);
}

// Re-exports for convenience
export { buildColdStartBreadcrumb, buildBreadcrumbItem, deriveAncestorsFromPrefix, type NavigateHeaders, type BreadcrumbStackItem } from "./breadcrumb-builder";
export { registry } from "./route-registry";
