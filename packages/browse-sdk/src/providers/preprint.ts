import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { downloadToFile, fetchJson, localPdfPath, parseDate, readExistingOrDownload, sanitizeFilename, USER_AGENT } from "./utils";

interface BiorxivResponse {
  collection?: Array<{
    doi?: string;
    title?: string;
    authors?: string;
    abstract?: string;
    date?: string;
    version?: string;
    category?: string;
  }>;
}

abstract class PreprintSearcher extends BasePaperSource {
  protected abstract readonly source: "biorxiv" | "medrxiv";
  protected abstract readonly host: "www.biorxiv.org" | "www.medrxiv.org";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    const days = typeof options.days === "number" ? options.days : 30;
    const endDate = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    const category = query.toLowerCase().replace(/\s+/g, "_");
    const url = `https://api.biorxiv.org/details/${this.source}/${startDate}/${endDate}/0${category ? `?category=${encodeURIComponent(category)}` : ""}`;
    try {
      const data = await fetchJson<BiorxivResponse>(url);
      return (data.collection ?? []).slice(0, options.max_results ?? 10).map((item) => {
        const version = item.version ?? "1";
        const doi = item.doi ?? "";
        return new Paper({
          paper_id: doi,
          title: item.title ?? "",
          authors: (item.authors ?? "").split("; ").filter(Boolean),
          abstract: item.abstract ?? "",
          doi,
          published_date: parseDate(item.date),
          updated_date: parseDate(item.date),
          pdf_url: `https://${this.host}/content/${doi}v${version}.full.pdf`,
          url: `https://${this.host}/content/${doi}v${version}`,
          source: this.source,
          categories: [item.category ?? ""].filter(Boolean),
          keywords: [],
        });
      });
    } catch {
      return [];
    }
  }

  async downloadPdf(paperId: string, savePath: string): Promise<string> {
    if (!paperId) {
      throw new Error("Invalid paper_id: paper_id is empty");
    }
    return await downloadToFile(`https://${this.host}/content/${paperId}v1.full.pdf`, savePath, `${sanitizeFilename(paperId)}.pdf`, {
      "user-agent": USER_AGENT,
    });
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    return await readExistingOrDownload(localPdfPath(savePath, `${sanitizeFilename(paperId)}.pdf`), () => this.downloadPdf(paperId, savePath), options);
  }
}

export class BioRxivSearcher extends PreprintSearcher {
  protected readonly source = "biorxiv" as const;
  protected readonly host = "www.biorxiv.org" as const;
}

export class MedRxivSearcher extends PreprintSearcher {
  protected readonly source = "medrxiv" as const;
  protected readonly host = "www.medrxiv.org" as const;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
