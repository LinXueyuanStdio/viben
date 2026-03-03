/**
 * Team initialization module
 *
 * This module implements the `viben team init` command that generates
 * a complete AI-assisted development workflow structure.
 *
 * Templates are read from packages/core/templates/
 *
 * Generated structure:
 * - .viben/ - Workflow files, scripts, specs, and workspace
 * - .claude/ - Claude Code agents, commands, hooks, and settings (if selected)
 * - .cursor/ - Cursor IDE commands (if selected)
 * - Other executors as selected
 * - AGENTS.md - Root instructions file
 */
import * as fs from "node:fs";
import { mkdir, writeFile, chmod, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { type ProjectType, EXECUTOR_TEMPLATE_CONFIGS } from "./types";

export type { ProjectType } from "./types";

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
 * Get the path to a specific template directory
 */
function getTemplatePath(name: string): string {
  const templatePath = join(getTemplatesDir(), name);
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }
  throw new Error(`Could not find ${name} templates directory`);
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
  createdFiles: string[],
  hashes: Record<string, string>
): Promise<void> {
  const claudeDir = join(cwd, ".claude");
  ensureDir(join(claudeDir, "agents"));
  ensureDir(join(claudeDir, "commands/viben"));
  ensureDir(join(claudeDir, "hooks"));

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
  hashes[".claude/settings.json"] = sha256(settingsContent);

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

  // Hooks
  await copyTemplateDir(
    "claude/hooks",
    join(claudeDir, "hooks"),
    { ...options, executable: true },
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
  ensureDir(join(iflowDir, "hooks"));

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

  await copyTemplateDir(
    "iflow/hooks",
    join(iflowDir, "hooks"),
    { ...options, executable: true },
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
// Main Init Function
// =============================================================================

/**
 * Options for team initialization
 */
export interface InitOptions {
  /** Target directory (default: cwd) */
  targetDir?: string;
  /** Developer name (required) */
  developerName: string;
  /** Project type (default: fullstack) */
  projectType?: ProjectType;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip existing files without error */
  skipExisting?: boolean;
  /** Executors to configure (default: CURSOR, CLAUDE_CODE) */
  executors?: string[];
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
 * Validate developer name format.
 * Must be lowercase alphanumeric with hyphens, not starting/ending with hyphen.
 */
function validateDeveloperName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error("Developer name is required");
  }

  const isValid =
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name) &&
    !name.startsWith("-") &&
    !name.endsWith("-");

  if (!isValid) {
    throw new Error(
      `Invalid developer name "${name}". Must be lowercase alphanumeric with hyphens, not starting/ending with hyphen.`
    );
  }
}

/**
 * Detect project type based on files in the directory
 */
function detectProjectType(cwd: string): ProjectType {
  const hasPackageJson = fs.existsSync(join(cwd, "package.json"));
  const hasGoMod = fs.existsSync(join(cwd, "go.mod"));
  const hasCargoToml = fs.existsSync(join(cwd, "Cargo.toml"));
  const hasPyprojectToml = fs.existsSync(join(cwd, "pyproject.toml"));
  const hasRequirementsTxt = fs.existsSync(join(cwd, "requirements.txt"));

  const hasBackend = hasGoMod || hasCargoToml || hasPyprojectToml || hasRequirementsTxt;

  if (hasPackageJson) {
    // Check if it's frontend-only or fullstack
    try {
      const pkg = JSON.parse(fs.readFileSync(join(cwd, "package.json"), "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      const hasFrontendFramework =
        deps.react || deps.vue || deps.angular || deps.svelte || deps.next;
      const hasBackendFramework =
        deps.express || deps.fastify || deps.koa || deps.nestjs;

      if (hasFrontendFramework && !hasBackendFramework && !hasBackend) {
        return "frontend";
      }
      if (hasBackendFramework || hasBackend) {
        return "fullstack";
      }
      return "frontend";
    } catch {
      return "fullstack";
    }
  }

  if (hasBackend) {
    return "backend";
  }

  return "fullstack";
}

/**
 * Initialize a Viben team workspace.
 *
 * @param options - Initialization options
 * @returns Initialization result
 */
export async function initTeam(options: InitOptions): Promise<InitResult> {
  const targetDir = options.targetDir || process.cwd();
  const projectType = options.projectType || detectProjectType(targetDir);
  const executors = options.executors || ["CURSOR", "CLAUDE_CODE"];
  const createdFiles: string[] = [];
  const warnings: string[] = [];
  const hashes: Record<string, string> = {};

  // Validate developer name
  validateDeveloperName(options.developerName);

  const vibenDir = join(targetDir, ".viben");

  // Check for existing .viben directory
  if (fs.existsSync(vibenDir) && !options.force && !options.skipExisting) {
    throw new Error(`Directory already exists: ${vibenDir}`);
  }

  const writeOpts = {
    force: options.force,
    skipExisting: options.skipExisting,
  };

  // ===================
  // Create .viben workflow structure
  // ===================

  // Copy scripts directory
  await copyTemplateDir(
    "viben/scripts",
    join(vibenDir, "scripts"),
    { ...writeOpts, executable: true },
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
  hashes[".viben/workflow.md"] = sha256(workflowMd);

  // Copy worktree.yaml (multi-agent enabled by default)
  const worktreeYaml = readTemplate("viben/worktree.yaml");
  await writeFileIfNeeded(
    join(vibenDir, "worktree.yaml"),
    worktreeYaml,
    writeOpts,
    createdFiles,
    targetDir
  );
  hashes[".viben/worktree.yaml"] = sha256(worktreeYaml);

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

  // Create spec templates based on project type
  await createSpecTemplates(targetDir, projectType, writeOpts, createdFiles);

  // Add .viben/worktrees to root .gitignore
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

  // Version file
  await writeFileIfNeeded(
    join(vibenDir, ".version"),
    "1.0.0",
    writeOpts,
    createdFiles,
    targetDir
  );

  // Developer identity file
  const now = new Date();
  const developerContent = `name=${options.developerName}\ninitialized_at=${now.toISOString()}\n`;
  await writeFileIfNeeded(
    join(vibenDir, ".developer"),
    developerContent,
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Configure selected executors
  // ===================

  for (const executor of executors) {
    switch (executor) {
      case "CLAUDE_CODE":
        await configureClaude(targetDir, writeOpts, createdFiles, hashes);
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
      case "GEMINI_CLI":
        await configureGemini(targetDir, writeOpts, createdFiles);
        break;
      case "ANTIGRAVITY":
        await configureAntigravity(targetDir, writeOpts, createdFiles);
        break;
      // Other executors not yet implemented - skip silently
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
  await writeFileIfNeeded(
    join(vibenDir, ".template-hashes.json"),
    JSON.stringify(hashes, null, 2),
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Initialize developer identity via Python script
  // ===================
  try {
    const pythonCmd = getPythonCommand();
    const scriptPath = join(vibenDir, "scripts/init_developer.py");
    if (fs.existsSync(scriptPath)) {
      execSync(`${pythonCmd} "${scriptPath}" "${options.developerName}"`, {
        cwd: targetDir,
        stdio: "pipe",
      });
    }
  } catch {
    // Silent failure - user can run init_developer.py manually
  }

  return {
    success: true,
    path: targetDir,
    files: createdFiles,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Create spec templates based on project type
 */
async function createSpecTemplates(
  cwd: string,
  projectType: ProjectType,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[]
): Promise<void> {
  const specDir = join(cwd, ".viben/spec");
  ensureDir(specDir);

  // Guides - always created
  ensureDir(join(specDir, "guides"));
  const guidesFiles = [
    "index.md",
    "cross-layer-thinking-guide.md",
    "cross-platform-thinking-guide.md",
    "code-reuse-thinking-guide.md",
  ];

  for (const file of guidesFiles) {
    const content = readTemplate(`viben/spec/guides/${file}`);
    await writeFileIfNeeded(
      join(specDir, "guides", file),
      content,
      options,
      createdFiles,
      cwd
    );
  }

  // Backend specs (if backend or fullstack)
  if (projectType === "backend" || projectType === "fullstack") {
    ensureDir(join(specDir, "backend"));
    const backendFiles = [
      "index.md",
      "directory-structure.md",
      "database-guidelines.md",
      "logging-guidelines.md",
      "quality-guidelines.md",
      "error-handling.md",
    ];

    for (const file of backendFiles) {
      const content = readTemplate(`viben/spec/backend/${file}`);
      await writeFileIfNeeded(
        join(specDir, "backend", file),
        content,
        options,
        createdFiles,
        cwd
      );
    }
  }

  // Frontend specs (if frontend or fullstack)
  if (projectType === "frontend" || projectType === "fullstack") {
    ensureDir(join(specDir, "frontend"));
    const frontendFiles = [
      "index.md",
      "directory-structure.md",
      "type-safety.md",
      "hook-guidelines.md",
      "component-guidelines.md",
      "quality-guidelines.md",
      "state-management.md",
    ];

    for (const file of frontendFiles) {
      const content = readTemplate(`viben/spec/frontend/${file}`);
      await writeFileIfNeeded(
        join(specDir, "frontend", file),
        content,
        options,
        createdFiles,
        cwd
      );
    }
  }
}
