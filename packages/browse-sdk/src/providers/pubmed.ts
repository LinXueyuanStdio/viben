import { BasePaperSource, Paper, type ReadOptions, type SearchOptions } from "../types";
import { buildUrl, parseDate, parseXml, textOf, toArray } from "./utils";

/** A node that may be a plain string or an object with a `text` property (when XML attributes exist). */
type XmlTextNode = string | number | { text?: string | number; [attr: string]: unknown };

interface PubMedSearchXml {
  eSearchResult?: {
    IdList?: {
      Id?: XmlTextNode | XmlTextNode[];
    };
  };
}

interface PubMedFetchXml {
  PubmedArticleSet?: {
    PubmedArticle?: PubmedArticle | PubmedArticle[];
  };
}

interface PubmedArticle {
  MedlineCitation?: {
    PMID?: XmlTextNode;
    Article?: {
      ArticleTitle?: XmlTextNode;
      Abstract?: {
        AbstractText?: XmlTextNode | XmlTextNode[];
      };
      AuthorList?: {
        Author?: PubmedAuthor | PubmedAuthor[];
      };
      Journal?: {
        JournalIssue?: {
          PubDate?: {
            Year?: string;
          };
        };
      };
      ELocationID?: PubmedELocationId;
    };
  };
}

interface PubmedAuthor {
  LastName?: string;
  Initials?: string;
}

type PubmedELocationId = XmlTextNode | Array<{ text?: string; EIdType?: string }> | undefined;

export class PubMedSearcher extends BasePaperSource {
  static readonly SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  static readonly FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

  async search(query: string, options: SearchOptions = {}): Promise<Paper[]> {
    const searchXml = await fetch(buildUrl(PubMedSearcher.SEARCH_URL, {
      db: "pubmed",
      term: query,
      retmax: options.max_results ?? 10,
      retmode: "xml",
    })).then((response) => response.text());
    const ids = toArray(parseXml<PubMedSearchXml>(searchXml).eSearchResult?.IdList?.Id).map(textOf).filter(Boolean);
    if (ids.length === 0) {
      return [];
    }
    const fetchXml = await fetch(buildUrl(PubMedSearcher.FETCH_URL, {
      db: "pubmed",
      id: ids.join(","),
      retmode: "xml",
    })).then((response) => response.text());
    return toArray(parseXml<PubMedFetchXml>(fetchXml).PubmedArticleSet?.PubmedArticle).map((article) => this.parseArticle(article));
  }

  downloadPdf(): string {
    throw new Error("PubMed does not provide direct PDF downloads. Please use the paper's DOI or URL to access the publisher's website.");
  }

  readPaper(_paperId: string, _savePath = "./downloads", _options: ReadOptions = {}): string {
    return "PubMed papers cannot be read directly through this tool. Only metadata and abstracts are available through PubMed's API. Please use the paper's DOI or URL to access the full text on the publisher's website.";
  }

  private parseArticle(article: PubmedArticle): Paper {
    const medline = article.MedlineCitation;
    const data = medline?.Article;
    const pmid = textOf(medline?.PMID);
    const doi = extractDoi(data?.ELocationID);
    return new Paper({
      paper_id: pmid,
      title: textOf(data?.ArticleTitle),
      authors: toArray(data?.AuthorList?.Author)
        .map((author) => `${author.LastName ?? ""} ${author.Initials ?? ""}`.trim())
        .filter(Boolean),
      abstract: toArray(data?.Abstract?.AbstractText).map(textOf).filter(Boolean).join(" "),
      doi,
      published_date: parseDate(data?.Journal?.JournalIssue?.PubDate?.Year),
      pdf_url: "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: "pubmed",
      categories: [],
      keywords: [],
    });
  }
}

function extractDoi(value: PubmedELocationId): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  // Single object with EIdType (not wrapped in array)
  if (!Array.isArray(value) && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.EIdType === "doi") {
      return textOf(obj.text ?? obj);
    }
    // If it's a text node without EIdType, just extract text
    return textOf(value);
  }
  // Array of ELocationID elements
  const match = toArray(value).find((item) => typeof item === "object" && item.EIdType === "doi");
  return typeof match === "object" ? String(match.text ?? "") : "";
}
