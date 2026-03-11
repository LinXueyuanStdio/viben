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
  devType: string;
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
 * Initialize context files for a task
 */
export function initContext(
  repoRoot: string,
  taskName: string,
  devType: string
): ContextInitResult {
  const taskDir = resolveTaskDirectory(taskName, repoRoot);
  if (!taskDir || !existsSync(taskDir)) {
    return {
      success: false,
      taskDir: taskName,
      devType,
      files: { implement: 0, check: 0, fix: 0 },
      error: `Task not found: ${taskName}`,
    };
  }

  const validTypes = ["backend", "frontend", "fullstack", "test", "docs"];
  if (!validTypes.includes(devType)) {
    return {
      success: false,
      taskDir,
      devType,
      files: { implement: 0, check: 0, fix: 0 },
      error: `Invalid dev type. Must be one of: ${validTypes.join(", ")}`,
    };
  }

  // implement.jsonl
  const implementEntries: ContextEntry[] = [
    { file: `${DIR_VIBEN}/workflow.md`, reason: "Project workflow and conventions" },
  ];

  if (devType === "backend" || devType === "test" || devType === "fullstack") {
    implementEntries.push({
      file: "docs/specs/backend/index.md",
      reason: "Backend development guide",
    });
  }
  if (devType === "frontend" || devType === "fullstack") {
    implementEntries.push({
      file: "docs/specs/frontend/index.md",
      reason: "Frontend development guide",
    });
  }

  const implementFile = join(taskDir, "implement.jsonl");
  writeJsonlFile(implementFile, implementEntries as unknown as Array<Record<string, unknown>>);

  // check.jsonl
  const checkEntries: ContextEntry[] = [
    { file: ".claude/commands/viben/finish-work.md", reason: "Finish work checklist" },
  ];
  if (devType === "backend" || devType === "fullstack") {
    checkEntries.push({
      file: ".claude/commands/viben/check-backend.md",
      reason: "Backend check spec",
    });
  }
  if (devType === "frontend" || devType === "fullstack") {
    checkEntries.push({
      file: ".claude/commands/viben/check-frontend.md",
      reason: "Frontend check spec",
    });
  }

  const checkFile = join(taskDir, "check.jsonl");
  writeJsonlFile(checkFile, checkEntries as unknown as Array<Record<string, unknown>>);

  // fix.jsonl
  const fixEntries: ContextEntry[] = [];
  if (devType === "backend" || devType === "fullstack") {
    fixEntries.push({
      file: ".claude/commands/viben/check-backend.md",
      reason: "Backend check spec",
    });
  }
  if (devType === "frontend" || devType === "fullstack") {
    fixEntries.push({
      file: ".claude/commands/viben/check-frontend.md",
      reason: "Frontend check spec",
    });
  }

  const fixFile = join(taskDir, "fix.jsonl");
  writeJsonlFile(fixFile, fixEntries as unknown as Array<Record<string, unknown>>);

  // Update task.json with dev_type
  updateTaskField(taskDir, "dev_type", devType);

  return {
    success: true,
    taskDir,
    devType,
    files: {
      implement: implementEntries.length,
      check: checkEntries.length,
      fix: fixEntries.length,
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
  options: { reason?: string; recursive?: boolean } = {}
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

  const implementFile = join(taskDir, "implement.jsonl");
  const reason = options.reason || "Added by user";

  let addedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    // Skip if already exists
    if (jsonlEntryExists(implementFile, file)) {
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

    appendToJsonl(implementFile, entry as unknown as Record<string, unknown>);
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
