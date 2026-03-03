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
 * - .claude/ - Claude Code agents, commands, hooks, and settings
 * - .cursor/ - Cursor IDE commands (optional)
 * - AGENTS.md - Root instructions file
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile, chmod, copyFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

/**
 * Get the templates directory path.
 * Templates are located in packages/core/templates/.
 */
function getTemplatesDir(): string {
  // In development: __dirname is packages/core/src/team
  // In production (dist): __dirname is packages/core/dist/team
  // Templates are at packages/core/templates/
  const currentDir = dirname(fileURLToPath(import.meta.url));

  // Check if we're in dist (production) or src (development)
  if (currentDir.includes("/dist/")) {
    // Production: packages/core/dist/team -> packages/core/templates
    return resolve(currentDir, "../../templates");
  } else {
    // Development: packages/core/src/team -> packages/core/templates
    return resolve(currentDir, "../../templates");
  }
}

/**
 * Read a template file from the Rust crate templates directory
 */
function readTemplate(relativePath: string): string {
  const templatesDir = getTemplatesDir();
  const fullPath = join(templatesDir, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Template not found: ${relativePath}`);
  }
  return readFileSync(fullPath, "utf-8");
}

/**
 * Project type for initialization
 */
export type ProjectType = "frontend" | "backend" | "fullstack";

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
  /** Include Cursor configuration */
  includeCursor?: boolean;
  /** Include Codex support (reserved for future) */
  includeCodex?: boolean;
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
 * Calculate SHA256 hash of content
 */
function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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
  if (existsSync(filePath)) {
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

/**
 * Write a file and make it executable
 */
async function writeExecutable(
  filePath: string,
  content: string,
  options: { force?: boolean; skipExisting?: boolean },
  createdFiles: string[],
  baseDir: string
): Promise<void> {
  await writeFileIfNeeded(filePath, content, options, createdFiles, baseDir);
  await chmod(filePath, 0o755);
}

/**
 * Initialize a Viben team workspace.
 *
 * Creates:
 * - .viben/ - Workflow files, scripts, specs, workspace
 * - .claude/ - Claude Code configuration
 * - .cursor/ - Cursor configuration (optional)
 * - AGENTS.md - Root instructions file
 *
 * @param options - Initialization options
 * @returns Initialization result
 */
export async function initTeam(options: InitOptions): Promise<InitResult> {
  const targetDir = options.targetDir || process.cwd();
  const projectType = options.projectType || "fullstack";
  const createdFiles: string[] = [];
  const warnings: string[] = [];

  // Validate developer name
  validateDeveloperName(options.developerName);

  const vibenDir = join(targetDir, ".viben");
  const claudeDir = join(targetDir, ".claude");
  const cursorDir = join(targetDir, ".cursor");

  // Check for existing .viben directory
  if (existsSync(vibenDir) && !options.force && !options.skipExisting) {
    throw new Error(`Directory already exists: ${vibenDir}`);
  }

  const writeOpts = {
    force: options.force,
    skipExisting: options.skipExisting,
  };

  // Template hashes for tracking
  const hashes: Record<string, string> = {};

  // ===================
  // Create .viben directory structure
  // ===================
  await mkdir(join(vibenDir, "scripts/common"), { recursive: true });
  await mkdir(join(vibenDir, "scripts/multi-agent"), { recursive: true });
  await mkdir(join(vibenDir, "workspace", options.developerName), {
    recursive: true,
  });
  await mkdir(join(vibenDir, "tasks/archive"), { recursive: true });
  await mkdir(join(vibenDir, "spec/backend"), { recursive: true });
  await mkdir(join(vibenDir, "spec/frontend"), { recursive: true });
  await mkdir(join(vibenDir, "spec/guides"), { recursive: true });

  // Root files from viben/ templates
  const workflowMd = readTemplate("viben/workflow.md");
  await writeFileIfNeeded(
    join(vibenDir, "workflow.md"),
    workflowMd,
    writeOpts,
    createdFiles,
    targetDir
  );
  hashes[".viben/workflow.md"] = sha256(workflowMd);

  const worktreeYaml = readTemplate("viben/worktree.yaml");
  await writeFileIfNeeded(
    join(vibenDir, "worktree.yaml"),
    worktreeYaml,
    writeOpts,
    createdFiles,
    targetDir
  );
  hashes[".viben/worktree.yaml"] = sha256(worktreeYaml);

  const gitignore = readTemplate("viben/gitignore.txt");
  await writeFileIfNeeded(
    join(vibenDir, ".gitignore"),
    gitignore,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Add .viben/worktrees to root .gitignore
  const rootGitignorePath = join(targetDir, ".gitignore");
  const worktreesIgnoreEntry = ".viben/worktrees";
  if (existsSync(rootGitignorePath)) {
    const rootGitignoreContent = readFileSync(rootGitignorePath, "utf-8");
    if (!rootGitignoreContent.includes(worktreesIgnoreEntry)) {
      const newContent = rootGitignoreContent.endsWith("\n")
        ? `${rootGitignoreContent}\n# Viben worktrees (git worktrees for multi-agent workflows)\n${worktreesIgnoreEntry}\n`
        : `${rootGitignoreContent}\n\n# Viben worktrees (git worktrees for multi-agent workflows)\n${worktreesIgnoreEntry}\n`;
      await writeFile(rootGitignorePath, newContent, "utf-8");
      warnings.push(`Added ${worktreesIgnoreEntry} to root .gitignore`);
    }
  } else {
    // Create root .gitignore with worktrees entry
    const newGitignore = `# Viben worktrees (git worktrees for multi-agent workflows)\n${worktreesIgnoreEntry}\n`;
    await writeFileIfNeeded(
      rootGitignorePath,
      newGitignore,
      writeOpts,
      createdFiles,
      targetDir
    );
  }

  const version = "1.0.0";
  await writeFileIfNeeded(
    join(vibenDir, ".version"),
    version,
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
  // Scripts - Main
  // ===================
  const mainScripts = [
    "task.sh",
    "init-developer.sh",
    "get-developer.sh",
    "get-context.sh",
    "add-session.sh",
    "create-bootstrap.sh",
  ];

  for (const script of mainScripts) {
    const content = readTemplate(`viben/scripts/${script}`);
    await writeExecutable(
      join(vibenDir, "scripts", script),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.viben/scripts/${script}`] = sha256(content);
  }

  // Scripts - Common
  const commonScripts = [
    "paths.sh",
    "developer.sh",
    "git-context.sh",
    "worktree.sh",
    "task-queue.sh",
    "task-utils.sh",
    "phase.sh",
    "registry.sh",
  ];

  for (const script of commonScripts) {
    const content = readTemplate(`viben/scripts/common/${script}`);
    await writeExecutable(
      join(vibenDir, "scripts/common", script),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.viben/scripts/common/${script}`] = sha256(content);
  }

  // Scripts - Multi-agent
  const multiAgentScripts = [
    "start.sh",
    "cleanup.sh",
    "status.sh",
    "create-pr.sh",
    "plan.sh",
  ];

  for (const script of multiAgentScripts) {
    const content = readTemplate(`viben/scripts/multi_agent/${script}`);
    await writeExecutable(
      join(vibenDir, "scripts/multi-agent", script),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.viben/scripts/multi-agent/${script}`] = sha256(content);
  }

  // ===================
  // Spec files
  // ===================
  // Guides (always created)
  const guidesFiles = [
    "index.md",
    "cross-layer-thinking-guide.md",
    "code-reuse-thinking-guide.md",
  ];

  for (const file of guidesFiles) {
    const content = readTemplate(`viben/spec/guides/${file}`);
    await writeFileIfNeeded(
      join(vibenDir, "spec/guides", file),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.viben/spec/guides/${file}`] = sha256(content);
  }

  // Backend specs (if backend or fullstack)
  if (projectType === "backend" || projectType === "fullstack") {
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
        join(vibenDir, "spec/backend", file),
        content,
        writeOpts,
        createdFiles,
        targetDir
      );
    }
  }

  // Frontend specs (if frontend or fullstack)
  if (projectType === "frontend" || projectType === "fullstack") {
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
        join(vibenDir, "spec/frontend", file),
        content,
        writeOpts,
        createdFiles,
        targetDir
      );
    }
  }

  // ===================
  // Workspace files
  // ===================
  const workspaceIndex = readTemplate("markdown/workspace-index.md");
  await writeFileIfNeeded(
    join(vibenDir, "workspace/index.md"),
    workspaceIndex,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Developer-specific files
  const today = now.toISOString().split("T")[0];
  const developerIndex = `# ${options.developerName} Workspace

> Personal workspace for AI Agent sessions

---

## Quick Stats

<!-- @@@auto:stats -->
| Metric | Value |
|--------|-------|
| Total Sessions | 0 |
| Last Active | ${today} |
| Current Journal | journal-1.md |
<!-- @@@/auto:stats -->

---

## Session History

<!-- @@@auto:history -->
| # | Date | Title | Commits |
|---|------|-------|---------|
<!-- @@@/auto:history -->

---

## Active Work

(None currently)

---

## Notes

(Add any personal notes here)
`;

  await writeFileIfNeeded(
    join(vibenDir, "workspace", options.developerName, "index.md"),
    developerIndex,
    writeOpts,
    createdFiles,
    targetDir
  );

  const journalContent = `# Journal 1

> Session records for ${options.developerName}

---

## Session 1: Workspace Initialized

**Date**: ${today}

### Summary

Initialized Viben Agent Organization workspace.

### Status

[OK] **Completed**
`;

  await writeFileIfNeeded(
    join(vibenDir, "workspace", options.developerName, "journal-1.md"),
    journalContent,
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Bootstrap task
  // ===================
  const taskDir = join(vibenDir, "tasks/00-bootstrap-guidelines");
  await mkdir(taskDir, { recursive: true });

  const taskJson = JSON.stringify(
    {
      title: "Bootstrap Project Guidelines",
      slug: "bootstrap-guidelines",
      status: "pending",
      priority: "P1",
      assignee: options.developerName,
      branch: null,
      scope: null,
      created_at: now.toISOString(),
      dev_type: projectType,
    },
    null,
    2
  );

  await writeFileIfNeeded(
    join(taskDir, "task.json"),
    taskJson,
    writeOpts,
    createdFiles,
    targetDir
  );

  const prdContent = `# Bootstrap Project Guidelines

## Objective

Fill in the placeholder guidelines in \`.viben/spec/\` with project-specific information.

## Tasks

1. **Backend Guidelines** (if applicable)
   - [ ] Update \`spec/backend/directory-structure.md\` with your project's structure
   - [ ] Update \`spec/backend/database-guidelines.md\` with your database conventions
   - [ ] Update \`spec/backend/error-handling.md\` with your error patterns
   - [ ] Update \`spec/backend/logging-guidelines.md\` with your logging setup
   - [ ] Update \`spec/backend/quality-guidelines.md\` with your quality standards

2. **Frontend Guidelines** (if applicable)
   - [ ] Update \`spec/frontend/directory-structure.md\` with your project's structure
   - [ ] Update \`spec/frontend/component-guidelines.md\` with your component patterns
   - [ ] Update \`spec/frontend/state-management.md\` with your state approach
   - [ ] Update \`spec/frontend/type-safety.md\` with your TypeScript conventions
   - [ ] Update \`spec/frontend/hook-guidelines.md\` with your custom hooks
   - [ ] Update \`spec/frontend/quality-guidelines.md\` with your quality standards

3. **Review Guides**
   - [ ] Read \`spec/guides/cross-layer-thinking-guide.md\`
   - [ ] Read \`spec/guides/code-reuse-thinking-guide.md\`

## Acceptance Criteria

- [ ] All placeholder text replaced with project-specific content
- [ ] Guidelines reflect actual project conventions
- [ ] Team members can follow guidelines without ambiguity
`;

  await writeFileIfNeeded(
    join(taskDir, "prd.md"),
    prdContent,
    writeOpts,
    createdFiles,
    targetDir
  );

  // Set current task
  await writeFileIfNeeded(
    join(vibenDir, ".current-task"),
    ".viben/tasks/00-bootstrap-guidelines",
    writeOpts,
    createdFiles,
    targetDir
  );

  // ===================
  // Create .claude directory structure
  // ===================
  await mkdir(join(claudeDir, "agents"), { recursive: true });
  await mkdir(join(claudeDir, "commands/viben"), { recursive: true });
  await mkdir(join(claudeDir, "hooks"), { recursive: true });

  // settings.json
  const settingsJson = readTemplate("claude/settings.json");
  await writeFileIfNeeded(
    join(claudeDir, "settings.json"),
    settingsJson,
    writeOpts,
    createdFiles,
    targetDir
  );
  hashes[".claude/settings.json"] = sha256(settingsJson);

  // Agents
  const agents = [
    "check.md",
    "debug.md",
    "dispatch.md",
    "implement.md",
    "plan.md",
    "research.md",
  ];

  for (const agent of agents) {
    const content = readTemplate(`claude/agents/${agent}`);
    await writeFileIfNeeded(
      join(claudeDir, "agents", agent),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.claude/agents/${agent}`] = sha256(content);
  }

  // Commands
  const commands = [
    "before-backend-dev.md",
    "before-frontend-dev.md",
    "break-loop.md",
    "check-backend.md",
    "check-cross-layer.md",
    "check-frontend.md",
    "create-command.md",
    "finish-work.md",
    "integrate-skill.md",
    "onboard.md",
    "parallel.md",
    "record-session.md",
    "start.md",
    "update-spec.md",
  ];

  for (const cmd of commands) {
    const content = readTemplate(`claude/commands/${cmd}`);
    await writeFileIfNeeded(
      join(claudeDir, "commands/viben", cmd),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.claude/commands/viben/${cmd}`] = sha256(content);
  }

  // Hooks
  const hooks = [
    "inject-subagent-context.py",
    "ralph-loop.py",
    "session-start.py",
  ];

  for (const hook of hooks) {
    const content = readTemplate(`claude/hooks/${hook}`);
    await writeExecutable(
      join(claudeDir, "hooks", hook),
      content,
      writeOpts,
      createdFiles,
      targetDir
    );
    hashes[`.claude/hooks/${hook}`] = sha256(content);
  }

  // ===================
  // Create .cursor directory (optional)
  // ===================
  if (options.includeCursor !== false) {
    await mkdir(join(cursorDir, "commands"), { recursive: true });

    // Cursor commands - note: not all claude commands have cursor equivalents
    // Cursor uses viben- prefix in filenames
    const cursorCommands = [
      "before-backend-dev.md",
      "before-frontend-dev.md",
      "break-loop.md",
      "check-backend.md",
      "check-cross-layer.md",
      "check-frontend.md",
      "create-command.md",
      "finish-work.md",
      "integrate-skill.md",
      "onboard.md",
      "record-session.md",
      "start.md",
      "update-spec.md",
    ];

    for (const cmd of cursorCommands) {
      const content = readTemplate(`cursor/commands/viben-${cmd}`);
      await writeFileIfNeeded(
        join(cursorDir, "commands", `viben-${cmd}`),
        content,
        writeOpts,
        createdFiles,
        targetDir
      );
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

  return {
    success: true,
    path: targetDir,
    files: createdFiles,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
