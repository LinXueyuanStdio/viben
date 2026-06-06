import { readFile } from "node:fs/promises";

export interface PaperData {
  paper_id: string;
  title: string;
  authors?: string[];
  abstract?: string;
  doi?: string;
  published_date?: Date | string | null;
  pdf_url?: string;
  url?: string;
  source: string;
  updated_date?: Date | string | null;
  categories?: string[];
  keywords?: string[];
  citations?: number;
  references?: string[];
  extra?: Record<string, unknown> | null;
}

export interface PaperDict {
  paper_id: string;
  title: string;
  authors: string;
  abstract: string;
  doi: string;
  published_date: string;
  pdf_url: string;
  url: string;
  source: string;
  updated_date: string;
  categories: string;
  keywords: string;
  citations: number;
  references: string;
  extra: string;
}

export interface SearchOptions {
  max_results?: number;
  fetch_details?: boolean;
  year?: string;
  kwargs?: Record<string, unknown>;
  days?: number;
  [key: string]: unknown;
}

export interface ReadOptions {
  page?: number;
  start_page?: number;
  end_page?: number;
}

export interface ContentSource<T> {
  search(query: string, options?: SearchOptions): Promise<T[]> | T[];
  download(contentId: string, savePath: string): Promise<string> | string;
  read(contentId: string, savePath: string, options?: ReadOptions): Promise<string> | string;
}

export interface PaperSource extends ContentSource<Paper> {
  search(query: string, options?: SearchOptions): Promise<Paper[]> | Paper[];
  downloadPdf(paperId: string, savePath: string): Promise<string> | string;
  readPaper(paperId: string, savePath: string, options?: ReadOptions): Promise<string> | string;
  download(contentId: string, savePath: string): Promise<string> | string;
  read(contentId: string, savePath: string, options?: ReadOptions): Promise<string> | string;
}

export class Paper {
  paper_id: string;
  title: string;
  authors: string[];
  abstract: string;
  doi: string;
  published_date: Date | string | null;
  pdf_url: string;
  url: string;
  source: string;
  updated_date: Date | string | null;
  categories: string[];
  keywords: string[];
  citations: number;
  references: string[];
  extra: Record<string, unknown>;

  constructor(data: PaperData) {
    this.paper_id = data.paper_id;
    this.title = data.title;
    this.authors = data.authors ?? [];
    this.abstract = data.abstract ?? "";
    this.doi = data.doi ?? "";
    this.published_date = data.published_date ?? null;
    this.pdf_url = data.pdf_url ?? "";
    this.url = data.url ?? "";
    this.source = data.source;
    this.updated_date = data.updated_date ?? null;
    this.categories = data.categories ?? [];
    this.keywords = data.keywords ?? [];
    this.citations = data.citations ?? 0;
    this.references = data.references ?? [];
    this.extra = data.extra ?? {};
  }

  toDict(): PaperDict {
    return {
      paper_id: this.paper_id,
      title: this.title,
      authors: joinList(this.authors),
      abstract: this.abstract,
      doi: this.doi,
      published_date: formatDateTime(this.published_date),
      pdf_url: this.pdf_url,
      url: this.url,
      source: this.source,
      updated_date: formatDateTime(this.updated_date),
      categories: joinList(this.categories),
      keywords: joinList(this.keywords),
      citations: this.citations,
      references: joinList(this.references),
      extra: Object.keys(this.extra).length > 0 ? JSON.stringify(this.extra) : "",
    };
  }

  toText(): string {
    return paperToText(this);
  }
}

export abstract class BasePaperSource implements PaperSource {
  abstract search(query: string, options?: SearchOptions): Promise<Paper[]> | Paper[];

  download(contentId: string, savePath: string): Promise<string> | string {
    return this.downloadPdf(contentId, savePath);
  }

  read(contentId: string, savePath: string, options: ReadOptions = {}): Promise<string> | string {
    return this.readPaper(contentId, savePath, options);
  }

  abstract downloadPdf(paperId: string, savePath: string): Promise<string> | string;

  abstract readPaper(paperId: string, savePath: string, options?: ReadOptions): Promise<string> | string;
}

export function paperToText(input: Paper | PaperData): string {
  const paper = input instanceof Paper ? input : new Paper(input);
  const lines: string[] = [];
  if (paper.source) {
    lines.push(`Source: '${paper.source}'`);
  }
  if (paper.paper_id) {
    lines.push(`Paper ID: '${paper.paper_id}'`);
  }
  if (paper.title) {
    lines.push(`Title: ${paper.title}`);
  }
  if (paper.authors.length > 0) {
    lines.push(`Authors: ${joinList(paper.authors)}`);
  }
  if (paper.abstract) {
    lines.push(`Abstract: ${paper.abstract}`);
  }
  if (paper.published_date) {
    lines.push(`Published Date: ${formatDateOnly(paper.published_date)}`);
  }
  if (paper.url) {
    lines.push(`URL: ${paper.url}`);
  }
  if (paper.doi) {
    lines.push(`DOI: ${paper.doi}`);
  }
  if (paper.categories.length > 0) {
    lines.push(`Categories: ${joinList(paper.categories)}`);
  }
  if (paper.keywords.length > 0) {
    lines.push(`Keywords: ${joinList(paper.keywords)}`);
  }
  if (paper.citations) {
    lines.push(`Citations: ${paper.citations}`);
  }
  if (paper.references.length > 0) {
    lines.push(`References: ${joinList(paper.references)}`);
  }
  if (Object.keys(paper.extra).length > 0) {
    lines.push(`Extra Info: ${JSON.stringify(paper.extra)}`);
  }
  return lines.length > 0 ? lines.join("\n") : JSON.stringify(paper.toDict());
}

export async function extractPdfPages(
  pdfPath: string,
  options: ReadOptions = {}
): Promise<string> {
  const buffer = await readFile(pdfPath);
  const text = buffer.toString("latin1");
  const readable = extractBestEffortPdfText(text);
  if (!readable.trim()) {
    return "";
  }
  const pages = splitBestEffortPages(readable);
  const selected = selectPages(pages, options);
  return selected.map((pageText, index) => `--- Page ${index + 1} ---\n${pageText}`).join("\n\n");
}

function selectPages(pages: string[], options: ReadOptions): string[] {
  if (options.page !== undefined) {
    const pageIndex = options.page - 1;
    return pageIndex >= 0 && pageIndex < pages.length ? [pages[pageIndex]] : [];
  }
  const start = Math.max((options.start_page ?? 1) - 1, 0);
  const end = options.end_page ?? pages.length;
  return pages.slice(start, Math.min(end, pages.length));
}

function splitBestEffortPages(text: string): string[] {
  const pages = text.split(/\f+/).map((page) => page.trim()).filter(Boolean);
  return pages.length > 0 ? pages : [text.trim()];
}

function extractBestEffortPdfText(raw: string): string {
  return raw
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, "\n")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinList(items: string[]): string {
  return items.filter(Boolean).join("; ");
}

function formatDateOnly(value: Date | string | null): string {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return parsed.toISOString().slice(0, 10);
  }
  return value;
}

function formatDateTime(value: Date | string | null): string {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
