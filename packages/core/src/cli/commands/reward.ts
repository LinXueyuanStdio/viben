/**
 * viben reward - Reward type management for FileRL
 *
 * Manages reward types used to evaluate PR quality in the FileRL workflow.
 * Supports built-in types and user-defined custom types.
 *
 * Subcommands:
 * - list-types: List available reward types (builtin + custom)
 * - select: Select best task using PPO metrics
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
import {
  listTypes,
  selectBestTask,
  SELECT_DEFAULTS,
  type RewardType,
  type TaskCandidate,
} from "../../reward/ops";

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

  // ============================================================================
  // reward select
  // ============================================================================
  rewardCmd
    .command("select")
    .description("Select best task using PPO metrics")
    .argument("<tasks...>", "Task names to compare (must have computed rewards)")
    .option(
      "--threshold <number>",
      `Minimum adjusted reward threshold (default: ${SELECT_DEFAULTS.threshold})`,
      parseFloat
    )
    .option(
      "--kl-coef <number>",
      `KL penalty coefficient (default: ${SELECT_DEFAULTS.klCoef})`,
      parseFloat
    )
    .option(
      "--max-diff <number>",
      `Maximum diff lines for KL normalization (default: ${SELECT_DEFAULTS.maxDiff})`,
      (v: string) => parseInt(v, 10)
    )
    .option("--json", "JSON format output")
    .action(
      async (
        tasks: string[],
        options: {
          threshold?: number;
          klCoef?: number;
          maxDiff?: number;
          json?: boolean;
        }
      ) => {
        const ctx = getOutputContext(program);
        if (options.json) {
          ctx.json = true;
        }
        const cwd = process.cwd();

        try {
          const repoRoot = ensureVibenRoot(cwd);

          // Build options - only include defined values to allow defaults to apply
          const selectOptions: Parameters<typeof selectBestTask>[2] = {};
          if (options.threshold !== undefined) {
            if (isNaN(options.threshold)) {
              throw CliError.invalidArgument("threshold", "must be a valid number");
            }
            selectOptions.threshold = options.threshold;
          }
          if (options.klCoef !== undefined) {
            if (isNaN(options.klCoef)) {
              throw CliError.invalidArgument("kl-coef", "must be a valid number");
            }
            selectOptions.klCoef = options.klCoef;
          }
          if (options.maxDiff !== undefined) {
            if (isNaN(options.maxDiff)) {
              throw CliError.invalidArgument("max-diff", "must be a valid integer");
            }
            selectOptions.maxDiff = options.maxDiff;
          }

          const result = selectBestTask(repoRoot, tasks, selectOptions);

          if (!result.success) {
            throw CliError.operationFailed(
              "Select task",
              result.error || "Unknown error"
            );
          }

          // Prepare JSON output
          const jsonOutput = {
            baseline: result.baseline,
            threshold: result.threshold,
            candidates: result.candidates?.map((c: TaskCandidate) => ({
              task: c.task,
              reward: c.reward,
              diff_lines: c.diffLines,
              kl_penalty: c.klPenalty,
              adjusted_reward: c.adjustedReward,
              advantage: c.advantage,
              ppo_score: c.ppoScore,
            })),
            selected: result.selected,
            rejected: result.rejected,
          };

          output(ctx, successResponse(jsonOutput), () => {
            console.log(chalk.bold("PPO Selection Results"));
            console.log(chalk.bold("====================="));
            console.log();
            console.log(
              `Baseline: ${chalk.cyan(result.baseline?.toFixed(3))} | ` +
                `Threshold: ${chalk.cyan(result.threshold?.toFixed(1))}`
            );
            console.log();

            // Output table
            outputTable(
              ctx,
              ["TASK", "REWARD", "DIFF", "KL", "ADJUSTED", "ADVANTAGE", "STATUS"],
              (result.candidates || []).map((c: TaskCandidate) => {
                const isSelected = c.task === result.selected;
                const status = isSelected
                  ? chalk.green("SELECTED")
                  : chalk.gray("rejected");
                const advantage =
                  c.advantage >= 0
                    ? chalk.green(`+${c.advantage.toFixed(3)}`)
                    : chalk.red(c.advantage.toFixed(3));

                return [
                  isSelected ? chalk.bold(c.task) : c.task,
                  c.reward.toFixed(3),
                  String(c.diffLines),
                  c.klPenalty.toFixed(3),
                  c.adjustedReward.toFixed(3),
                  advantage,
                  status,
                ];
              })
            );

            console.log();
            if (result.selected) {
              console.log(`Selected: ${chalk.green.bold(result.selected)}`);
            } else {
              console.log(
                chalk.yellow("No task selected (none above threshold)")
              );
            }
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );
}
