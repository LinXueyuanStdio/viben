import { BrowseSourceRegistry } from "./registry";
import { Paper, paperToText, type PaperSource, type ReadOptions, type SearchOptions } from "./types";
import { createDefaultSources } from "./providers";

export interface BrowseClientOptions {
  registry?: BrowseSourceRegistry;
  sources?: Record<string, PaperSource>;
  enabledSources?: string[];
  disabledSources?: string[];
  savePath?: string;
}

export interface BrowseSearchQuery {
  searcher?: string | null;
  query: string;
  max_results?: number;
  fetch_details?: boolean;
  year?: string;
  kwargs?: Record<string, unknown>;
}

export interface BrowseDownloadQuery {
  searcher: string;
  content_id?: string;
  paper_id?: string;
}

export interface BrowseReadQuery extends ReadOptions {
  searcher: string;
  content_id: string;
}

export class BrowseClient {
  readonly registry: BrowseSourceRegistry;
  readonly savePath: string;

  constructor(options: BrowseClientOptions = {}) {
    this.registry = options.registry ?? new BrowseSourceRegistry({
      sources: options.sources ?? createDefaultSources(),
      enabledSources: options.enabledSources ?? envList("BROWSE_MCP_ENABLED_SOURCES"),
      disabledSources: options.disabledSources ?? envList("BROWSE_MCP_DISABLED_SOURCES"),
    });
    this.savePath = options.savePath ?? process.env.BROWSE_MCP_DOWNLOAD_PATH ?? "./downloads";
  }

  getAvailableSources(): string[] {
    return this.registry.availableSources;
  }

  expandQueries(queries: BrowseSearchQuery[]): Required<Pick<BrowseSearchQuery, "searcher" | "query">>[] & BrowseSearchQuery[] {
    const expanded: BrowseSearchQuery[] = [];
    for (const query of queries) {
      if (query.searcher) {
        expanded.push(query);
        continue;
      }
      for (const source of this.registry.availableSources) {
        expanded.push({ ...query, searcher: source });
      }
    }
    return expanded as Required<Pick<BrowseSearchQuery, "searcher" | "query">>[] & BrowseSearchQuery[];
  }

  async searchPerQuery(query: BrowseSearchQuery): Promise<Paper[]> {
    if (!query.searcher) {
      return [];
    }
    const source = this.registry.getSource(query.searcher);
    if (!source) {
      const available = this.registry.availableSources.join(", ");
      throw new Error(`Searcher '${query.searcher}' is not available. Available sources: ${available}`);
    }
    const options: SearchOptions = {
      max_results: query.max_results ?? 10,
    };
    if (query.fetch_details !== undefined) {
      options.fetch_details = query.fetch_details;
    }
    if (query.year !== undefined) {
      options.year = query.year;
    }
    if (query.kwargs) {
      Object.assign(options, query.kwargs);
      options.kwargs = query.kwargs;
    }
    return await source.search(query.query, options);
  }

  async browseSearch(queries: BrowseSearchQuery[]): Promise<string> {
    try {
      const expanded = this.expandQueries(queries);
      const results = await Promise.all(expanded.map((query) => this.searchPerQuery(query)));
      const papers = results.flat();
      const texts = papers.map((paper) => typeof (paper as Paper).toText === "function" ? (paper as Paper).toText() : paperToText(paper));
      return texts.length > 0 ? texts.join("\n\n") : "No content found.";
    } catch (error) {
      return `Error searching content: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async browseDownload(queries: BrowseDownloadQuery[]): Promise<string[]> {
    return await Promise.all(queries.map((query) => this.downloadPerQuery(query)));
  }

  async downloadPerQuery(query: BrowseDownloadQuery): Promise<string> {
    const source = this.registry.getSource(query.searcher);
    if (!source) {
      return `Searcher '${query.searcher}' not found.`;
    }
    const contentId = (query.content_id ?? query.paper_id ?? "").trim();
    if (!contentId) {
      return "Error downloading content: content_id cannot be empty or whitespace only";
    }
    try {
      return await source.downloadPdf(contentId, this.savePath);
    } catch (error) {
      return `Error downloading content ${contentId} from ${query.searcher}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async browseRead(query: BrowseReadQuery): Promise<string> {
    const available = this.registry.availableSources.join(", ");
    if (!this.registry.isEnabled(query.searcher)) {
      return `Error: Searcher '${query.searcher}' is not available. Available sources: ${available}`;
    }
    const contentId = query.content_id.trim();
    if (!contentId) {
      return "Error: content_id cannot be empty or whitespace only";
    }
    const source = this.registry.getSource(query.searcher);
    if (!source) {
      return `Searcher '${query.searcher}' not found or not supported.`;
    }
    try {
      return await source.readPaper(contentId, this.savePath, {
        page: query.page,
        start_page: query.start_page,
        end_page: query.end_page,
      });
    } catch (error) {
      return `Error reading content: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

function envList(name: string): string[] | undefined {
  const value = process.env[name]?.trim();
  if (!value) {
    return undefined;
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
