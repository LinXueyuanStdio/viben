/**
 * Workspace initialization module
 *
 * Provides functionality for initializing Viben workspaces and
 * managing workspace templates.
 */
import { readdir, mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { stringify } from "yaml";
import {
  getStateDir,
  getWorkspaceTemplatesDir,
  getWorkspaceTemplateDir,
} from "../config/paths";
import { readYaml, writeYaml, fileExists, ensureDir } from "../config/yaml";
import { AlreadyExistsError, ValidationError, NotFoundError } from "../error";
import type {
  WorkspaceConfigFile,
  InitWorkspaceOptions,
  InitWorkspaceResult,
  WorkspaceTemplate,
  WorkspaceTemplateConfig,
} from "./types";
import {
  WORKSPACE_DIR,
  WORKSPACE_CONFIG_FILE,
  AGENTS_DIR,
  DEFAULT_WORKSPACE_CONFIG,
} from "./index";

/**
 * Default agent configuration YAML content
 */
const DEFAULT_AGENT_CONFIG = `# Main agent configuration
id: main
name: Main Agent
description: Default workspace agent

# Model configuration (optional, uses defaults)
# model: claude-sonnet-4-20250514
# provider: anthropic
`;

/**
 * Check if a directory is inside an existing workspace (but not the root).
 * Returns the enclosing workspace path if found, null otherwise.
 */
function getEnclosingWorkspace(
  dir: string,
  findWorkspaceRoot: (dir: string) => string | null
): string | null {
  const resolvedDir = resolve(dir);
  const workspaceRoot = findWorkspaceRoot(resolvedDir);

  if (workspaceRoot && workspaceRoot !== resolvedDir) {
    return workspaceRoot;
  }

  return null;
}

/**
 * Find the workspace root directory by traversing up from the given directory.
 * Returns null if no workspace is found.
 */
function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = resolve(startDir);
  const { root } = require("node:path").parse(currentDir);

  while (currentDir !== root) {
    const vibenDir = join(currentDir, WORKSPACE_DIR);
    const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);

    if (existsSync(configPath)) {
      return currentDir;
    }

    const parentDir = join(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Initialize a Viben workspace in the target directory.
 *
 * Creates:
 * - .viben/config.yaml - Workspace configuration
 * - .viben/agents/main.yaml - Default agent configuration (optional)
 *
 * @param options - Initialization options
 * @returns Initialization result
 * @throws AlreadyExistsError if workspace already exists and force is false
 * @throws ValidationError if inside an existing workspace
 * @throws NotFoundError if template not found
 */
export async function initWorkspace(
  options: InitWorkspaceOptions = {}
): Promise<InitWorkspaceResult> {
  const targetDir = resolve(options.targetDir || process.cwd());
  const vibenDir = join(targetDir, WORKSPACE_DIR);
  const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);
  const agentsDir = join(vibenDir, AGENTS_DIR);
  const mainAgentPath = join(agentsDir, "main.yaml");

  // Check if already inside a workspace (nested workspace check)
  const enclosingWorkspace = getEnclosingWorkspace(targetDir, findWorkspaceRoot);
  if (enclosingWorkspace) {
    throw new ValidationError(
      `Already inside workspace at ${enclosingWorkspace}. Nested workspaces are not supported.`
    );
  }

  // Check if workspace already exists
  if (existsSync(configPath) && !options.force) {
    throw new AlreadyExistsError("Workspace", targetDir);
  }

  // Track created files
  const createdFiles: string[] = [];

  // Determine config to use
  let config: WorkspaceConfigFile;
  let templateConfig: WorkspaceTemplateConfig | null = null;

  if (options.template) {
    // Load template
    templateConfig = await getTemplateConfig(options.template);
    if (!templateConfig) {
      throw new NotFoundError("WorkspaceTemplate", options.template);
    }

    // Merge template config with defaults
    const now = new Date().toISOString();
    config = {
      ...DEFAULT_WORKSPACE_CONFIG,
      ...templateConfig.workspaceConfig,
      version: 1,
      name: basename(targetDir),
      createdAt: now,
      updatedAt: now,
    };
  } else {
    // Use default config
    const now = new Date().toISOString();
    config = {
      ...DEFAULT_WORKSPACE_CONFIG,
      version: 1,
      name: basename(targetDir),
      createdAt: now,
      updatedAt: now,
    };
  }

  // Create .viben directory
  if (!existsSync(vibenDir)) {
    await mkdir(vibenDir, { recursive: true });
  }

  // Write config file
  const configContent = stringify(config, { indent: 2 });
  await writeFile(configPath, configContent, "utf-8");
  createdFiles.push(WORKSPACE_CONFIG_FILE);

  // If using template, create additional directories and copy files
  if (templateConfig) {
    // Create template-specified directories
    if (templateConfig.directories) {
      for (const dir of templateConfig.directories) {
        const dirPath = join(vibenDir, dir);
        if (!existsSync(dirPath)) {
          await mkdir(dirPath, { recursive: true });
        }
      }
    }

    // Copy template files
    if (templateConfig.files && options.template) {
      const templateDir = getWorkspaceTemplateDir(options.template);
      for (const file of templateConfig.files) {
        const srcPath = join(templateDir, file);
        const destPath = join(vibenDir, file);

        if (existsSync(srcPath)) {
          // Ensure destination directory exists
          const destDir = join(destPath, "..");
          if (!existsSync(destDir)) {
            await mkdir(destDir, { recursive: true });
          }

          await copyFile(srcPath, destPath);
          createdFiles.push(file);
        }
      }
    }
  } else {
    // Create default agents directory and main agent
    if (!existsSync(agentsDir)) {
      await mkdir(agentsDir, { recursive: true });
    }

    // Create default agent config
    if (!existsSync(mainAgentPath) || options.force) {
      await writeFile(mainAgentPath, DEFAULT_AGENT_CONFIG, "utf-8");
      createdFiles.push(`${AGENTS_DIR}/main.yaml`);
    }
  }

  return {
    success: true,
    path: vibenDir,
    files: createdFiles,
    config,
  };
}

/**
 * Initialize a workspace from a template.
 *
 * This is a convenience wrapper around initWorkspace with the template option.
 *
 * @param path - Target directory path
 * @param templateName - Name of the template to use
 * @returns Initialization result
 * @throws NotFoundError if template not found
 */
export async function initFromTemplate(
  path: string,
  templateName: string
): Promise<InitWorkspaceResult> {
  return initWorkspace({
    targetDir: path,
    template: templateName,
  });
}

/**
 * Get the configuration of a workspace template.
 *
 * @param templateId - Template identifier
 * @returns Template configuration or null if not found
 */
async function getTemplateConfig(
  templateId: string
): Promise<WorkspaceTemplateConfig | null> {
  const templateDir = getWorkspaceTemplateDir(templateId);
  const configPath = join(templateDir, "template.yaml");

  if (!fileExists(configPath)) {
    return null;
  }

  const config = await readYaml<WorkspaceTemplateConfig>(configPath);
  return config ?? null;
}

/**
 * List all available workspace templates.
 *
 * @returns Array of workspace template metadata
 */
export async function listWorkspaceTemplates(): Promise<WorkspaceTemplate[]> {
  const templatesDir = getWorkspaceTemplatesDir();

  if (!fileExists(templatesDir)) {
    return [];
  }

  const entries = await readdir(templatesDir, { withFileTypes: true });
  const templates: WorkspaceTemplate[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const template = await getWorkspaceTemplate(entry.name);
      if (template) {
        templates.push(template);
      }
    }
  }

  return templates;
}

/**
 * Get a workspace template by ID.
 *
 * @param templateId - Template identifier
 * @returns Template metadata or null if not found
 */
export async function getWorkspaceTemplate(
  templateId: string
): Promise<WorkspaceTemplate | null> {
  const config = await getTemplateConfig(templateId);
  if (!config) {
    return null;
  }

  return {
    id: templateId,
    name: config.name,
    description: config.description,
    createdAt: config.createdAt,
  };
}

/**
 * Create a new workspace template.
 *
 * @param templateId - Template identifier (directory name)
 * @param config - Template configuration
 * @returns Created template metadata
 * @throws AlreadyExistsError if template already exists
 */
export async function createWorkspaceTemplate(
  templateId: string,
  config: Omit<WorkspaceTemplateConfig, "createdAt">
): Promise<WorkspaceTemplate> {
  const templateDir = getWorkspaceTemplateDir(templateId);

  if (existsSync(templateDir)) {
    throw new AlreadyExistsError("WorkspaceTemplate", templateId);
  }

  // Create template directory
  await ensureDir(templateDir);

  const now = new Date().toISOString();
  const templateConfig: WorkspaceTemplateConfig = {
    ...config,
    createdAt: now,
  };

  // Write template config
  await writeYaml(join(templateDir, "template.yaml"), templateConfig);

  return {
    id: templateId,
    name: config.name,
    description: config.description,
    createdAt: now,
  };
}

/**
 * Delete a workspace template.
 *
 * @param templateId - Template identifier
 * @returns true if deleted, false if not found
 */
export async function deleteWorkspaceTemplate(
  templateId: string
): Promise<boolean> {
  const templateDir = getWorkspaceTemplateDir(templateId);

  if (!existsSync(templateDir)) {
    return false;
  }

  const { rm } = await import("node:fs/promises");
  await rm(templateDir, { recursive: true, force: true });
  return true;
}

/**
 * Check if a workspace exists at the given path.
 *
 * @param path - Directory path to check
 * @returns true if workspace exists
 */
export function workspaceExists(path: string): boolean {
  const configPath = join(resolve(path), WORKSPACE_DIR, WORKSPACE_CONFIG_FILE);
  return existsSync(configPath);
}

/**
 * Check if a path is inside an existing workspace.
 *
 * @param path - Path to check
 * @returns Enclosing workspace path or null
 */
export function isInsideWorkspace(path: string): string | null {
  return findWorkspaceRoot(resolve(path));
}
