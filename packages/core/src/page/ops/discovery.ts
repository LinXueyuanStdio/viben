// packages/core/src/page/ops/discovery.ts

/**
 * Page discovery - scan pages/ directory and parse SKILL.md files
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { PageConfig, StaticPageConfig, MarkdownPageConfig, ServerPageConfig, ProxyPageConfig } from "./types";

const SKILL_FILE = "SKILL.md";
const PAGES_DIR = "pages";

/**
 * Parse a SKILL.md file and extract page config
 */
export async function parseSkillMd(
  skillPath: string,
  workspacePath: string
): Promise<PageConfig | null> {
  if (!existsSync(skillPath)) {
    return null;
  }

  const content = readFileSync(skillPath, "utf-8");
  const matter = (await import("gray-matter")).default;
  const { data, content: markdownContent } = matter(content);

  // Validate required fields
  if (!data.page?.type || !data.name) {
    return null;
  }

  const pageDir = join(skillPath, "..");
  const relativePath = relative(join(workspacePath, PAGES_DIR), pageDir);
  const slug = relativePath.replace(/\\/g, "/"); // Normalize for Windows

  // Process icon - read from top-level (icon is a top-level field, not inside page)
  const iconValue = data.icon;

  const base = {
    slug,
    name: data.name,
    description: data.description,
    icon: iconValue,
    permission: data.page.permission ?? ["read", "write"],
    path: pageDir,
    skill_content: markdownContent.trim() || undefined,
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
      // command 是必填字段
      if (!data.page.command) {
        console.warn(`[parseSkillMd] server page "${slug}" missing required field: command`);
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
      // url 是必填字段
      if (!data.page.url) {
        console.warn(`[parseSkillMd] proxy page "${slug}" missing required field: url`);
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
 * Recursively discover all pages in a directory
 */
export async function discoverPages(
  dir: string,
  workspacePath: string
): Promise<PageConfig[]> {
  const pages: PageConfig[] = [];

  if (!existsSync(dir)) {
    return pages;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const subDir = join(dir, entry.name);
    const skillPath = join(subDir, SKILL_FILE);

    // Check if this directory has a SKILL.md
    if (existsSync(skillPath)) {
      const page = await parseSkillMd(skillPath, workspacePath);
      if (page) {
        pages.push(page);
      }
    }

    // Recursively scan subdirectories
    const subPages = await discoverPages(subDir, workspacePath);
    pages.push(...subPages);
  }

  return pages;
}

/**
 * List all pages in a workspace
 */
export async function listPagesInWorkspace(workspacePath: string): Promise<PageConfig[]> {
  const pagesDir = join(workspacePath, PAGES_DIR);
  return await discoverPages(pagesDir, workspacePath);
}

/**
 * Get a specific page by slug
 */
export async function getPageBySlug(
  workspacePath: string,
  slug: string
): Promise<PageConfig | null> {
  const pagesDir = join(workspacePath, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  return await parseSkillMd(skillPath, workspacePath);
}