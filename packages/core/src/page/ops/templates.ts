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
import type { PageTemplate, PageType, TemplateVars, ListTemplatesResult } from "./types";
import { getTemplatesDir } from "../../utils/templates";

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
