/**
 * Task context file operations
 *
 * Manage context JSONL files: implement.jsonl, check.jsonl, fix.jsonl
 */

import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  resolveTaskDirectory,
  readJsonlFile,
  writeJsonlFile,
  appendToJsonl,
  jsonlEntryExists,
  updateTaskField,
  DIR_VIBEN,
} from "../../cli/lib/viben-workspace";

import type { ContextEntry } from "./types";

// =============================================================================
// Result Types
// =============================================================================

export interface ContextInitResult {
  success: boolean;
  taskDir: string;
  files: {
    implement: number;
    check: number;
    fix: number;
  };
  error?: string;
}

export interface ContextAddResult {
  success: boolean;
  added: number;
  skipped: number;
  total: number;
  error?: string;
}

export interface ContextRemoveResult {
  success: boolean;
  removed: string[];
  error?: string;
}

export interface ContextListResult {
  success: boolean;
  context: Record<string, ContextEntry[]>;
  error?: string;
}

export interface ContextValidateResult {
  success: boolean;
  valid: string[];
  missing: string[];
  error?: string;
}

// =============================================================================
// Context File Operations
// =============================================================================

/**
 * Initialize empty context files for a task
 *
 * Creates empty implement.jsonl, check.jsonl, and fix.jsonl files.
 * These will be populated by research agent via add-context.
 */
export function initContext(
  repoRoot: string,
  taskName: string
): ContextInitResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      taskDir: taskName,
      files: { implement: 0, check: 0, fix: 0 },
      error: `Task not found: ${taskName}`,
    };
  }

  // Create empty jsonl files - research agent will populate them
  const implementFile = join(taskDir, "implement.jsonl");
  const checkFile = join(taskDir, "check.jsonl");
  const fixFile = join(taskDir, "fix.jsonl");

  // Initialize with empty arrays (creates empty files)
  writeJsonlFile(implementFile, []);
  writeJsonlFile(checkFile, []);
  writeJsonlFile(fixFile, []);

  return {
    success: true,
    taskDir,
    files: {
      implement: 0,
      check: 0,
      fix: 0,
    },
  };
}

/**
 * Add context files to a task
 */
export function addContext(
  repoRoot: string,
  taskName: string,
  files: string[],
  options: { reason?: string; recursive?: boolean; contextType?: "implement" | "check" | "fix" } = {}
): ContextAddResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      added: 0,
      skipped: 0,
      total: files.length,
      error: `Task not found: ${taskName}`,
    };
  }

  const contextType = options.contextType || "implement";
  const contextFile = join(taskDir, `${contextType}.jsonl`);
  const reason = options.reason || "Added by user";

  let addedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    // Skip if already exists
    if (jsonlEntryExists(contextFile, file)) {
      skippedCount++;
      continue;
    }

    // Determine type
    let type: "file" | "directory" | undefined;
    const fullPath = join(repoRoot, file);
    if (existsSync(fullPath)) {
      type = statSync(fullPath).isDirectory() ? "directory" : "file";
    }

    const entry: ContextEntry = { file, reason };
    if (type) {
      entry.type = type;
    }

    appendToJsonl(contextFile, entry as unknown as Record<string, unknown>);
    addedCount++;
  }

  return {
    success: true,
    added: addedCount,
    skipped: skippedCount,
    total: files.length,
  };
}

/**
 * Remove context files from a task
 */
export function removeContext(
  repoRoot: string,
  taskName: string,
  files: string[]
): ContextRemoveResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir) {
    return {
      success: false,
      removed: [],
      error: `Task not found: ${taskName}`,
    };
  }

  for (const jsonlName of ["implement.jsonl", "check.jsonl", "fix.jsonl"]) {
    const jsonlPath = join(taskDir, jsonlName);
    if (!existsSync(jsonlPath)) continue;

    const content = readFileSync(jsonlPath, "utf-8");
    const lines = content.split("\n").filter((line) => {
      if (!line.trim()) return false;
      try {
        const entry = JSON.parse(line);
        return !files.includes(entry.file);
      } catch {
        return true;
      }
    });

    writeFileSync(jsonlPath, lines.join("\n") + "\n", "utf-8");
  }

  return {
    success: true,
    removed: files,
  };
}

/**
 * List context entries for a task
 */
export function listContext(
  repoRoot: string,
  taskName: string
): ContextListResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      context: {},
      error: `Task not found: ${taskName}`,
    };
  }

  const contextFiles = ["implement.jsonl", "check.jsonl", "fix.jsonl"];
  const result: Record<string, ContextEntry[]> = {};

  for (const fileName of contextFiles) {
    const filePath = join(taskDir, fileName);
    if (existsSync(filePath)) {
      result[fileName] = readJsonlFile(filePath) as unknown as ContextEntry[];
    }
  }

  return {
    success: true,
    context: result,
  };
}

/**
 * Validate context files (check referenced files exist)
 */
export function validateContext(
  repoRoot: string,
  taskName: string
): ContextValidateResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      valid: [],
      missing: [],
      error: `Task not found: ${taskName}`,
    };
  }

  const contextFiles = ["implement.jsonl", "check.jsonl", "fix.jsonl"];
  const missing: string[] = [];
  const valid: string[] = [];

  for (const fileName of contextFiles) {
    const filePath = join(taskDir, fileName);
    if (!existsSync(filePath)) continue;

    const entries = readJsonlFile(filePath) as unknown as ContextEntry[];
    for (const entry of entries) {
      const fullPath = join(repoRoot, entry.file);
      if (existsSync(fullPath)) {
        valid.push(entry.file);
      } else {
        missing.push(entry.file);
      }
    }
  }

  return {
    success: missing.length === 0,
    valid,
    missing,
  };
}
