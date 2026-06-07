import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  BrowseSourceRegistry,
  createDefaultSources,
  loadBrowsePluginSources,
  Paper,
  getHierarchicalName,
  normalizeSourceName,
  parseHierarchicalName,
  type PaperSource,
} from "../index";

class FakeSource implements PaperSource {
  constructor(private readonly source: string) {}

  async search(query: string, options?: { max_results?: number }): Promise<Paper[]> {
    return [
      new Paper({
        paper_id: `${this.source}:${query}`,
        title: `${this.source} result`,
        authors: [],
        abstract: "",
        doi: "",
        published_date: new Date("2024-01-01T00:00:00.000Z"),
        pdf_url: "",
        url: "",
        source: this.source,
        categories: [],
        keywords: [],
        citations: options?.max_results ?? 0,
      }),
    ];
  }

  async downloadPdf(contentId: string, savePath: string): Promise<string> {
    return `${savePath}/${contentId}.pdf`;
  }

  async download(contentId: string, savePath: string): Promise<string> {
    return this.downloadPdf(contentId, savePath);
  }

  async readPaper(contentId: string): Promise<string> {
    return `${this.source}:${contentId}`;
  }

  async read(contentId: string): Promise<string> {
    return this.readPaper(contentId);
  }
}

const envKeys = ["BROWSE_MCP_PLUGIN_DIRS"] as const;
const originalEnv = new Map<string, string | undefined>();

for (const key of envKeys) {
  originalEnv.set(key, process.env[key]);
}

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("source naming", () => {
  it("maps flat source names to provider/source hierarchy", () => {
    expect(getHierarchicalName("arxiv")).toBe("academic/arxiv");
    expect(getHierarchicalName("publisher/custom")).toBe("publisher/custom");
    expect(parseHierarchicalName("semantic")).toEqual({ provider: "academic", source: "semantic" });
    expect(parseHierarchicalName("docs/context7")).toEqual({ provider: "docs", source: "context7" });
    expect(normalizeSourceName("academic/arxiv")).toBe("arxiv");
  });
});

describe("BrowseSourceRegistry", () => {
  it("filters enabled and disabled sources and supports hierarchical lookup", () => {
    const registry = new BrowseSourceRegistry({
      sources: {
        arxiv: new FakeSource("arxiv"),
        crossref: new FakeSource("crossref"),
        scopus: new FakeSource("scopus"),
      },
      enabledSources: ["academic/arxiv", "crossref"],
      disabledSources: ["scopus"],
    });

    expect(registry.availableSources).toEqual(["arxiv", "crossref"]);
    expect(registry.getSource("academic/arxiv")).toBeInstanceOf(FakeSource);
    expect(registry.isEnabled("publisher/scopus")).toBe(false);
    expect(registry.sourcesByProvider).toEqual({ academic: ["arxiv", "crossref"] });
    expect(registry.hierarchicalSources).toEqual({
      "academic/arxiv": "arxiv",
      "academic/crossref": "crossref",
      "publisher/scopus": "scopus",
    });
  });
});

describe("browse source plugins", () => {
  it("loads local browse plugin sources from plugin manifests", async () => {
    const pluginsDir = await mkdtemp(join(tmpdir(), "browse-plugin-test-"));
    const pluginDir = join(pluginsDir, "browse-plugin-test-source");
    await mkdir(pluginDir, { recursive: true });
    await writeFile(join(pluginDir, "browse-plugin.json"), JSON.stringify({
      name: "browse-plugin-test-source",
      sources: [
        {
          name: "test_search",
          module: "./source.cjs",
        },
      ],
    }, null, 2));
    await writeFile(join(pluginDir, "source.cjs"), `
      class TestSource {
        async search(query) {
          return [{
            paper_id: "test:" + query,
            title: "Plugin " + query,
            source: "test_search"
          }];
        }
        async downloadPdf(contentId, savePath) {
          return savePath + "/" + contentId + ".txt";
        }
        async download(contentId, savePath) {
          return this.downloadPdf(contentId, savePath);
        }
        async readPaper(contentId) {
          return "plugin:" + contentId;
        }
        async read(contentId) {
          return this.readPaper(contentId);
        }
      }
      module.exports = { source: new TestSource() };
    `);

    const sources = loadBrowsePluginSources([pluginsDir]);

    expect(Object.keys(sources)).toEqual(["test_search"]);
    await expect(sources.test_search.search("agents")).resolves.toMatchObject([
      {
        paper_id: "test:agents",
        title: "Plugin agents",
        source: "test_search",
      },
    ]);
  });

  it("merges plugin sources into the default source set", async () => {
    const pluginsDir = await mkdtemp(join(tmpdir(), "browse-plugin-default-test-"));
    const pluginDir = join(pluginsDir, "browse-plugin-default-source");
    await mkdir(pluginDir, { recursive: true });
    await writeFile(join(pluginDir, "browse-plugin.json"), JSON.stringify({
      name: "browse-plugin-default-source",
      sources: [
        {
          name: "default_test_search",
          module: "./source.cjs",
        },
      ],
    }, null, 2));
    await writeFile(join(pluginDir, "source.cjs"), `
      module.exports = {
        source: {
          async search() { return []; },
          async downloadPdf(contentId, savePath) { return savePath + "/" + contentId; },
          async download(contentId, savePath) { return savePath + "/" + contentId; },
          async readPaper(contentId) { return contentId; },
          async read(contentId) { return contentId; }
        }
      };
    `);
    process.env.BROWSE_MCP_PLUGIN_DIRS = pluginsDir;

    const sources = createDefaultSources();

    expect(sources.default_test_search).toBeDefined();
    expect(sources.arxiv).toBeDefined();
  });
});
