import { BasePaperSource, Paper, paperToText, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, fetchJson, parseDate, toArray } from "./utils";

interface CrossrefResponse {
  message?: {
    items?: CrossrefItem[];
  };
}

interface CrossrefWorkResponse {
  message?: CrossrefItem;
}

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  abstract?: string;
  published?: CrossrefDate;
  issued?: CrossrefDate;
  created?: CrossrefDate;
  URL?: string;
  resource?: { primary?: { URL?: string } };
  link?: Array<{ "content-type"?: string; URL?: string }>;
  "container-title"?: string[];
  publisher?: string;
  type?: string;
  subject?: string[];
  "is-referenced-by-count"?: number;
  volume?: string;
  issue?: string;
  page?: string;
  ISSN?: string[];
  ISBN?: string[];
  member?: string;
  prefix?: string;
}

interface CrossrefDate {
  "date-parts"?: number[][];
}

export class CrossRefSearcher extends BasePaperSource {
  static readonly BASE_URL = "https://api.crossref.org";
  static readonly USER_AGENT = "paper-search-mcp/0.1.3 (https://github.com/Dragonatorul/paper-search-mcp; mailto:paper-search@example.org)";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    try {
      const url = buildUrl(`${CrossRefSearcher.BASE_URL}/works`, {
        query,
        rows: Math.min(options.max_results ?? 10, 1000),
        sort: typeof options.sort === "string" ? options.sort : "relevance",
        order: typeof options.order === "string" ? options.order : "desc",
        filter: typeof options.filter === "string" ? options.filter : undefined,
        mailto: "paper-search@example.org",
      });
      const data = await fetchJson<CrossrefResponse>(url, {
        headers: {
          "user-agent": CrossRefSearcher.USER_AGENT,
        },
      });
      return toArray(data.message?.items).map((item) => this.parseItem(item)).filter((paper): paper is Paper => Boolean(paper));
    } catch {
      return [];
    }
  }

  downloadPdf(): string {
    throw new Error("CrossRef does not provide direct PDF downloads. CrossRef is a citation database that provides metadata about academic papers. To access the full text, please use the paper's DOI or URL to visit the publisher's website.");
  }

  async readPaper(paperId: string, _savePath = "./downloads", _options: ReadOptions = {}): Promise<string> {
    const paper = await this.getPaperByDoi(paperId);
    if (paper) {
      return paperToText(paper);
    }
    return "Note: CrossRef papers cannot be read directly through this tool. CrossRef is a citation database that provides metadata about academic papers. Only metadata and abstracts are available through CrossRef's API. To access the full text, please use the paper's DOI or URL to visit the publisher's website.";
  }

  async getPaperByDoi(doi: string): Promise<Paper | undefined> {
    try {
      const data = await fetchJson<CrossrefWorkResponse>(buildUrl(`${CrossRefSearcher.BASE_URL}/works/${doi}`, {
        mailto: "paper-search@example.org",
      }), {
        headers: {
          "user-agent": CrossRefSearcher.USER_AGENT,
        },
      });
      return data.message ? this.parseItem(data.message) : undefined;
    } catch {
      return undefined;
    }
  }

  private parseItem(item: CrossrefItem): Paper | undefined {
    const doi = item.DOI ?? "";
    const publishedDate = extractDate(item.published) ?? extractDate(item.issued) ?? extractDate(item.created) ?? new Date("1970-01-01T00:00:00.000Z");
    return new Paper({
      paper_id: doi,
      title: item.title?.[0] ?? "",
      authors: toArray(item.author).map((author) => [author.given, author.family].filter(Boolean).join(" ")).filter(Boolean),
      abstract: item.abstract ?? "",
      doi,
      published_date: publishedDate,
      pdf_url: extractPdfUrl(item),
      url: item.URL ?? (doi ? `https://doi.org/${doi}` : ""),
      source: "crossref",
      categories: [item.type ?? ""].filter(Boolean),
      keywords: Array.isArray(item.subject) ? item.subject : [],
      citations: item["is-referenced-by-count"] ?? 0,
      extra: {
        publisher: item.publisher ?? "",
        container_title: item["container-title"]?.[0] ?? "",
        volume: item.volume ?? "",
        issue: item.issue ?? "",
        page: item.page ?? "",
        issn: item.ISSN ?? [],
        isbn: item.ISBN ?? [],
        crossref_type: item.type ?? "",
        member: item.member ?? "",
        prefix: item.prefix ?? "",
      },
    });
  }
}

function extractDate(value?: CrossrefDate): Date | undefined {
  const parts = value?.["date-parts"]?.[0];
  if (!parts?.length) {
    return undefined;
  }
  return parseDate([parts[0], parts[1] ?? 1, parts[2] ?? 1].map((part) => String(part).padStart(2, "0")).join("-"));
}

function extractPdfUrl(item: CrossrefItem): string {
  const primary = item.resource?.primary?.URL;
  if (primary?.endsWith(".pdf")) {
    return primary;
  }
  return item.link?.find((link) => link["content-type"]?.toLowerCase().includes("pdf"))?.URL ?? "";
}
