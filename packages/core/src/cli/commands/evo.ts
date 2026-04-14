/**
 * viben evo - Evo (File-based Self-Evolution) command
 *
 * Evo treats codebase as "model parameters" and uses PPO algorithm
 * to iteratively optimize code quality.
 *
 * Subcommands:
 * - create: Create a new Evo target file
 * - start: Start Evo with a target file
 * - status: View status of an Evo run
 * - list: List all Evo runs
 * - stop: Stop an active Evo run
 * - resume: Resume a paused Evo run
 */

import chalk from "chalk";
import type { Command } from "commander";
import { writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync } from "node:fs";
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
import { findVibenRoot, resolveTaskDirectory } from "../lib/viben-workspace";

// Import evo ops
import {
  parseTarget,
  validateConfig,
  generateTargetContent,
  initRun,
  runEvoLoop,
  stop,
  resume,
  listRuns,
  getStatus,
  readState,
  writeState,
  getEvoDir,
  generateIdeasForEvo,
  type EvoConfig,
  type EvoState,
  type IterationState,
} from "../../evo/ops";

// Import idea ops
import {
  getAllIdeasFromSession,
  promoteIdeaDirect,
  readIdeasFromFile,
  type IdeaStatus,
} from "../../idea/ops";

// Import reward ops
import {
  selectBestTask,
  SELECT_DEFAULTS,
  type TaskCandidate,
} from "../../reward/ops";

// Import task phase
import { runRewardPhaseSync } from "../../task/phase";

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
      "Evo command",
      `Not a Viben workspace (.viben not found). Run "viben init" first.`
    );
  }
  return repoRoot;
}

/**
 * Format boolean as status indicator
 */
function formatBoolStatus(value: boolean, trueText: string, falseText: string): string {
  return value ? chalk.green(trueText) : chalk.gray(falseText);
}

/**
 * Format idea status for display
 */
function formatIdeaStatus(status: string): string {
  switch (status) {
    case "draft":
      return chalk.yellow(status);
    case "promoted":
      return chalk.green(status);
    case "dismissed":
      return chalk.gray(status);
    default:
      return chalk.gray(status);
  }
}

/**
 * Format effort level for display
 */
function formatEffort(effort: string): string {
  switch (effort) {
    case "trivial":
      return chalk.green(effort);
    case "small":
      return chalk.cyan(effort);
    case "medium":
      return chalk.yellow(effort);
    case "large":
      return chalk.red(effort);
    case "complex":
      return chalk.magenta(effort);
    default:
      return chalk.gray(effort);
  }
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
 * Register the evo command
 */
export function registerEvoCommand(program: Command): void {
  const evoCmd = program
    .command("evo")
    .description("Evo - File-based Self-Evolution for code optimization");

  // ============================================================================
  // evo create <name>
  // ============================================================================
  evoCmd
    .command("create")
    .description("Create a new Evo target file")
    .argument("<name>", "Name for the Evo target")
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

        // Initialize the run state so add-idea and list-ideas work immediately
        const initResult = initRun(repoRoot, outputPath, { force: false });
        if (!initResult.success) {
          throw CliError.operationFailed("Init run", initResult.error || "Unknown error");
        }

        output(ctx, successResponse({ name, path: outputPath }), () => {
          outputSuccess(ctx, `Created Evo target: ${outputPath}`);
          console.log();
          console.log("Next steps:");
          console.log(`  1. Edit ${outputPath} to configure your optimization goals`);
          console.log(`  2. Add ideas: viben evo add-idea ${outputPath} path/to/idea.md`);
          console.log(`  3. Start run: viben evo start ${outputPath}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo start <name-or-target>
  // ============================================================================
  evoCmd
    .command("start")
    .description("Start Evo with a target file or run name")
    .argument("<name-or-target>", "Evo run name or path to target file (*.md)")
    .option("--force", "Force restart even if run is active")
    .option("--dry-run", "Parse and validate without running")
    .option("--json", "JSON format output")
    .action(async (nameOrTarget: string, options: {
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

        // Determine if input is a file path or run name
        let target: string;

        // Check if it's an existing run (by name)
        const existingState = readState(repoRoot, nameOrTarget);
        if (existingState) {
          // Use existing run's target file
          target = existingState.target_path;
        } else if (nameOrTarget.endsWith(".md") || existsSync(resolve(cwd, nameOrTarget))) {
          // It's a target file path
          target = nameOrTarget;
        } else {
          throw CliError.operationFailed(
            "Start Evo",
            `"${nameOrTarget}" is not a valid run name or target file`
          );
        }

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
            console.log(chalk.bold(`Evo Target: ${config.name}`));
            console.log();
            outputKeyValue(ctx, {
              "Name": config.name,
              "Description": config.description || "-",
              "Enabled": formatBoolStatus(config.enabled, "yes", "no"),
            });
            console.log();
            console.log(chalk.bold("PPO Configuration:"));
            outputKeyValue(ctx, {
              "KL Coefficient": config.ppo.kl_coef.toString(),
              "Change Sensitivity": config.ppo.change_sensitivity.toString(),
              "Clip Range": config.ppo.clip_range.toString(),
              "Quality Threshold": config.ppo.quality_threshold.toString(),
              "Max Diff": config.ppo.max_diff.toString(),
            });
            console.log();
            console.log(chalk.bold("Rollout Configuration:"));
            outputKeyValue(ctx, {
              "Rollouts per Idea": config.rollout.n.toString(),
              "Use Worktree": formatBoolStatus(config.rollout.worktree, "yes", "no"),
            });
            console.log();
            console.log(chalk.bold("Convergence Configuration:"));
            outputKeyValue(ctx, {
              "Threshold": config.convergence.threshold.toString(),
              "Max Iterations": config.convergence.max_iterations.toString(),
              "No-merge Limit": config.convergence.no_merge_limit.toString(),
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
              "Auto Generate": config.idea.auto_generate ? "yes" : "no",
              "Types": config.idea.types.join(", "),
              "Max Ideas": config.idea.max_ideas.toString(),
              "Batch Size": config.idea.batch_size.toString(),
            });
            console.log();
            console.log(chalk.bold("Task Configuration:"));
            outputKeyValue(ctx, {
              "Executor": config.task.executor,
              "Model": config.task.model || "-",
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

        console.log(chalk.green("=== Evo Starting ==="));
        console.log();
        console.log(`  Name:              ${config.name}`);
        console.log(`  Target:            ${target}`);
        console.log(`  Auto-generate:     ${config.idea.auto_generate ? "yes" : "no"}`);
        console.log(`  Batch size:        ${config.idea.batch_size} ideas`);
        console.log(`  Rollouts per idea: ${config.rollout.n}`);
        console.log(`  Max iterations:    ${config.convergence.max_iterations}`);
        console.log();

        if (!config.idea.auto_generate) {
          console.log(chalk.yellow("Note: auto_generate is off. Add ideas manually:"));
          console.log(chalk.yellow(`  viben evo add-idea ${config.name} path/to/idea.md`));
          console.log();
        }

        // Run the full Evo loop
        const loopResult = await runEvoLoop(repoRoot, config.name, (msg) => {
          console.log(chalk.gray(`  ${msg}`));
        });

        if (!loopResult.success) {
          throw CliError.operationFailed("Evo loop", loopResult.error || "Unknown error");
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
          console.log(chalk.green("=== Evo Complete ==="));
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
  // evo status <name>
  // ============================================================================
  evoCmd
    .command("status")
    .description("View status of a Evo run")
    .argument("<name>", "Name of the Evo run")
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
          throw CliError.notFound("Evo run", name);
        }

        const state = result.state;

        // Load config from target file
        const parseResult = parseTarget(state.target_path, repoRoot);
        const config = parseResult.config;

        output(ctx, successResponse({
          state,
          config: config || null,
        }), () => {
          console.log(chalk.bold(`Evo Run: ${state.name}`));
          console.log();
          outputKeyValue(ctx, {
            "Target": state.target_path,
            "Status": state.converged
              ? chalk.green("converged")
              : state.active
                ? chalk.cyan("active")
                : chalk.yellow("paused"),
            "Iteration": `${state.current_iteration} / ${config?.convergence.max_iterations || "?"}`,
            "Completed": state.completed_iterations.toString(),
            "No-merge streak": `${state.no_merge_count} / ${config?.convergence.no_merge_limit || "?"}`,
            "Best Reward": state.best_reward.toFixed(3),
            "Best Task": state.best_task || "-",
          });

          // Show config summary
          if (config) {
            console.log();
            console.log(chalk.bold("Configuration:"));
            outputKeyValue(ctx, {
              "Auto-generate": config.idea.auto_generate ? "yes" : "no",
              "Batch size": config.idea.batch_size.toString(),
              "Rollouts per idea": config.rollout.n.toString(),
              "Quality threshold": config.ppo.quality_threshold.toString(),
            });
          }

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
            console.log(chalk.yellow("Run is paused. Use 'viben evo resume' to continue."));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo list
  // ============================================================================
  evoCmd
    .command("list")
    .description("List all Evo runs")
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
            console.log(chalk.gray("No Evo runs found."));
            console.log();
            console.log("To start a new run:");
            console.log("  viben evo create <name>    # Create target file");
            console.log("  viben evo start <target.md>    # Run Evo");
            return;
          }

          console.log(chalk.bold("Evo Runs:"));
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
  // evo stop <name>
  // ============================================================================
  evoCmd
    .command("stop")
    .description("Stop an active Evo run")
    .argument("<name>", "Name of the Evo run to stop")
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
          outputSuccess(ctx, result.message || `Stopped Evo run: ${name}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo resume <name-or-target>
  // ============================================================================
  evoCmd
    .command("resume")
    .description("Resume a paused Evo run and continue the loop")
    .argument("<name-or-target>", "Name of the Evo run or path to target file (*.md)")
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

        console.log(chalk.green(`=== Evo Resuming: ${name} ===`));
        console.log();

        // Then continue the loop
        const loopResult = await runEvoLoop(repoRoot, name, (msg) => {
          console.log(chalk.gray(`  ${msg}`));
        });

        if (!loopResult.success) {
          throw CliError.operationFailed("Evo loop", loopResult.error || "Unknown error");
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
          console.log(chalk.green("=== Evo Complete ==="));
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
  // evo add-idea <name-or-target> <idea-path>
  // ============================================================================
  evoCmd
    .command("add-idea")
    .description("Add an idea file to a Evo target's idea pool")
    .argument("<name-or-target>", "Run name or path to Evo target file (*.md)")
    .argument("<idea-path>", "Path to the idea file (.md)")
    .option("--json", "JSON format output")
    .action(async (nameOrTarget: string, ideaPath: string, options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Try to get config from run state first, then fallback to target file
        let config: EvoConfig | null = null;

        if (nameOrTarget.endsWith(".md")) {
          // It's a target file path - parse directly
          const parseResult = parseTarget(nameOrTarget, repoRoot);
          config = parseResult.config ?? null;
        } else {
          // It's a run name - try run state first
          const state = readState(repoRoot, nameOrTarget);
          if (state) {
            const parseResult = parseTarget(state.target_path, repoRoot);
            config = parseResult.config ?? null;
          } else {
            // Fallback: try to find target file named {name}.md
            const targetPath = resolve(cwd, `${nameOrTarget}.md`);
            if (existsSync(targetPath)) {
              const parseResult = parseTarget(targetPath, repoRoot);
              config = parseResult.config ?? null;
            }
          }
        }

        if (!config) {
          throw CliError.notFound("Evo run or target file", nameOrTarget);
        }

        const name = config.name;
        const ideasDir = config.idea.session_dir
          ? resolve(repoRoot, config.idea.session_dir)
          : join(repoRoot, ".viben", "ideas", name);

        // Ensure ideas directory exists
        if (!existsSync(ideasDir)) {
          mkdirSync(ideasDir, { recursive: true });
        }

        // Copy idea file to ideas directory
        const srcPath = resolve(cwd, ideaPath);
        if (!existsSync(srcPath)) {
          throw CliError.notFound("Idea file", ideaPath);
        }

        const destPath = join(ideasDir, basename(ideaPath));
        copyFileSync(srcPath, destPath);

        output(ctx, successResponse({ name, ideaPath: destPath }), () => {
          outputSuccess(ctx, `Added idea to ${name}: ${basename(ideaPath)}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo list-ideas <name-or-target>
  // ============================================================================
  evoCmd
    .command("list-ideas")
    .description("List ideas in a Evo target's pool")
    .argument("<name-or-target>", "Run name or path to Evo target file (*.md)")
    .option("--status <status>", "Filter by status (draft, promoted, dismissed)")
    .option("--json", "JSON format output")
    .action(async (nameOrTarget: string, options: { status?: string; json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Try to get config from run state first, then fallback to target file
        let config: EvoConfig | null = null;

        if (nameOrTarget.endsWith(".md")) {
          // It's a target file path - parse directly
          const parseResult = parseTarget(nameOrTarget, repoRoot);
          config = parseResult.config ?? null;
        } else {
          // It's a run name - try run state first
          const state = readState(repoRoot, nameOrTarget);
          if (state) {
            const parseResult = parseTarget(state.target_path, repoRoot);
            config = parseResult.config ?? null;
          } else {
            // Fallback: try to find target file named {name}.md
            const targetPath = resolve(cwd, `${nameOrTarget}.md`);
            if (existsSync(targetPath)) {
              const parseResult = parseTarget(targetPath, repoRoot);
              config = parseResult.config ?? null;
            }
          }
        }

        if (!config) {
          throw CliError.notFound("Evo run or target file", nameOrTarget);
        }

        const name = config.name;

        // Extended idea type for rich display (defined below in parseIdeaFromContent)
        type EvoIdea = {
          id: string;
          title: string;
          description: string;
          rationale: string;
          type: string;
          estimatedEffort: "trivial" | "small" | "medium" | "large" | "complex";
          status: "draft" | "promoted" | "dismissed";
          created_at: string;
          affectedFiles?: string[];
          existingPatterns?: string[];
          implementationApproach?: string;
          promotedTo?: string;
        };

        // Get all ideas from state.json and idea files
        const allIdeas: EvoIdea[] = [];

        // Load state to get idea IDs from iterations
        const state = readState(repoRoot, name);
        const ideaIdsFromState: string[] = [];
        if (state) {
          for (const iter of state.iterations) {
            for (const ideaId of iter.ideas) {
              if (!ideaIdsFromState.includes(ideaId)) {
                ideaIdsFromState.push(ideaId);
              }
            }
          }
        }

        // Search for idea files in .viben/ideas/ directories
        // Ideas can be in:
        // 1. .viben/evo/<name>/iter{N}/<idea-id>/idea.md (new Evo structure)
        // 2. .viben/ideas/<session-name>/idea_*_<id>.md (legacy session structure)
        const ideasBaseDir = join(repoRoot, ".viben", "ideas");
        const evoDir = join(repoRoot, ".viben", "evo", name);

        // Helper to parse idea from file content
        const parseIdeaFromContent = (content: string, ideaId: string): EvoIdea | null => {
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) return null;

          const frontmatter = frontmatterMatch[1];
          const body = content.slice(frontmatterMatch[0].length).trim();

          // Parse frontmatter fields
          const titleMatch = frontmatter.match(/title:\s*"?([^"\n]+)"?/);
          const effortMatch = frontmatter.match(/estimated_effort:\s*(\w+)/);
          const statusMatch = frontmatter.match(/status:\s*(\w+)/);
          const typeMatch = frontmatter.match(/type:\s*(\w+)/);
          const rationaleMatch = frontmatter.match(/rationale:\s*"?([^"\n]+)"?/);
          const descriptionMatch = frontmatter.match(/description:\s*"?([^"\n]+)"?/);
          const promotedToMatch = frontmatter.match(/promoted_to:\s*"?([^"\n]+)"?/);

          // Parse affected_files array
          const affectedFilesMatch = frontmatter.match(/affected_files:\s*\n((?:\s+-\s+[^\n]+\n?)*)/);
          const affectedFiles: string[] = [];
          if (affectedFilesMatch) {
            const fileLines = affectedFilesMatch[1].match(/^\s+-\s+(.+)$/gm);
            if (fileLines) {
              for (const line of fileLines) {
                const fileMatch = line.match(/^\s+-\s+(.+)$/);
                if (fileMatch) {
                  affectedFiles.push(fileMatch[1].trim());
                }
              }
            }
          }

          // Parse existing_patterns array
          const existingPatternsMatch = frontmatter.match(/existing_patterns:\s*\n((?:\s+-\s+[^\n]+\n?)*)/);
          const existingPatterns: string[] = [];
          if (existingPatternsMatch) {
            const patternLines = existingPatternsMatch[1].match(/^\s+-\s+(.+)$/gm);
            if (patternLines) {
              for (const line of patternLines) {
                const patternMatch = line.match(/^\s+-\s+(.+)$/);
                if (patternMatch) {
                  existingPatterns.push(patternMatch[1].trim());
                }
              }
            }
          }

          // Use body as description if no frontmatter description
          const description = descriptionMatch?.[1] || body.split("\n")[0] || "";

          return {
            id: ideaId,
            title: titleMatch?.[1] || "Untitled",
            description,
            rationale: rationaleMatch?.[1] || "",
            type: typeMatch?.[1] || "unknown",
            estimatedEffort: (effortMatch?.[1] || "medium") as "trivial" | "small" | "medium" | "large" | "complex",
            status: (statusMatch?.[1] || "draft") as "draft" | "promoted" | "dismissed",
            created_at: new Date().toISOString(),
            affectedFiles: affectedFiles.length > 0 ? affectedFiles : undefined,
            existingPatterns: existingPatterns.length > 0 ? existingPatterns : undefined,
            implementationApproach: body || undefined,
            promotedTo: promotedToMatch?.[1],
          };
        };

        const foundIdeaIds = new Set<string>();

        // 1. Check Evo directory structure: .viben/evo/<name>/iter{N}/<idea-id>/idea.md
        if (existsSync(evoDir)) {
          const entries = readdirSync(evoDir);
          for (const entry of entries) {
            if (entry.startsWith("iter") && statSync(join(evoDir, entry)).isDirectory()) {
              const iterDir = join(evoDir, entry);
              const ideaDirs = readdirSync(iterDir).filter(f =>
                statSync(join(iterDir, f)).isDirectory()
              );

              for (const ideaId of ideaDirs) {
                const ideaPath = join(iterDir, ideaId, "idea.md");
                if (existsSync(ideaPath) && !foundIdeaIds.has(ideaId)) {
                  const content = readFileSync(ideaPath, "utf-8");
                  const idea = await parseIdeaFromContent(content, ideaId);
                  if (idea) {
                    allIdeas.push(idea);
                    foundIdeaIds.add(ideaId);
                  }
                }
              }
            }
          }
        }

        // 2. Search in legacy ideas directory for remaining idea IDs from state
        if (existsSync(ideasBaseDir)) {
          const sessionDirs = readdirSync(ideasBaseDir).filter(f =>
            statSync(join(ideasBaseDir, f)).isDirectory()
          );

          for (const sessionDir of sessionDirs) {
            const sessionPath = join(ideasBaseDir, sessionDir);
            const ideaFiles = readdirSync(sessionPath).filter(f => f.endsWith(".md"));

            for (const ideaFile of ideaFiles) {
              // Extract idea ID from filename pattern: idea_<type>_<8-char-hex-id>.md
              const idMatch = ideaFile.match(/idea_.*_([a-f0-9]{8})\.md$/);
              if (idMatch) {
                const ideaId = idMatch[1];
                // Include if: (a) matches an ID in state, or (b) we have no state (show all)
                if (!foundIdeaIds.has(ideaId) && (ideaIdsFromState.length === 0 || ideaIdsFromState.includes(ideaId))) {
                  const ideaPath = join(sessionPath, ideaFile);
                  const content = readFileSync(ideaPath, "utf-8");
                  const idea = await parseIdeaFromContent(content, ideaId);
                  if (idea) {
                    allIdeas.push(idea);
                    foundIdeaIds.add(ideaId);
                  }
                }
              }
            }
          }
        }

        // 3. Fallback: check session_dir from config if specified
        const legacyIdeasDir = config.idea.session_dir
          ? resolve(repoRoot, config.idea.session_dir)
          : null;

        if (legacyIdeasDir && existsSync(legacyIdeasDir) && allIdeas.length === 0) {
          const legacyIdeas = getAllIdeasFromSession(legacyIdeasDir);
          // Cast legacy ideas to EvoIdea format (they have compatible base fields)
          allIdeas.push(...legacyIdeas.map(idea => ({
            ...idea,
            affectedFiles: idea.affectedFiles,
            existingPatterns: idea.existingPatterns,
            implementationApproach: idea.implementationApproach,
            promotedTo: idea.promotedTo,
          })));
        }

        // Apply status filter if provided
        const filteredIdeas = options.status
          ? allIdeas.filter(idea => idea.status === options.status)
          : allIdeas;

        output(ctx, successResponse({ ideas: filteredIdeas, count: filteredIdeas.length }), () => {
          if (filteredIdeas.length === 0) {
            console.log(chalk.gray("No ideas found."));
            console.log();
            console.log("To add ideas:");
            console.log(`  viben evo add-idea ${nameOrTarget} path/to/idea.md`);
            return;
          }

          console.log(chalk.bold(`Ideas (${filteredIdeas.length}):`));
          console.log();

          for (const idea of filteredIdeas) {
            // Header: ID, Type, Status, Effort
            console.log(
              chalk.cyan(`[${idea.id}]`) +
                chalk.gray(` ${idea.type}`) +
                `  ${formatIdeaStatus(idea.status)}` +
                `  ${formatEffort(idea.estimatedEffort)}`
            );

            // Title
            console.log(chalk.bold(`  ${idea.title}`));

            // Description
            if (idea.description) {
              console.log(chalk.gray(`  ${idea.description}`));
            }

            // Rationale
            if (idea.rationale) {
              console.log(chalk.yellow(`  Why: `) + idea.rationale);
            }

            // Affected files
            if (idea.affectedFiles && idea.affectedFiles.length > 0) {
              console.log(chalk.blue(`  Files:`));
              for (const file of idea.affectedFiles.slice(0, 8)) {
                console.log(chalk.gray(`    - ${file}`));
              }
              if (idea.affectedFiles.length > 8) {
                console.log(chalk.gray(`    ... +${idea.affectedFiles.length - 8} more`));
              }
            }

            // Existing patterns
            if (idea.existingPatterns && idea.existingPatterns.length > 0) {
              console.log(chalk.magenta(`  Patterns:`));
              for (const pattern of idea.existingPatterns.slice(0, 5)) {
                console.log(chalk.gray(`    - ${pattern}`));
              }
              if (idea.existingPatterns.length > 5) {
                console.log(chalk.gray(`    ... +${idea.existingPatterns.length - 5} more`));
              }
            }

            // Implementation approach (can be multi-line)
            if (idea.implementationApproach) {
              console.log(chalk.green(`  Implementation:`));
              const lines = idea.implementationApproach.split("\n");
              const maxLines = 10;
              for (const line of lines.slice(0, maxLines)) {
                console.log(chalk.gray(`    ${line}`));
              }
              if (lines.length > maxLines) {
                console.log(chalk.gray(`    ... +${lines.length - maxLines} more lines`));
              }
            }

            // Promoted to task
            if (idea.promotedTo) {
              console.log(chalk.green(`  Task: `) + idea.promotedTo);
            }

            console.log(); // Blank line between ideas
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo generate-ideas <name>
  // ============================================================================
  evoCmd
    .command("generate-ideas")
    .description("Generate ideas for a Evo run iteration")
    .argument("<name>", "Evo run name")
    .option("--iter <N>", "Target iteration number (default: current iteration from state.json)")
    .option("--types <types...>", "Idea types to generate (e.g., code_improvements, refactoring)")
    .option("--json", "JSON format output")
    .action(async (name: string, options: {
      iter?: string;
      types?: string[];
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Load state
        const state = readState(repoRoot, name);
        if (!state) {
          throw CliError.notFound("Evo run", name);
        }

        // Parse target to get config
        const parseResult = parseTarget(state.target_path, repoRoot);
        if (!parseResult.success || !parseResult.config) {
          throw CliError.operationFailed(
            "Parse target",
            parseResult.error || "Failed to parse target file"
          );
        }

        const config = parseResult.config;

        // Determine target iteration
        const targetIter = options.iter
          ? parseInt(options.iter, 10)
          : state.current_iteration || 1;

        if (isNaN(targetIter) || targetIter < 1) {
          throw CliError.invalidArgument("iter", "Must be a positive integer");
        }

        // Determine idea types (from CLI or config)
        const ideaTypes = options.types && options.types.length > 0
          ? options.types
          : config.idea.types;

        if (ideaTypes.length === 0) {
          throw CliError.invalidArgument("types", "No idea types specified");
        }

        console.log(chalk.bold(`Generating ideas for Evo: ${name}`));
        console.log();
        console.log(`  Iteration:   ${targetIter}`);
        console.log(`  Types:       ${ideaTypes.join(", ")}`);
        console.log(`  Max ideas:   ${config.idea.max_ideas}`);
        console.log();

        const result = await generateIdeasForEvo(repoRoot, name, targetIter, ideaTypes, {
          maxIdeas: config.idea.max_ideas,
          model: config.task.model || "sonnet",
          onProgress: (msg) => console.log(chalk.gray(`  ${msg}`)),
        });

        if (!result.success) {
          throw CliError.operationFailed("Generate ideas", result.error || "Unknown error");
        }

        output(ctx, successResponse({
          name,
          iteration: targetIter,
          ideas: result.ideas,
          count: result.ideas.length,
        }), () => {
          console.log();
          outputSuccess(ctx, `Generated ${result.ideas.length} ideas for iteration ${targetIter}`);
          console.log();

          if (result.ideas.length > 0) {
            outputTable(
              ctx,
              ["ID", "TITLE", "EFFORT", "TYPE"],
              result.ideas.map(idea => [
                idea.id,
                idea.title.slice(0, 40) + (idea.title.length > 40 ? "..." : ""),
                idea.estimatedEffort,
                idea.type,
              ])
            );
            console.log();
            console.log(chalk.gray(`Ideas saved to: .viben/evo/${name}/iter${targetIter}/`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo promote-ideas <name> --ideas <idea...>
  // ============================================================================
  evoCmd
    .command("promote-ideas")
    .description("Promote ideas to tasks. Supports all viben task create options.")
    .argument("<name>", "Evo run name")
    .option("--iter <N>", "Iteration number (default: current iteration from state.json)")
    .option("--ideas <ideas...>", "Idea IDs to promote (required)")
    .option("-s, --slug <name>", "Task slug (only used if single idea)")
    .option("-b, --branch <branch>", "Custom branch name (only used if single idea)")
    .option("-a, --assignee <dev>", "Task assignee")
    .option("-p, --priority <priority>", "Priority (P0-P3)")
    .option("-d, --description <text>", "Task description (only used if single idea)")
    .option("--agent <agent-id>", "Agent configuration")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, GEMINI, etc.)")
    .option("--model <model>", "Model to use")
    .option("--start", "Auto-start tasks after promotion")
    .option("--worktree", "Run in git worktree")
    .option("--json", "JSON format output")
    .action(async (name: string, options: {
      iter?: string;
      ideas?: string[];
      slug?: string;
      branch?: string;
      assignee?: string;
      priority?: string;
      description?: string;
      agent?: string;
      executor?: string;
      model?: string;
      start?: boolean;
      worktree?: boolean;
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Validate ideas argument
        if (!options.ideas || options.ideas.length === 0) {
          throw CliError.invalidArgument("ideas", "At least one idea ID is required");
        }

        // Load state
        const state = readState(repoRoot, name);
        if (!state) {
          throw CliError.notFound("Evo run", name);
        }

        // Parse target to get config
        const parseResult = parseTarget(state.target_path, repoRoot);
        if (!parseResult.success || !parseResult.config) {
          throw CliError.operationFailed(
            "Parse target",
            parseResult.error || "Failed to parse target file"
          );
        }

        const config = parseResult.config;

        // Determine target iteration
        const targetIter = options.iter
          ? parseInt(options.iter, 10)
          : state.current_iteration || 1;

        if (isNaN(targetIter) || targetIter < 1) {
          throw CliError.invalidArgument("iter", "Must be a positive integer");
        }

        const evoDir = join(repoRoot, ".viben", "evo", name);
        const iterDir = join(evoDir, `iter${targetIter}`);

        if (!existsSync(iterDir)) {
          throw CliError.operationFailed(
            "Promote ideas",
            `Iteration ${targetIter} does not exist. Run generate-ideas first.`
          );
        }

        console.log(chalk.bold(`Promoting ideas for Evo: ${name}`));
        console.log();
        console.log(`  Iteration: ${targetIter}`);
        console.log(`  Ideas:     ${options.ideas.join(", ")}`);
        console.log();

        // Ensure current iteration exists in state
        let currentIter: IterationState | undefined = state.iterations.find(i => i.iteration === targetIter);
        if (!currentIter) {
          // Create iteration state if it doesn't exist
          const newIter: IterationState = {
            iteration: targetIter,
            phase: "promote_ideas",
            ideas: [],
            tasks: [],
            task_idea_map: {},
            rewards: {},
            selected_task: undefined,
            rejected_tasks: [],
            completed: false,
            started_at: new Date().toISOString(),
          };
          state.iterations.push(newIter);
          currentIter = newIter;
        }

        // Load and promote each idea
        const results: Array<{
          ideaId: string;
          taskId?: string;
          success: boolean;
          error?: string;
        }> = [];

        for (const ideaId of options.ideas) {
          const ideaDir = join(iterDir, ideaId);
          const ideaPath = join(ideaDir, "idea.md");

          if (!existsSync(ideaPath)) {
            results.push({
              ideaId,
              success: false,
              error: `Idea not found: ${ideaId}`,
            });
            continue;
          }

          // Load idea from file
          const ideas = readIdeasFromFile(ideaPath);
          if (ideas.length === 0) {
            results.push({
              ideaId,
              success: false,
              error: `Failed to parse idea: ${ideaId}`,
            });
            continue;
          }

          const idea = ideas[0];

          // Build promote options
          const promoteOptions = {
            slug: options.slug || idea.id,  // Use idea.id as default slug
            branch: options.branch,
            assignee: options.assignee,
            priority: options.priority,
            description: options.description,
            agent: options.agent,
            executor: options.executor || config.task.executor,
            model: options.model || config.task.model,
            start: options.start,
            worktree: options.worktree ?? config.rollout.worktree,
            computeReward: true,
            evoDir: getEvoDir(repoRoot, name),
          };

          console.log(chalk.gray(`  Promoting: ${idea.title}`));

          const result = promoteIdeaDirect(repoRoot, idea, promoteOptions);

          if (result.success && result.dir_name) {
            results.push({
              ideaId,
              taskId: result.dir_name,
              success: true,
            });

            // Update iteration state
            if (!currentIter.ideas.includes(ideaId)) {
              currentIter.ideas.push(ideaId);
            }
            currentIter.tasks.push(result.dir_name);
            currentIter.task_idea_map[result.dir_name] = ideaId;
          } else {
            results.push({
              ideaId,
              success: false,
              error: result.error,
            });
          }
        }

        // Save state
        writeState(repoRoot, state);

        // Output results
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        output(ctx, successResponse({
          name,
          iteration: targetIter,
          results,
          promoted: successCount,
          failed: failCount,
        }), () => {
          console.log();

          if (successCount > 0) {
            outputSuccess(ctx, `Promoted ${successCount} idea(s) to tasks`);
            console.log();
            outputTable(
              ctx,
              ["IDEA", "TASK", "STATUS"],
              results.map(r => [
                r.ideaId,
                r.taskId || "-",
                r.success ? chalk.green("promoted") : chalk.red("failed"),
              ])
            );
          }

          if (failCount > 0) {
            console.log();
            outputWarning(ctx, `Failed to promote ${failCount} idea(s):`);
            for (const r of results.filter(r => !r.success)) {
              console.log(chalk.red(`  - ${r.ideaId}: ${r.error}`));
            }
          }

          if (options.start && successCount > 0) {
            console.log();
            console.log(chalk.gray("Tasks started. Monitor with: viben swarm status --watch"));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // evo select - Select best task using PPO metrics
  // ============================================================================
  evoCmd
    .command("select")
    .description("Select best task from a Evo run using PPO metrics")
    .argument("<name>", "Evo run name")
    .option("--iter <N>", "Iteration number (default: current iteration)", (v: string) => parseInt(v, 10))
    .option("--idea <idea>", "Filter by specific idea ID")
    .option("--tasks <tasks...>", "Specific task names to compare (default: all tasks in iteration)")
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
        name: string,
        options: {
          iter?: number;
          idea?: string;
          tasks?: string[];
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

          // Load Evo state
          const state = readState(repoRoot, name);
          if (!state) {
            throw CliError.notFound("Evo run", name);
          }

          // Determine iteration
          const iteration = options.iter ?? state.current_iteration;
          const evoDir = join(repoRoot, ".viben", "evo", name);

          // Get tasks from the iteration and build taskIdeaMap for two-stage selection
          let tasks = options.tasks || [];
          const taskIdeaMap: Record<string, string> = {};

          if (tasks.length === 0) {
            // Get tasks from state.json (not directory scan to avoid stale entries)
            const iterState = state.iterations.find(i => i.iteration === iteration);
            if (iterState) {
              // Filter by idea if specified
              if (options.idea) {
                tasks = iterState.tasks.filter(t => iterState.task_idea_map?.[t] === options.idea);
              } else {
                tasks = [...iterState.tasks];
              }

              // Build taskIdeaMap from state
              if (iterState.task_idea_map) {
                for (const task of tasks) {
                  const ideaId = iterState.task_idea_map[task];
                  if (ideaId) {
                    taskIdeaMap[task] = ideaId;
                  }
                }
              }
            }
          } else {
            // If tasks provided via --tasks, try to get ideaId from state
            const iterState = state.iterations.find(i => i.iteration === iteration);
            if (iterState?.task_idea_map) {
              for (const task of tasks) {
                const ideaId = iterState.task_idea_map[task];
                if (ideaId) {
                  taskIdeaMap[task] = ideaId;
                }
              }
            }
          }

          if (tasks.length === 0) {
            throw CliError.operationFailed(
              "Select",
              `No tasks found in iteration ${iteration}${options.idea ? ` for idea ${options.idea}` : ""}`
            );
          }

          // Build options with taskIdeaMap for two-stage selection
          const selectOptions: Parameters<typeof selectBestTask>[2] = {
            evoDir,
            iteration,
            taskIdeaMap: Object.keys(taskIdeaMap).length > 0 ? taskIdeaMap : undefined,
          };
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

          // Update state.json with selection results
          const iterState = state.iterations.find(i => i.iteration === iteration);
          if (iterState) {
            iterState.selected_task = result.selected || undefined;
            iterState.rejected_tasks = result.rejected || [];
            iterState.phase = "select_best";

            // Record rewards from candidates
            for (const candidate of result.candidates || []) {
              iterState.rewards[candidate.task] = candidate.reward;
            }

            // Write updated state
            writeState(repoRoot, state);
          }

          // Prepare JSON output
          const jsonOutput = {
            run: name,
            iteration,
            idea: options.idea,
            baseline: result.baseline,
            threshold: result.threshold,
            candidates: result.candidates?.map((c: TaskCandidate) => ({
              task: c.task,
              reward: c.reward,
              diff_lines: c.diffLines,
              kl_penalty: c.klPenalty,
              adjusted_reward: c.adjustedReward,
              relative_score: c.relativeScore,
              final_score: c.finalScore,
            })),
            selected: result.selected,
            rejected: result.rejected,
          };

          output(ctx, successResponse(jsonOutput), () => {
            console.log(chalk.bold("PPO Selection Results"));
            console.log(chalk.bold("====================="));
            console.log();
            console.log(`Run: ${chalk.cyan(name)} | Iteration: ${chalk.cyan(iteration)}`);
            if (options.idea) {
              console.log(`Idea: ${chalk.cyan(options.idea)}`);
            }
            console.log(
              `Baseline: ${chalk.cyan(result.baseline?.toFixed(3))} | ` +
                `Threshold: ${chalk.cyan(result.threshold?.toFixed(1))}`
            );
            console.log();

            // Output table
            outputTable(
              ctx,
              ["TASK", "REWARD", "DIFF", "KL", "ADJUSTED", "RELATIVE", "FINAL", "STATUS"],
              (result.candidates || []).map((c: TaskCandidate) => {
                const isSelected = c.task === result.selected;
                const status = isSelected
                  ? chalk.green("SELECTED")
                  : chalk.gray("rejected");
                const relativeScore =
                  c.relativeScore >= 0
                    ? chalk.green(`+${c.relativeScore.toFixed(3)}`)
                    : chalk.red(c.relativeScore.toFixed(3));

                return [
                  isSelected ? chalk.bold(c.task) : c.task,
                  c.reward.toFixed(3),
                  String(c.diffLines),
                  c.klPenalty.toFixed(3),
                  c.adjustedReward.toFixed(3),
                  relativeScore,
                  c.finalScore.toFixed(3),
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
  // evo compute-reward - Compute reward for a task in a Evo run
  // ============================================================================
  evoCmd
    .command("compute-reward")
    .description("Compute reward for a task in a Evo run")
    .argument("<name>", "Evo run name")
    .option("--iter <N>", "Iteration number (default: current iteration)", (v: string) => parseInt(v, 10))
    .option("--idea <idea>", "Idea ID")
    .option("--task <task>", "Task name")
    .option("-p, --platform <platform>", "Platform (claude, cursor, iflow, opencode)", "claude")
    .option("-v, --verbose", "Enable verbose output")
    .option("--json", "JSON format output")
    .action(async (name: string, options: {
      iter?: number;
      idea?: string;
      task?: string;
      platform?: string;
      verbose?: boolean;
      json?: boolean;
    }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);

        // Load Evo state
        const state = readState(repoRoot, name);
        if (!state) {
          throw CliError.notFound("Evo run", name);
        }

        // Determine iteration
        const iteration = options.iter ?? state.current_iteration;
        const evoDir = join(repoRoot, ".viben", "evo", name);
        const iterDir = join(evoDir, `iter${iteration}`);

        if (!existsSync(iterDir)) {
          throw CliError.operationFailed(
            "Compute reward",
            `Iteration ${iteration} does not exist for run ${name}`
          );
        }

        // Resolve task directory
        let taskDir: string | null = null;

        if (options.task) {
          // Direct task lookup
          taskDir = resolveTaskDirectory(options.task, repoRoot);
        } else if (options.idea) {
          // Find task from idea directory
          const ideaDir = join(iterDir, options.idea);
          if (existsSync(ideaDir)) {
            const taskDirs = readdirSync(ideaDir).filter(f =>
              statSync(join(ideaDir, f)).isDirectory()
            );
            if (taskDirs.length > 0) {
              // Use first task found
              taskDir = resolveTaskDirectory(taskDirs[0], repoRoot);
            }
          }
        }

        if (!taskDir) {
          throw CliError.invalidArgument(
            "task",
            `Task not found. Provide --task or --idea to specify which task to compute reward for.`
          );
        }

        // Determine ideaId for output directory structure
        // Priority: 1) --idea option, 2) state.task_idea_map lookup
        let ideaId = options.idea;
        if (!ideaId && options.task) {
          // Try to find ideaId from state's task_idea_map
          const iterState = state.iterations.find(i => i.iteration === iteration);
          if (iterState?.task_idea_map) {
            ideaId = iterState.task_idea_map[options.task];
          }
        }

        const result = runRewardPhaseSync(repoRoot, taskDir, {
          platform: options.platform,
          verbose: options.verbose,
          ideaId,
        });

        if (!result.success) {
          throw CliError.operationFailed("Compute Reward", result.error || "Unknown error");
        }

        output(ctx, successResponse({
          ...result,
          run: name,
          iteration,
          idea: options.idea,
        }), () => {
          console.log(chalk.green("=== Reward Agent Started ==="));
          console.log();
          console.log(`  Run:       ${name}`);
          console.log(`  Iteration: ${iteration}`);
          if (options.idea) {
            console.log(`  Idea:      ${options.idea}`);
          }
          console.log(`  ID:        ${result.agentId}`);
          console.log(`  PID:       ${result.pid}`);
          console.log(`  Log:       ${result.log_file}`);

          if (result.warnings && result.warnings.length > 0) {
            console.log();
            console.log(chalk.yellow("Warnings:"));
            for (const warning of result.warnings) {
              console.log(`  - ${warning}`);
            }
          }

          console.log();
          console.log(chalk.gray("To monitor:"));
          console.log(`  tail -f ${result.log_file}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
