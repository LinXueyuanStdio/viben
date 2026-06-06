import { Paper, BasePaperSource, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, downloadToFile, localPdfPath, parseDate, parseXml, readExistingOrDownload, toArray } from "./utils";

interface ArxivFeed {
  feed?: {
    entry?: ArxivEntry | ArxivEntry[];
  };
}

interface ArxivEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  author?: Array<{ name?: string }> | { name?: string };
  link?: Array<{ href?: string; type?: string }> | { href?: string; type?: string };
  category?: Array<{ term?: string }> | { term?: string };
  doi?: string;
}

export class ArxivSearcher extends BasePaperSource {
  static readonly BASE_URL = "https://export.arxiv.org/api/query";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    const maxResults = options.max_results ?? 10;
    const url = buildUrl(ArxivSearcher.BASE_URL, {
      search_query: query,
      max_results: maxResults,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });
    const xml = await fetch(url).then((response) => response.text());
    const feed = parseXml<ArxivFeed>(xml);
    return toArray(feed.feed?.entry).map((entry) => {
      const links = toArray(entry.link);
      return new Paper({
        paper_id: (entry.id ?? "").split("/").pop() ?? "",
        title: entry.title ?? "",
        authors: toArray(entry.author).map((author) => author.name ?? "").filter(Boolean),
        abstract: entry.summary ?? "",
        doi: entry.doi ?? "",
        published_date: parseDate(entry.published),
        updated_date: parseDate(entry.updated),
        pdf_url: links.find((link) => link.type === "application/pdf")?.href ?? "",
        url: entry.id ?? "",
        source: "arxiv",
        categories: toArray(entry.category).map((category) => category.term ?? "").filter(Boolean),
        keywords: [],
      });
    });
  }

  async downloadPdf(paperId: string, savePath: string): Promise<string> {
    return await downloadToFile(`https://arxiv.org/pdf/${paperId}.pdf`, savePath, `${paperId}.pdf`);
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readExistingOrDownload(localPdfPath(savePath, `${paperId}.pdf`), () => this.downloadPdf(paperId, savePath), options);
  }
}
