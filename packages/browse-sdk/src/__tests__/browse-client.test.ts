import { describe, expect, it } from "vitest";
import {
  BrowseClient,
  BrowseSourceRegistry,
  Paper,
  type PaperSource,
  type SearchOptions,
} from "../index";

class RecordingSource implements PaperSource {
  readonly searches: Array<{ query: string; options: SearchOptions }> = [];

  constructor(private readonly source: string) {}

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    this.searches.push({ query, options });
    return [
      new Paper({
        paper_id: `${this.source}-1`,
        title: `${this.source} title`,
        authors: ["Author"],
        abstract: "Abstract",
        doi: "",
        published_date: "2024-01-01",
        pdf_url: "",
        url: `https://example.test/${this.source}`,
        source: this.source,
      }),
    ];
  }

  async downloadPdf(contentId: string, savePath: string): Promise<string> {
    return `${savePath}/${this.source}-${contentId}.pdf`;
  }

  async download(contentId: string, savePath: string): Promise<string> {
    return this.downloadPdf(contentId, savePath);
  }

  async readPaper(contentId: string): Promise<string> {
    return `read:${this.source}:${contentId}`;
  }

  async read(contentId: string): Promise<string> {
    return this.readPaper(contentId);
  }
}

describe("BrowseClient", () => {
  it("expands empty searcher to all enabled sources and returns joined paper text", async () => {
    const arxiv = new RecordingSource("arxiv");
    const crossref = new RecordingSource("crossref");
    const client = new BrowseClient({
      registry: new BrowseSourceRegistry({
        sources: { arxiv, crossref },
      }),
      savePath: "/tmp/browse-sdk-test",
    });

    const text = await client.browseSearch([{ query: "agents", max_results: 2 }]);

    expect(arxiv.searches).toEqual([{ query: "agents", options: { max_results: 2 } }]);
    expect(crossref.searches).toEqual([{ query: "agents", options: { max_results: 2 } }]);
    expect(text).toContain("Source: 'arxiv'");
    expect(text).toContain("Source: 'crossref'");
  });

  it("passes searcher-specific options and supports download/read", async () => {
    const semantic = new RecordingSource("semantic");
    const client = new BrowseClient({
      registry: new BrowseSourceRegistry({
        sources: { semantic },
      }),
      savePath: "/tmp/downloads",
    });

    await client.browseSearch([
      {
        searcher: "semantic",
        query: "cryptography",
        max_results: 4,
        year: "2020-2024",
      },
    ]);
    expect(semantic.searches[0]).toEqual({
      query: "cryptography",
      options: { max_results: 4, year: "2020-2024" },
    });

    await expect(client.browseDownload([{ searcher: "semantic", content_id: "paper-1" }])).resolves.toEqual([
      "/tmp/downloads/semantic-paper-1.pdf",
    ]);
    await expect(client.browseRead({ searcher: "semantic", content_id: "paper-1", page: 2 })).resolves.toBe(
      "read:semantic:paper-1"
    );
  });

  it("reports validation-style errors instead of throwing from browse tools", async () => {
    const client = new BrowseClient({
      registry: new BrowseSourceRegistry({ sources: {} }),
    });

    await expect(client.browseSearch([{ searcher: "missing", query: "agents" }])).resolves.toContain(
      "Error searching content"
    );
    await expect(client.browseDownload([{ searcher: "missing", content_id: "x" }])).resolves.toEqual([
      "Searcher 'missing' not found.",
    ]);
    await expect(client.browseRead({ searcher: "missing", content_id: "x" })).resolves.toContain(
      "Error: Searcher 'missing' is not available"
    );
  });
});
