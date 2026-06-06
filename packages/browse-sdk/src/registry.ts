import type { PaperSource } from "./types";

export const SOURCE_TO_PROVIDER: Record<string, string> = {
  arxiv: "academic",
  pubmed: "academic",
  pmc: "academic",
  biorxiv: "academic",
  medrxiv: "academic",
  semantic: "academic",
  core: "academic",
  crossref: "academic",
  iacr: "academic",
  acm: "academic",
  sciencedirect: "publisher",
  springer: "publisher",
  ieee: "publisher",
  scopus: "publisher",
  wos: "institutional",
  jstor: "institutional",
  researchgate: "institutional",
  google_scholar: "web",
  context7: "docs",
};

export interface ParsedSourceName {
  provider: string;
  source: string;
}

export interface BrowseSourceRegistryOptions {
  sources?: Record<string, PaperSource>;
  enabledSources?: string[];
  disabledSources?: string[];
}

export function getHierarchicalName(flatName: string): string {
  if (flatName.includes("/")) {
    return flatName;
  }
  return `${SOURCE_TO_PROVIDER[flatName] ?? "other"}/${flatName}`;
}

export function parseHierarchicalName(name: string): ParsedSourceName {
  if (name.includes("/")) {
    const [provider, source] = name.split("/", 2);
    return { provider, source };
  }
  return { provider: SOURCE_TO_PROVIDER[name] ?? "other", source: name };
}

export function normalizeSourceName(name: string): string {
  return name.includes("/") ? name.split("/", 2)[1] : name;
}

export class BrowseSourceRegistry {
  private readonly allSourcesMap: Record<string, PaperSource>;
  private readonly enabledSourcesMap: Record<string, PaperSource>;

  constructor(options: BrowseSourceRegistryOptions = {}) {
    this.allSourcesMap = normalizeSourceMap(options.sources ?? {});
    this.enabledSourcesMap = this.applyFilters(options.enabledSources, options.disabledSources);
  }

  get allSources(): Record<string, PaperSource> {
    return { ...this.allSourcesMap };
  }

  get enabledSources(): Record<string, PaperSource> {
    return { ...this.enabledSourcesMap };
  }

  get availableSources(): string[] {
    return Object.keys(this.enabledSourcesMap).sort();
  }

  get hierarchicalSources(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const name of Object.keys(this.allSourcesMap).sort()) {
      result[getHierarchicalName(name)] = name;
    }
    return result;
  }

  get sourcesByProvider(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const name of Object.keys(this.enabledSourcesMap).sort()) {
      const provider = SOURCE_TO_PROVIDER[name] ?? "other";
      result[provider] = result[provider] ?? [];
      result[provider].push(name);
    }
    return result;
  }

  getSource(name: string): PaperSource | undefined {
    return this.enabledSourcesMap[normalizeSourceName(name)];
  }

  isEnabled(name: string): boolean {
    return normalizeSourceName(name) in this.enabledSourcesMap;
  }

  isLoaded(name: string): boolean {
    return normalizeSourceName(name) in this.allSourcesMap;
  }

  getProvider(name: string): string {
    return parseHierarchicalName(name).provider;
  }

  private applyFilters(enabledSources?: string[], disabledSources?: string[]): Record<string, PaperSource> {
    const enabled = new Set((enabledSources ?? []).map((source) => normalizeSourceName(source.toLowerCase())));
    const disabled = new Set((disabledSources ?? []).map((source) => normalizeSourceName(source.toLowerCase())));
    const result: Record<string, PaperSource> = {};

    for (const [name, source] of Object.entries(this.allSourcesMap)) {
      if (enabled.size > 0) {
        if (enabled.has(name)) {
          result[name] = source;
        }
        continue;
      }
      if (!disabled.has(name)) {
        result[name] = source;
      }
    }

    return result;
  }
}

function normalizeSourceMap(sources: Record<string, PaperSource>): Record<string, PaperSource> {
  const result: Record<string, PaperSource> = {};
  for (const [name, source] of Object.entries(sources)) {
    result[normalizeSourceName(name.toLowerCase())] = source;
  }
  return result;
}
