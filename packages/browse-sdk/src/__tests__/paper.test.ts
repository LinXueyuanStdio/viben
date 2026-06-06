import { describe, expect, it } from "vitest";
import { Paper, paperToText, type PaperData } from "../index";

describe("Paper", () => {
  it("serializes list fields and dates like browse_mcp Paper.to_dict", () => {
    const paper = new Paper({
      paper_id: "2106.12345",
      title: "A TypeScript Port",
      authors: ["Ada Lovelace", "Alan Turing"],
      abstract: "Abstract text",
      doi: "10.1000/example",
      published_date: new Date("2024-02-03T00:00:00.000Z"),
      updated_date: new Date("2024-02-04T00:00:00.000Z"),
      pdf_url: "https://example.test/paper.pdf",
      url: "https://example.test/paper",
      source: "arxiv",
      categories: ["cs.AI", "cs.SE"],
      keywords: ["agents", "mcp"],
      citations: 7,
      references: ["10.1000/ref"],
      extra: { publisher: "Example Press" },
    });

    expect(paper.toDict()).toEqual({
      paper_id: "2106.12345",
      title: "A TypeScript Port",
      authors: "Ada Lovelace; Alan Turing",
      abstract: "Abstract text",
      doi: "10.1000/example",
      published_date: "2024-02-03T00:00:00.000Z",
      pdf_url: "https://example.test/paper.pdf",
      url: "https://example.test/paper",
      source: "arxiv",
      updated_date: "2024-02-04T00:00:00.000Z",
      categories: "cs.AI; cs.SE",
      keywords: "agents; mcp",
      citations: 7,
      references: "10.1000/ref",
      extra: "{\"publisher\":\"Example Press\"}",
    });
  });

  it("renders only populated fields in the browse_mcp text format", () => {
    const data: PaperData = {
      paper_id: "abc",
      title: "Readable Paper",
      authors: ["Grace Hopper"],
      abstract: "Important.",
      doi: "",
      published_date: "2024-01-02",
      pdf_url: "",
      url: "https://example.test/abc",
      source: "crossref",
      categories: [],
      keywords: [],
      citations: 0,
    };

    expect(paperToText(data)).toBe(
      [
        "Source: 'crossref'",
        "Paper ID: 'abc'",
        "Title: Readable Paper",
        "Authors: Grace Hopper",
        "Abstract: Important.",
        "Published Date: 2024-01-02",
        "URL: https://example.test/abc",
      ].join("\n")
    );
  });
});
