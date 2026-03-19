/**
 * viben reward - Reward type management for FileRL
 *
 * Manages reward types used to evaluate PR quality in the FileRL workflow.
 * Supports built-in types and user-defined custom types.
 *
 * Subcommands:
 * - list-types: List available reward types (builtin + custom)
 * - select: Select best task using PPO metrics
 * - compute-for-task: Compute reward for a task
 * - type: Reward type CRUD subcommands
 *   - type list: List reward types
 *   - type view: View a reward type
 *   - type create: Create a custom reward type
 *   - type update: Update a custom reward type
 *   - type delete: Delete a custom reward type
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  outputWarning,
  handleCommandError,
} from "../lib";
import { CliError } from "../types";
import { findVibenRoot, resolveTaskDirectory } from "../lib/viben-workspace";
import { runRewardPhaseSync } from "../../task/phase";

// Import from reward/ops module
import {
  listTypes,
  viewType,
  createType,
  updateType,
  deleteType,
  selectBestTask,
  SELECT_DEFAULTS,
  CUSTOM_REWARD_TYPES_DIR,
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

  // ============================================================================
  // reward compute-for-task (alias for `viben task compute-reward`)
  // ============================================================================
  rewardCmd
    .command("compute-for-task")
    .description("Compute reward for a task (alias for `viben task compute-reward`)")
    .argument("<task>", "Task name or directory")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .option("-v, --verbose", "Enable verbose output")
    .option("--json", "JSON format output")
    .action(async (task: string, options: { platform?: string; verbose?: boolean; json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Resolve task directory
        const taskDir = resolveTaskDirectory(task, repoRoot);
        if (!taskDir) {
          throw CliError.invalidArgument("task", `Task not found: ${task}`);
        }

        const result = runRewardPhaseSync(repoRoot, taskDir, {
          platform: options.platform,
          verbose: options.verbose,
        });

        if (!result.success) {
          throw CliError.operationFailed("Compute Reward", result.error || "Unknown error");
        }

        output(ctx, successResponse(result), () => {
          console.log(chalk.green("=== Reward Agent Started ==="));
          console.log();
          console.log(`  ID:   ${result.agentId}`);
          console.log(`  PID:  ${result.pid}`);
          console.log(`  Log:  ${result.logFile}`);

          if (result.warnings && result.warnings.length > 0) {
            console.log();
            console.log(chalk.yellow("Warnings:"));
            for (const warning of result.warnings) {
              console.log(`  - ${warning}`);
            }
          }

          console.log();
          console.log(chalk.gray("To monitor:"));
          console.log(`  tail -f ${result.logFile}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // reward type - Reward type CRUD subcommands
  // ============================================================================
  const typeCmd = rewardCmd
    .command("type")
    .description("Manage reward types (list, view, create, update, delete)");

  // ----------------------------------------------------------------------------
  // reward type list
  // ----------------------------------------------------------------------------
  typeCmd
    .command("list")
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
          throw CliError.operationFailed("List types", result.error || "Unknown error");
        }

        output(ctx, successResponse({ types: result.types, count: result.count }), () => {
          console.log(chalk.bold("Available Reward Types:"));
          console.log();
          outputTable(
            ctx,
            ["NAME", "SOURCE", "WEIGHT", "DESCRIPTION"],
            result.types.map((t: RewardType) => [
              t.name,
              formatSource(t.source),
              t.weightDefault?.toFixed(2) || "-",
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

  // ----------------------------------------------------------------------------
  // reward type view <name>
  // ----------------------------------------------------------------------------
  typeCmd
    .command("view")
    .description("View details of a reward type")
    .argument("<name>", "Reward type name")
    .option("--json", "JSON format output")
    .option("--show-prompt", "Show prompt content")
    .action(async (name: string, options: { json?: boolean; showPrompt?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);
        const result = viewType(repoRoot, name);

        if (!result.success) {
          throw CliError.notFound("Reward type", name);
        }

        const rt = result.rewardType!;

        output(ctx, successResponse({
          reward_type: {
            name: rt.name,
            description: rt.description,
            weight_default: rt.weightDefault,
            source: rt.source,
            prompt_path: rt.promptPath,
          },
          prompt_content: options.showPrompt ? result.promptContent : undefined,
        }), () => {
          console.log(chalk.bold(`Reward Type: ${rt.name}`));
          console.log();
          outputKeyValue(ctx, {
            "Name": rt.name,
            "Description": rt.description,
            "Source": formatSource(rt.source),
            "Default Weight": rt.weightDefault?.toString() || "(none)",
            "Prompt Path": rt.promptPath,
          });

          if (options.showPrompt && result.promptContent) {
            console.log();
            console.log(chalk.bold("Prompt Content:"));
            console.log(chalk.gray("─".repeat(60)));
            console.log(result.promptContent);
            console.log(chalk.gray("─".repeat(60)));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ----------------------------------------------------------------------------
  // reward type create <name>
  // ----------------------------------------------------------------------------
  typeCmd
    .command("create")
    .description("Create a new custom reward type")
    .argument("<name>", "Reward type name")
    .requiredOption("-d, --description <text>", "Description of the reward type")
    .option("-w, --weight <number>", "Default weight (0.0 - 1.0)", parseFloat)
    .option("--json", "JSON format output")
    .action(async (
      name: string,
      options: { description: string; weight?: number; json?: boolean }
    ) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Validate weight if provided
        if (options.weight !== undefined) {
          if (isNaN(options.weight) || options.weight < 0 || options.weight > 1) {
            throw CliError.invalidArgument("weight", "must be a number between 0.0 and 1.0");
          }
        }

        const result = createType(repoRoot, {
          name,
          description: options.description,
          weightDefault: options.weight,
        });

        if (!result.success) {
          throw CliError.operationFailed("Create type", result.error || "Unknown error");
        }

        output(ctx, successResponse({
          reward_type: result.rewardType ? {
            name: result.rewardType.name,
            description: result.rewardType.description,
            weight_default: result.rewardType.weightDefault,
            source: result.rewardType.source,
            prompt_path: result.rewardType.promptPath,
          } : null,
          file_path: result.filePath,
        }), () => {
          outputSuccess(ctx, `Created reward type: ${name}`);
          console.log();
          console.log(`  File: ${result.filePath}`);
          console.log();
          console.log(chalk.gray(`Edit the prompt at: ${result.filePath}`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ----------------------------------------------------------------------------
  // reward type update <name>
  // ----------------------------------------------------------------------------
  typeCmd
    .command("update")
    .description("Update a custom reward type")
    .argument("<name>", "Reward type name")
    .option("-d, --description <text>", "New description")
    .option("-w, --weight <number>", "New default weight (0.0 - 1.0)", parseFloat)
    .option("--json", "JSON format output")
    .action(async (
      name: string,
      options: { description?: string; weight?: number; json?: boolean }
    ) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Validate weight if provided
        if (options.weight !== undefined) {
          if (isNaN(options.weight) || options.weight < 0 || options.weight > 1) {
            throw CliError.invalidArgument("weight", "must be a number between 0.0 and 1.0");
          }
        }

        // Check if any updates provided
        if (options.description === undefined && options.weight === undefined) {
          throw CliError.invalidArgument("options", "must provide at least one of --description or --weight");
        }

        const updates: { description?: string; weightDefault?: number } = {};
        if (options.description !== undefined) updates.description = options.description;
        if (options.weight !== undefined) updates.weightDefault = options.weight;

        const result = updateType(repoRoot, name, updates);

        if (!result.success) {
          if (result.error?.includes("not found")) {
            throw CliError.notFound("Reward type", name);
          }
          throw CliError.operationFailed("Update type", result.error || "Unknown error");
        }

        output(ctx, successResponse({
          reward_type: result.rewardType ? {
            name: result.rewardType.name,
            description: result.rewardType.description,
            weight_default: result.rewardType.weightDefault,
            source: result.rewardType.source,
            prompt_path: result.rewardType.promptPath,
          } : null,
        }), () => {
          outputSuccess(ctx, `Updated reward type: ${name}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ----------------------------------------------------------------------------
  // reward type delete <name>
  // ----------------------------------------------------------------------------
  typeCmd
    .command("delete")
    .description("Delete a custom reward type")
    .argument("<name>", "Reward type name")
    .option("--json", "JSON format output")
    .option("-f, --force", "Skip confirmation")
    .action(async (
      name: string,
      options: { json?: boolean; force?: boolean }
    ) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Check if type exists and is deletable
        const viewResult = viewType(repoRoot, name);
        if (!viewResult.success) {
          throw CliError.notFound("Reward type", name);
        }

        if (viewResult.rewardType?.source === "builtin") {
          // Check if there's a custom override
          const customDir = `${repoRoot}/${CUSTOM_REWARD_TYPES_DIR}`;
          const customPath = `${customDir}/${name}.md`;
          const { existsSync } = await import("node:fs");
          if (!existsSync(customPath)) {
            throw CliError.operationFailed(
              "Delete type",
              `Cannot delete builtin type "${name}". Builtin types are shipped with viben.`
            );
          }
        }

        const result = deleteType(repoRoot, name);

        if (!result.success) {
          if (result.error?.includes("not found")) {
            throw CliError.notFound("Reward type", name);
          }
          throw CliError.operationFailed("Delete type", result.error || "Unknown error");
        }

        output(ctx, successResponse({ deleted_type: result.deletedType }), () => {
          outputSuccess(ctx, `Deleted reward type: ${name}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
