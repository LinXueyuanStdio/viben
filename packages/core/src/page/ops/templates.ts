// packages/core/src/page/ops/templates.ts

/**
 * Page templates - load and render page templates
 *
 * 双层查找机制:
 * 1. 优先查找用户自定义模板: <workspace>/docs/page-templates/
 * 2. 回退到内置模板: packages/core/templates/pages/
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import type {
  ApplyPageTemplateOptions,
  ApplyPageTemplateResult,
  PageTemplate,
  PageType,
  TemplateVars,
  ListTemplatesResult,
} from "./types";
import { getTemplatesDir } from "../../utils/templates";
import { getPageByUid } from "./discovery";
import { assertSafePageUid, resolveExistingPageDir } from "./page-paths";
import { writeTemplateFilesToPageDir } from "./template-files";

export const CUSTOM_PAGE_TEMPLATES_DIR = "docs/page-templates";
export const BUILTIN_TEMPLATE_IDS = ["static-html", "markdown-docs"] as const;

function getBuiltinTemplatesDir(): string {
  const templatesDir = getTemplatesDir(import.meta.url);
  return join(templatesDir, "pages");
}

function getCustomTemplatesDir(workspacePath: string): string {
  return join(workspacePath, CUSTOM_PAGE_TEMPLATES_DIR);
}

function getBuiltinTemplatePath(templateId: string): string {
  return join(getBuiltinTemplatesDir(), templateId);
}

function getCustomTemplatePath(workspacePath: string, templateId: string): string {
  return join(getCustomTemplatesDir(workspacePath), templateId);
}

function isBuiltinTemplateId(templateId: string): boolean {
  return (BUILTIN_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

function loadTemplateFromDir(
  templateDir: string,
  templateId: string,
  source: "builtin" | "custom"
): PageTemplate | null {
  const metadataPath = join(templateDir, "template.json");
  if (!existsSync(metadataPath)) return null;

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    return {
      id: templateId,
      name: metadata.name,
      description: metadata.description,
      type: metadata.type as PageType,
      default_config: metadata.default_config ?? {},
      install_command: metadata.install_command,
      source,
    };
  } catch {
    return null;
  }
}

export function getTemplate(
  templateId: string,
  workspacePath?: string
): PageTemplate | null {
  if (workspacePath) {
    const customPath = getCustomTemplatePath(workspacePath, templateId);
    if (existsSync(customPath)) {
      const source = isBuiltinTemplateId(templateId) ? "builtin" : "custom";
      return loadTemplateFromDir(customPath, templateId, source);
    }
  }

  if (isBuiltinTemplateId(templateId)) {
    const builtinPath = getBuiltinTemplatePath(templateId);
    if (existsSync(builtinPath)) {
      return loadTemplateFromDir(builtinPath, templateId, "builtin");
    }
  }

  return null;
}

export function listTemplates(workspacePath?: string): PageTemplate[] {
  const templates: PageTemplate[] = [];
  const seenIds = new Set<string>();

  if (workspacePath) {
    const customDir = getCustomTemplatesDir(workspacePath);
    if (existsSync(customDir)) {
      const entries = readdirSync(customDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const templateId = entry.name;
        const templateDir = join(customDir, templateId);
        const source = isBuiltinTemplateId(templateId) ? "builtin" : "custom";
        const template = loadTemplateFromDir(templateDir, templateId, source);
        if (template) {
          templates.push(template);
          seenIds.add(templateId);
        }
      }
    }
  }

  const builtinDir = getBuiltinTemplatesDir();
  if (existsSync(builtinDir)) {
    for (const templateId of BUILTIN_TEMPLATE_IDS) {
      if (seenIds.has(templateId)) continue;
      const builtinPath = getBuiltinTemplatePath(templateId);
      const template = loadTemplateFromDir(builtinPath, templateId, "builtin");
      if (template) {
        templates.push(template);
      }
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTemplate(content: string, vars: TemplateVars): string {
  return content
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{slug\}\}/g, vars.slug)
    .replace(/\{\{description\}\}/g, vars.description);
}

export function loadTemplateFiles(
  templateId: string,
  vars: TemplateVars,
  workspacePath?: string
): Map<string, string> {
  const files = new Map<string, string>();
  let templateDir: string | null = null;

  if (workspacePath) {
    const customPath = getCustomTemplatePath(workspacePath, templateId);
    if (existsSync(customPath)) {
      templateDir = customPath;
    }
  }

  if (!templateDir && isBuiltinTemplateId(templateId)) {
    const builtinPath = getBuiltinTemplatePath(templateId);
    if (existsSync(builtinPath)) {
      templateDir = builtinPath;
    }
  }

  if (!templateDir) return files;

  loadFilesRecursively(templateDir, templateDir, vars, files);
  return files;
}

function loadFilesRecursively(
  dir: string,
  baseDir: string,
  vars: TemplateVars,
  files: Map<string, string>
): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "template.json") continue;

    const fullPath = join(dir, entry.name);
    const relativePath = relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      loadFilesRecursively(fullPath, baseDir, vars, files);
    } else {
      const content = readFileSync(fullPath, "utf-8");
      const outputName = relativePath.endsWith(".hbs")
        ? relativePath.slice(0, -4)
        : relativePath;
      files.set(outputName, renderTemplate(content, vars));
    }
  }
}

export async function listTemplatesResult(
  workspacePath?: string
): Promise<ListTemplatesResult> {
  return {
    success: true,
    templates: listTemplates(workspacePath),
  };
}

export async function applyPageTemplate(
  options: ApplyPageTemplateOptions
): Promise<ApplyPageTemplateResult> {
  try {
    const { workspace_path, uid, template_id } = options;
    assertSafePageUid(uid);
    const page = await getPageByUid(workspace_path, uid);
    if (!page) {
      return { success: false, error: `Page not found: ${uid}` };
    }
    if (page.type !== "markdown") {
      return { success: false, error: "Template can only be applied to an empty markdown page" };
    }

    const pageDir = resolveExistingPageDir(workspace_path, uid);
    const skillPath = join(pageDir, "SKILL.md");
    if (!existsSync(skillPath)) {
      return { success: false, error: `Page SKILL.md not found: ${uid}` };
    }

    const parsed = matter(readFileSync(skillPath, "utf-8"));
    if (parsed.content.trim()) {
      return { success: false, error: "Template can only be applied to an empty page" };
    }

    const template = getTemplate(template_id, workspace_path);
    if (!template) {
      return { success: false, error: `Template not found: ${template_id}` };
    }

    const vars = {
      name: page.name,
      slug: uid,
      description: page.description ?? "",
    };
    const files = loadTemplateFiles(template_id, vars, workspace_path);
    if (files.size === 0) {
      return { success: false, error: `Template has no files: ${template_id}` };
    }

    writeTemplateFilesToPageDir(pageDir, files);
    const updated = await getPageByUid(workspace_path, uid);
    return { success: true, page: updated ?? undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply page template",
    };
  }
}
