/**
 * viben context - Get current development context
 *
 * Displays developer identity, Git status, current task, active tasks,
 * and journal file status. Useful for AI agents to understand project state.
 *
 * Usage:
 *   viben context         - Display full context (text format)
 *   viben context --json  - JSON format output
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import { runVibenScript, findVibenRoot } from "../lib/python-runner";

/**
 * Context data structure (matches Python script output)
 */
interface ContextData {
  developer: string;
  git: {
    branch: string;
    isClean: boolean;
    uncommittedChanges: number;
    recentCommits: Array<{
      hash: string;
      message: string;
    }>;
  };
  tasks: {
    active: Array<{
      dir: string;
      name: string;
      status: string;
    }>;
    directory: string;
  };
  journal: {
    file: string;
    lines: number;
    nearLimit: boolean;
  };
}

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
 * Register the context command
 */
export function registerContextCommand(program: Command): void {
  program
    .command("context")
    .description("Get current development context")
    .option("-j, --json", "Output in JSON format")
    .action(async (options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      // Support both --json (global) and --json (local) for JSON output
      const wantJson = ctx.json || options.json;

      try {
        // Check if we're in a Viben workspace
        const workspaceRoot = findVibenRoot();
        if (!workspaceRoot) {
          output(
            ctx,
            errorResponse("NOT_IN_WORKSPACE", "Not in a Viben workspace"),
            () => {
              console.log(chalk.red("Error: Not in a Viben workspace."));
              console.log();
              console.log("Initialize a workspace with:");
              console.log(chalk.cyan("  viben team init --user <name>"));
            }
          );
          process.exit(1);
        }

        // Run the Python script
        const args = wantJson ? ["--json"] : [];
        const result = await runVibenScript("get_context.py", args);

        if (result.code !== 0) {
          output(
            ctx,
            errorResponse("SCRIPT_ERROR", result.stderr || "Failed to get context"),
            () => {
              console.error(chalk.red(`Error: ${result.stderr || "Failed to get context"}`));
            }
          );
          process.exit(1);
        }

        if (wantJson) {
          // Parse and re-output JSON for consistent formatting
          try {
            const data = JSON.parse(result.stdout) as ContextData;
            output(
              ctx,
              successResponse(data),
              () => {
                // In global JSON mode (--json before command), output() handles it
                // For local --json (after command), print formatted JSON
                if (!ctx.json) {
                  console.log(JSON.stringify(data, null, 2));
                }
              }
            );
          } catch {
            // If parsing fails, output raw
            console.log(result.stdout);
          }
        } else {
          // Text mode: output directly from Python script
          console.log(result.stdout);
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
