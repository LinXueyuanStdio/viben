import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, downloadToFile, fetchJson, localPdfPath, parseDate, readExistingOrDownload, toArray } from "./utils";

interface PmcSearchResponse {
  esearchresult?: {
    idlist?: string[];
  };
}

interface PmcSummaryResponse {
  result?: Record<string, PmcArticle | unknown>;
}

interface PmcArticle {
  pmcid?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  pubdate?: string;
  elocationid?: string;
  fulljournalname?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}

export class PMCSearcher extends BasePaperSource {
  static readonly BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    try {
      const search = await fetchJson<PmcSearchResponse>(buildUrl(`${PMCSearcher.BASE_URL}/esearch.fcgi`, {
        db: "pmc",
        term: query,
        retmax: options.max_results ?? 10,
        retmode: "json",
        sort: "relevance",
      }));
      const ids = search.esearchresult?.idlist ?? [];
      if (ids.length === 0) {
        return [];
      }
      const summary = await fetchJson<PmcSummaryResponse>(buildUrl(`${PMCSearcher.BASE_URL}/esummary.fcgi`, {
        db: "pmc",
        id: ids.join(","),
        retmode: "json",
      }));
      return ids.map((id) => this.parseArticle(id, summary.result?.[id] as PmcArticle | undefined)).filter((paper): paper is Paper => Boolean(paper));
    } catch {
      return [];
    }
  }

  async downloadPdf(paperId: string, savePath: string): Promise<string> {
    const pmcid = paperId.startsWith("PMC") ? paperId : `PMC${paperId}`;
    return await downloadToFile(`https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/pdf/`, savePath, `${pmcid}.pdf`);
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    const pmcid = paperId.startsWith("PMC") ? paperId : `PMC${paperId}`;
    return await readExistingOrDownload(localPdfPath(savePath, `${pmcid}.pdf`), () => this.downloadPdf(pmcid, savePath), options);
  }

  private parseArticle(id: string, article?: PmcArticle): Paper | undefined {
    if (!article) {
      return undefined;
    }
    const pmcid = article.pmcid ?? `PMC${id}`;
    return new Paper({
      paper_id: pmcid,
      title: article.title ?? "",
      authors: toArray(article.authors).map((author) => author.name ?? "").filter(Boolean),
      abstract: "",
      doi: (article.elocationid ?? "").replace(/^doi:\s*/, ""),
      published_date: parseDate(article.pubdate),
      pdf_url: `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/pdf/`,
      url: `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`,
      source: "pmc",
      categories: [],
      keywords: [],
      extra: {
        journal: article.fulljournalname ?? "",
        volume: article.volume ?? "",
        issue: article.issue ?? "",
        pages: article.pages ?? "",
      },
    });
  }
}
