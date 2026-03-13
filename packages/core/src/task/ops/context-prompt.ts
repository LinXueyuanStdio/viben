/**
 * Context Prompt Utilities
 *
 * Format jsonl context files into prompt text for agents.
 * Agents will read the files themselves using their tools.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ContextEntry } from "./types";

/**
 * Read and parse a jsonl file
 */
function readJsonlFile(filePath: string): ContextEntry[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const entries: ContextEntry[] = [];
    for (const line of content.split("\n")) {
      if (line.trim()) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Format context entries as a markdown list for prompts
 *
 * @param entries - Context entries from jsonl
 * @returns Formatted markdown list
 *
 * @example
 * ```
 * - docs/specs/backend/index.md (Backend development guide)
 * - docs/specs/frontend/index.md (Frontend development guide)
 * ```
 */
export function formatContextList(entries: ContextEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  return entries.map((e) => `- ${e.file} (${e.reason})`).join("\n");
}

/**
 * Read jsonl file and format as context list
 *
 * @param taskDir - Absolute path to task directory
 * @param jsonlName - Name of jsonl file (e.g., "implement.jsonl")
 * @returns Formatted context list or empty string if file doesn't exist
 */
export function getContextListFromJsonl(
  taskDir: string,
  jsonlName: string
): string {
  const jsonlPath = join(taskDir, jsonlName);
  const entries = readJsonlFile(jsonlPath);
  return formatContextList(entries);
}

/**
 * Build the "read these files" section for agent prompts
 *
 * @param taskDir - Absolute path to task directory
 * @param jsonlName - Name of jsonl file
 * @param sectionTitle - Title for the section (e.g., "Code-Spec Files to Read")
 * @returns Formatted section or empty string if no files
 */
export function buildContextSection(
  taskDir: string,
  jsonlName: string,
  sectionTitle: string = "Before starting, read these code-spec files"
): string {
  const contextList = getContextListFromJsonl(taskDir, jsonlName);

  if (!contextList) {
    return "";
  }

  return `## ${sectionTitle}

${contextList}

Read each file above using your Read tool before proceeding.`;
}

/**
 * Check if a jsonl context file exists and has entries
 *
 * @param taskDir - Absolute path to task directory
 * @param jsonlName - Name of jsonl file
 * @returns true if file exists and has at least one entry
 */
export function hasContextEntries(
  taskDir: string,
  jsonlName: string
): boolean {
  const jsonlPath = join(taskDir, jsonlName);
  const entries = readJsonlFile(jsonlPath);
  return entries.length > 0;
}
