const GOOGLE_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

let BrowsePaper;
try {
  ({ Paper: BrowsePaper } = require("@viben/browse-sdk"));
} catch {
  BrowsePaper = undefined;
}

class GoogleSearchSource {
  async search(query, options = {}) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID;
    const maxResults = Math.max(1, Math.min(Number(options.max_results || 10), 10));

    if (!apiKey || !cx) {
      return [
        createPaper({
          paper_id: "google_search:missing_credentials",
          title: "Google Search plugin is not configured",
          authors: [],
          abstract: "Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX to enable Google Custom Search results.",
          doi: "",
          published_date: new Date().toISOString(),
          pdf_url: "",
          url: "https://developers.google.com/custom-search/v1/overview",
          source: "google_search",
          categories: [],
          keywords: ["configuration"],
          citations: 0,
          references: [],
          extra: {
            query,
            required_env: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_CX"],
          },
        }),
      ];
    }

    const url = new URL(GOOGLE_SEARCH_API_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(maxResults));
    if (typeof options.safe === "string") {
      url.searchParams.set("safe", options.safe);
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "VibenBrowseGoogleSearchPlugin/0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Custom Search HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return (data.items || []).slice(0, maxResults).map((item) => {
      const link = typeof item.link === "string" ? item.link : "";
      return createPaper({
        paper_id: `google_search:${hashString(link || item.cacheId || item.title || query)}`,
        title: String(item.title || "Untitled result"),
        authors: [],
        abstract: String(item.snippet || ""),
        doi: "",
        published_date: new Date().toISOString(),
        pdf_url: link.toLowerCase().endsWith(".pdf") ? link : "",
        url: link,
        source: "google_search",
        categories: [],
        keywords: [],
        citations: 0,
        references: [],
        extra: {
          display_link: item.displayLink || "",
          formatted_url: item.formattedUrl || "",
          cache_id: item.cacheId || "",
        },
      });
    });
  }

  async downloadPdf(contentId, savePath) {
    return `Google Search does not download content directly. Open the URL from content_id '${contentId}' and save it manually under ${savePath}.`;
  }

  async download(contentId, savePath) {
    return this.downloadPdf(contentId, savePath);
  }

  readPaper(contentId) {
    return `Google Search does not read pages directly. Use the URL from search result '${contentId}' in a browser or a source-specific reader.`;
  }

  read(contentId) {
    return this.readPaper(contentId);
  }
}

function createPaper(data) {
  if (typeof BrowsePaper === "function") {
    return new BrowsePaper(data);
  }
  return data;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

module.exports = {
  source: new GoogleSearchSource(),
};
