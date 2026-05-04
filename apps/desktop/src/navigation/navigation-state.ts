import type { IconData } from "@/components/ui/icon-picker";
import type { DesktopLocation } from "./location";
import type {
  BreadcrumbItemKind,
  BreadcrumbStackItem,
} from "./view-target";
import {
  createBreadcrumbItem,
  createLocationBreadcrumbItem,
} from "./breadcrumb-stack";

export interface BreadcrumbNodeDescriptor {
  id?: string;
  kind?: BreadcrumbItemKind;
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
    if (!descriptor.kind) {
      throw new Error("Breadcrumb node with location requires explicit kind");
    }

    return createLocationBreadcrumbItem(descriptor.location, {
      ...descriptor,
      kind: descriptor.kind,
    });
  }

  return createBreadcrumbItem({
    id: descriptor.id ?? descriptor.label,
    kind: descriptor.kind ?? "virtual-folder",
    label: descriptor.label,
    icon: descriptor.icon,
    meta: descriptor.meta,
    sourceNodeId: descriptor.sourceNodeId,
    parentNodeId: descriptor.parentNodeId,
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
