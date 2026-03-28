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
import { writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
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
  writeState,
  getFileRlDir,
  generateIdeasForFileRl,
  type FileRlConfig,
  type FileRlState,
  type IterationState,
} from "../../filerl/ops";

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

        // Initialize the run state so add-idea and list-ideas work immediately
        const initResult = initRun(repoRoot, outputPath, { force: false });
        if (!initResult.success) {
          throw CliError.operationFailed("Init run", initResult.error || "Unknown error");
        }

        output(ctx, successResponse({ name, path: outputPath }), () => {
          outputSuccess(ctx, `Created FileRL target: ${outputPath}`);
          console.log();
          console.log("Next steps:");
          console.log(`  1. Edit ${outputPath} to configure your optimization goals`);
          console.log(`  2. Add ideas: viben filerl add-idea ${outputPath} path/to/idea.md`);
          console.log(`  3. Start run: viben filerl start ${outputPath}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl start <name-or-target>
  // ============================================================================
  fileRlCmd
    .command("start")
    .description("Start FileRL with a target file or run name")
    .argument("<name-or-target>", "FileRL run name or path to target file (*.md)")
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
            "Start FileRL",
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
              "Change Sensitivity": config.ppo.change_sensitivity.toString(),
              "Clip Range": config.ppo.clip_range.toString(),
              "Quality Threshold": config.ppo.quality_threshold.toString(),
              "Max Diff": config.ppo.max_diff.toString(),
            });
            console.log();
            console.log(chalk.bold("Rollout Configuration:"));
            outputKeyValue(ctx, {
              "Rollouts per Idea": config.rollout.n.toString(),
              "Use Worktree": formatStatus(config.rollout.worktree, "yes", "no"),
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

        console.log(chalk.green("=== FileRL Starting ==="));
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
          console.log(chalk.yellow(`  viben filerl add-idea ${config.name} path/to/idea.md`));
          console.log();
        }

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

  // ============================================================================
  // filerl add-idea <name-or-target> <idea-path>
  // ============================================================================
  fileRlCmd
    .command("add-idea")
    .description("Add an idea file to a FileRL target's idea pool")
    .argument("<name-or-target>", "Run name or path to FileRL target file (*.md)")
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
        let config: FileRlConfig | null = null;

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
          throw CliError.notFound("FileRL run or target file", nameOrTarget);
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
  // filerl list-ideas <name-or-target>
  // ============================================================================
  fileRlCmd
    .command("list-ideas")
    .description("List ideas in a FileRL target's pool")
    .argument("<name-or-target>", "Run name or path to FileRL target file (*.md)")
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
        let config: FileRlConfig | null = null;

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
          throw CliError.notFound("FileRL run or target file", nameOrTarget);
        }

        const name = config.name;

        // For FileRL, ideas are stored in .viben/filerl/<name>/iter{N}/<idea-id>/idea.md
        // We need to read from the filerl directory structure, not the generic ideas directory
        const filerlDir = join(repoRoot, ".viben", "filerl", name);

        // Get all ideas from all iteration directories
        const allIdeas: Awaited<ReturnType<typeof getAllIdeasFromSession>> = [];

        // Check if filerl directory exists
        if (existsSync(filerlDir)) {
          const { readdirSync, statSync } = await import("node:fs");
          const entries = readdirSync(filerlDir);

          for (const entry of entries) {
            // Look for iter{N} directories
            if (entry.startsWith("iter") && statSync(join(filerlDir, entry)).isDirectory()) {
              const iterDir = join(filerlDir, entry);
              const ideaDirs = readdirSync(iterDir).filter(f =>
                statSync(join(iterDir, f)).isDirectory()
              );

              for (const ideaId of ideaDirs) {
                const ideaPath = join(iterDir, ideaId, "idea.md");
                if (existsSync(ideaPath)) {
                  // Parse idea.md to extract idea metadata
                  const { readFileSync } = await import("node:fs");
                  const content = readFileSync(ideaPath, "utf-8");

                  // Parse YAML frontmatter
                  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                  if (frontmatterMatch) {
                    const frontmatter = frontmatterMatch[1];
                    const titleMatch = frontmatter.match(/title:\s*"?([^"\n]+)"?/);
                    const effortMatch = frontmatter.match(/estimated_effort:\s*(\w+)/);
                    const statusMatch = frontmatter.match(/status:\s*(\w+)/);
                    const typeMatch = frontmatter.match(/type:\s*(\w+)/);
                    const rationaleMatch = frontmatter.match(/rationale:\s*"?([^"\n]+)"?/);

                    allIdeas.push({
                      id: ideaId,
                      title: titleMatch?.[1] || "Untitled",
                      description: "",
                      rationale: rationaleMatch?.[1] || "",
                      type: typeMatch?.[1] || "unknown",
                      estimatedEffort: (effortMatch?.[1] || "medium") as "trivial" | "small" | "medium" | "large" | "complex",
                      status: (statusMatch?.[1] || "draft") as "draft" | "promoted" | "dismissed",
                      createdAt: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        }

        // Fallback: also check the legacy ideas directory
        const legacyIdeasDir = config.idea.session_dir
          ? resolve(repoRoot, config.idea.session_dir)
          : join(repoRoot, ".viben", "ideas", name);

        if (existsSync(legacyIdeasDir) && allIdeas.length === 0) {
          const legacyIdeas = getAllIdeasFromSession(legacyIdeasDir);
          allIdeas.push(...legacyIdeas);
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
            console.log(`  viben filerl add-idea ${nameOrTarget} path/to/idea.md`);
            return;
          }

          outputTable(
            ctx,
            ["ID", "TITLE", "EFFORT", "STATUS"],
            filteredIdeas.map(idea => [
              idea.id,
              idea.title.slice(0, 40) + (idea.title.length > 40 ? "..." : ""),
              idea.estimatedEffort,
              idea.status,
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl generate-ideas <name>
  // ============================================================================
  fileRlCmd
    .command("generate-ideas")
    .description("Generate ideas for a FileRL run iteration")
    .argument("<name>", "FileRL run name")
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
          throw CliError.notFound("FileRL run", name);
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

        console.log(chalk.bold(`Generating ideas for FileRL: ${name}`));
        console.log();
        console.log(`  Iteration:   ${targetIter}`);
        console.log(`  Types:       ${ideaTypes.join(", ")}`);
        console.log(`  Max ideas:   ${config.idea.max_ideas}`);
        console.log();

        const result = await generateIdeasForFileRl(repoRoot, name, targetIter, ideaTypes, {
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
            console.log(chalk.gray(`Ideas saved to: .viben/filerl/${name}/iter${targetIter}/`));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // filerl promote-ideas <name> --ideas <idea...>
  // ============================================================================
  fileRlCmd
    .command("promote-ideas")
    .description("Promote ideas to tasks. Supports all viben task create options.")
    .argument("<name>", "FileRL run name")
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
          throw CliError.notFound("FileRL run", name);
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

        const filerlDir = join(repoRoot, ".viben", "filerl", name);
        const iterDir = join(filerlDir, `iter${targetIter}`);

        if (!existsSync(iterDir)) {
          throw CliError.operationFailed(
            "Promote ideas",
            `Iteration ${targetIter} does not exist. Run generate-ideas first.`
          );
        }

        console.log(chalk.bold(`Promoting ideas for FileRL: ${name}`));
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
            filerlDir: getFileRlDir(repoRoot, name),
          };

          console.log(chalk.gray(`  Promoting: ${idea.title}`));

          const result = promoteIdeaDirect(repoRoot, idea, promoteOptions);

          if (result.success && result.dirName) {
            results.push({
              ideaId,
              taskId: result.dirName,
              success: true,
            });

            // Update iteration state
            if (!currentIter.ideas.includes(ideaId)) {
              currentIter.ideas.push(ideaId);
            }
            currentIter.tasks.push(result.dirName);
            currentIter.task_idea_map[result.dirName] = ideaId;
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
  // filerl select - Select best task using PPO metrics
  // ============================================================================
  fileRlCmd
    .command("select")
    .description("Select best task from a FileRL run using PPO metrics")
    .argument("<name>", "FileRL run name")
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

          // Load FileRL state
          const state = readState(repoRoot, name);
          if (!state) {
            throw CliError.notFound("FileRL run", name);
          }

          // Determine iteration
          const iteration = options.iter ?? state.current_iteration;
          const filerlDir = join(repoRoot, ".viben", "filerl", name);

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
            filerlDir,
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
  // filerl compute-reward - Compute reward for a task in a FileRL run
  // ============================================================================
  fileRlCmd
    .command("compute-reward")
    .description("Compute reward for a task in a FileRL run")
    .argument("<name>", "FileRL run name")
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

        // Load FileRL state
        const state = readState(repoRoot, name);
        if (!state) {
          throw CliError.notFound("FileRL run", name);
        }

        // Determine iteration
        const iteration = options.iter ?? state.current_iteration;
        const filerlDir = join(repoRoot, ".viben", "filerl", name);
        const iterDir = join(filerlDir, `iter${iteration}`);

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
            const { readdirSync, statSync } = await import("node:fs");
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
          console.log(`  Log:       ${result.logFile}`);

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
}
