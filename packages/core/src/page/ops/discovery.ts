// packages/core/src/page/ops/discovery.ts

/**
 * Page discovery - scan pages/ directory and parse SKILL.md files
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { resolveExistingPageDir } from "./page-paths";
import type {
  PageConfig,
  PageIndex,
  StaticPageConfig,
  MarkdownPageConfig,
  ServerPageConfig,
  ProxyPageConfig,
} from "./types";

const SKILL_FILE = "SKILL.md";
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
 * Parse a SKILL.md file and extract page config
 *
 * New frontmatter structure:
 * ```yaml
 * name: finance
 * description: 金融 demo
 * metadata:
 *   icon:
 *     type: emoji
 *     value: "\U0001F44D\U0001F3FC"
 *   cover: 'gradient:sky'
 *   page:
 *     type: static
 *     file: index.html
 *     permission:
 *       - read
 *       - write
 * ```
 */
export async function parseSkillMd(
  skillMdPath: string,
  uid: string
): Promise<PageConfig | null> {
  if (!existsSync(skillMdPath)) {
    return null;
  }

  const content = readFileSync(skillMdPath, "utf-8");
  const { data, content: markdownContent } = matter(content);

  // Validate required fields - page config is now under metadata.page
  const pageData = data.metadata?.page;
  if (!pageData?.type || typeof data.name !== "string") {
    return null;
  }

  const pageDir = join(skillMdPath, "..");

  // Process icon and cover - now under metadata
  const iconValue = data.metadata?.icon;
  const coverValue = data.metadata?.cover;
  const pageWidth = data.metadata?.page_width;
  const showToc = data.metadata?.show_toc;

  // Get file modification time
  const updatedAt = statSync(skillMdPath).mtime.toISOString();

  const base = {
    uid,
    name: data.name,
    description: data.description,
    icon: iconValue,
    cover: coverValue,
    page_width: pageWidth,
    show_toc: showToc,
    permission: pageData.permission ?? ["read", "write"],
    path: pageDir,
    skill_content: markdownContent.trim() ? markdownContent.trim() : "",
    updated_at: updatedAt,
  };

  switch (pageData.type) {
    case "static":
      return {
        ...base,
        type: "static",
        file: pageData.file ?? "index.html",
      } as StaticPageConfig;

    case "markdown":
      return {
        ...base,
        type: "markdown",
      } as MarkdownPageConfig;

    case "server":
      if (!pageData.command) {
        console.warn(`[parseSkillMd] server page "${uid}" missing required field: command`);
        return null;
      }
      return {
        ...base,
        type: "server",
        command: pageData.command,
        port: pageData.port,
        ready_pattern: pageData.ready_pattern,
        timeout: pageData.timeout ?? 300,
      } as ServerPageConfig;

    case "proxy":
      if (!pageData.url) {
        console.warn(`[parseSkillMd] proxy page "${uid}" missing required field: url`);
        return null;
      }
      return {
        ...base,
        type: "proxy",
        url: pageData.url,
        headers: pageData.headers,
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
    const skillMdPath = join(pagesDir, uid, SKILL_FILE);
    const page = await parseSkillMd(skillMdPath, uid);

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
  let pageDir: string;
  try {
    pageDir = resolveExistingPageDir(workspacePath, uid);
  } catch {
    return null;
  }
  const skillMdPath = join(pageDir, SKILL_FILE);
  return parseSkillMd(skillMdPath, uid);
}
