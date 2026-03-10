/**
 * Markdown frontmatter utilities for Viben configuration files
 */
import matter from "gray-matter";
import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ensureDir, fileExists } from "./yaml";

/**
 * Parsed markdown config with frontmatter and body
 */
export interface MarkdownConfig<T> {
  frontmatter: T;
  body: string;
}

/**
 * Read a markdown file with YAML frontmatter
 *
 * @param path - Path to the markdown file
 * @returns Parsed frontmatter and body, or null if file doesn't exist
 */
export async function readMarkdownConfig<T>(path: string): Promise<MarkdownConfig<T> | null> {
  if (!fileExists(path)) {
    return null;
  }

  const content = await readFile(path, "utf-8");
  const { data, content: body } = matter(content);
  return { frontmatter: data as T, body: body.trim() };
}

/**
 * Recursively remove undefined values from an object
 * This is necessary because YAML serializers cannot handle undefined values
 */
function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as T;
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = removeUndefined(value);
      }
    }
    return result as T;
  }
  return obj;
}

/**
 * Write a markdown file with YAML frontmatter
 *
 * @param path - Path to the markdown file
 * @param frontmatter - YAML frontmatter data
 * @param body - Markdown body content
 */
export async function writeMarkdownConfig<T extends object>(
  path: string,
  frontmatter: T,
  body: string
): Promise<void> {
  await ensureDir(dirname(path));
  // Remove undefined values to avoid YAML serialization errors
  const cleanFrontmatter = removeUndefined(frontmatter);
  const content = matter.stringify(body, cleanFrontmatter as Record<string, unknown>);
  await writeFile(path, content, "utf-8");
}
