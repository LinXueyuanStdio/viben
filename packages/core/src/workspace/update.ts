/**
 * Workspace update module
 *
 * Provides functionality for updating specific parts of a Viben workspace.
 */
import * as fs from "node:fs";
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { getTemplatesDir as getTemplatesDirUtil } from "../utils/templates";

// =============================================================================
// Template Path Helpers
// =============================================================================

/**
 * Get the templates directory using shared utility.
 */
function getTemplatesDir(): string {
  return getTemplatesDirUtil(import.meta.url);
}

/**
 * Read a template file
 */
function readTemplate(relativePath: string): string {
  const templatesDir = getTemplatesDir();
  const fullPath = join(templatesDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Template not found: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, "utf-8");
}

// =============================================================================
// File Writing Helpers
// =============================================================================

/**
 * Ensure a directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write a file if it doesn't exist or force mode is enabled
 */
async function writeFileIfNeeded(
  filePath: string,
  content: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[],
  baseDir: string
): Promise<void> {
  if (fs.existsSync(filePath)) {
    if (options.skipExisting) {
      return;
    }
    if (!options.force) {
      throw new Error(`File already exists: ${filePath}`);
    }
  }

  // Ensure parent directory exists
  const parentDir = dirname(filePath);
  await mkdir(parentDir, { recursive: true });

  await writeFile(filePath, content, "utf-8");

  createdFiles.push(filePath.replace(baseDir + "/", ""));
}

// =============================================================================
// Update Functions
// =============================================================================

/**
 * Update idea-types templates in docs/idea-types/
 *
 * These are the prompt templates for the `viben idea` command.
 * Both builtin and custom types are stored in this directory.
 */
export async function updateIdeaTypes(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const ideaTypesDir = join(cwd, "docs/idea-types");
  ensureDir(ideaTypesDir);

  // Builtin idea types
  const ideaTypeFiles = [
    "code_improvements.md",
    "code_quality.md",
    "documentation_gaps.md",
    "performance_optimizations.md",
    "security_hardening.md",
    "ui_ux_improvements.md",
  ];

  for (const file of ideaTypeFiles) {
    const content = readTemplate(`viben/idea-types/${file}`);
    await writeFileIfNeeded(
      join(ideaTypesDir, file),
      content,
      options,
      createdFiles,
      cwd
    );
  }
}

/**
 * Update reward-types templates in docs/reward-types/
 *
 * These are the prompt templates for the `viben reward` command.
 * Both builtin and custom types are stored in this directory.
 */
export async function updateRewardTypes(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const rewardTypesDir = join(cwd, "docs/reward-types");
  ensureDir(rewardTypesDir);

  // Builtin reward types
  const rewardTypeFiles = [
    "test_coverage.md",
    "code_quality.md",
    "security_scan.md",
    "diff_penalty.md",
    "agent_review.md",
    "benchmark_comparison.md",
  ];

  for (const file of rewardTypeFiles) {
    const content = readTemplate(`viben/reward-types/${file}`);
    await writeFileIfNeeded(
      join(rewardTypesDir, file),
      content,
      options,
      createdFiles,
      cwd
    );
  }
}
