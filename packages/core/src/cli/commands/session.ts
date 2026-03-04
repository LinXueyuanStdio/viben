/**
 * viben session - Session recording management
 *
 * Subcommands:
 * - add: Add a new session record
 * - list: List session history
 */
import chalk from "chalk";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  outputTable,
  handleCommandError,
} from "../lib";
import {
  findVibenRoot,
  getDeveloper as getWorkspaceDeveloper,
  getWorkspaceDir as getDevWorkspaceDir,
  getAllDevelopers,
  getJournalInfo,
  getCurrentSessionNumber,
  generateSessionContent,
  createNewJournalFile,
  updateIndexWithSession,
  getTodayDate,
  MAX_JOURNAL_LINES,
  DIR_VIBEN,
  DIR_WORKSPACE,
  FILE_JOURNAL_PREFIX,
} from "../lib/viben-workspace";

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
// Helper Functions
// =============================================================================

/**
 * Find the nearest directory containing .viben/ folder
 */
function getRepoRoot(startPath?: string): string {
  const root = findVibenRoot(startPath);
  if (!root) {
    // Fallback to current directory
    return resolve(process.cwd());
  }
  return root;
}

/**
 * Get developer name from .developer file
 */
function getDeveloper(repoRoot: string): string | null {
  return getWorkspaceDeveloper(repoRoot);
}

/**
 * Get workspace directory for the developer
 */
function getWorkspaceDir(repoRoot: string, developer: string): string {
  return join(repoRoot, DIR_VIBEN, DIR_WORKSPACE, developer);
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
 * Add a new session (native TypeScript implementation)
 */
async function addSession(
  repoRoot: string,
  title: string,
  commit: string,
  summary: string,
  extraContent: string
): Promise<SessionAddResult> {
  const developer = getDeveloper(repoRoot);
  if (!developer) {
    throw new Error("Developer not initialized");
  }

  const workspaceDir = getWorkspaceDir(repoRoot, developer);
  if (!existsSync(workspaceDir)) {
    throw new Error("Workspace directory not found");
  }

  const indexPath = join(workspaceDir, "index.md");
  const today = getTodayDate();

  // Get current journal info
  const { file: journalFile, number: currentNum, lines: currentLines } = getJournalInfo(repoRoot);
  const currentSession = getCurrentSessionNumber(indexPath);
  const newSession = currentSession + 1;

  // Generate session content
  const sessionContent = generateSessionContent({
    sessionNum: newSession,
    title,
    commit,
    summary,
    extraContent,
    date: today,
  });
  const contentLines = sessionContent.split("\n").length;

  // Log progress to stderr
  console.error("========================================");
  console.error("ADD SESSION");
  console.error("========================================");
  console.error("");
  console.error(`Session: ${newSession}`);
  console.error(`Title: ${title}`);
  console.error(`Commit: ${commit}`);
  console.error("");
  console.error(`Current journal file: ${FILE_JOURNAL_PREFIX}${currentNum}.md`);
  console.error(`Current lines: ${currentLines}`);
  console.error(`New content lines: ${contentLines}`);
  console.error(`Total after append: ${currentLines + contentLines}`);
  console.error("");

  // Determine target file
  let targetFile = journalFile;
  let targetNum = currentNum;

  // Check if we need to create a new journal file
  if (currentLines + contentLines > MAX_JOURNAL_LINES) {
    targetNum = currentNum + 1;
    console.error(`[!] Exceeds ${MAX_JOURNAL_LINES} lines, creating ${FILE_JOURNAL_PREFIX}${targetNum}.md`);
    targetFile = await createNewJournalFile({
      workspaceDir,
      number: targetNum,
      developer,
      date: today,
      prevNumber: currentNum,
    });
    console.error(`Created: ${targetFile}`);
  }

  // Append session content to journal file
  if (targetFile) {
    await appendFile(targetFile, sessionContent, "utf-8");
    console.error(`[OK] Appended session to ${basename(targetFile)}`);
  }

  console.error("");

  // Update index.md
  const activeFile = `${FILE_JOURNAL_PREFIX}${targetNum}.md`;
  const updated = await updateIndexWithSession({
    indexPath,
    workspaceDir,
    sessionNum: newSession,
    title,
    commit,
    activeFile,
    date: today,
  });

  if (!updated) {
    throw new Error("Failed to update index.md - markers not found");
  }

  console.error(`Updating index.md for session ${newSession}...`);
  console.error(`  Title: ${title}`);
  console.error(`  Commit: ${commit}`);
  console.error(`  Active File: ${activeFile}`);
  console.error("");
  console.error("[OK] Updated index.md successfully!");
  console.error("");
  console.error("========================================");
  console.error(`[OK] Session ${newSession} added successfully!`);
  console.error("========================================");
  console.error("");
  console.error("Files updated:");
  console.error(`  - ${basename(targetFile || "journal")}`);
  console.error("  - index.md");

  return {
    session: newSession,
    title,
    commit,
    journalFile: basename(targetFile || "journal-1.md"),
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

          // Read extra content from file or stdin
          let extraContent = "(Add details)";
          if (options.contentFile) {
            if (existsSync(options.contentFile)) {
              extraContent = readFileSync(options.contentFile, "utf-8");
            }
          } else if (!process.stdin.isTTY && process.stdin.readable && !process.stdin.readableEnded) {
            // Read from stdin if available (non-interactive mode)
            // Only read if stdin is readable and not already ended (has actual piped data)
            try {
              // Try to read with a short timeout
              const readPromise = new Promise<string>(async (resolve, reject) => {
                const chunks: Buffer[] = [];
                let hasData = false;

                // Listen for data event
                const onData = (chunk: Buffer) => {
                  hasData = true;
                  chunks.push(chunk);
                };

                const onEnd = () => {
                  cleanup();
                  const content = Buffer.concat(chunks).toString("utf-8").trim();
                  resolve(content);
                };

                const onError = (err: Error) => {
                  cleanup();
                  reject(err);
                };

                const cleanup = () => {
                  process.stdin.removeListener("data", onData);
                  process.stdin.removeListener("end", onEnd);
                  process.stdin.removeListener("error", onError);
                };

                process.stdin.on("data", onData);
                process.stdin.on("end", onEnd);
                process.stdin.on("error", onError);

                // If no data arrives within 100ms, assume no stdin input
                setTimeout(() => {
                  if (!hasData) {
                    cleanup();
                    resolve("");
                  }
                }, 100);
              });

              const stdinContent = await readPromise;
              if (stdinContent) {
                extraContent = stdinContent;
              }
            } catch {
              // Keep default value if stdin read fails
            }
          }

          const result = await addSession(
            repoRoot,
            options.title,
            options.commit,
            options.summary,
            extraContent
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
