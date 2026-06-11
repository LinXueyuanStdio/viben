// packages/core/src/page/ops/crud.ts

/**
 * Page CRUD operations
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { nanoid } from "nanoid";
import matter from "gray-matter";
import type {
  ListPagesResult,
  ViewPageResult,
  CreatePageResult,
  DeletePageResult,
  UpdatePageContentResult,
  UpdatePageConfigOptions,
  UpdatePageConfigResult,
  UploadPageAssetResult,
  PageConfig,
  PageIndex,
  ReorderPagesOptions,
  ReorderPagesResult,
  DuplicatePageOptions,
  DuplicatePageResult,
  IconData,
} from "./types";
import { listPagesInWorkspace, getPageByUid } from "./discovery";
import { loadTemplateFiles, getTemplate } from "./templates";

const PAGES_DIR = "pages";
const PAGE_FILE = "PAGE.md";
const INDEX_FILE = "index.json";

// =============================================================================
// UID Generation
// =============================================================================

function generatePageUid(slug?: string): string {
  const mmdd = new Date().toISOString().slice(5, 10).replace("-", "");
  return slug ? `${mmdd}-${slug}` : `${mmdd}-${nanoid(6)}`;
}

// =============================================================================
// Index Operations
// =============================================================================

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

function writePageIndex(workspacePath: string, index: PageIndex): void {
  const pagesDir = join(workspacePath, PAGES_DIR);
  if (!existsSync(pagesDir)) {
    mkdirSync(pagesDir, { recursive: true });
  }
  const indexPath = join(pagesDir, INDEX_FILE);
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
}

function removeUidFromIndex(index: PageIndex, uid: string): void {
  // Remove uid from all parent arrays
  for (const key of Object.keys(index)) {
    index[key] = index[key].filter((id) => id !== uid);
  }
  // Remove uid's own children entry
  delete index[uid];
}

// =============================================================================
// List Pages
// =============================================================================

export interface ListPagesOptions {
  workspace_path: string;
}

export async function listPages(
  options: ListPagesOptions
): Promise<ListPagesResult> {
  const { workspace_path } = options;

  if (!existsSync(workspace_path)) {
    return {
      success: false,
      error: `Workspace not found: ${workspace_path}`,
      pages: [],
      count: 0,
      index: { root: [] },
    };
  }

  const { pages, index } = await listPagesInWorkspace(workspace_path);

  return {
    success: true,
    pages,
    count: pages.length,
    index,
  };
}

// =============================================================================
// View Page
// =============================================================================

export interface ViewPageOptions {
  workspace_path: string;
  uid: string;
}

export async function viewPage(
  options: ViewPageOptions
): Promise<ViewPageResult> {
  const { workspace_path, uid } = options;

  const page = await getPageByUid(workspace_path, uid);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  return {
    success: true,
    page,
  };
}

// =============================================================================
// Create Page
// =============================================================================

export interface CreatePageOptions {
  workspace_path: string;
  slug?: string;
  name: string;
  description?: string;
  icon?: IconData;
  type: "static" | "markdown" | "server" | "proxy";
  parent_uid?: string;
  // Template support
  template_id?: string;
  // Static-specific
  file?: string;
  // Server-specific
  command?: string;
  port?: number;
  ready_pattern?: string;
  timeout?: number;
  // Proxy-specific
  url?: string;
  headers?: Record<string, string>;
}

export async function createPage(
  options: CreatePageOptions
): Promise<CreatePageResult> {
  const { workspace_path, slug, name, description = "", icon, type, template_id, parent_uid } = options;

  const uid = generatePageUid(slug);
  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, uid);
  const pageMdPath = join(pageDir, PAGE_FILE);

  // Check if page already exists
  if (existsSync(pageMdPath)) {
    return {
      success: false,
      error: `Page already exists: ${uid}`,
    };
  }

  // Create directory
  mkdirSync(pageDir, { recursive: true });

  // If template_id is provided, use template system
  if (template_id) {
    const template = getTemplate(template_id, workspace_path);
    if (!template) {
      return {
        success: false,
        error: `Template not found: ${template_id}`,
      };
    }

    const vars = { name, slug: uid, description };
    const files = loadTemplateFiles(template_id, vars, workspace_path);

    for (const [filePath, content] of files) {
      const fullPath = join(pageDir, filePath);
      // Ensure parent directory exists for nested files
      const parentDir = dirname(fullPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      // Rename SKILL.md to PAGE.md if template uses old name
      const finalPath = filePath === "SKILL.md" ? join(pageDir, PAGE_FILE) : fullPath;
      writeFileSync(finalPath, content, "utf-8");
    }
  } else {
    // Build PAGE.md content (default behavior without template)
    let pageContent = "---\n";
    pageContent += "page:\n";
    pageContent += `  type: ${type}\n`;

    if (type === "static") {
      const file = options.file ?? "index.html";
      pageContent += `  file: ${file}\n`;
      pageContent += "  permission: [read, write]\n";
    } else if (type === "markdown") {
      pageContent += "  permission: [read, write]\n";
    } else if (type === "server") {
      pageContent += `  command: "${options.command ?? "pnpm dev"}"\n`;
      if (options.port) {
        pageContent += `  port: ${options.port}\n`;
      }
      pageContent += "  permission: [read, write]\n";
    } else if (type === "proxy") {
      pageContent += `  url: "${options.url ?? "https://example.com"}"\n`;
      pageContent += "  permission: [read]\n";
    }

    pageContent += `name: "${name}"\n`;
    if (description) {
      pageContent += `description: "${description}"\n`;
    }
    if (icon) {
      pageContent += `icon:\n`;
      pageContent += `  type: ${icon.type}\n`;
      pageContent += `  value: "${icon.value}"\n`;
    }
    pageContent += "---\n\n";
    pageContent += `# ${name}\n\n`;
    pageContent += description || "Page description here.";

    writeFileSync(pageMdPath, pageContent, "utf-8");

    // For static type, create default index.html
    if (type === "static") {
      const file = options.file ?? "index.html";
      const htmlPath = join(pageDir, file);
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body>
  <h1>${name}</h1>
  <p>${description || "Welcome to the page."}</p>
</body>
</html>
`;
      writeFileSync(htmlPath, htmlContent, "utf-8");
    }
  }

  // Update index.json
  const index = readPageIndex(workspace_path);
  const parentKey = parent_uid ?? "root";
  index[parentKey] = index[parentKey] ?? [];
  index[parentKey].push(uid);
  writePageIndex(workspace_path, index);

  // Return created page
  const page = await getPageByUid(workspace_path, uid);

  return {
    success: true,
    page: page ?? undefined,
  };
}

// =============================================================================
// Delete Page
// =============================================================================

export interface DeletePageOptions {
  workspace_path: string;
  uid: string;
}

export async function deletePage(
  options: DeletePageOptions
): Promise<DeletePageResult> {
  const { workspace_path, uid } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, uid);

  if (!existsSync(pageDir)) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  // Remove directory recursively
  rmSync(pageDir, { recursive: true, force: true });

  // Update index.json
  const index = readPageIndex(workspace_path);
  removeUidFromIndex(index, uid);
  writePageIndex(workspace_path, index);

  return {
    success: true,
    uid,
    deleted_path: pageDir,
  };
}

// =============================================================================
// Update Page Content (preserves YAML frontmatter)
// =============================================================================

export interface UpdatePageContentOptions {
  workspace_path: string;
  uid: string;
  content: string;
}

export async function updatePageContent(
  options: UpdatePageContentOptions
): Promise<UpdatePageContentResult> {
  const { workspace_path, uid, content } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, uid);
  const pageMdPath = join(pageDir, PAGE_FILE);

  if (!existsSync(pageMdPath)) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  // Read existing file and extract frontmatter
  const existing = readFileSync(pageMdPath, "utf-8");
  const { data } = matter(existing);

  // Rebuild PAGE.md with original frontmatter + new content
  const result = matter.stringify(content, data);
  writeFileSync(pageMdPath, result, "utf-8");

  return {
    success: true,
    uid,
  };
}

// =============================================================================
// Update Page Config (updates YAML frontmatter, preserves markdown body)
// =============================================================================

export async function updatePageConfig(
  options: UpdatePageConfigOptions
): Promise<UpdatePageConfigResult> {
  const { workspace_path, uid, name, description, icon, cover, page_width, show_toc } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, uid);
  const pageMdPath = join(pageDir, PAGE_FILE);

  if (!existsSync(pageMdPath)) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  // Read existing file and extract frontmatter + content
  const existing = readFileSync(pageMdPath, "utf-8");
  const { data, content } = matter(existing);

  // Merge only provided fields into frontmatter
  if (name !== undefined) {
    data.name = name;
  }
  if (description !== undefined) {
    if (description === null) {
      delete data.description;
    } else {
      data.description = description;
    }
  }
  if (icon !== undefined) {
    if (icon === null) {
      delete data.icon;
    } else {
      data.icon = icon;
    }
  }
  if (cover !== undefined) {
    if (cover === null) {
      delete data.cover;
    } else {
      data.cover = cover;
    }
  }
  if (page_width !== undefined) {
    if (page_width === null) {
      delete data.page_width;
    } else {
      data.page_width = page_width;
    }
  }
  if (show_toc !== undefined) {
    if (show_toc === null) {
      delete data.show_toc;
    } else {
      data.show_toc = show_toc;
    }
  }

  // Rebuild PAGE.md with updated frontmatter + original content
  const updated = matter.stringify(content, data);
  writeFileSync(pageMdPath, updated, "utf-8");

  // Return updated page config
  const page = await getPageByUid(workspace_path, uid);
  return {
    success: true,
    uid,
    page: page ?? undefined,
  };
}

// =============================================================================
// Duplicate Page
// =============================================================================

/**
 * Duplicate a page by copying its entire directory with a new uid.
 * The name in frontmatter is updated to append " (Copy)".
 */
export async function duplicatePage(
  options: DuplicatePageOptions
): Promise<DuplicatePageResult> {
  const { workspace_path, uid } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const sourceDir = join(pagesDir, uid);

  if (!existsSync(sourceDir)) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  // Read the original page name BEFORE copying
  const originalPage = await getPageByUid(workspace_path, uid);
  const originalName = originalPage?.name ?? uid;

  // Generate a new uid for the copy
  const newUid = generatePageUid();
  const targetDir = join(pagesDir, newUid);

  // Copy the entire directory recursively
  cpSync(sourceDir, targetDir, { recursive: true });

  // Update the name in the COPY's PAGE.md
  const pageMdPath = join(targetDir, PAGE_FILE);
  if (existsSync(pageMdPath)) {
    const raw = readFileSync(pageMdPath, "utf-8");
    const newName = `${originalName} (Copy)`;
    const updated = raw.replace(
      /^(name:\s*)(["']?)(.+?)\2\s*$/m,
      `$1"${newName}"`
    );
    writeFileSync(pageMdPath, updated, "utf-8");
  }

  // Update index.json - add new uid to same parent as original
  const index = readPageIndex(workspace_path);
  // Find which parent contains the original uid
  let parentKey = "root";
  for (const key of Object.keys(index)) {
    if (index[key].includes(uid)) {
      parentKey = key;
      break;
    }
  }
  index[parentKey] = index[parentKey] ?? [];
  index[parentKey].push(newUid);
  writePageIndex(workspace_path, index);

  // Return the newly created page
  const page = await getPageByUid(workspace_path, newUid);

  return {
    success: true,
    page: page ?? undefined,
  };
}

// =============================================================================
// Reorder Pages
// =============================================================================

/**
 * Reorder pages within a parent level.
 * Directly modifies index.json
 */
export async function reorderPages(
  options: ReorderPagesOptions
): Promise<ReorderPagesResult> {
  const { workspace_path, parent_uid, ordered_uids } = options;

  if (!existsSync(workspace_path)) {
    return {
      success: false,
      error: `Workspace not found: ${workspace_path}`,
    };
  }

  const index = readPageIndex(workspace_path);
  const key = parent_uid ?? "root";
  index[key] = ordered_uids;
  writePageIndex(workspace_path, index);

  return { success: true };
}

// =============================================================================
// Upload Page Asset
// =============================================================================

export interface UploadPageAssetOptions {
  workspace_path: string;
  uid: string;
  filename: string;
  data: Buffer;
}

export async function uploadPageAsset(
  options: UploadPageAssetOptions
): Promise<UploadPageAssetResult> {
  const { workspace_path, uid, filename, data } = options;

  const page = await getPageByUid(workspace_path, uid);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${uid}`,
    };
  }

  const assetsDir = join(page.path, "_assets");

  // Create _assets directory if it doesn't exist
  await mkdir(assetsDir, { recursive: true });

  // Generate a unique filename to avoid collisions
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = join(assetsDir, uniqueFilename);

  await writeFile(filePath, data);

  return {
    success: true,
    filename: uniqueFilename,
  };
}
