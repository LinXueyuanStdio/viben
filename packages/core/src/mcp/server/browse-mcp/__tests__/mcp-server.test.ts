import { BrowseClient, BrowseSourceRegistry, Paper, type PaperSource, type SearchOptions } from "@viben/browse-sdk";
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import {
  BROWSE_DOWNLOAD_TOOL_NAME,
  BROWSE_MCP_SERVER_NAME,
  BROWSE_READ_TOOL_NAME,
  BROWSE_SEARCH_TOOL_NAME,
  createBrowseMcpServer,
} from "../mcp-server";
import {
  browseDownloadQuerySchema,
  browseSearchQuerySchema,
} from "../types";

type RegisteredTool = {
  description?: string;
  inputSchema?: unknown;
  handler: (args: unknown) => Promise<CallToolResult>;
};

type InspectableMcpServer = {
  _registeredTools?: Record<string, RegisteredTool>;
  server: {
    _serverInfo?: { name?: string };
  };
};

class RecordingSource implements PaperSource {
  readonly searches: Array<{ query: string; options: SearchOptions }> = [];
  readonly downloads: Array<{ contentId: string; savePath: string }> = [];
  readonly reads: Array<{ contentId: string; savePath: string; options?: { page?: number; start_page?: number; end_page?: number } }> = [];

  constructor(private readonly source: string, private readonly searchResults = 1) {}

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    this.searches.push({ query, options });
    return Array.from({ length: this.searchResults }, (_, index) => new Paper({
      paper_id: `${this.source}:${query}:${index + 1}`,
      title: `${this.source} result ${index + 1}`,
      authors: [],
      abstract: "",
      doi: "",
      published_date: "2024-01-01",
      pdf_url: "",
      url: "",
      source: this.source,
    }));
  }

  async downloadPdf(contentId: string, savePath: string): Promise<string> {
    this.downloads.push({ contentId, savePath });
    return `${savePath}/${this.source}-${contentId}.pdf`;
  }

  async download(contentId: string, savePath: string): Promise<string> {
    return this.downloadPdf(contentId, savePath);
  }

  async readPaper(contentId: string, savePath: string, options?: { page?: number; start_page?: number; end_page?: number }): Promise<string> {
    this.reads.push({ contentId, savePath, options });
    return `read:${this.source}:${contentId}`;
  }

  async read(contentId: string, savePath: string, options?: { page?: number; start_page?: number; end_page?: number }): Promise<string> {
    return this.readPaper(contentId, savePath, options);
  }
}

class ThrowingDownloadSource extends RecordingSource {
  override async downloadPdf(contentId: string): Promise<string> {
    throw new Error(`download failed for ${contentId}`);
  }
}

function getTool(server: InspectableMcpServer, toolName: string): RegisteredTool {
  const tool = server._registeredTools?.[toolName];
  if (!tool) {
    throw new Error(`Tool was not registered: ${toolName}`);
  }
  return tool;
}

describe("browse MCP server", () => {
  it("registers browse_mcp tools", () => {
    const server = createBrowseMcpServer({
      client: fakeClient(),
    }) as unknown as InspectableMcpServer;

    expect(server.server._serverInfo?.name).toBe(BROWSE_MCP_SERVER_NAME);
    expect(getTool(server, BROWSE_SEARCH_TOOL_NAME).description).toContain("Search content");
    expect(getTool(server, BROWSE_SEARCH_TOOL_NAME).description).toContain("## Example:");
    expect(getTool(server, BROWSE_SEARCH_TOOL_NAME).description).toContain(`{"query": "deep learning", "max_results": 2}`);
    expect(getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).description).toContain("Download content");
    expect(getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).description).toContain("## Content ID formats:");
    expect(getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).description).toContain("Google Scholar: Direct PDF download is not supported");
    expect(getTool(server, BROWSE_READ_TOOL_NAME).description).toContain("Read and extract");
    expect(getTool(server, BROWSE_READ_TOOL_NAME).description).toContain("## Pagination behavior:");
    expect(getTool(server, BROWSE_READ_TOOL_NAME).description).toContain("page=3: Return only page 3");
  });

  it("forwards search, download, and read requests through BrowseClient", async () => {
    const server = createBrowseMcpServer({
      client: fakeClient(),
    }) as unknown as InspectableMcpServer;

    const search = await getTool(server, BROWSE_SEARCH_TOOL_NAME).handler({
      query_list: [{ searcher: "arxiv", query: "agents", max_results: 2 }],
    });
    expect(CallToolResultSchema.safeParse(search).success).toBe(true);
    expect(search.content[0]).toMatchObject({ type: "text" });
    expect(search.content[0]?.type === "text" ? search.content[0].text : "").toContain("Paper ID: 'arxiv:agents:1'");
    expect(search.structuredContent).toEqual({
      content: "Source: 'arxiv'\nPaper ID: 'arxiv:agents:1'\nTitle: arxiv result 1\nPublished Date: 2024-01-01",
      count: 1,
      queries: [{ searcher: "arxiv", query: "agents", max_results: 2 }],
    });

    const download = await getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).handler({
      query_list: [{ searcher: "arxiv", content_id: "2106.12345" }],
    });
    expect(CallToolResultSchema.safeParse(download).success).toBe(true);
    expect(download.content[0]?.type === "text" ? download.content[0].text : "").toBe("Downloaded 1 content item.");
    expect(download.structuredContent).toEqual({
      paths: ["/tmp/downloads/arxiv-2106.12345.pdf"],
      count: 1,
      queries: [{ searcher: "arxiv", content_id: "2106.12345" }],
    });

    const read = await getTool(server, BROWSE_READ_TOOL_NAME).handler({
      searcher: "arxiv",
      content_id: "2106.12345",
      page: 1,
    });
    expect(CallToolResultSchema.safeParse(read).success).toBe(true);
    expect(read.content[0]?.type === "text" ? read.content[0].text : "").toBe("read:arxiv:2106.12345");
    expect(read.structuredContent).toEqual({
      text: "read:arxiv:2106.12345",
      length: 21,
      query: {
        searcher: "arxiv",
        content_id: "2106.12345",
        page: 1,
      },
    });
  });

  it("expands search requests without a searcher across all enabled sources", async () => {
    const arxiv = new RecordingSource("arxiv");
    const crossref = new RecordingSource("crossref");
    const server = createBrowseMcpServer({
      client: fakeClient({ arxiv, crossref }),
    }) as unknown as InspectableMcpServer;

    const search = await getTool(server, BROWSE_SEARCH_TOOL_NAME).handler({
      query_list: [{ query: "deep learning", max_results: 2 }],
    });

    expect(arxiv.searches).toEqual([{ query: "deep learning", options: { max_results: 2 } }]);
    expect(crossref.searches).toEqual([{ query: "deep learning", options: { max_results: 2 } }]);
    expect(search.structuredContent).toMatchObject({
      count: 2,
      queries: [{ query: "deep learning", max_results: 2 }],
    });
    expect(search.content[0]?.type === "text" ? search.content[0].text : "").toContain("Source: 'arxiv'");
    expect(search.content[0]?.type === "text" ? search.content[0].text : "").toContain("Source: 'crossref'");
  });

  it("passes backend source-specific search options through to the selected sources", async () => {
    const iacr = new RecordingSource("iacr");
    const semantic = new RecordingSource("semantic");
    const crossref = new RecordingSource("crossref");
    const server = createBrowseMcpServer({
      client: fakeClient({ iacr, semantic, crossref }),
    }) as unknown as InspectableMcpServer;

    await getTool(server, BROWSE_SEARCH_TOOL_NAME).handler({
      query_list: [
        { searcher: "iacr", query: "cryptography", max_results: 3, fetch_details: false },
        { searcher: "semantic", query: "climate", max_results: 4, year: "2015-2020" },
        { searcher: "crossref", query: "deep learning", max_results: 2, kwargs: { filter: "from-pub-date:2020" } },
      ],
    });

    expect(iacr.searches).toEqual([{ query: "cryptography", options: { max_results: 3, fetch_details: false } }]);
    expect(semantic.searches).toEqual([{ query: "climate", options: { max_results: 4, year: "2015-2020" } }]);
    expect(crossref.searches).toEqual([
      {
        query: "deep learning",
        options: {
          max_results: 2,
          filter: "from-pub-date:2020",
          kwargs: { filter: "from-pub-date:2020" },
        },
      },
    ]);
  });

  it("supports the deprecated paper_id alias for downloads", async () => {
    const arxiv = new RecordingSource("arxiv");
    const server = createBrowseMcpServer({
      client: fakeClient({ arxiv }),
    }) as unknown as InspectableMcpServer;

    const download = await getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).handler({
      query_list: [{ searcher: "arxiv", paper_id: "2106.12345" }],
    });

    expect(arxiv.downloads).toEqual([{ contentId: "2106.12345", savePath: "/tmp/downloads" }]);
    expect(download.structuredContent).toEqual({
      paths: ["/tmp/downloads/arxiv-2106.12345.pdf"],
      count: 1,
      queries: [{ searcher: "arxiv", paper_id: "2106.12345" }],
    });
  });

  it("passes read pagination parameters through to the source", async () => {
    const arxiv = new RecordingSource("arxiv");
    const server = createBrowseMcpServer({
      client: fakeClient({ arxiv }),
    }) as unknown as InspectableMcpServer;

    const read = await getTool(server, BROWSE_READ_TOOL_NAME).handler({
      searcher: "arxiv",
      content_id: "2106.12345",
      start_page: 1,
      end_page: 5,
    });

    expect(arxiv.reads).toEqual([{
      contentId: "2106.12345",
      savePath: "/tmp/downloads",
      options: { page: undefined, start_page: 1, end_page: 5 },
    }]);
    expect(read.structuredContent).toMatchObject({
      text: "read:arxiv:2106.12345",
      query: {
        searcher: "arxiv",
        content_id: "2106.12345",
        start_page: 1,
        end_page: 5,
      },
    });
  });

  it("returns MCP error results for backend validation-style failures", async () => {
    const server = createBrowseMcpServer({
      client: fakeClient({ arxiv: new ThrowingDownloadSource("arxiv") }),
    }) as unknown as InspectableMcpServer;

    const search = await getTool(server, BROWSE_SEARCH_TOOL_NAME).handler({
      query_list: [{ searcher: "missing", query: "agents" }],
    });
    expect(search.isError).toBe(true);
    expect(search.structuredContent).toMatchObject({ count: 0 });
    expect(search.content[0]?.type === "text" ? search.content[0].text : "").toContain("Error searching content");

    const download = await getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).handler({
      query_list: [{ searcher: "arxiv", content_id: "2106.12345" }],
    });
    expect(download.isError).toBe(true);
    expect(download.structuredContent).toMatchObject({
      paths: ["Error downloading content 2106.12345 from arxiv: download failed for 2106.12345"],
      count: 1,
    });

    const read = await getTool(server, BROWSE_READ_TOOL_NAME).handler({
      searcher: "missing",
      content_id: "2106.12345",
    });
    expect(read.isError).toBe(true);
    expect(read.structuredContent).toMatchObject({ length: 68 });
    expect(read.content[0]?.type === "text" ? read.content[0].text : "").toContain("Searcher 'missing' is not available");
  });

  it("matches backend query model validation for whitespace and source-specific parameters", () => {
    expect(browseSearchQuerySchema.parse({ query: "  machine learning  " })).toMatchObject({
      query: "machine learning",
      max_results: 10,
    });
    expect(browseDownloadQuerySchema.parse({ searcher: "arxiv", content_id: " 2106.12345 " })).toMatchObject({
      content_id: "2106.12345",
    });
    expect(() => browseSearchQuerySchema.parse({ searcher: "arxiv", query: "   " })).toThrow();
    expect(() => browseDownloadQuerySchema.parse({ searcher: "arxiv", content_id: "   " })).toThrow();
    expect(() => browseSearchQuerySchema.parse({ searcher: "arxiv", query: "agents", year: "2020" })).toThrow();
    expect(() => browseSearchQuerySchema.parse({ searcher: "semantic", query: "agents", kwargs: { filter: "x" } })).toThrow();
    expect(() => browseSearchQuerySchema.parse({ searcher: "arxiv", query: "agents", fetch_details: false })).toThrow();
  });
});

function fakeClient(sources: Record<string, PaperSource> = { arxiv: new RecordingSource("arxiv") }): BrowseClient {
  return new BrowseClient({
    registry: new BrowseSourceRegistry({
      sources,
    }),
    savePath: "/tmp/downloads",
  });
}
