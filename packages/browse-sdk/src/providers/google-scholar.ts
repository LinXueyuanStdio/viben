import * as cheerio from "cheerio";
import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, fetchText, USER_AGENT } from "./utils";

export class GoogleScholarSearcher extends BasePaperSource {
  static readonly SCHOLAR_URL = "https://scholar.google.com/scholar";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    try {
      const html = await fetchText(buildUrl(GoogleScholarSearcher.SCHOLAR_URL, {
        q: query,
        start: 0,
        hl: "en",
        as_sdt: "0,5",
      }), {
        headers: { "user-agent": USER_AGENT },
      });
      const $ = cheerio.load(html);
      return $("div.gs_ri").toArray().slice(0, options.max_results ?? 10).map((element) => this.parsePaper($, element)).filter((paper): paper is Paper => Boolean(paper));
    } catch {
      return [];
    }
  }

  downloadPdf(): string {
    throw new Error("Google Scholar doesn't provide direct PDF downloads. Please use the paper URL to access the publisher's website.");
  }

  readPaper(_paperId: string, _savePath = "./downloads", _options: ReadOptions = {}): string {
    return "Google Scholar doesn't support direct paper reading. Please use the paper URL to access the full text on the publisher's website.";
  }

  private parsePaper($: cheerio.CheerioAPI, element: cheerio.Element): Paper | undefined {
    const root = $(element);
    const titleElement = root.find("h3.gs_rt").first();
    const infoText = root.find("div.gs_a").first().text();
    if (!titleElement.length || !infoText) {
      return undefined;
    }
    const url = titleElement.find("a[href]").first().attr("href") ?? "";
    const year = extractYear(infoText);
    return new Paper({
      paper_id: `gs_${hashString(url)}`,
      title: titleElement.text().replace("[PDF]", "").replace("[HTML]", "").trim(),
      authors: infoText.split("-")[0].split(",").map((author) => author.trim()).filter(Boolean),
      abstract: root.find("div.gs_rs").first().text(),
      doi: "",
      published_date: year ? new Date(`${year}-01-01T00:00:00.000Z`) : null,
      pdf_url: "",
      url,
      source: "google_scholar",
      categories: [],
      keywords: [],
    });
  }
}

function extractYear(text: string): number | undefined {
  for (const word of text.split(/\s+/)) {
    const value = Number.parseInt(word, 10);
    if (Number.isInteger(value) && value >= 1900 && value <= new Date().getFullYear()) {
      return value;
    }
  }
  return undefined;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return String(hash);
}
