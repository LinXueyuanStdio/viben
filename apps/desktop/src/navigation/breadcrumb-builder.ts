// apps/desktop/src/navigation/breadcrumb-builder.ts
import { registry, humanize } from "./route-registry";
import type { RouteEntry, RouteMatch } from "./route-compiler";
import type { IconData } from "@/components/ui/icon-picker";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NavigateHeaders {
  label?: string;
  icon?: IconData;
  id?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  meta?: BreadcrumbMeta;
}

export interface BreadcrumbMeta {
  workspaceId?: string;
  section?: string;
  pageSlug?: string;
  agentId?: string;
  executorType?: string;
  webId?: string;
  url?: string;
  blockId?: string;
}

export interface BreadcrumbStackItem {
  id: string;
  label: string;
  icon?: IconData;
  pattern?: string;
  href?: string;
  sourceNodeId?: string;
  parentNodeId?: string;
  meta?: BreadcrumbMeta;
}

// ─── Cold Start Builder ─────────────────────────────────────────────────────

export function buildColdStartBreadcrumb(url: string, headers?: NavigateHeaders): BreadcrumbStackItem[] {
  const match = registry.match(url);
  if (!match) return [];

  const chain: BreadcrumbStackItem[] = [];

  // 1. Path prefix ancestors
  for (const ancestorPattern of deriveAncestorsFromPrefix(match.pattern)) {
    const ancestorEntry = registry.getEntry(ancestorPattern)!;
    const ancestorParams = pickMatchingParams(ancestorPattern, match.params);
    chain.push(buildBreadcrumbItem(ancestorEntry, ancestorParams));
  }

  // 2. Rest param intermediate levels
  const restParam = registry.getRestParam(match.pattern);
  if (restParam && match.params[restParam]?.includes("/")) {
    const segments = match.params[restParam].split("/");
    for (let i = 1; i < segments.length; i++) {
      const prefix = segments.slice(0, i).join("/");
      const lastSegment = segments[i - 1];
      chain.push(buildBreadcrumbItem(
        match.entry,
        { ...match.params, [restParam]: prefix },
        { label: humanize(lastSegment) },
      ));
    }
  }

  // 3. Current node (headers can override label/icon)
  chain.push(buildBreadcrumbItem(match.entry, match.params, headers));

  return chain;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function deriveAncestorsFromPrefix(pattern: string): string[] {
  const segments = pattern.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let i = segments.length - 1; i > 0; i--) {
    const candidate = "/" + segments.slice(0, i).join("/");
    if (registry.hasEntry(candidate)) {
      ancestors.unshift(candidate);
    }
  }
  return ancestors;
}

export function pickMatchingParams(
  targetPattern: string,
  allParams: Record<string, string>,
): Record<string, string> {
  const paramNames = registry.getParamNames(targetPattern);
  const result: Record<string, string> = {};
  for (const name of paramNames) {
    if (allParams[name] !== undefined) {
      result[name] = allParams[name];
    }
  }
  return result;
}

export function buildBreadcrumbItem(
  entry: RouteEntry,
  params: Record<string, string>,
  headers?: NavigateHeaders,
): BreadcrumbStackItem {
  const href = registry.build(entry.pattern, params);
  const icon = headers?.icon ?? (typeof entry.icon === "function" ? entry.icon(params) : entry.icon);
  const title = typeof entry.title === "function" ? entry.title(params) : entry.title;

  return {
    id: headers?.id ?? href,
    label: headers?.label ?? title,
    icon,
    pattern: entry.pattern,
    href,
    sourceNodeId: headers?.sourceNodeId,
    parentNodeId: headers?.parentNodeId,
    meta: headers?.meta,
  };
}
