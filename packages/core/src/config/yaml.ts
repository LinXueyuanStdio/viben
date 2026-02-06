/**
 * YAML file read/write utilities
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";

/**
 * Read and parse a YAML file
 * Returns undefined if file doesn't exist
 */
export async function readYaml<T>(path: string): Promise<T | undefined> {
  try {
    if (!existsSync(path)) {
      return undefined;
    }
    const content = await readFile(path, "utf-8");
    return parse(content) as T;
  } catch (error) {
    console.error(`Failed to read YAML file: ${path}`, error);
    return undefined;
  }
}

/**
 * Write data to a YAML file
 * Creates parent directories if they don't exist
 */
export async function writeYaml<T>(path: string, data: T): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const content = stringify(data, { indent: 2 });
  await writeFile(path, content, "utf-8");
}

/**
 * Read and parse a JSON file
 * Returns undefined if file doesn't exist
 */
export async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    if (!existsSync(path)) {
      return undefined;
    }
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Failed to read JSON file: ${path}`, error);
    return undefined;
  }
}

/**
 * Write data to a JSON file
 * Creates parent directories if they don't exist
 */
export async function writeJson<T>(path: string, data: T): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const content = JSON.stringify(data, null, 2);
  await writeFile(path, content, "utf-8");
}

/**
 * Ensure a directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
  return existsSync(path);
}
