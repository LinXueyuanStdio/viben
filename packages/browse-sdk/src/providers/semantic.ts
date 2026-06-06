import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, downloadToFile, fetchJson, localPdfPath, parseDate, readExistingOrDownload, sanitizeFilename, USER_AGENT } from "./utils";

interface SemanticSearchResponse {
  data?: SemanticPaper[];
}

interface SemanticPaper {
  paperId?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  abstract?: string;
  url?: string;
  openAccessPdf?: {
    url?: string;
    disclaimer?: string;
  };
  publicationDate?: string;
  externalIds?: {
    DOI?: string;
  };
  fieldsOfStudy?: string[];
  citationCount?: number;
}

export class SemanticSearcher extends BasePaperSource {
  static readonly SEMANTIC_BASE_URL = "https://api.semanticscholar.org/graph/v1";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    const fields = ["title", "abstract", "year", "citationCount", "authors", "url", "publicationDate", "externalIds", "fieldsOfStudy", "openAccessPdf"];
    const url = buildUrl(`${SemanticSearcher.SEMANTIC_BASE_URL}/paper/search`, {
      query,
      limit: options.max_results ?? 10,
      fields: fields.join(","),
      year: options.year,
    });
    try {
      const data = await fetchJson<SemanticSearchResponse>(url, { headers: semanticHeaders() });
      return (data.data ?? []).slice(0, options.max_results ?? 10).map((item) => this.parsePaper(item)).filter((paper): paper is Paper => Boolean(paper));
    } catch {
      return [];
    }
  }

  async downloadPdf(paperId: string, savePath: string): Promise<string> {
    const paper = await this.getPaperDetails(paperId);
    if (!paper?.pdf_url) {
      return `Error: Could not find PDF URL for paper ${paperId}`;
    }
    return await downloadToFile(paper.pdf_url, savePath, `semantic_${sanitizeFilename(paperId)}.pdf`, {
      "user-agent": USER_AGENT,
    });
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    const paper = await this.getPaperDetails(paperId);
    if (!paper?.pdf_url) {
      return `Error: Could not find PDF URL for paper ${paperId}`;
    }
    const pdfPath = await downloadToFile(paper.pdf_url, savePath, `semantic_${sanitizeFilename(paperId)}.pdf`, {
      "user-agent": USER_AGENT,
    });
    const text = await readExistingOrDownload(localPdfPath(savePath, `semantic_${sanitizeFilename(paperId)}.pdf`), async () => pdfPath, options);
    if (!text.trim()) {
      return `PDF downloaded to ${pdfPath}, but unable to extract readable text`;
    }
    return [
      `Title: ${paper.title}`,
      `Authors: ${paper.authors.join(", ")}`,
      `Published Date: ${paper.published_date}`,
      `URL: ${paper.url}`,
      `PDF downloaded to: ${pdfPath}`,
      "=".repeat(80),
      "",
      text.trim(),
    ].join("\n");
  }

  async getPaperDetails(paperId: string): Promise<Paper | undefined> {
    const fields = ["title", "abstract", "year", "citationCount", "authors", "url", "publicationDate", "externalIds", "fieldsOfStudy", "openAccessPdf"];
    try {
      const data = await fetchJson<SemanticPaper>(buildUrl(`${SemanticSearcher.SEMANTIC_BASE_URL}/paper/${paperId}`, {
        fields: fields.join(","),
      }), { headers: semanticHeaders() });
      return this.parsePaper(data);
    } catch {
      return undefined;
    }
  }

  private parsePaper(item: SemanticPaper): Paper | undefined {
    if (!item.paperId && !item.title) {
      return undefined;
    }
    return new Paper({
      paper_id: item.paperId ?? "",
      title: item.title ?? "",
      authors: (item.authors ?? []).map((author) => author.name ?? "").filter(Boolean),
      abstract: item.abstract ?? "",
      doi: item.externalIds?.DOI ?? "",
      published_date: parseDate(item.publicationDate, new Date("1970-01-01T00:00:00.000Z")),
      pdf_url: extractSemanticPdfUrl(item),
      url: item.url ?? "",
      source: "semantic",
      categories: item.fieldsOfStudy ?? [],
      citations: item.citationCount ?? 0,
    });
  }
}

function semanticHeaders(): Record<string, string> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  return apiKey ? { "x-api-key": apiKey } : {};
}

function extractSemanticPdfUrl(item: SemanticPaper): string {
  if (item.openAccessPdf?.url) {
    return item.openAccessPdf.url;
  }
  const disclaimer = item.openAccessPdf?.disclaimer ?? "";
  const urls = disclaimer.match(/https?:\/\/[^\s,)]+/g) ?? [];
  const candidate = urls.find((url) => !url.includes("unpaywall.org")) ?? urls[0] ?? "";
  return candidate.includes("arxiv.org/abs/") ? candidate.replace("/abs/", "/pdf/") : candidate;
}
