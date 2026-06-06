#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowseClient, type BrowseClientOptions } from "@viben/browse-sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  browseDownloadQuerySchema,
  browseReadQuerySchema,
  browseSearchQuerySchema,
  type BrowseDownloadQueryInput,
  type BrowseReadQueryInput,
  type BrowseSearchQueryInput,
} from "./types";

export const BROWSE_MCP_SERVER_NAME = "browse_mcp";
export const BROWSE_SEARCH_TOOL_NAME = "browse_search";
export const BROWSE_DOWNLOAD_TOOL_NAME = "browse_download";
export const BROWSE_READ_TOOL_NAME = "browse_read";

export interface BrowseMcpServerOptions extends BrowseClientOptions {
  client?: BrowseClient;
}

type StructuredContent = NonNullable<CallToolResult["structuredContent"]>;

export function createBrowseMcpServer(options: BrowseMcpServerOptions = {}): McpServer {
  const client = options.client ?? new BrowseClient(options);
  const server = new McpServer({
    name: BROWSE_MCP_SERVER_NAME,
    version: "1.0.0",
  });

  server.tool(
    BROWSE_SEARCH_TOOL_NAME,
    buildBrowseSearchDescription(client),
    {
      query_list: z.array(browseSearchQuerySchema).describe("List of source-specific search queries."),
    },
    async (args): Promise<CallToolResult> => {
      const input = args as { query_list?: BrowseSearchQueryInput[] };
      const queryList = input.query_list ?? [];
      const content = await client.browseSearch(queryList);
      return textResult(
        content,
        content.startsWith("Error searching content"),
        {
          content,
          count: content === "No content found." || content.startsWith("Error searching content") ? 0 : content.split("\n\n").length,
          queries: queryList,
        }
      );
    }
  );

  server.tool(
    BROWSE_DOWNLOAD_TOOL_NAME,
    buildBrowseDownloadDescription(client),
    {
      query_list: z.array(browseDownloadQuerySchema).describe("List of content download requests."),
    },
    async (args): Promise<CallToolResult> => {
      const input = args as { query_list?: BrowseDownloadQueryInput[] };
      const queryList = input.query_list ?? [];
      const paths: string[] = await client.browseDownload(queryList);
      const hasError = paths.some((item) => item.startsWith("Error"));
      return textResult(
        hasError ? "One or more downloads failed." : `Downloaded ${paths.length} content item${paths.length === 1 ? "" : "s"}.`,
        hasError,
        {
          paths,
          count: paths.length,
          queries: queryList,
        }
      );
    }
  );

  server.tool(
    BROWSE_READ_TOOL_NAME,
    buildBrowseReadDescription(client),
    {
      searcher: browseReadQuerySchema.shape.searcher,
      content_id: browseReadQuerySchema.shape.content_id,
      page: browseReadQuerySchema.shape.page,
      start_page: browseReadQuerySchema.shape.start_page,
      end_page: browseReadQuerySchema.shape.end_page,
    },
    async (args): Promise<CallToolResult> => {
      const input = args as BrowseReadQueryInput;
      const text = await client.browseRead(input);
      return textResult(
        text,
        text.startsWith("Error"),
        {
          text,
          length: text.length,
          query: input,
        }
      );
    }
  );

  return server;
}

function textResult(text: string, isError = false, structuredContent?: StructuredContent): CallToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent,
    isError: isError || undefined,
  };
}

function buildBrowseSearchDescription(client: BrowseClient): string {
  return `Search content from multiple sources.

## Available sources: ${client.getAvailableSources().join(", ")}

## Input Constraints:
- query_list: list of search query objects
- query: 1-500 characters, required, cannot be empty
- max_results: 1-100, default is 10
- year: valid formats: '2019', '2016-2020', '2010-', '-2015' (only for semantic)
- fetch_details: boolean (only for iacr)
- kwargs: dict (only for crossref)

## Example:
browse_search([
    {"searcher": "arxiv", "query": "machine learning", "max_results": 5},
    {"searcher": "pubmed", "query": "cancer immunotherapy", "max_results": 3},
    {"searcher": "iacr", "query": "cryptography", "max_results": 3, "fetch_details": true},
    {"searcher": "semantic", "query": "climate change", "max_results": 4, "year": "2015-2020"},
    {"searcher": "crossref", "query": "deep learning", "max_results": 2, "kwargs": {"filter": "from-pub-date:2020,has-full-text:true"}},
    {"query": "deep learning", "max_results": 2}
])`;
}

function buildBrowseDownloadDescription(client: BrowseClient): string {
  return `Download content such as PDFs from multiple sources.

## Available sources: ${client.getAvailableSources().join(", ")}

## Input Constraints:
- query_list: list of download query objects
- searcher: required, must be one of the supported platforms
- content_id: required, 1-200 characters, cannot be empty
- paper_id: deprecated alias for content_id

## Content ID formats:
- arXiv: Use the arXiv ID (e.g., "2106.12345").
- PubMed: Use the PubMed ID (PMID) (e.g., "32790614").
- bioRxiv: Use the bioRxiv DOI (e.g., "10.1101/2020.01.01.123456").
- medRxiv: Use the medRxiv DOI (e.g., "10.1101/2020.01.01.123456").
- Google Scholar: Direct PDF download is not supported; please use the paper URL to access the publisher's website.
- IACR: Use the IACR paper ID (e.g., "2009/101").
- Semantic Scholar: Use the Semantic Scholar paper ID or prefixed ID (e.g., "DOI:10.18653/v1/N18-3011").
- CrossRef: Use the DOI (e.g., "10.1038/s41586-020-2649-2").

## Returns:
List of paths to the downloaded files.

## Example:
browse_download([
    {"searcher": "arxiv", "content_id": "2106.12345"},
    {"searcher": "pubmed", "content_id": "32790614"},
    {"searcher": "biorxiv", "content_id": "10.1101/2020.01.01.123456"},
    {"searcher": "semantic", "content_id": "DOI:10.18653/v1/N18-3011"}
])`;
}

function buildBrowseReadDescription(client: BrowseClient): string {
  return `Read and extract text content from sources with optional pagination support.

## Available sources: ${client.getAvailableSources().join(", ")}

## Input Constraints:
- searcher: required, must be one of the available sources
- content_id: required, 1-200 characters, cannot be empty
- page: optional, specific page number to read, 1-indexed
- start_page: optional, start page for range extraction, 1-indexed
- end_page: optional, end page for range extraction, 1-indexed

## Pagination behavior:
- No pagination params: Return all content
- page=3: Return only page 3
- start_page=1, end_page=5: Return pages 1-5
- start_page=10: Return from page 10 to end
- end_page=5: Return pages 1-5

## Example:
browse_read(searcher="arxiv", content_id="2106.12345")
browse_read(searcher="arxiv", content_id="2106.12345", page=3)
browse_read(searcher="arxiv", content_id="2106.12345", start_page=1, end_page=5)`;
}

async function main(): Promise<void> {
  const server = createBrowseMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`[browse_mcp] ${message}\n`);
    process.exitCode = 1;
  });
}
