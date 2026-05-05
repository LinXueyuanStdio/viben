import type { IconData } from "@/components/ui/icon-picker";
import type {
  DesktopLocation,
  BreadcrumbStackItem,
} from "./navigation-meta";
import {
  createBreadcrumbItem,
  createLocationBreadcrumbItem,
} from "./breadcrumb-stack";

export interface BreadcrumbNodeDescriptor {
  id?: string;
  descriptorId?: string;
  label: string;
  icon?: IconData;
  meta?: BreadcrumbStackItem["meta"];
  sourceNodeId?: string;
  parentNodeId?: string;
  location?: DesktopLocation;
}

export interface ResolvedNavigationState<TValue> {
  value: TValue;
  breadcrumbStack: BreadcrumbStackItem[];
}

export function createBreadcrumbNode(
  descriptor: BreadcrumbNodeDescriptor
): BreadcrumbStackItem {
  if (descriptor.location) {
    return createLocationBreadcrumbItem(descriptor.location, {
      ...descriptor,
      descriptorId: descriptor.descriptorId,
    });
  }

  return createBreadcrumbItem({
    id: descriptor.id ?? descriptor.label,
    label: descriptor.label,
    icon: descriptor.icon,
    meta: descriptor.meta,
    sourceNodeId: descriptor.sourceNodeId,
    parentNodeId: descriptor.parentNodeId,
    descriptorId: descriptor.descriptorId,
  });
}

export function buildBreadcrumbStack(
  descriptors: BreadcrumbNodeDescriptor[]
): BreadcrumbStackItem[] {
  return descriptors.map(createBreadcrumbNode);
}

export function resolveNavigationState<TValue>(
  value: TValue,
  descriptors: BreadcrumbNodeDescriptor[]
): ResolvedNavigationState<TValue> {
  return {
    value,
    breadcrumbStack: buildBreadcrumbStack(descriptors),
  };
}
