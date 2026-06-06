import { BrowseClient, BrowseSourceRegistry, Paper, type PaperSource, type SearchOptions } from "@viben/browse-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import {
  BROWSE_DOWNLOAD_TOOL_NAME,
  BROWSE_MCP_SERVER_NAME,
  BROWSE_READ_TOOL_NAME,
  BROWSE_SEARCH_TOOL_NAME,
  createBrowseMcpServer,
} from "../mcp-server";

type RegisteredTool = {
  description?: string;
  inputSchema?: unknown;
  handler: (args: unknown) => Promise<CallToolResult>;
};

type InspectableMcpServer = ReturnType<typeof createBrowseMcpServer> & {
  _registeredTools?: Record<string, RegisteredTool>;
  server: {
    _serverInfo?: { name?: string };
  };
};

class FakeSource implements PaperSource {
  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    return [
      new Paper({
        paper_id: `${query}:${options.max_results ?? 10}`,
        title: "Result",
        authors: [],
        abstract: "",
        doi: "",
        published_date: "2024-01-01",
        pdf_url: "",
        url: "",
        source: "arxiv",
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
    return `read:${contentId}`;
  }

  async read(contentId: string): Promise<string> {
    return this.readPaper(contentId);
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
    }) as InspectableMcpServer;

    expect(server.server._serverInfo?.name).toBe(BROWSE_MCP_SERVER_NAME);
    expect(getTool(server, BROWSE_SEARCH_TOOL_NAME).description).toContain("Search content");
    expect(getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).description).toContain("Download content");
    expect(getTool(server, BROWSE_READ_TOOL_NAME).description).toContain("Read and extract");
  });

  it("forwards search, download, and read requests through BrowseClient", async () => {
    const server = createBrowseMcpServer({
      client: fakeClient(),
    }) as InspectableMcpServer;

    const search = await getTool(server, BROWSE_SEARCH_TOOL_NAME).handler({
      query_list: [{ searcher: "arxiv", query: "agents", max_results: 2 }],
    });
    expect(search.content[0]).toMatchObject({ type: "text" });
    expect(search.content[0]?.type === "text" ? search.content[0].text : "").toContain("Paper ID: 'agents:2'");

    const download = await getTool(server, BROWSE_DOWNLOAD_TOOL_NAME).handler({
      query_list: [{ searcher: "arxiv", content_id: "2106.12345" }],
    });
    expect(download.content[0]?.type === "text" ? download.content[0].text : "").toContain("/tmp/downloads/2106.12345.pdf");

    const read = await getTool(server, BROWSE_READ_TOOL_NAME).handler({
      searcher: "arxiv",
      content_id: "2106.12345",
      page: 1,
    });
    expect(read.content[0]?.type === "text" ? read.content[0].text : "").toBe("read:2106.12345");
  });
});

function fakeClient(): BrowseClient {
  return new BrowseClient({
    registry: new BrowseSourceRegistry({
      sources: {
        arxiv: new FakeSource(),
      },
    }),
    savePath: "/tmp/downloads",
  });
}
