import type { IconData } from "@/components/ui/icon-picker";
import type { BreadcrumbStackItem, BreadcrumbMeta } from "./breadcrumb-builder";
import { createBreadcrumbItem } from "./breadcrumb-stack";

export interface BreadcrumbNodeDescriptor {
  id?: string;
  descriptorId?: string;
  label: string;
  href: string;
  icon?: IconData;
  meta?: BreadcrumbMeta;
  sourceNodeId?: string;
  parentNodeId?: string;
}

export interface ResolvedNavigationState<TValue> {
  value: TValue;
  breadcrumbStack: BreadcrumbStackItem[];
}

export function createBreadcrumbNode(
  descriptor: BreadcrumbNodeDescriptor
): BreadcrumbStackItem {
  return createBreadcrumbItem({
    id: descriptor.id ?? descriptor.href,
    label: descriptor.label,
    href: descriptor.href,
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
