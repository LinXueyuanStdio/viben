import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { extractPdfPages, type ReadOptions } from "../types";

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) VibenBrowse/0.1";

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: "application/json",
      ...options.headers,
    },
    timeoutMs: options.timeoutMs,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return await response.json() as T;
}

export async function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml,text/xml",
      ...options.headers,
    },
    timeoutMs: options.timeoutMs,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return await response.text();
}

export async function downloadToFile(url: string, savePath: string, filename: string, headers: Record<string, string> = {}): Promise<string> {
  await mkdir(savePath, { recursive: true });
  const response = await fetchWithTimeout(url, {
    headers: {
      "user-agent": USER_AGENT,
      ...headers,
    },
    timeoutMs: 60_000,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const output = join(savePath, filename);
  await writeFile(output, buffer);
  return output;
}

export async function readExistingOrDownload(
  pdfPath: string,
  download: () => Promise<string>,
  options: ReadOptions = {}
): Promise<string> {
  const path = existsSync(pdfPath) ? pdfPath : await download();
  const text = await extractPdfPages(path, options);
  return text.trim();
}

export function parseXml<T>(xml: string): T {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "text",
    trimValues: true,
    parseTagValue: false,
  });
  return parser.parse(xml) as T;
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function parseDate(value: unknown, fallback = new Date()): Date {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const formats = [
    value,
    `${value}-01`,
    `${value}-01-01`,
  ];
  for (const candidate of formats) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return fallback;
}

export function sanitizeFilename(value: string): string {
  return value.replace(/[\/\\:*?"<>|]/g, "_");
}

export function buildUrl(base: string, params: Record<string, unknown>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function unsupportedSearch(): [] {
  return [];
}

export function localPdfPath(savePath: string, fileName: string): string {
  return join(savePath, fileName);
}
