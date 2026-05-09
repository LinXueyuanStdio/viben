/**
 * Route Compiler — Core Engine
 *
 * Pure functions for compiling URL patterns, matching URLs against a registry,
 * and building URLs from patterns + params.
 *
 * Pattern syntax:
 *   /workspace/:workspaceId        — named param (matches one segment)
 *   /workspace/:workspaceId/pages/:pageSlug+  — rest param (matches 1+ segments)
 */

import type { IconData } from "@/components/ui/icon-picker";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompiledPattern {
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  restParam: string | null;
  build: (params: Record<string, string>) => string;
  constantSegmentCount: number;
}

export interface RouteEntry<TParams extends Record<string, string> = Record<string, string>> {
  pattern: string;
  icon: IconData | ((params: TParams) => IconData);
  title: string | ((params: TParams) => string);
  titleKey?: string;
  isContainer?: boolean;
  queryParams?: string[];
  dropdownCategory?: string;
}

export interface RouteMatch {
  pattern: string;
  params: Record<string, string>;
  icon: IconData;
  title: string;
  entry: RouteEntry;
}

export interface CompiledRoute extends CompiledPattern {
  entry: RouteEntry;
  queryParams: string[];
}

// ─── Core: compilePattern ────────────────────────────────────────────────────

export function compilePattern(pattern: string): CompiledPattern {
  const paramNames: string[] = [];
  let restParam: string | null = null;
  let constantSegmentCount = 0;

  const segments = pattern.split("/").filter(Boolean);
  const regexParts: string[] = [];
  const buildParts: Array<
    | { type: "const"; value: string }
    | { type: "param"; name: string; rest: boolean }
  > = [];

  for (const segment of segments) {
    if (segment.startsWith(":")) {
      const isRest = segment.endsWith("+");
      const name = isRest ? segment.slice(1, -1) : segment.slice(1);
      paramNames.push(name);
      if (isRest) {
        restParam = name;
        regexParts.push("(.+)");
      } else {
        regexParts.push("([^/]+)");
      }
      buildParts.push({ type: "param", name, rest: isRest });
    } else {
      constantSegmentCount++;
      regexParts.push(escapeRegex(segment));
      buildParts.push({ type: "const", value: segment });
    }
  }

  const regex = new RegExp("^\\/" + regexParts.join("\\/") + "$");

  const build = (params: Record<string, string>): string => {
    const parts = buildParts.map((part) => {
      if (part.type === "const") return part.value;
      const value = params[part.name];
      if (!value) {
        throw new Error(`Param "${part.name}" must be non-empty for pattern: ${pattern}`);
      }
      return part.rest ? value : encodeURIComponent(value);
    });
    return "/" + parts.join("/");
  };

  return { pattern, regex, paramNames, restParam, build, constantSegmentCount };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export function compileRegistry(entries: RouteEntry[]): CompiledRoute[] {
  const compiled = entries.map((entry) => ({
    ...compilePattern(entry.pattern),
    entry,
    queryParams: entry.queryParams ?? [],
  }));

  // Sort: more constant segments first, then non-rest before rest
  compiled.sort((a, b) => {
    if (b.constantSegmentCount !== a.constantSegmentCount) {
      return b.constantSegmentCount - a.constantSegmentCount;
    }
    return (a.restParam ? 1 : 0) - (b.restParam ? 1 : 0);
  });

  return compiled;
}

// ─── matchUrl ────────────────────────────────────────────────────────────────

export function matchUrl(url: string, entries: RouteEntry[]): RouteMatch | null {
  const compiled = compileRegistry(entries);
  return matchUrlCompiled(url, compiled);
}

export function matchUrlCompiled(url: string, compiled: CompiledRoute[]): RouteMatch | null {
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;

  for (const route of compiled) {
    const pathMatch = route.regex.exec(pathname);
    if (!pathMatch) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      const raw = pathMatch[i + 1];
      params[name] =
        name === route.restParam
          ? raw.split("/").map(decodeURIComponent).join("/")
          : decodeURIComponent(raw);
    });

    // Extract declared query params
    for (const qp of route.queryParams) {
      const value = parsed.searchParams.get(qp);
      if (value) params[qp] = value;
    }

    return {
      pattern: route.pattern,
      params,
      icon: resolveIcon(route.entry, params),
      title: resolveTitle(route.entry, params),
      entry: route.entry,
    };
  }
  return null;
}

// ─── buildUrl ────────────────────────────────────────────────────────────────

export function buildUrl(
  pattern: string,
  params: Record<string, string>,
  entries: RouteEntry[],
): string {
  const compiled = compileRegistry(entries);
  return buildUrlCompiled(pattern, params, compiled);
}

export function buildUrlCompiled(
  pattern: string,
  params: Record<string, string>,
  compiled: CompiledRoute[],
): string {
  const route = compiled.find((r) => r.pattern === pattern);
  if (!route) throw new Error(`Unknown pattern: ${pattern}`);

  let path = route.build(params);

  const queryEntries = route.queryParams
    .filter((qp) => params[qp])
    .map((qp) => [qp, params[qp]] as [string, string]);

  if (queryEntries.length > 0) {
    path += "?" + new URLSearchParams(queryEntries).toString();
  }

  return path;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveIcon(entry: RouteEntry, params: Record<string, string>): IconData {
  return typeof entry.icon === "function" ? entry.icon(params) : entry.icon;
}

function resolveTitle(entry: RouteEntry, params: Record<string, string>): string {
  return typeof entry.title === "function" ? entry.title(params) : entry.title;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
