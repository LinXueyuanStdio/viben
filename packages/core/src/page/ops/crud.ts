// packages/core/src/page/ops/crud.ts

/**
 * Page CRUD operations
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  PageOrderData,
  ReorderPagesOptions,
  ReorderPagesResult,
  DuplicatePageOptions,
  DuplicatePageResult,
} from "./types";
import { listPagesInWorkspace, getPageBySlug } from "./discovery";
import { loadTemplateFiles, getTemplate } from "./templates";

const PAGES_DIR = "pages";
const SKILL_FILE = "SKILL.md";

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
    };
  }

  const pages = await listPagesInWorkspace(workspace_path);
  const pageOrder = getPageOrder(workspace_path);

  return {
    success: true,
    pages,
    count: pages.length,
    page_order: Object.keys(pageOrder).length > 0 ? pageOrder : undefined,
  };
}

// =============================================================================
// View Page
// =============================================================================

export interface ViewPageOptions {
  workspace_path: string;
  slug: string;
}

export async function viewPage(
  options: ViewPageOptions
): Promise<ViewPageResult> {
  const { workspace_path, slug } = options;

  const page = await getPageBySlug(workspace_path, slug);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
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

import type { IconData } from "./types";

export interface CreatePageOptions {
  workspace_path: string;
  slug: string;
  name: string;
  description?: string;
  icon?: IconData;
  type: "static" | "markdown" | "server" | "proxy";
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
  const { workspace_path, slug, name, description = "", icon, type, template_id } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  // Check if page already exists
  if (existsSync(skillPath)) {
    return {
      success: false,
      error: `Page already exists: ${slug}`,
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

    const vars = { name, slug, description };
    const files = loadTemplateFiles(template_id, vars, workspace_path);

    for (const [filePath, content] of files) {
      const fullPath = join(pageDir, filePath);
      // Ensure parent directory exists for nested files
      const parentDir = dirname(fullPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      writeFileSync(fullPath, content, "utf-8");
    }

    // Return created page
    const page = await getPageBySlug(workspace_path, slug);

    return {
      success: true,
      page: page ?? undefined,
    };
  }

  // Build SKILL.md content (default behavior without template)
  let skillContent = "---\n";
  skillContent += "page:\n";
  skillContent += `  type: ${type}\n`;

  if (type === "static") {
    const file = options.file ?? "index.html";
    skillContent += `  file: ${file}\n`;
    skillContent += "  permission: [read, write]\n";
  } else if (type === "markdown") {
    // Markdown type: no file field needed
    skillContent += "  permission: [read, write]\n";
  } else if (type === "server") {
    skillContent += `  command: "${options.command ?? "pnpm dev"}"\n`;
    if (options.port) {
      skillContent += `  port: ${options.port}\n`;
    }
    skillContent += "  permission: [read, write]\n";
  } else if (type === "proxy") {
    skillContent += `  url: "${options.url ?? "https://example.com"}"\n`;
    skillContent += "  permission: [read]\n";
  }

  skillContent += `name: "${name}"\n`;
  if (description) {
    skillContent += `description: "${description}"\n`;
  }
  if (icon) {
    // Write icon as YAML structure
    skillContent += `icon:\n`;
    skillContent += `  type: ${icon.type}\n`;
    skillContent += `  value: "${icon.value}"\n`;
  }
  skillContent += "---\n\n";
  skillContent += `# ${name}\n\n`;
  skillContent += description || "Page description here.";

  // Write SKILL.md
  writeFileSync(skillPath, skillContent, "utf-8");

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

  // Return created page
  const page = await getPageBySlug(workspace_path, slug);

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
  slug: string;
}

export async function deletePage(
  options: DeletePageOptions
): Promise<DeletePageResult> {
  const { workspace_path, slug } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);

  if (!existsSync(pageDir)) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  // Remove directory recursively
  rmSync(pageDir, { recursive: true, force: true });

  return {
    success: true,
    slug,
  };
}

// =============================================================================
// Update Page Content (preserves YAML frontmatter)
// =============================================================================

export interface UpdatePageContentOptions {
  workspace_path: string;
  slug: string;
  content: string;
}

export async function updatePageContent(
  options: UpdatePageContentOptions
): Promise<UpdatePageContentResult> {
  const { workspace_path, slug, content } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  if (!existsSync(skillPath)) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  // Read existing file and extract frontmatter
  const existing = readFileSync(skillPath, "utf-8");
  const matter = (await import("gray-matter")).default;
  const { data } = matter(existing);

  // Rebuild SKILL.md with original frontmatter + new content
  const result = matter.stringify(content, data);
  writeFileSync(skillPath, result, "utf-8");

  return {
    success: true,
    slug,
  };
}

// =============================================================================
// Update Page Config (updates YAML frontmatter, preserves markdown body)
// =============================================================================

export async function updatePageConfig(
  options: UpdatePageConfigOptions
): Promise<UpdatePageConfigResult> {
  const { workspace_path, slug, name, description, icon, cover, page_width, show_toc } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const pageDir = join(pagesDir, slug);
  const skillPath = join(pageDir, SKILL_FILE);

  if (!existsSync(skillPath)) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  // Read existing file and extract frontmatter + content
  const existing = readFileSync(skillPath, "utf-8");
  const matter = (await import("gray-matter")).default;
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

  // Rebuild SKILL.md with updated frontmatter + original content
  const updated = matter.stringify(content, data);
  writeFileSync(skillPath, updated, "utf-8");

  // Return updated page config
  const page = await getPageBySlug(workspace_path, slug);
  return {
    success: true,
    slug,
    page: page ?? undefined,
  };
}

// =============================================================================
// Duplicate Page
// =============================================================================

/**
 * Duplicate a page by copying its entire directory with a new slug.
 * The new slug is generated by appending "-copy" (or "-copy-N") to the original.
 * The name in frontmatter is updated to append " (Copy)".
 */
export async function duplicatePage(
  options: DuplicatePageOptions
): Promise<DuplicatePageResult> {
  const { workspace_path, slug } = options;

  const pagesDir = join(workspace_path, PAGES_DIR);
  const sourceDir = join(pagesDir, slug);

  if (!existsSync(sourceDir)) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
    };
  }

  // Read the original page name BEFORE copying
  const originalPage = await getPageBySlug(workspace_path, slug);
  const originalName = originalPage?.name ?? slug;

  // Generate a unique slug for the copy
  let newSlug = `${slug}-copy`;
  let counter = 2;
  while (existsSync(join(pagesDir, newSlug))) {
    newSlug = `${slug}-copy-${counter}`;
    counter++;
  }

  const targetDir = join(pagesDir, newSlug);

  // Copy the entire directory recursively
  const { cpSync } = await import("node:fs");
  cpSync(sourceDir, targetDir, { recursive: true });

  // Update the name in the COPY's SKILL.md to indicate it's a duplicate.
  // Use a targeted regex replacement instead of gray-matter.stringify to avoid
  // reformatting the entire YAML (which could corrupt the original on APFS clones).
  const skillPath = join(targetDir, SKILL_FILE);
  if (existsSync(skillPath)) {
    const raw = readFileSync(skillPath, "utf-8");
    const newName = `${originalName} (Copy)`;
    // Replace the name field in YAML frontmatter (handles both quoted and unquoted)
    const updated = raw.replace(
      /^(name:\s*)(["']?)(.+?)\2\s*$/m,
      `$1"${newName}"`
    );
    writeFileSync(skillPath, updated, "utf-8");
  }

  // Return the newly created page
  const page = await getPageBySlug(workspace_path, newSlug);

  return {
    success: true,
    page: page ?? undefined,
  };
}

// =============================================================================
// Upload Page Asset
// =============================================================================

export interface UploadPageAssetOptions {
  workspace_path: string;
  slug: string;
  filename: string;
  data: Buffer;
}

// =============================================================================
// Reorder Pages
// =============================================================================

const PAGE_ORDER_FILE = ".page-order.json";

/**
 * Read the page order data from .page-order.json
 */
export function getPageOrder(workspacePath: string): PageOrderData {
  const orderPath = join(workspacePath, PAGES_DIR, PAGE_ORDER_FILE);
  if (!existsSync(orderPath)) {
    return {};
  }
  try {
    const raw = readFileSync(orderPath, "utf-8");
    return JSON.parse(raw) as PageOrderData;
  } catch {
    return {};
  }
}

/**
 * Reorder pages within a parent level.
 * Writes to {workspace}/pages/.page-order.json
 */
export async function reorderPages(
  options: ReorderPagesOptions
): Promise<ReorderPagesResult> {
  const { workspace_path, parent_slug, ordered_slugs } = options;

  if (!existsSync(workspace_path)) {
    return {
      success: false,
      error: `Workspace not found: ${workspace_path}`,
    };
  }

  const pagesDir = join(workspace_path, PAGES_DIR);
  if (!existsSync(pagesDir)) {
    mkdirSync(pagesDir, { recursive: true });
  }

  const orderPath = join(pagesDir, PAGE_ORDER_FILE);

  // Read existing order data
  const orderData = getPageOrder(workspace_path);

  // Key: "root" for top-level, or the parent slug
  const key = parent_slug ?? "root";
  orderData[key] = ordered_slugs;

  // Write back with pretty-print (git-friendly)
  writeFileSync(orderPath, JSON.stringify(orderData, null, 2) + "\n", "utf-8");

  return { success: true };
}

// =============================================================================
// Upload Page Asset
// =============================================================================

export async function uploadPageAsset(
  options: UploadPageAssetOptions
): Promise<UploadPageAssetResult> {
  const { workspace_path, slug, filename, data } = options;

  const page = await getPageBySlug(workspace_path, slug);

  if (!page) {
    return {
      success: false,
      error: `Page not found: ${slug}`,
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
