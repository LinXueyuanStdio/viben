/**
 * viben filerl - FileRL (File-based Reinforcement Learning) command
 *
 * FileRL treats codebase as "model parameters" and uses PPO algorithm
 * to iteratively optimize code quality.
 *
 * Subcommands:
 * - create: Create a new FileRL target file
 * - start: Start FileRL with a target file
 * - status: View status of a FileRL run
 * - list: List all FileRL runs
 * - stop: Stop an active FileRL run
 * - resume: Resume a paused FileRL run
 */

import chalk from "chalk";
import type { Command } from "commander";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";

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
import { findVibenRoot } from "../lib/viben-workspace";

// Import filerl ops
import {
  parseTarget,
  validateConfig,
  generateTargetContent,
  initRun,
  runFileRlLoop,
  stop,
  resume,
  listRuns,
  getStatus,
  readState,
  type FileRlConfig,
  type FileRlState,
  type IterationState,
} from "../../filerl/ops";

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
 * Ensure we're in a viben workspace
 */
function ensureVibenRoot(cwd: string): string {
  const repoRoot = findVibenRoot(cwd);
  if (!repoRoot) {
    throw CliError.operationFailed(
      "FileRL command",
      `Not a Viben workspace (.viben not found). Run "viben team init" first.`
    );
  }
  return repoRoot;
}

/**
 * Format boolean as status indicator
 */
function formatStatus(value: boolean, trueText: string, falseText: string): string {
  return value ? chalk.green(trueText) : chalk.gray(falseText);
}

/**
 * Format iteration state for display
 */
function formatIterationState(iter: IterationState): string {
  if (iter.completed) {
    return iter.selected_task
      ? chalk.green(`completed (selected: ${iter.selected_task})`)
      : chalk.yellow("completed (no selection)");
  }
  return chalk.cyan("in progress");
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the filerl command
 */
export function registerFileRlCommand(program: Command): void {
  const fileRlCmd = program
    .command("filerl")
    .description("FileRL - File-based Reinforcement Learning for code optimization");

  // ============================================================================
  // filerl create <name>
  // ============================================================================
  fileRlCmd
    .command("create")
    .description("Create a new FileRL target file")
    .argument("<name>", "Name for the FileRL target")
    .option("-d, --description <text>", "Description of the target")
    .option("-o, --output <path>", "Output path (default: <name>.md)")
    .option("--json", "JSON format output")
    .action(async (name: string, options: {
      description?: string;
      output?: string;
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Determine output path
        const outputPath = options.output || `${name}.md`;
        const fullPath = resolve(repoRoot, outputPath);

        // Check if file already exists
        if (existsSync(fullPath)) {
          throw CliError.operationFailed(
            "Init target",
            `File already exists: ${outputPath}`
          );
        }

        // Generate content
        const content = generateTargetContent(name, options.description);

        // Ensure directory exists
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Write file
        writeFileSync(fullPath, content, "utf-8");

        output(ctx, successResponse({ name, path: outputPath }), () => {
          outputSuccess(ctx, `Created FileRL target: ${outputPath}`);
          console.log();
          console.log("Next steps:");
          console.log(`  1. Edit ${outputPath} to configure your optimization goals`);
          console.log(`  2. Run: viben filerl start ${outputPath}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl start <target>
  // ============================================================================
  fileRlCmd
    .command("start")
    .description("Start FileRL with a target file")
    .argument("<target>", "Path to FileRL target file (*.md)")
    .option("--force", "Force restart even if run is active")
    .option("--dry-run", "Parse and validate without running")
    .option("--json", "JSON format output")
    .action(async (target: string, options: {
      force?: boolean;
      dryRun?: boolean;
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Parse target file
        const parseResult = parseTarget(target, repoRoot);
        if (!parseResult.success || !parseResult.config) {
          throw CliError.operationFailed(
            "Parse target",
            parseResult.error || "Failed to parse target file"
          );
        }

        const config = parseResult.config;

        // Validate configuration
        const validation = validateConfig(config);
        if (!validation.valid) {
          throw CliError.operationFailed(
            "Validate config",
            `Invalid configuration:\n${validation.errors.map(e => `  - ${e}`).join("\n")}`
          );
        }

        if (options.dryRun) {
          // Dry run - just show parsed config
          output(ctx, successResponse({ config, body_length: parseResult.body?.length || 0 }), () => {
            console.log(chalk.bold(`FileRL Target: ${config.name}`));
            console.log();
            outputKeyValue(ctx, {
              "Name": config.name,
              "Description": config.description || "-",
              "Enabled": formatStatus(config.enabled, "yes", "no"),
            });
            console.log();
            console.log(chalk.bold("PPO Configuration:"));
            outputKeyValue(ctx, {
              "KL Coefficient": config.ppo.kl_coef.toString(),
              "Threshold": config.ppo.threshold.toString(),
              "Max Diff": config.ppo.max_diff.toString(),
              "Parallel Count": config.ppo.parallel_count.toString(),
              "Max Iterations": config.ppo.max_iterations.toString(),
              "Convergence Threshold": config.ppo.convergence_threshold.toString(),
            });
            console.log();
            console.log(chalk.bold("Reward Configuration:"));
            outputKeyValue(ctx, {
              "Types": config.reward.types.join(", "),
              "Weights": config.reward.weights.map(w => w.toFixed(2)).join(", "),
            });
            console.log();
            console.log(chalk.bold("Idea Configuration:"));
            outputKeyValue(ctx, {
              "Types": config.idea.types.join(", "),
              "Max Ideas": config.idea.max_ideas.toString(),
              "Auto Promote": config.idea.auto_promote_count.toString(),
            });
            console.log();
            console.log(chalk.bold("Task Configuration:"));
            outputKeyValue(ctx, {
              "Worktree": formatStatus(config.task.worktree, "yes", "no"),
              "Executor": config.task.executor,
              "Model": config.task.model || "-",
              "Auto Start": formatStatus(config.task.auto_start, "yes", "no"),
            });
            console.log();
            outputSuccess(ctx, "Configuration is valid");
          });
          return;
        }

        // Initialize run
        const initResult = initRun(repoRoot, target, { force: options.force });
        if (!initResult.success) {
          throw CliError.operationFailed("Init run", initResult.error || "Unknown error");
        }

        console.log(chalk.green("=== FileRL Starting ==="));
        console.log();
        console.log(`  Name:         ${config.name}`);
        console.log(`  Target:       ${target}`);
        console.log(`  Max Iterations: ${config.ppo.max_iterations}`);
        console.log();
        console.log(chalk.gray("The FileRL loop will run automatically:"));
        console.log(chalk.gray("  1. Generate ideas using configured idea types"));
        console.log(chalk.gray("  2. Create tasks in parallel worktrees"));
        console.log(chalk.gray("  3. Wait for task completion"));
        console.log(chalk.gray("  4. Compute rewards and select the best"));
        console.log(chalk.gray("  5. Merge winner and iterate until convergence"));
        console.log();

        // Run the full FileRL loop
        const loopResult = await runFileRlLoop(repoRoot, config.name, (msg) => {
          console.log(chalk.gray(`  ${msg}`));
        });

        if (!loopResult.success) {
          throw CliError.operationFailed("FileRL loop", loopResult.error || "Unknown error");
        }

        const resultData = loopResult.data as {
          iterations?: number;
          bestReward?: number;
          bestTask?: string;
        };

        console.log();
        output(ctx, successResponse({
          name: config.name,
          phase: loopResult.phase,
          iterations: resultData.iterations,
          bestReward: resultData.bestReward,
          bestTask: resultData.bestTask,
        }), () => {
          console.log(chalk.green("=== FileRL Complete ==="));
          console.log();
          outputKeyValue(ctx, {
            "Status": loopResult.phase === "converged" ? chalk.green("Converged") : chalk.yellow("Max iterations reached"),
            "Iterations": String(resultData.iterations || 0),
            "Best Reward": resultData.bestReward?.toFixed(3) || "-",
            "Best Task": resultData.bestTask || "-",
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl status <name>
  // ============================================================================
  fileRlCmd
    .command("status")
    .description("View status of a FileRL run")
    .argument("<name>", "Name of the FileRL run")
    .option("--json", "JSON format output")
    .action(async (name: string, options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        const result = getStatus(repoRoot, name);
        if (!result.success || !result.state) {
          throw CliError.notFound("FileRL run", name);
        }

        const state = result.state;

        // Load config from target file
        const parseResult = parseTarget(state.target_path, repoRoot);
        const config = parseResult.config;

        output(ctx, successResponse({
          state,
          config: config || null,
        }), () => {
          console.log(chalk.bold(`FileRL Run: ${state.name}`));
          console.log();
          outputKeyValue(ctx, {
            "Target": state.target_path,
            "Status": state.converged
              ? chalk.green("converged")
              : state.active
                ? chalk.cyan("active")
                : chalk.yellow("paused"),
            "Iteration": `${state.current_iteration} / ${config?.ppo.max_iterations || "?"}`,
            "Completed": state.completed_iterations.toString(),
            "Best Reward": state.best_reward.toFixed(3),
            "Best Task": state.best_task || "-",
          });

          if (state.iterations.length > 0) {
            console.log();
            console.log(chalk.bold("Recent Iterations:"));
            outputTable(
              ctx,
              ["#", "TASKS", "SELECTED", "BEST REWARD", "STATUS"],
              state.iterations.slice(-5).map((iter) => [
                String(iter.iteration),
                iter.tasks.length.toString(),
                iter.selected_task || "-",
                Math.max(...Object.values(iter.rewards), 0).toFixed(3),
                formatIterationState(iter),
              ])
            );
          }

          if (state.converged) {
            console.log();
            console.log(chalk.green(`Run converged after ${state.completed_iterations} iterations.`));
          } else if (!state.active) {
            console.log();
            console.log(chalk.yellow("Run is paused. Use 'viben filerl resume' to continue."));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl list
  // ============================================================================
  fileRlCmd
    .command("list")
    .description("List all FileRL runs")
    .option("--active", "Show only active runs")
    .option("--json", "JSON format output")
    .action(async (options: { active?: boolean; json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        const result = listRuns(repoRoot);
        if (!result.success) {
          throw CliError.operationFailed("List runs", result.error || "Unknown error");
        }

        let runs = result.runs;

        // Filter if --active
        if (options.active) {
          runs = runs.filter((r) => r.active);
        }

        output(ctx, successResponse({ runs, count: runs.length }), () => {
          if (runs.length === 0) {
            console.log(chalk.gray("No FileRL runs found."));
            console.log();
            console.log("To start a new run:");
            console.log("  viben filerl create <name>    # Create target file");
            console.log("  viben filerl start <target.md>    # Run FileRL");
            return;
          }

          console.log(chalk.bold("FileRL Runs:"));
          console.log();
          outputTable(
            ctx,
            ["NAME", "ITERATION", "BEST REWARD", "STATUS"],
            runs.map((r) => [
              r.name,
              r.current_iteration.toString(),
              r.best_reward.toFixed(3),
              r.converged
                ? chalk.green("converged")
                : r.active
                  ? chalk.cyan("active")
                  : chalk.yellow("paused"),
            ])
          );

          console.log();
          console.log(chalk.gray(`Total: ${runs.length} run(s)`));
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl stop <name>
  // ============================================================================
  fileRlCmd
    .command("stop")
    .description("Stop an active FileRL run")
    .argument("<name>", "Name of the FileRL run to stop")
    .option("--json", "JSON format output")
    .action(async (name: string, options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        const result = stop(repoRoot, name);
        if (!result.success) {
          throw CliError.operationFailed("Stop run", result.error || "Unknown error");
        }

        output(ctx, successResponse({ name, message: result.message }), () => {
          outputSuccess(ctx, result.message || `Stopped FileRL run: ${name}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl resume <name-or-target>
  // ============================================================================
  fileRlCmd
    .command("resume")
    .description("Resume a paused FileRL run and continue the loop")
    .argument("<name-or-target>", "Name of the FileRL run or path to target file (*.md)")
    .option("--json", "JSON format output")
    .action(async (nameOrTarget: string, options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Determine if input is a target file path or a run name
        let name: string;
        if (nameOrTarget.endsWith(".md")) {
          // It's a target file - parse it to get the name
          const parseResult = parseTarget(nameOrTarget, repoRoot);
          if (!parseResult.success || !parseResult.config) {
            throw CliError.operationFailed(
              "Parse target",
              parseResult.error || "Failed to parse target file"
            );
          }
          name = parseResult.config.name;
        } else {
          // It's a run name
          name = nameOrTarget;
        }

        // First resume the run
        const resumeResult = resume(repoRoot, name);
        if (!resumeResult.success) {
          throw CliError.operationFailed("Resume run", resumeResult.error || "Unknown error");
        }

        console.log(chalk.green(`=== FileRL Resuming: ${name} ===`));
        console.log();

        // Then continue the loop
        const loopResult = await runFileRlLoop(repoRoot, name, (msg) => {
          console.log(chalk.gray(`  ${msg}`));
        });

        if (!loopResult.success) {
          throw CliError.operationFailed("FileRL loop", loopResult.error || "Unknown error");
        }

        const resultData = loopResult.data as {
          iterations?: number;
          bestReward?: number;
          bestTask?: string;
        };

        console.log();
        output(ctx, successResponse({
          name,
          phase: loopResult.phase,
          iterations: resultData.iterations,
          bestReward: resultData.bestReward,
          bestTask: resultData.bestTask,
        }), () => {
          console.log(chalk.green("=== FileRL Complete ==="));
          console.log();
          outputKeyValue(ctx, {
            "Status": loopResult.phase === "converged" ? chalk.green("Converged") : chalk.yellow("Max iterations reached"),
            "Iterations": String(resultData.iterations || 0),
            "Best Reward": resultData.bestReward?.toFixed(3) || "-",
            "Best Task": resultData.bestTask || "-",
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
