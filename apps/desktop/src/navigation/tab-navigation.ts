// apps/desktop/src/navigation/tab-navigation.ts
import type { BreadcrumbStackItem } from "./breadcrumb-builder";
import type { TabNavigationState } from "@/stores/tab-store";

/**
 * Create a new TabNavigationState from a URL and breadcrumb stack.
 */
export function createTabNavigationState(
  url: string,
  breadcrumbStack: BreadcrumbStackItem[],
  patch?: Partial<TabNavigationState>,
): TabNavigationState {
  return { url, breadcrumbStack, ...patch };
}
