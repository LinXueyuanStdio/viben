/**
 * Workspace initialization module
 *
 * Provides functionality for initializing Viben workspaces with full
 * AI-assisted development workflow structure.
 *
 * Templates are read from packages/core/templates/
 *
 * Generated structure:
 * - .viben/ - Workflow files, specs, and workspace
 * - .claude/ - Claude Code agents, commands, hooks, and settings (if selected)
 * - .cursor/ - Cursor IDE commands (if selected)
 * - Other executors as selected
 * - AGENTS.md - Root instructions file
 */
import * as fs from "node:fs";
import { mkdir, writeFile, chmod, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { stringify } from "yaml";
import type {
  WorkspaceConfigFile,
  InitWorkspaceOptions,
  InitWorkspaceResult,
  ExecutorType,
} from "./types";
import { EXECUTOR_TEMPLATE_CONFIGS } from "./types";
import { initDeveloper } from "../cli/commands/user";

export { EXECUTOR_TEMPLATE_CONFIGS } from "./types";
export type { ExecutorType } from "./types";

// =============================================================================
// Constants
// =============================================================================

/**
 * Workspace directory name
 */
export const WORKSPACE_DIR = ".viben";

/**
 * Workspace config file name
 */
export const WORKSPACE_CONFIG_FILE = "config.yaml";

/**
 * Agents directory name within workspace
 */
export const AGENTS_DIR = "agents";

/**
 * Default workspace configuration
 */
export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfigFile = {
  version: 1,
  settings: {
    editor: "code",
    pager: "less",
    color: "auto",
  },
  agents: [],
  mcp: {
    enabled: [],
  },
  skills: {
    enabled: [],
  },
};

// =============================================================================
// Template Path Helpers
// =============================================================================

/**
 * Get the templates directory path.
 * Templates are located in packages/core/templates/.
 */
function getTemplatesDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));

  // Check if we're in dist (production) or src (development)
  if (currentDir.includes("/dist/")) {
    return resolve(currentDir, "../../templates");
  } else {
    return resolve(currentDir, "../../templates");
  }
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
  options: { force?: boolean; skipExisting?: boolean; executable?: boolean },
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

  if (options.executable) {
    await chmod(filePath, 0o755);
  }

  createdFiles.push(filePath.replace(baseDir + "/", ""));
}

/**
 * Calculate SHA256 hash of content
 */
function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Directories to scan for template hashes
 * Includes .viben and all executor config directories
 */
const TEMPLATE_DIRS = [".viben", ".claude", ".cursor", ".iflow", ".opencode", ".codex", ".kilo", ".kiro", ".gemini", ".antigravity"];

/**
 * Patterns to exclude from hash tracking
 */
const EXCLUDE_FROM_HASH = [
  ".template-hashes.json",
  ".version",
  ".gitignore",
  ".developer",
  "workspace/",
  "tasks/",
  ".current-task",
  "docs/specs/frontend/",
  "docs/specs/backend/",
  ".backup-",
  "__pycache__",
  ".pyc",
  ".pyo",
  ".DS_Store",
  ".git",
];

/**
 * Check if a path should be excluded from hashing
 */
function shouldExclude(relativePath: string): boolean {
  return EXCLUDE_FROM_HASH.some((pattern) => relativePath.includes(pattern));
}

/**
 * Recursively collect all files in a directory for hashing
 */
function collectFilesForHash(
  baseDir: string,
  dir: string,
  files: string[] = []
): string[] {
  const fullDir = join(baseDir, dir);
  if (!fs.existsSync(fullDir)) {
    return files;
  }

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = join(dir, entry.name);
    if (shouldExclude(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFilesForHash(baseDir, relativePath, files);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Initialize template hashes by scanning created files
 */
function initializeHashes(cwd: string): Record<string, string> {
  const hashes: Record<string, string> = {};

  for (const dir of TEMPLATE_DIRS) {
    const files = collectFilesForHash(cwd, dir);
    for (const relativePath of files) {
      const fullPath = join(cwd, relativePath);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        hashes[relativePath] = sha256(content);
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return hashes;
}

/**
 * Detect available Python command (python3 or python)
 */
function getPythonCommand(): string {
  try {
    execSync("python3 --version", { stdio: "pipe" });
    return "python3";
  } catch {
    try {
      execSync("python --version", { stdio: "pipe" });
      return "python";
    } catch {
      return "python3";
    }
  }
}

// =============================================================================
// Directory Copy Helper
// =============================================================================

/**
 * Recursively copy a directory from templates to target
 */
async function copyTemplateDir(
  srcRelativePath: string,
  destPath: string,
  options: { force?: boolean; skipExisting?: boolean; executable?: boolean },
  createdFiles: string[],
  baseDir: string
): Promise<void> {
  const srcPath = join(getTemplatesDir(), srcRelativePath);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Template directory not found: ${srcRelativePath}`);
  }

  ensureDir(destPath);

  const entries = await readdir(srcPath);
  for (const entry of entries) {
    const srcEntryPath = join(srcPath, entry);
    const destEntryPath = join(destPath, entry);
    const entryStat = await stat(srcEntryPath);

    if (entryStat.isDirectory()) {
      await copyTemplateDir(
        join(srcRelativePath, entry),
        destEntryPath,
        options,
        createdFiles,
        baseDir
      );
    } else {
      const content = fs.readFileSync(srcEntryPath, "utf-8");
      const isExecutable =
        options.executable && (entry.endsWith(".sh") || entry.endsWith(".py"));
      await writeFileIfNeeded(
        destEntryPath,
        content,
        { ...options, executable: isExecutable },
        createdFiles,
        baseDir
      );
    }
  }
}

// =============================================================================
// Executor Configurators
// =============================================================================

/**
 * Configure Claude Code
 */
async function configureClaude(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const claudeDir = join(cwd, ".claude");
  ensureDir(join(claudeDir, "agents"));
  ensureDir(join(claudeDir, "commands/viben"));

  // Settings
  const pythonCmd = getPythonCommand();
  const settingsContent = readTemplate("claude/settings.json").replace(
    /\{\{PYTHON_CMD\}\}/g,
    pythonCmd
  );
  await writeFileIfNeeded(
    join(claudeDir, "settings.json"),
    settingsContent,
    options,
    createdFiles,
    cwd
  );

  // Agents
  await copyTemplateDir(
    "claude/agents",
    join(claudeDir, "agents"),
    options,
    createdFiles,
    cwd
  );

  // Commands
  await copyTemplateDir(
    "claude/commands/viben",
    join(claudeDir, "commands/viben"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure Cursor
 */
async function configureCursor(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const cursorDir = join(cwd, ".cursor");
  ensureDir(join(cursorDir, "commands"));

  await copyTemplateDir(
    "cursor/commands",
    join(cursorDir, "commands"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure iFlow
 */
async function configureIflow(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const iflowDir = join(cwd, ".iflow");
  ensureDir(join(iflowDir, "agents"));
  ensureDir(join(iflowDir, "commands/viben"));

  // Settings
  const pythonCmd = getPythonCommand();
  const settingsContent = readTemplate("iflow/settings.json").replace(
    /\{\{PYTHON_CMD\}\}/g,
    pythonCmd
  );
  await writeFileIfNeeded(
    join(iflowDir, "settings.json"),
    settingsContent,
    options,
    createdFiles,
    cwd
  );

  await copyTemplateDir(
    "iflow/agents",
    join(iflowDir, "agents"),
    options,
    createdFiles,
    cwd
  );

  await copyTemplateDir(
    "iflow/commands/viben",
    join(iflowDir, "commands/viben"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure OpenCode
 */
async function configureOpencode(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const opencodeDir = join(cwd, ".opencode");
  ensureDir(join(opencodeDir, "agents"));
  ensureDir(join(opencodeDir, "commands/viben"));

  await copyTemplateDir(
    "opencode/agents",
    join(opencodeDir, "agents"),
    options,
    createdFiles,
    cwd
  );

  await copyTemplateDir(
    "opencode/commands/viben",
    join(opencodeDir, "commands/viben"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure Codex
 */
async function configureCodex(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const codexDir = join(cwd, ".agents/skills");

  await copyTemplateDir(
    "codex/skills",
    codexDir,
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure Kilo
 */
async function configureKilo(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const kiloDir = join(cwd, ".kilocode");
  ensureDir(join(kiloDir, "commands/viben"));

  await copyTemplateDir(
    "kilo/commands/viben",
    join(kiloDir, "commands/viben"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure Kiro
 */
async function configureKiro(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const kiroDir = join(cwd, ".kiro/skills");

  await copyTemplateDir(
    "kiro/skills",
    kiroDir,
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure Gemini
 */
async function configureGemini(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const geminiDir = join(cwd, ".gemini");
  ensureDir(join(geminiDir, "commands/viben"));

  await copyTemplateDir(
    "gemini/commands/viben",
    join(geminiDir, "commands/viben"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Configure Antigravity
 */
async function configureAntigravity(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const antigravityDir = join(cwd, ".agent/workflows");

  await copyTemplateDir(
    "antigravity/workflows",
    antigravityDir,
    options,
    createdFiles,
    cwd
  );
}

// =============================================================================
// Spec Template Creation
// =============================================================================

/**
 * Copy all .md files from a template subdirectory to destination
 */
async function copyTemplateMdFiles(
  templateSubdir: string,
  destDir: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[],
  cwd: string
): Promise<void> {
  const templateDir = join(getTemplatesDir(), templateSubdir);
  if (!fs.existsSync(templateDir)) {
    return; // Template directory doesn't exist, skip
  }

  ensureDir(destDir);
  const entries = await readdir(templateDir);
  const mdFiles = entries.filter((file) => file.endsWith(".md"));

  for (const file of mdFiles) {
    const content = readTemplate(`${templateSubdir}/${file}`);
    await writeFileIfNeeded(
      join(destDir, file),
      content,
      options,
      createdFiles,
      cwd
    );
  }
}

/**
 * Create spec templates (always creates both frontend and backend specs)
 * Dynamically reads all .md files from template directories
 */
async function createSpecTemplates(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const specDir = join(cwd, "docs/specs");
  ensureDir(specDir);

  // Guides
  await copyTemplateMdFiles(
    "viben/spec/guides",
    join(specDir, "guides"),
    options,
    createdFiles,
    cwd
  );

  // Backend specs
  await copyTemplateMdFiles(
    "viben/spec/backend",
    join(specDir, "backend"),
    options,
    createdFiles,
    cwd
  );

  // Frontend specs
  await copyTemplateMdFiles(
    "viben/spec/frontend",
    join(specDir, "frontend"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Create idea-types templates in docs/idea-types/
 * Dynamically reads all .md files from templates/viben/idea-types/
 */
async function createIdeaTypesTemplates(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  await copyTemplateMdFiles(
    "viben/idea-types",
    join(cwd, "docs/idea-types"),
    options,
    createdFiles,
    cwd
  );
}

/**
 * Create reward-types templates in docs/reward-types/
 * Dynamically reads all .md files from templates/viben/reward-types/
 */
async function createRewardTypesTemplates(
  cwd: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  await copyTemplateMdFiles(
    "viben/reward-types",
    join(cwd, "docs/reward-types"),
    options,
    createdFiles,
    cwd
  );
}

// =============================================================================
// Validation and Detection
// =============================================================================

/**
 * Validate developer name format.
 * Must be lowercase alphanumeric with hyphens, not starting/ending with hyphen.
 */
export function validateDeveloperName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error("Developer name is required");
  }

  const isValid =
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name) &&
    !name.startsWith("-") &&
    !name.endsWith("-");

  if (!isValid) {
    throw new Error(
      `Invalid developer name "${name}". Must be lowercase alphanumeric with hyphens, not starting/ending with hyphen.\n\nExample: viben init --user john-doe`
    );
  }
}


/**
 * Check if a workspace exists at the given path.
 */
export function workspaceExists(path: string): boolean {
  const configPath = join(resolve(path), WORKSPACE_DIR, WORKSPACE_CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Check if a path is inside an existing workspace.
 */
export function isInsideWorkspace(path: string): string | null {
  return findWorkspaceRoot(resolve(path));
}

/**
 * Find the workspace root directory by traversing up from the given directory.
 */
function findWorkspaceRoot(startDir: string): string | null {
  let currentDir = resolve(startDir);
  const { root } = require("node:path").parse(currentDir);

  while (currentDir !== root) {
    const vibenDir = join(currentDir, WORKSPACE_DIR);
    const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);

    if (fs.existsSync(configPath)) {
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

// =============================================================================
// Main Init Function
// =============================================================================

/**
 * Initialize a Viben workspace.
 *
 * Creates a complete AI-assisted development workflow structure:
 * - .viben/ - Workflow files, config, workspace, tasks
 * - docs/specs/ - Development guidelines
 * - docs/idea-types/ - Idea templates
 * - Executor configs (.claude/, .cursor/, etc.)
 * - AGENTS.md - Root instructions
 *
 * @param options - Initialization options
 * @returns Initialization result
 */
export async function initWorkspace(
  options: InitWorkspaceOptions = {}
): Promise<InitWorkspaceResult> {
  const targetDir = resolve(options.targetDir || process.cwd());
  const executors = options.executors || ["CURSOR", "CLAUDE_CODE"];
  const createdFiles: string[] = [];
  const warnings: string[] = [];

  // Validate developer name if provided
  if (options.developerName) {
    validateDeveloperName(options.developerName);
  }

  const vibenDir = join(targetDir, WORKSPACE_DIR);
  const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);

  // Check for existing workspace
  if (fs.existsSync(vibenDir) && !options.force && !options.skipExisting) {
    throw new Error(`Workspace already exists: ${vibenDir}`);
  }

  const writeOpts = {
    force: options.force,
    skipExisting: options.skipExisting,
  };

  // ===================
  // Create .viben/ structure
  // ===================

  // Create config.yaml
  const now = new Date().toISOString();
  const config: WorkspaceConfigFile = {
    ...DEFAULT_WORKSPACE_CONFIG,
    version: 1,
    name: basename(targetDir),
    created_at: now,
    updated_at: now,
  };
  const configContent = stringify(config, { indent: 2 });
  await writeFileIfNeeded(
    configPath,
    configContent,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Copy workflow.md
  const workflowMd = readTemplate("viben/workflow.md");
  await writeFileIfNeeded(
    join(vibenDir, "workflow.md"),
    workflowMd,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Copy worktree.yaml
  const worktreeYaml = readTemplate("viben/worktree.yaml");
  await writeFileIfNeeded(
    join(vibenDir, "worktree.yaml"),
    worktreeYaml,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Copy .gitignore
  const gitignore = readTemplate("viben/gitignore.txt");
  await writeFileIfNeeded(
    join(vibenDir, ".gitignore"),
    gitignore,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Create workspace directory with index
  ensureDir(join(vibenDir, "workspace"));
  const workspaceIndex = readTemplate("markdown/workspace-index.md");
  await writeFileIfNeeded(
    join(vibenDir, "workspace/index.md"),
    workspaceIndex,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Create tasks directory
  ensureDir(join(vibenDir, "tasks"));

  // Version file
  await writeFileIfNeeded(
    join(vibenDir, ".version"),
    "1.0.0",
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Create docs/specs/ templates
  // ===================
  await createSpecTemplates(targetDir, writeOpts, createdFiles);

  // ===================
  // Create docs/idea-types/ templates
  // ===================
  await createIdeaTypesTemplates(targetDir, writeOpts, createdFiles);

  // ===================
  // Create docs/reward-types/ templates
  // ===================
  await createRewardTypesTemplates(targetDir, writeOpts, createdFiles);

  // ===================
  // Add .viben/worktrees to root .gitignore
  // ===================
  const rootGitignorePath = join(targetDir, ".gitignore");
  const worktreesIgnoreEntry = ".viben/worktrees";
  if (fs.existsSync(rootGitignorePath)) {
    const rootGitignoreContent = fs.readFileSync(rootGitignorePath, "utf-8");
    if (!rootGitignoreContent.includes(worktreesIgnoreEntry)) {
      const newContent = rootGitignoreContent.endsWith("\n")
        ? `${rootGitignoreContent}\n# Viben worktrees (git worktrees for multi-agent workflows)\n${worktreesIgnoreEntry}\n`
        : `${rootGitignoreContent}\n\n# Viben worktrees (git worktrees for multi-agent workflows)\n${worktreesIgnoreEntry}\n`;
      fs.writeFileSync(rootGitignorePath, newContent, "utf-8");
      warnings.push(`Added ${worktreesIgnoreEntry} to root .gitignore`);
    }
  }

  // ===================
  // Configure selected executors
  // ===================
  for (const executor of executors) {
    switch (executor) {
      case "CLAUDE_CODE":
        await configureClaude(targetDir, writeOpts, createdFiles);
        break;
      case "CURSOR":
        await configureCursor(targetDir, writeOpts, createdFiles);
        break;
      case "IFLOW":
        await configureIflow(targetDir, writeOpts, createdFiles);
        break;
      case "OPENCODE":
        await configureOpencode(targetDir, writeOpts, createdFiles);
        break;
      case "CODEX":
        await configureCodex(targetDir, writeOpts, createdFiles);
        break;
      case "KILO":
        await configureKilo(targetDir, writeOpts, createdFiles);
        break;
      case "KIRO":
        await configureKiro(targetDir, writeOpts, createdFiles);
        break;
      case "GEMINI":
        await configureGemini(targetDir, writeOpts, createdFiles);
        break;
      case "ANTIGRAVITY":
        await configureAntigravity(targetDir, writeOpts, createdFiles);
        break;
      default:
        break;
    }
  }

  // ===================
  // Create AGENTS.md
  // ===================
  const agentsMd = readTemplate("markdown/agents.md");
  await writeFileIfNeeded(
    join(targetDir, "AGENTS.md"),
    agentsMd,
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Create template hashes file
  // ===================
  const templateHashes = initializeHashes(targetDir);
  await writeFileIfNeeded(
    join(vibenDir, ".template-hashes.json"),
    JSON.stringify(templateHashes, null, 2),
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Initialize developer identity (if provided)
  // ===================
  if (options.developerName) {
    try {
      const initResult = await initDeveloper(options.developerName, targetDir);
      if (initResult.success) {
        for (const file of initResult.files) {
          createdFiles.push(`.viben/${file}`);
        }
      }
    } catch {
      // Silent failure - user can run 'viben user init' manually
    }
  }

  return {
    success: true,
    path: vibenDir,
    files: createdFiles,
    config,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Initialize a workspace from a template (deprecated).
 * @deprecated Templates are no longer supported. Use initWorkspace directly.
 */
export async function initFromTemplate(
  path: string,
  templateName: string
): Promise<InitWorkspaceResult> {
  throw new Error(
    "Workspace templates are deprecated. Use initWorkspace() directly."
  );
}

/**
 * List available workspace templates (deprecated).
 * @deprecated Templates are no longer supported.
 */
export async function listWorkspaceTemplates(): Promise<never[]> {
  return [];
}

/**
 * Get a workspace template (deprecated).
 * @deprecated Templates are no longer supported.
 */
export async function getWorkspaceTemplate(
  templateId: string
): Promise<null> {
  return null;
}

/**
 * Create a workspace template (deprecated).
 * @deprecated Templates are no longer supported.
 */
export async function createWorkspaceTemplate(
  templateId: string,
  config: unknown
): Promise<never> {
  throw new Error(
    "Workspace templates are deprecated."
  );
}

/**
 * Delete a workspace template (deprecated).
 * @deprecated Templates are no longer supported.
 */
export async function deleteWorkspaceTemplate(
  templateId: string
): Promise<boolean> {
  return false;
}
