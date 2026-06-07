import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { PaperSource } from "./types";

export interface BrowsePluginManifest {
  name: string;
  sources: BrowsePluginSourceManifest[];
}

export interface BrowsePluginSourceManifest {
  name: string;
  module: string;
  export?: string;
}

type BrowsePluginModule = Record<string, unknown>;

const MANIFEST_NAME = "browse-plugin.json";

export function loadBrowsePluginSources(pluginDirs = getBrowsePluginDirs()): Record<string, PaperSource> {
  const sources: Record<string, PaperSource> = {};
  for (const pluginsDir of pluginDirs) {
    for (const pluginDir of listPluginDirectories(pluginsDir)) {
      const manifestPath = join(pluginDir, MANIFEST_NAME);
      if (!existsSync(manifestPath)) {
        continue;
      }
      const manifest = parseManifest(manifestPath);
      if (!manifest) {
        continue;
      }
      for (const sourceManifest of manifest.sources) {
        const source = loadPluginSource(pluginDir, sourceManifest);
        if (source) {
          sources[sourceManifest.name] = source;
        }
      }
    }
  }
  return sources;
}

export function getBrowsePluginDirs(): string[] {
  const configured = process.env.BROWSE_MCP_PLUGIN_DIRS?.trim();
  if (configured) {
    return configured.split(delimiter()).map((item) => item.trim()).filter(Boolean).map((item) => resolve(item));
  }
  const repoPlugins = findAncestorPluginsDir(process.cwd());
  return repoPlugins ? [repoPlugins] : [];
}

function listPluginDirectories(pluginsDir: string): string[] {
  if (!existsSync(pluginsDir)) {
    return [];
  }
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(pluginsDir, entry.name));
}

function parseManifest(manifestPath: string): BrowsePluginManifest | undefined {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as Partial<BrowsePluginManifest>;
    if (typeof parsed.name !== "string" || !Array.isArray(parsed.sources)) {
      return undefined;
    }
    const sources = parsed.sources.filter(isSourceManifest);
    return { name: parsed.name, sources };
  } catch {
    return undefined;
  }
}

function isSourceManifest(value: unknown): value is BrowsePluginSourceManifest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<BrowsePluginSourceManifest>;
  return typeof candidate.name === "string" && typeof candidate.module === "string";
}

function loadPluginSource(pluginDir: string, sourceManifest: BrowsePluginSourceManifest): PaperSource | undefined {
  const modulePath = isAbsolute(sourceManifest.module)
    ? sourceManifest.module
    : join(pluginDir, sourceManifest.module);
  try {
    const requireFromPlugin = createRequire(join(pluginDir, "package.json"));
    const loaded = requireFromPlugin(modulePath) as BrowsePluginModule;
    const exportName = sourceManifest.export ?? "source";
    const candidate = loaded[exportName] ?? loaded.default ?? loaded;
    return isPaperSource(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function isPaperSource(value: unknown): value is PaperSource {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Record<keyof PaperSource, unknown>>;
  return typeof candidate.search === "function" &&
    typeof candidate.downloadPdf === "function" &&
    typeof candidate.readPaper === "function";
}

function findAncestorPluginsDir(startDir: string): string | undefined {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, "plugins");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function delimiter(): string {
  return process.platform === "win32" ? ";" : ":";
}
