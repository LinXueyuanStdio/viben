// packages/core/src/page/ops/discovery.ts

/**
 * Page discovery - scan pages/ directory and parse PAGE.md files
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type {
  PageConfig,
  PageIndex,
  StaticPageConfig,
  MarkdownPageConfig,
  ServerPageConfig,
  ProxyPageConfig,
} from "./types";

const PAGE_FILE = "PAGE.md";
const PAGES_DIR = "pages";
const INDEX_FILE = "index.json";

/**
 * Read index.json from workspace
 */
function readPageIndex(workspacePath: string): PageIndex {
  const indexPath = join(workspacePath, PAGES_DIR, INDEX_FILE);
  if (!existsSync(indexPath)) {
    return { root: [] };
  }
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return { root: [] };
  }
}

/**
 * Parse a PAGE.md file and extract page config
 */
export async function parsePageMd(
  pageMdPath: string,
  uid: string
): Promise<PageConfig | null> {
  if (!existsSync(pageMdPath)) {
    return null;
  }

  const content = readFileSync(pageMdPath, "utf-8");
  const { data, content: markdownContent } = matter(content);

  // Validate required fields
  if (!data.page?.type || !data.name) {
    return null;
  }

  const pageDir = join(pageMdPath, "..");

  // Process icon - read from top-level
  const iconValue = data.icon;

  // Get file modification time
  const updatedAt = statSync(pageMdPath).mtime.toISOString();

  const base = {
    uid,
    name: data.name,
    description: data.description,
    icon: iconValue,
    cover: data.cover,
    page_width: data.page_width,
    show_toc: data.show_toc,
    permission: data.page.permission ?? ["read", "write"],
    path: pageDir,
    skill_content: markdownContent.trim() || undefined,
    updated_at: updatedAt,
  };

  switch (data.page.type) {
    case "static":
      return {
        ...base,
        type: "static",
        file: data.page.file ?? "index.html",
      } as StaticPageConfig;

    case "markdown":
      return {
        ...base,
        type: "markdown",
      } as MarkdownPageConfig;

    case "server":
      if (!data.page.command) {
        console.warn(`[parsePageMd] server page "${uid}" missing required field: command`);
        return null;
      }
      return {
        ...base,
        type: "server",
        command: data.page.command,
        port: data.page.port,
        ready_pattern: data.page.ready_pattern,
        timeout: data.page.timeout ?? 300,
      } as ServerPageConfig;

    case "proxy":
      if (!data.page.url) {
        console.warn(`[parsePageMd] proxy page "${uid}" missing required field: url`);
        return null;
      }
      return {
        ...base,
        type: "proxy",
        url: data.page.url,
        headers: data.page.headers,
      } as ProxyPageConfig;

    default:
      return null;
  }
}

/**
 * List all pages in a workspace
 * Returns pages array and index structure
 */
export async function listPagesInWorkspace(workspacePath: string): Promise<{
  pages: PageConfig[];
  index: PageIndex;
}> {
  const pagesDir = join(workspacePath, PAGES_DIR);
  const index = readPageIndex(workspacePath);
  const pages: PageConfig[] = [];

  // Return empty if pages directory doesn't exist
  if (!existsSync(pagesDir)) {
    return { pages, index };
  }

  // Scan all directories in pages/
  const entries = readdirSync(pagesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip hidden directories and index.json
    if (entry.name.startsWith(".")) continue;

    const uid = entry.name;
    const pageMdPath = join(pagesDir, uid, PAGE_FILE);
    const page = await parsePageMd(pageMdPath, uid);

    if (page) {
      pages.push(page);
    }
  }

  return { pages, index };
}

/**
 * Get a specific page by uid
 */
export async function getPageByUid(
  workspacePath: string,
  uid: string
): Promise<PageConfig | null> {
  const pageMdPath = join(workspacePath, PAGES_DIR, uid, PAGE_FILE);
  return parsePageMd(pageMdPath, uid);
}
