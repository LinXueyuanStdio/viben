/**
 * viben session - Session recording management
 *
 * Subcommands:
 * - add: Add a new session record
 * - list: List session history
 */
import chalk from "chalk";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  outputTable,
  handleCommandError,
} from "../lib";

// =============================================================================
// Types
// =============================================================================

/**
 * Session entry parsed from index.md
 */
interface SessionEntry {
  /** Session number */
  number: number;
  /** Date string */
  date: string;
  /** Task/title */
  task: string;
  /** Commit hashes */
  commits: string;
}

/**
 * Session add result
 */
interface SessionAddResult {
  session: number;
  title: string;
  commit: string;
  journalFile: string;
}

// =============================================================================
// Constants
// =============================================================================

const DIR_WORKFLOW = ".viben";
const DIR_WORKSPACE = "workspace";
const FILE_DEVELOPER = ".developer";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find the nearest directory containing .viben/ folder
 */
function getRepoRoot(startPath?: string): string {
  let current = resolve(startPath || process.cwd());

  while (current !== resolve(current, "..")) {
    if (existsSync(join(current, DIR_WORKFLOW))) {
      return current;
    }
    current = resolve(current, "..");
  }

  // Fallback to current directory
  return process.cwd();
}

/**
 * Get developer name from .developer file
 */
function getDeveloper(repoRoot: string): string | null {
  const devFile = join(repoRoot, DIR_WORKFLOW, FILE_DEVELOPER);

  if (!existsSync(devFile)) {
    return null;
  }

  try {
    const content = readFileSync(devFile, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("name=")) {
        return line.split("=")[1]?.trim() || null;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get workspace directory for the developer
 */
function getWorkspaceDir(repoRoot: string, developer: string): string {
  return join(repoRoot, DIR_WORKFLOW, DIR_WORKSPACE, developer);
}

/**
 * Get all developers from workspace directory
 */
function getAllDevelopers(repoRoot: string): string[] {
  const workspaceDir = join(repoRoot, DIR_WORKFLOW, DIR_WORKSPACE);

  if (!existsSync(workspaceDir)) {
    return [];
  }

  try {
    return readdirSync(workspaceDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith("."))
      .map((dirent) => dirent.name);
  } catch {
    return [];
  }
}

/**
 * Parse sessions from index.md file
 */
function parseSessionsFromIndex(indexPath: string): SessionEntry[] {
  if (!existsSync(indexPath)) {
    return [];
  }

  const content = readFileSync(indexPath, "utf-8");
  const sessions: SessionEntry[] = [];

  // Find the @@@auto:session-history section
  const startMarker = "<!-- @@@auto:session-history -->";
  const endMarker = "<!-- @@@/auto:session-history -->";

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    return [];
  }

  const historySection = content.slice(startIdx + startMarker.length, endIdx);

  // Parse table rows (skip header and separator)
  // Format: | # | Date | Task | Commits |
  const lines = historySection.split("\n");
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip non-table lines
    if (!trimmed.startsWith("|")) continue;

    // Skip header row (contains "Date" or "#")
    if (trimmed.includes("| # |") || trimmed.includes("| Date |")) {
      headerPassed = true;
      continue;
    }

    // Skip separator row
    if (trimmed.match(/^\|\s*[-|]+\s*\|$/)) {
      continue;
    }

    // Parse data row
    if (headerPassed) {
      const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);

      if (cells.length >= 4) {
        const num = parseInt(cells[0], 10);
        if (!isNaN(num)) {
          sessions.push({
            number: num,
            date: cells[1],
            task: cells[2],
            commits: cells[3] || "-",
          });
        }
      }
    }
  }

  return sessions;
}

/**
 * Find Python interpreter
 */
function findPython(): string {
  const candidates = ["python3", "python"];

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], {
        encoding: "utf-8",
        timeout: 5000,
      });
      if (result.status === 0) {
        return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error("Python interpreter not found. Please install Python 3.");
}

/**
 * Find the add_session.py script
 */
function findAddSessionScript(repoRoot: string): string {
  // Check .viben/scripts/add_session.py
  const scriptPath = join(repoRoot, DIR_WORKFLOW, "scripts", "add_session.py");

  if (existsSync(scriptPath)) {
    return scriptPath;
  }

  throw new Error(
    `Script not found: ${scriptPath}\nRun 'viben team init' to initialize the workspace.`
  );
}

/**
 * Run the add_session.py script
 */
function runAddSessionScript(
  repoRoot: string,
  title: string,
  commit: string,
  summary: string,
  contentFile?: string
): SessionAddResult {
  const python = findPython();
  const script = findAddSessionScript(repoRoot);

  const args = [script, "--title", title, "--commit", commit, "--summary", summary];

  if (contentFile) {
    args.push("--content-file", contentFile);
  }

  // Run the script
  const result = spawnSync(python, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    timeout: 30000,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Failed to run add_session.py: ${result.error.message}`);
  }

  // The script outputs status to stderr
  if (result.stderr) {
    // Output the script's progress messages
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(
      `add_session.py failed with exit code ${result.status}\n${result.stderr || ""}`
    );
  }

  // Parse session number from stderr output
  // Expected format: "Session: 16"
  const sessionMatch = result.stderr?.match(/Session:\s*(\d+)/);
  const sessionNum = sessionMatch ? parseInt(sessionMatch[1], 10) : 0;

  // Parse journal file from stderr output
  // Expected format: "[OK] Appended session to journal-1.md"
  const journalMatch = result.stderr?.match(/Appended session to (journal-\d+\.md)/);
  const journalFile = journalMatch ? journalMatch[1] : "journal-1.md";

  return {
    session: sessionNum,
    title,
    commit,
    journalFile,
  };
}

// =============================================================================
// Output Context Helper
// =============================================================================

function getOutputContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the session command
 */
export function registerSessionCommand(program: Command): void {
  const session = program
    .command("session")
    .description("Session recording management");

  // session add
  session
    .command("add")
    .description("Add a new session record")
    .requiredOption("-t, --title <title>", "Session title")
    .option("-c, --commit <hash>", "Commit hash(es), comma-separated", "-")
    .option("-s, --summary <summary>", "Brief summary", "(Add summary)")
    .option("--content-file <path>", "Path to file with detailed content")
    .action(
      async (options: {
        title: string;
        commit: string;
        summary: string;
        contentFile?: string;
      }) => {
        const ctx = getOutputContext(program);

        try {
          const repoRoot = getRepoRoot();
          const developer = getDeveloper(repoRoot);

          if (!developer) {
            output(
              ctx,
              errorResponse(
                "DEVELOPER_NOT_INITIALIZED",
                "Developer not initialized. Run 'viben team init --user <name>' first."
              ),
              () => {
                console.log(chalk.red("Error: Developer not initialized."));
                console.log();
                console.log("Initialize with:");
                console.log(chalk.cyan("  viben team init --user <your-name>"));
              }
            );
            process.exit(1);
          }

          const result = runAddSessionScript(
            repoRoot,
            options.title,
            options.commit,
            options.summary,
            options.contentFile
          );

          output(
            ctx,
            successResponse({
              session: result.session,
              title: result.title,
              commit: result.commit,
              journal_file: result.journalFile,
            }),
            () => {
              // Script already outputs progress to stderr
              // Just add a final success message if not quiet
              if (!ctx.quiet) {
                console.log();
              }
            }
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // session list
  session
    .command("list")
    .description("List session history")
    .option("-a, --all", "Show all users' sessions")
    .option("-n, --limit <count>", "Limit number of sessions to show", "20")
    .action(
      async (options: {
        all?: boolean;
        limit: string;
      }) => {
        const ctx = getOutputContext(program);

        try {
          const repoRoot = getRepoRoot();
          const limit = parseInt(options.limit, 10) || 20;

          let allSessions: Array<SessionEntry & { developer?: string }> = [];

          if (options.all) {
            // Get sessions from all developers
            const developers = getAllDevelopers(repoRoot);

            for (const dev of developers) {
              const workspaceDir = getWorkspaceDir(repoRoot, dev);
              const indexPath = join(workspaceDir, "index.md");
              const sessions = parseSessionsFromIndex(indexPath);

              for (const s of sessions) {
                allSessions.push({ ...s, developer: dev });
              }
            }

            // Sort by date descending, then by session number descending
            allSessions.sort((a, b) => {
              const dateCompare = b.date.localeCompare(a.date);
              if (dateCompare !== 0) return dateCompare;
              return b.number - a.number;
            });
          } else {
            // Get sessions for current developer
            const developer = getDeveloper(repoRoot);

            if (!developer) {
              output(
                ctx,
                errorResponse(
                  "DEVELOPER_NOT_INITIALIZED",
                  "Developer not initialized. Run 'viben team init --user <name>' first."
                ),
                () => {
                  console.log(chalk.red("Error: Developer not initialized."));
                  console.log();
                  console.log("Initialize with:");
                  console.log(chalk.cyan("  viben team init --user <your-name>"));
                }
              );
              process.exit(1);
            }

            const workspaceDir = getWorkspaceDir(repoRoot, developer);
            const indexPath = join(workspaceDir, "index.md");
            allSessions = parseSessionsFromIndex(indexPath);

            // Sessions are already in descending order in the file
          }

          // Apply limit
          const limitedSessions = allSessions.slice(0, limit);

          // Output
          output(
            ctx,
            successResponse({
              sessions: limitedSessions,
              total: allSessions.length,
              showing: limitedSessions.length,
            }),
            () => {
              if (limitedSessions.length === 0) {
                console.log(chalk.gray("No sessions found."));
                console.log();
                console.log("Add a session with:");
                console.log(
                  chalk.cyan('  viben session add --title "Session Title" --commit "abc123"')
                );
                return;
              }

              const developer = getDeveloper(repoRoot);
              const title = options.all
                ? "Session History (All Users)"
                : `Session History (${developer})`;

              console.log(chalk.bold(`=== ${title} ===`));
              console.log();

              if (options.all) {
                // Include developer column
                outputTable(
                  ctx,
                  ["#", "Date", "User", "Task", "Commits"],
                  limitedSessions.map((s) => [
                    s.number,
                    s.date,
                    s.developer || "",
                    s.task,
                    s.commits,
                  ])
                );
              } else {
                outputTable(
                  ctx,
                  ["#", "Date", "Task", "Commits"],
                  limitedSessions.map((s) => [s.number, s.date, s.task, s.commits])
                );
              }

              console.log();
              console.log(`Total: ${allSessions.length} sessions`);
            }
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );
}
