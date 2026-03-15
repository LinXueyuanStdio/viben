/**
 * viben reward - Reward type management for FileRL
 *
 * Manages reward types used to evaluate PR quality in the FileRL workflow.
 * Supports built-in types and user-defined custom types.
 *
 * Subcommands:
 * - list-types: List available reward types (builtin + custom)
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  handleCommandError,
} from "../lib";
import { CliError } from "../types";
import { findVibenRoot } from "../lib/viben-workspace";

// Import from reward/ops module
import { listTypes, type RewardType } from "../../reward/ops";

// =============================================================================
// Helpers
// =============================================================================

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
 * Check if the .viben directory exists and return the repo root
 */
function ensureVibenRoot(cwd: string): string {
  const repoRoot = findVibenRoot(cwd);
  if (!repoRoot) {
    throw CliError.operationFailed(
      "Reward command",
      `Not a Viben workspace (.viben not found). Run "viben team init" first.`
    );
  }
  return repoRoot;
}

/**
 * Format source for display
 */
function formatSource(source: string): string {
  switch (source) {
    case "builtin":
      return chalk.blue(source);
    case "custom":
      return chalk.green(source);
    default:
      return chalk.gray(source);
  }
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the reward command
 */
export function registerRewardCommand(program: Command): void {
  const rewardCmd = program
    .command("reward")
    .description("Reward type management for FileRL");

  // ============================================================================
  // reward list-types
  // ============================================================================
  rewardCmd
    .command("list-types")
    .description("List available reward types (builtin + custom)")
    .option("--json", "JSON format output")
    .action(async (options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);
        const result = listTypes(repoRoot);

        if (!result.success) {
          throw CliError.operationFailed(
            "List types",
            result.error || "Unknown error"
          );
        }

        output(ctx, successResponse({ types: result.types, count: result.count }), () => {
          console.log(chalk.bold("Available Reward Types:"));
          console.log();
          outputTable(
            ctx,
            ["NAME", "SOURCE", "DESCRIPTION"],
            result.types.map((t: RewardType) => [
              t.name,
              formatSource(t.source),
              t.description,
            ])
          );

          if (result.count > 0) {
            console.log();
            console.log(chalk.gray(`Total: ${result.count} type(s)`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
