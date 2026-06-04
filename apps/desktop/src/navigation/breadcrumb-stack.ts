import type { BreadcrumbStackItem } from "./breadcrumb-builder";
import { getDescriptorIcon } from "./route-registry";

// ─── Atomic Stack Operations ─────────────────────────────────────────────────

export function getStackTop(
  stack: BreadcrumbStackItem[]
): BreadcrumbStackItem | undefined {
  return stack[stack.length - 1];
}

export function pushStackItem(
  stack: BreadcrumbStackItem[],
  item: BreadcrumbStackItem
): BreadcrumbStackItem[] {
  return [...stack, item];
}

export function replaceStackTop(
  stack: BreadcrumbStackItem[],
  item: BreadcrumbStackItem
): BreadcrumbStackItem[] {
  if (stack.length === 0) {
    return [item];
  }

  return [...stack.slice(0, -1), item];
}

export function popTo(
  stack: BreadcrumbStackItem[],
  index: number
): BreadcrumbStackItem[] {
  if (stack.length === 0) {
    return stack;
  }

  const normalizedIndex = Math.max(0, Math.min(index, stack.length - 1));
  return stack.slice(0, normalizedIndex + 1);
}

// ─── Item Factory ────────────────────────────────────────────────────────────

export function createBreadcrumbItem(
  item: BreadcrumbStackItem
): BreadcrumbStackItem {
  return {
    ...item,
    icon: item.icon ?? getDescriptorIcon(item.descriptorId),
  };
}
