import * as cheerio from "cheerio";
import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, downloadToFile, fetchText, localPdfPath, parseDate, readExistingOrDownload, sanitizeFilename, USER_AGENT } from "./utils";

export class IACRSearcher extends BasePaperSource {
  static readonly IACR_SEARCH_URL = "https://eprint.iacr.org/search";
  static readonly IACR_BASE_URL = "https://eprint.iacr.org";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    try {
      const html = await fetchText(buildUrl(IACRSearcher.IACR_SEARCH_URL, { q: query }), {
        headers: { "user-agent": USER_AGENT },
      });
      const $ = cheerio.load(html);
      const papers: Paper[] = [];
      for (const element of $("div.mb-4").toArray()) {
        if (papers.length >= (options.max_results ?? 10)) {
          break;
        }
        const paper = (options.fetch_details ?? true)
          ? await this.getPaperDetails($(element).find("a.paperlink").first().text().trim())
          : this.parseSearchResult($, element);
        if (paper) {
          papers.push(paper);
        }
      }
      return papers;
    } catch {
      return [];
    }
  }

  async downloadPdf(paperId: string, savePath: string): Promise<string> {
    return await downloadToFile(`${IACRSearcher.IACR_BASE_URL}/${paperId}.pdf`, savePath, `iacr_${sanitizeFilename(paperId)}.pdf`, {
      "user-agent": USER_AGENT,
    });
  }

  async readPaper(paperId: string, savePath = "./downloads", options: ReadOptions = {}): Promise<string> {
    const paper = await this.getPaperDetails(paperId);
    const pdfPath = paper?.pdf_url
      ? await downloadToFile(paper.pdf_url, savePath, `iacr_${sanitizeFilename(paperId)}.pdf`, { "user-agent": USER_AGENT })
      : await this.downloadPdf(paperId, savePath);
    const text = await readExistingOrDownload(localPdfPath(savePath, `iacr_${sanitizeFilename(paperId)}.pdf`), async () => pdfPath, options);
    if (!text.trim()) {
      return `PDF downloaded to ${pdfPath}, but unable to extract readable text`;
    }
    if (!paper) {
      return text.trim();
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

  async getPaperDetails(paperIdOrUrl: string): Promise<Paper | undefined> {
    if (!paperIdOrUrl) {
      return undefined;
    }
    const paperUrl = paperIdOrUrl.startsWith("http") ? paperIdOrUrl : `${IACRSearcher.IACR_BASE_URL}/${paperIdOrUrl}`;
    const paperId = paperIdOrUrl.startsWith("http") ? paperUrl.split("/").slice(-2).join("/") : paperIdOrUrl;
    try {
      const html = await fetchText(paperUrl, { headers: { "user-agent": USER_AGENT } });
      const $ = cheerio.load(html);
      const pageText = $.root().text().split("\n").map((line) => line.trim()).filter(Boolean);
      const publicationIndex = pageText.findIndex((line) => line.includes("Publication info"));
      const historyIndex = pageText.findIndex((line) => line === "History");
      const historyEntries = historyIndex >= 0
        ? pageText.slice(historyIndex + 1).filter((line) => line.includes(":") && !line.startsWith("Short URL") && !line.startsWith("License"))
        : [];
      const lastUpdated = historyEntries[0]?.split(":")[0]?.trim();
      return new Paper({
        paper_id: paperId,
        title: $("h3.mb-3").first().text().trim(),
        authors: $("p.fst-italic").first().text().trim().replace(/\sand\s/g, ",").split(",").map((author) => author.trim()).filter(Boolean),
        abstract: $('p[style="white-space: pre-wrap;"]').first().text().trim(),
        doi: "",
        published_date: lastUpdated ? parseDate(lastUpdated) : new Date(),
        updated_date: lastUpdated ? parseDate(lastUpdated) : null,
        pdf_url: `${IACRSearcher.IACR_BASE_URL}/${paperId}.pdf`,
        url: paperUrl,
        source: "iacr",
        categories: [],
        keywords: $("a.badge.bg-secondary.keyword").toArray().map((element) => $(element).text().trim()).filter(Boolean),
        citations: 0,
        extra: {
          publication_info: publicationIndex >= 0 ? pageText[publicationIndex + 1] ?? "" : "",
          history: historyEntries.join("; "),
        },
      });
    } catch {
      return undefined;
    }
  }

  private parseSearchResult($: cheerio.CheerioAPI, element: cheerio.Element): Paper | undefined {
    const root = $(element);
    const paperLink = root.find("a.paperlink").first();
    const paperId = paperLink.text().trim();
    if (!paperId) {
      return undefined;
    }
    return new Paper({
      paper_id: paperId,
      title: root.find(".ms-md-4 strong").first().text().trim(),
      authors: root.find(".ms-md-4 span.fst-italic").first().text().trim().split(",").map((author) => author.trim()).filter(Boolean),
      abstract: root.find("p.search-abstract").first().text().trim(),
      doi: "",
      published_date: new Date("1900-01-01T00:00:00.000Z"),
      pdf_url: `${IACRSearcher.IACR_BASE_URL}/${paperId}.pdf`,
      url: `${IACRSearcher.IACR_BASE_URL}${paperLink.attr("href") ?? `/${paperId}`}`,
      source: "iacr",
      categories: [root.find("small.badge").first().text().trim()].filter(Boolean),
      keywords: [],
    });
  }
}
