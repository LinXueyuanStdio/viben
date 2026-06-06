import { z } from "zod";

export const browseSearchQuerySchema = z.object({
  searcher: z.string().optional().nullable().describe("The content platform to search from. Omit to search all enabled platforms."),
  query: z.string().min(1).max(500).describe("Search query string. Must be between 1 and 500 characters."),
  max_results: z.number().int().min(1).max(100).default(10).describe("Maximum number of results to return."),
  fetch_details: z.boolean().optional().describe("Only applicable to searcher == 'iacr'."),
  year: z.string().regex(/^\d{4}(-\d{4})?|\d{4}-|-\d{4}$/).optional().describe("Only applicable to searcher == 'semantic'."),
  kwargs: z.record(z.string(), z.unknown()).optional().describe("Only applicable to searcher == 'crossref'."),
});

export const browseDownloadQuerySchema = z.object({
  searcher: z.string().describe("The content platform to download from."),
  content_id: z.string().min(1).max(200).optional().describe("The unique identifier of the content to download."),
  paper_id: z.string().min(1).max(200).optional().describe("Deprecated alias for content_id."),
});

export const browseReadQuerySchema = z.object({
  searcher: z.string().describe("The content platform to read from."),
  content_id: z.string().min(1).max(200).describe("The unique identifier of the content to read."),
  page: z.number().int().min(1).optional().describe("Specific page number to read, 1-indexed."),
  start_page: z.number().int().min(1).optional().describe("Start page for range extraction, 1-indexed."),
  end_page: z.number().int().min(1).optional().describe("End page for range extraction, 1-indexed."),
});

export type BrowseSearchQueryInput = z.infer<typeof browseSearchQuerySchema>;
export type BrowseDownloadQueryInput = z.infer<typeof browseDownloadQuerySchema>;
export type BrowseReadQueryInput = z.infer<typeof browseReadQuerySchema>;
