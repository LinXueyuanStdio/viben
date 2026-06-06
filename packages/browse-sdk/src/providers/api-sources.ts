import { existsSync } from "node:fs";
import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, downloadToFile, fetchJson, localPdfPath, parseDate, readExistingOrDownload, sanitizeFilename } from "./utils";

export class CORESearcher extends BasePaperSource {
  static readonly BASE_URL = "https://api.core.ac.uk/v3";
  private readonly apiKey: string;

  constructor(apiKey = process.env.CORE_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    if (!this.apiKey) {
      return [];
    }
    try {
      const data = await fetchJson<{ results?: CoreWork[] }>(buildUrl(`${CORESearcher.BASE_URL}/search/works`, {
        q: query,
        limit: options.max_results ?? 10,
      }), { headers: { Authorization: `Bearer ${this.apiKey}` } });
      return (data.results ?? []).map((item) => new Paper({
        paper_id: String(item.id ?? ""),
        title: item.title ?? "",
        authors: parseCoreAuthors(item.authors),
        abstract: item.abstract ?? "",
        doi: item.doi ?? "",
        published_date: item.yearPublished ? new Date(`${item.yearPublished}-01-01T00:00:00.000Z`) : new Date(),
        pdf_url: item.downloadUrl ?? "",
        url: item.links?.[0]?.url ?? (item.doi ? `https://doi.org/${item.doi}` : item.id ? `https://core.ac.uk/display/${item.id}` : ""),
        source: "core",
        categories: [],
        keywords: item.subjects ?? [],
        extra: {
          publisher: item.publisher ?? "",
          language: item.language?.name ?? "",
        },
      }));
    } catch {
      return [];
    }
  }

  async downloadPdf(paperId: string, savePath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("API key required for CORE PDF download");
    }
    const data = await fetchJson<{ downloadUrl?: string }>(`${CORESearcher.BASE_URL}/works/${paperId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!data.downloadUrl) {
      throw new Error(`No PDF URL found for paper ${paperId}`);
    }
    return await downloadToFile(data.downloadUrl, savePath, `${paperId}.pdf`);
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readExistingOrDownload(localPdfPath(savePath, `${paperId}.pdf`), () => this.downloadPdf(paperId, savePath), options);
  }
}

interface CoreWork {
  id?: string | number;
  title?: string;
  authors?: Array<string | { name?: string }>;
  abstract?: string;
  doi?: string;
  yearPublished?: string | number;
  links?: Array<{ url?: string }>;
  downloadUrl?: string;
  subjects?: string[];
  publisher?: string;
  language?: { name?: string };
}

export class IEEESearcher extends BasePaperSource {
  static readonly BASE_URL = "http://ieeexploreapi.ieee.org/api/v1/search/articles";
  private readonly apiKey: string;

  constructor(apiKey = process.env.IEEE_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    if (!this.apiKey) {
      return [];
    }
    try {
      const data = await fetchJson<{ articles?: IEEEArticle[] }>(buildUrl(IEEESearcher.BASE_URL, {
        apikey: this.apiKey,
        querytext: query,
        max_records: options.max_results ?? 10,
        format: "json",
      }));
      return (data.articles ?? []).map((article) => new Paper({
        paper_id: article.article_number ?? article.doi ?? "",
        title: article.title ?? "",
        authors: article.authors?.authors?.map((author) => author.full_name ?? "").filter(Boolean) ?? [],
        abstract: article.abstract ?? "",
        doi: article.doi ?? "",
        published_date: parseDate(article.publication_date),
        pdf_url: article.pdf_url ?? "",
        url: article.html_url ?? article.abstract_url ?? "",
        source: "ieee",
        categories: [article.content_type ?? ""].filter(Boolean),
        keywords: article.index_terms?.ieee_terms?.terms ?? [],
        citations: Number(article.citing_paper_count ?? 0),
        extra: {
          publication: article.publication_title ?? "",
          volume: article.volume ?? "",
          issue: article.issue ?? "",
          pages: article.start_page && article.end_page ? `${article.start_page}-${article.end_page}` : "",
        },
      }));
    } catch {
      return [];
    }
  }

  downloadPdf(): string {
    if (!this.apiKey) {
      throw new Error("API key required for IEEE PDF download");
    }
    throw new Error("IEEE PDF download requires institutional access");
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readLocalInstitutionalPdf(paperId, savePath, "IEEE requires institutional access for PDF download.", options);
  }
}

interface IEEEArticle {
  article_number?: string;
  doi?: string;
  title?: string;
  authors?: { authors?: Array<{ full_name?: string }> };
  abstract?: string;
  publication_date?: string;
  pdf_url?: string;
  html_url?: string;
  abstract_url?: string;
  content_type?: string;
  index_terms?: { ieee_terms?: { terms?: string[] } };
  citing_paper_count?: number | string;
  publication_title?: string;
  volume?: string;
  issue?: string;
  start_page?: string;
  end_page?: string;
}

export class ScopusSearcher extends BasePaperSource {
  static readonly BASE_URL = "https://api.elsevier.com/content/search/scopus";
  private readonly apiKey: string;

  constructor(apiKey = process.env.SCOPUS_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    if (!this.apiKey) {
      return [];
    }
    return await searchElsevier(ScopusSearcher.BASE_URL, this.apiKey, query, options, "scopus");
  }

  downloadPdf(): string {
    throw new Error("Scopus PDF download requires institutional access");
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readLocalInstitutionalPdf(paperId, savePath, "Scopus requires institutional access for PDF download.", options);
  }
}

export class ScienceDirectSearcher extends BasePaperSource {
  static readonly BASE_URL = "https://api.elsevier.com/content/search/sciencedirect";
  private readonly apiKey: string;

  constructor(apiKey = process.env.SCIENCEDIRECT_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    if (!this.apiKey) {
      return [];
    }
    return await searchElsevier(ScienceDirectSearcher.BASE_URL, this.apiKey, query, options, "sciencedirect");
  }

  downloadPdf(): string {
    if (!this.apiKey) {
      throw new Error("API key required for Science Direct PDF download");
    }
    throw new Error("Science Direct PDF download requires institutional access");
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readLocalInstitutionalPdf(paperId, savePath, "Science Direct requires institutional access for PDF download.", options);
  }
}

export class SpringerSearcher extends BasePaperSource {
  static readonly BASE_URL = "http://api.springernature.com/metadata/json";
  private readonly apiKey: string;

  constructor(apiKey = process.env.SPRINGER_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    if (!this.apiKey) {
      return [];
    }
    try {
      const data = await fetchJson<{ records?: SpringerRecord[] }>(buildUrl(SpringerSearcher.BASE_URL, {
        q: query,
        p: options.max_results ?? 10,
        api_key: this.apiKey,
      }));
      return (data.records ?? []).map((record) => {
        const doi = record.doi ?? "";
        const urls = Array.isArray(record.url) ? record.url : [];
        return new Paper({
          paper_id: doi || record.identifier || "",
          title: record.title ?? "",
          authors: (record.creators ?? []).map((creator) => typeof creator === "string" ? creator : creator.creator ?? "").filter(Boolean),
          abstract: record.abstract ?? "",
          doi,
          published_date: parseDate(record.publicationDate),
          pdf_url: urls.find((url) => url.format === "pdf")?.value ?? "",
          url: urls[0]?.value ?? (doi ? `https://doi.org/${doi}` : ""),
          source: "springer",
          categories: [record.publicationType ?? ""].filter(Boolean),
          keywords: record.subjects ?? [],
          extra: {
            publication: record.publicationName ?? "",
            volume: record.volume ?? "",
            issue: record.number ?? "",
            pages: `${record.startingPage ?? ""}-${record.endingPage ?? ""}`,
          },
        });
      });
    } catch {
      return [];
    }
  }

  downloadPdf(): string {
    if (!this.apiKey) {
      throw new Error("API key required for Springer PDF download");
    }
    throw new Error("Springer PDF download requires institutional access");
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readLocalInstitutionalPdf(sanitizeFilename(paperId), savePath, "Springer requires institutional access for PDF download.", options);
  }
}

interface SpringerRecord {
  doi?: string;
  identifier?: string;
  title?: string;
  creators?: Array<string | { creator?: string }>;
  abstract?: string;
  publicationDate?: string;
  url?: Array<{ format?: string; value?: string }>;
  publicationType?: string;
  subjects?: string[];
  publicationName?: string;
  volume?: string;
  number?: string;
  startingPage?: string;
  endingPage?: string;
}

export class WOSSearcher extends BasePaperSource {
  private readonly apiKey: string;

  constructor(apiKey = process.env.WOS_API_KEY ?? "") {
    super();
    this.apiKey = apiKey;
  }

  search(): [] {
    return [];
  }

  downloadPdf(): string {
    throw new Error("Web of Science PDF download requires institutional access");
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    void this.apiKey;
    return await readLocalInstitutionalPdf(paperId, savePath, "Web of Science requires institutional access.", options);
  }
}

interface ElsevierResponse {
  "search-results"?: {
    entry?: ElsevierEntry[];
  };
}

interface ElsevierEntry {
  "dc:identifier"?: string;
  "dc:title"?: string;
  "dc:creator"?: string;
  "dc:description"?: string;
  "prism:doi"?: string;
  "prism:coverDate"?: string;
  "prism:url"?: string;
  "prism:aggregationType"?: string;
  "citedby-count"?: string | number;
  "prism:publicationName"?: string;
  "prism:volume"?: string;
  "prism:issueIdentifier"?: string;
  "prism:pageRange"?: string;
  authors?: {
    author?: Array<{ "given-name"?: string; surname?: string }>;
  };
  link?: Array<{ "@ref"?: string; "@href"?: string }>;
}

async function searchElsevier(url: string, apiKey: string, query: string, options: SearchOptions, source: "scopus" | "sciencedirect"): Promise<Paper[]> {
  try {
    const data = await fetchJson<ElsevierResponse>(buildUrl(url, {
      query,
      count: options.max_results ?? 10,
      sort: "relevance",
    }), {
      headers: {
        "X-ELS-APIKey": apiKey,
      },
    });
    return (data["search-results"]?.entry ?? []).map((entry) => {
      const doi = entry["prism:doi"] ?? "";
      return new Paper({
        paper_id: (entry["dc:identifier"] ?? "").replace("SCOPUS_ID:", ""),
        title: entry["dc:title"] ?? "",
        authors: source === "scopus"
          ? [entry["dc:creator"] ?? ""].filter(Boolean)
          : (entry.authors?.author ?? []).map((author) => `${author["given-name"] ?? ""} ${author.surname ?? ""}`.trim()).filter(Boolean),
        abstract: entry["dc:description"] ?? "",
        doi,
        published_date: parseDate(entry["prism:coverDate"]),
        pdf_url: entry.link?.find((link) => link["@ref"] === "scidir")?.["@href"] ?? "",
        url: entry["prism:url"] ?? (doi ? `https://doi.org/${doi}` : ""),
        source,
        categories: [entry["prism:aggregationType"] ?? ""].filter(Boolean),
        keywords: [],
        citations: Number(entry["citedby-count"] ?? 0),
        extra: {
          publication: entry["prism:publicationName"] ?? "",
          volume: entry["prism:volume"] ?? "",
          issue: entry["prism:issueIdentifier"] ?? "",
          pages: entry["prism:pageRange"] ?? "",
        },
      });
    });
  } catch {
    return [];
  }
}

async function readLocalInstitutionalPdf(paperId: string, savePath: string, missingReason: string, options: ReadOptions): Promise<string> {
  const path = localPdfPath(savePath, `${paperId}.pdf`);
  if (!existsSync(path)) {
    throw new Error(`PDF not found: ${path}. ${missingReason}`);
  }
  return (await readExistingOrDownload(path, async () => path, options)).trim();
}

function parseCoreAuthors(value?: Array<string | { name?: string }>): string[] {
  return (value ?? []).map((author) => typeof author === "string" ? author : author.name ?? "").filter(Boolean);
}
