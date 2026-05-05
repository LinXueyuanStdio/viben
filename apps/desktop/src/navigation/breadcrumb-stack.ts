import {
  type DesktopLocation,
  locationToUrl,
  buildViewTarget,
  type BreadcrumbStackItem,
  getDescriptorIcon,
} from "./navigation-meta";

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

// ─── Item Factories ──────────────────────────────────────────────────────────

export function createBreadcrumbItem(
  item: Omit<BreadcrumbStackItem, "target"> & {
    descriptorId?: string;
    location?: DesktopLocation;
  }
): BreadcrumbStackItem {
  return {
    ...item,
    icon: item.icon ?? getDescriptorIcon(item.descriptorId),
    target: item.location
      ? buildViewTarget(item.location, locationToUrl(item.location))
      : undefined,
  };
}

export function createLocationBreadcrumbItem(
  location: DesktopLocation,
  item: Partial<Omit<BreadcrumbStackItem, "target">> & {
    descriptorId?: string;
  }
): BreadcrumbStackItem {
  return createBreadcrumbItem({
    id: item?.id ?? locationToUrl(location),
    label: item?.label ?? locationToUrl(location),
    icon: item?.icon,
    meta: item?.meta,
    parentNodeId: item?.parentNodeId,
    sourceNodeId: item?.sourceNodeId,
    descriptorId: item?.descriptorId,
    location,
  });
}
