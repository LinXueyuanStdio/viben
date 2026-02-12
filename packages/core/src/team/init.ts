/**
 * Team initialization module
 *
 * This module implements functionality equivalent to `trellis init`,
 * generating `.viben/` and `.claude/` directories with all necessary
 * configuration files, scripts, and templates.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile, copyFile, readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { stringify } from "yaml";
import { getStateDir, getTemplatesDir } from "../config/paths";
import { readYaml, writeYaml, fileExists, ensureDir } from "../config/yaml";
import { AlreadyExistsError, ValidationError, NotFoundError } from "../error";

/**
 * Project type for initialization
 */
export type ProjectType =
  | "default"
  | "monorepo"
  | "web"
  | "api"
  | "cli"
  | "library"
  | "custom";

/**
 * Options for team initialization
 */
export interface InitOptions {
  /** Target directory (default: cwd) */
  targetDir?: string;
  /** Project name (default: directory name) */
  name?: string;
  /** Project type */
  projectType?: ProjectType;
  /** Template to use */
  template?: string;
  /** Force overwrite existing */
  force?: boolean;
  /** Skip default agent creation */
  skipAgent?: boolean;
  /** Skip Claude configuration */
  skipClaude?: boolean;
}

/**
 * Result of team initialization
 */
export interface InitResult {
  /** Whether initialization was successful */
  success: boolean;
  /** Path to initialized directory */
  path: string;
  /** List of created files */
  files: string[];
  /** Warning messages */
  warnings?: string[];
}

/**
 * Default .viben/config.yaml content
 */
const DEFAULT_VIBEN_CONFIG = `# Viben workspace configuration
version: 1
name: "{name}"

# Workspace settings
settings:
  defaultAgent: main
  autoCommit: false

# Project metadata
metadata:
  createdAt: "{createdAt}"
`;

/**
 * Default agent configuration
 */
const DEFAULT_AGENT_CONFIG = `# Main agent configuration
id: main
name: Main Agent
description: Default workspace agent
executorType: CLAUDE_CODE

# Model configuration (optional)
# model: claude-sonnet-4-20250514
# provider: anthropic
`;

/**
 * Default CLAUDE.md content
 */
const DEFAULT_CLAUDE_MD = `# Claude Code Guidelines

## Project Overview

This is a {projectType} project named {name}.

## Development Guidelines

- Follow existing code patterns
- Write tests for new features
- Keep code simple and readable

## Build Commands

\`\`\`bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
\`\`\`
`;

/**
 * Initialize a Viben team workspace.
 *
 * Creates:
 * - .viben/config.yaml - Workspace configuration
 * - .viben/agents/main.yaml - Default agent
 * - .claude/CLAUDE.md - Claude Code guidelines (optional)
 *
 * @param options - Initialization options
 * @returns Initialization result
 */
export async function initTeam(options: InitOptions = {}): Promise<InitResult> {
  const targetDir = resolve(options.targetDir || process.cwd());
  const projectName = options.name || basename(targetDir);
  const projectType = options.projectType || "default";
  const vibenDir = join(targetDir, ".viben");
  const claudeDir = join(targetDir, ".claude");
  const createdFiles: string[] = [];
  const warnings: string[] = [];

  // Check for existing .viben directory
  if (existsSync(vibenDir) && !options.force) {
    throw new AlreadyExistsError("Workspace", targetDir);
  }

  // Create .viben directory
  await ensureDir(vibenDir);

  // Create config.yaml
  const now = new Date().toISOString();
  const configContent = DEFAULT_VIBEN_CONFIG
    .replace("{name}", projectName)
    .replace("{createdAt}", now);

  await writeFile(join(vibenDir, "config.yaml"), configContent, "utf-8");
  createdFiles.push(".viben/config.yaml");

  // Create agents directory and default agent
  if (!options.skipAgent) {
    const agentsDir = join(vibenDir, "agents");
    await ensureDir(agentsDir);

    await writeFile(
      join(agentsDir, "main.yaml"),
      DEFAULT_AGENT_CONFIG,
      "utf-8"
    );
    createdFiles.push(".viben/agents/main.yaml");
  }

  // Create .claude directory
  if (!options.skipClaude) {
    if (existsSync(claudeDir) && !options.force) {
      warnings.push(".claude directory already exists, skipping");
    } else {
      await ensureDir(claudeDir);

      const claudeMdContent = DEFAULT_CLAUDE_MD
        .replace("{name}", projectName)
        .replace("{projectType}", projectType);

      await writeFile(
        join(claudeDir, "CLAUDE.md"),
        claudeMdContent,
        "utf-8"
      );
      createdFiles.push(".claude/CLAUDE.md");
    }
  }

  // Apply template if specified
  if (options.template) {
    const templateFiles = await applyTemplate(
      options.template,
      vibenDir,
      options.force
    );
    createdFiles.push(...templateFiles);
  }

  return {
    success: true,
    path: targetDir,
    files: createdFiles,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Apply a template to the workspace.
 *
 * @param templateName - Name of the template
 * @param vibenDir - Target .viben directory
 * @param force - Force overwrite
 * @returns List of created files
 */
async function applyTemplate(
  templateName: string,
  vibenDir: string,
  force?: boolean
): Promise<string[]> {
  const templatesDir = getTemplatesDir();
  const templateDir = join(templatesDir, templateName);

  if (!fileExists(templateDir)) {
    throw new NotFoundError("Template", templateName);
  }

  const createdFiles: string[] = [];

  // Copy template files recursively
  async function copyDir(src: string, dest: string, basePath: string) {
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      const relativePath = join(basePath, entry.name);

      if (entry.isDirectory()) {
        await ensureDir(destPath);
        await copyDir(srcPath, destPath, relativePath);
      } else {
        if (!existsSync(destPath) || force) {
          await copyFile(srcPath, destPath);
          createdFiles.push(`.viben/${relativePath}`);
        }
      }
    }
  }

  await copyDir(templateDir, vibenDir, "");

  return createdFiles;
}

/**
 * List available initialization templates.
 *
 * @returns List of template names
 */
export async function listTemplates(): Promise<string[]> {
  const templatesDir = getTemplatesDir();

  if (!fileExists(templatesDir)) {
    return [];
  }

  const entries = await readdir(templatesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
