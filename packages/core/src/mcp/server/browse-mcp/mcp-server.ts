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
      const result = await client.browseSearch(input.query_list ?? []);
      return textResult(result, result.startsWith("Error searching content"));
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
      const result = await client.browseDownload(input.query_list ?? []);
      return textResult(JSON.stringify(result, null, 2), result.some((item) => item.startsWith("Error")));
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
      const result = await client.browseRead(input);
      return textResult(result, result.startsWith("Error"));
    }
  );

  return server;
}

function textResult(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: isError || undefined,
  };
}

function buildBrowseSearchDescription(client: BrowseClient): string {
  return `Search content from multiple sources.

Available sources: ${client.getAvailableSources().join(", ")}

Input constraints:
- query_list: list of search query objects
- query: 1-500 characters, required, cannot be empty
- max_results: 1-100, default is 10
- year: valid formats: '2019', '2016-2020', '2010-', '-2015' (only for semantic)
- fetch_details: boolean (only for iacr)
- kwargs: dict (only for crossref)`;
}

function buildBrowseDownloadDescription(client: BrowseClient): string {
  return `Download content such as PDFs from multiple sources.

Available sources: ${client.getAvailableSources().join(", ")}

Input constraints:
- query_list: list of download query objects
- searcher: required, must be one of the supported platforms
- content_id: required, 1-200 characters, cannot be empty
- paper_id: deprecated alias for content_id`;
}

function buildBrowseReadDescription(client: BrowseClient): string {
  return `Read and extract text content from sources with optional pagination support.

Available sources: ${client.getAvailableSources().join(", ")}

Input constraints:
- searcher: required, must be one of the available sources
- content_id: required, 1-200 characters, cannot be empty
- page: optional, specific page number to read, 1-indexed
- start_page: optional, start page for range extraction, 1-indexed
- end_page: optional, end page for range extraction, 1-indexed`;
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
