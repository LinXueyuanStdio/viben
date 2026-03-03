/**
 * User CLI commands
 *
 * Manages user identity for the Trellis workflow.
 * Each developer/agent needs to initialize their identity before using
 * task management and session recording features.
 */
import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, parse } from "node:path";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  handleCommandError,
  outputSuccess,
  outputKeyValue,
} from "../lib";

/**
 * Directory and file constants
 */
const DIR_VIBEN = ".viben";
const DIR_WORKSPACE = "workspace";
const FILE_DEVELOPER = ".developer";
const FILE_JOURNAL_PREFIX = "journal-";

/**
 * Get output context from program options
 */
function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Find the root directory containing .viben/ folder.
 * Traverses up from the given directory.
 */
function findVibenRoot(startDir: string): string | null {
  let currentDir = resolve(startDir);
  const root = parse(currentDir).root;

  while (currentDir !== root) {
    const vibenDir = join(currentDir, DIR_VIBEN);
    if (existsSync(vibenDir)) {
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
 * Get developer name from .developer file
 */
async function getDeveloper(repoRoot: string): Promise<string | null> {
  const devFile = join(repoRoot, DIR_VIBEN, FILE_DEVELOPER);

  if (!existsSync(devFile)) {
    return null;
  }

  try {
    const content = await readFile(devFile, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("name=")) {
        return line.split("=")[1]?.trim() || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Initialize developer identity
 */
async function initDeveloper(
  name: string,
  repoRoot: string
): Promise<{ success: boolean; files: string[] }> {
  const vibenDir = join(repoRoot, DIR_VIBEN);
  const devFile = join(vibenDir, FILE_DEVELOPER);
  const workspaceDir = join(vibenDir, DIR_WORKSPACE, name);
  const files: string[] = [];

  // Create .developer file
  const initializedAt = new Date().toISOString();
  const devContent = `name=${name}\ninitialized_at=${initializedAt}\n`;

  try {
    await writeFile(devFile, devContent, "utf-8");
    files.push(FILE_DEVELOPER);
  } catch (error) {
    throw new Error(`Failed to create .developer file: ${error}`);
  }

  // Create workspace directory
  try {
    await mkdir(workspaceDir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create workspace directory: ${error}`);
  }

  // Create initial journal file
  const journalFile = join(workspaceDir, `${FILE_JOURNAL_PREFIX}1.md`);
  if (!existsSync(journalFile)) {
    const today = new Date().toISOString().split("T")[0];
    const journalContent = `# Journal - ${name} (Part 1)

> AI development session journal
> Started: ${today}

---

`;
    try {
      await writeFile(journalFile, journalContent, "utf-8");
      files.push(`${DIR_WORKSPACE}/${name}/${FILE_JOURNAL_PREFIX}1.md`);
    } catch (error) {
      throw new Error(`Failed to create journal file: ${error}`);
    }
  }

  // Create index.md
  const indexFile = join(workspaceDir, "index.md");
  if (!existsSync(indexFile)) {
    const indexContent = `# Workspace Index - ${name}

> Journal tracking for AI development sessions.

---

## Current Status

<!-- @@@auto:current-status -->
- **Active File**: \`journal-1.md\`
- **Total Sessions**: 0
- **Last Active**: -
<!-- @@@/auto:current-status -->

---

## Active Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| \`journal-1.md\` | ~0 | Active |
<!-- @@@/auto:active-documents -->

---

## Session History

<!-- @@@auto:session-history -->
| # | Date | Title | Commits |
|---|------|-------|---------|
<!-- @@@/auto:session-history -->

---

## Notes

- Sessions are appended to journal files
- New journal file created when current exceeds 2000 lines
- Use \`viben session add\` to record sessions
`;
    try {
      await writeFile(indexFile, indexContent, "utf-8");
      files.push(`${DIR_WORKSPACE}/${name}/index.md`);
    } catch (error) {
      throw new Error(`Failed to create index.md: ${error}`);
    }
  }

  return { success: true, files };
}

/**
 * Register user commands
 */
export function registerUserCommand(program: Command): void {
  const user = program.command("user").description("Manage user identity");

  // user init <name> - initialize user identity
  user
    .command("init")
    .description("Initialize user identity")
    .argument("<name>", "User name (e.g., john, claude-agent)")
    .action(async (name: string) => {
      const ctx = getOutputContext(program);
      try {
        // Validate name
        if (!name || name.trim() === "") {
          throw new Error("User name is required");
        }

        // Find .viben directory
        const repoRoot = findVibenRoot(process.cwd());
        if (!repoRoot) {
          throw new Error(
            "Not in a Viben workspace. Run 'viben init' first to create a workspace."
          );
        }

        // Check if already initialized
        const existing = await getDeveloper(repoRoot);
        if (existing) {
          output(
            ctx,
            successResponse({ user: existing, alreadyInitialized: true }),
            () => {
              console.log(`Developer already initialized: ${chalk.cyan(existing)}`);
              console.log();
              console.log(
                chalk.gray(
                  `To reinitialize, remove ${DIR_VIBEN}/${FILE_DEVELOPER} first`
                )
              );
            }
          );
          return;
        }

        // Initialize developer
        const result = await initDeveloper(name, repoRoot);

        output(ctx, successResponse({ user: name, files: result.files }), () => {
          console.log(chalk.green(`Developer initialized: ${name}`));
          console.log();
          console.log("Created:");
          for (const file of result.files) {
            console.log(chalk.gray(`  ${DIR_VIBEN}/${file}`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // user get - get current user identity
  user
    .command("get")
    .description("Get current user identity")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        // Find .viben directory
        const repoRoot = findVibenRoot(process.cwd());
        if (!repoRoot) {
          throw new Error(
            "Not in a Viben workspace. Run 'viben init' first to create a workspace."
          );
        }

        // Get developer
        const developer = await getDeveloper(repoRoot);

        if (!developer) {
          if (ctx.json) {
            output(ctx, successResponse({ user: null }), () => {});
          } else {
            console.error("Developer not initialized");
            process.exit(1);
          }
          return;
        }

        output(ctx, successResponse({ user: developer }), () => {
          console.log(developer);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // user status - show user status and info
  user
    .command("status")
    .description("Show user status and workspace info")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        // Find .viben directory
        const repoRoot = findVibenRoot(process.cwd());
        if (!repoRoot) {
          throw new Error(
            "Not in a Viben workspace. Run 'viben init' first to create a workspace."
          );
        }

        // Get developer
        const developer = await getDeveloper(repoRoot);

        if (!developer) {
          output(ctx, successResponse({ initialized: false }), () => {
            console.log(chalk.yellow("Developer not initialized"));
            console.log();
            console.log("Run:");
            console.log(chalk.cyan("  viben user init <your-name>"));
          });
          return;
        }

        const workspaceDir = join(repoRoot, DIR_VIBEN, DIR_WORKSPACE, developer);
        const hasWorkspace = existsSync(workspaceDir);

        const status = {
          initialized: true,
          user: developer,
          workspace: hasWorkspace ? workspaceDir : null,
          repoRoot,
        };

        output(ctx, successResponse(status), () => {
          console.log(chalk.bold("User Status"));
          console.log();
          outputKeyValue(ctx, {
            User: developer,
            Workspace: hasWorkspace
              ? `${DIR_VIBEN}/${DIR_WORKSPACE}/${developer}/`
              : chalk.gray("(not found)"),
            "Repo Root": repoRoot,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
