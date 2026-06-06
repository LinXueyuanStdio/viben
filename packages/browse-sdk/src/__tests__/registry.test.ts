import { describe, expect, it } from "vitest";
import {
  BrowseSourceRegistry,
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
