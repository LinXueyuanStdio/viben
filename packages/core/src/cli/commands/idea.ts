/**
 * viben idea - AI-driven idea generation commands
 *
 * Analyzes project codebase to automatically generate improvement suggestions.
 * Supports 6 built-in types and user-defined custom types.
 *
 * Subcommands:
 * - generate: Generate ideas (core command)
 * - list: List generated ideas
 * - list-types: List available idea types (builtin + custom)
 * - view: View idea details
 * - promote: Convert idea to task
 * - remove: Remove ideas
 */
import chalk from "chalk";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
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
import { findVibenRoot, DIR_VIBEN, DIR_TASKS } from "../lib/viben-workspace";
import { createTask, type CreateTaskOptions } from "../../task/ops/crud";
import { updateIdeaStatus } from "../lib/idea-store";

// Import from idea-types and idea-store modules
import {
  EFFORT_LEVELS,
  IDEA_STATUSES,
  EFFORT_PRIORITY_MAP,
  IDEAS_DIR,
  isValidEffortLevel,
  isValidIdeaStatus,
  type EffortLevel,
  type IdeaStatus,
  type Idea,
  type IdeaType,
  type IdeaSession,
} from "../lib/idea-types";

import {
  getIdeasDir,
  listIdeaTypes,
  getIdeaType,
  getAllIdeas,
  getIdeaById,
  removeIdea,
  removeIdeasByType,
  removeAllIdeas,
} from "../lib/idea-store";

import { generateIdeas } from "../lib/idea-generator";

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
      "Idea command",
      `Not a Viben workspace (.viben not found). Run "viben team init" first.`
    );
  }
  return repoRoot;
}

/**
 * Ensure ideas directory exists
 */
function ensureIdeasDirExists(repoRoot: string): string {
  const ideasDir = getIdeasDir(repoRoot);
  if (!existsSync(ideasDir)) {
    mkdirSync(ideasDir, { recursive: true });
  }
  return ideasDir;
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
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
 * Format effort for display
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
 * Validate idea type exists using the idea-store module
 */
function validateIdeaTypeExists(type: string, repoRoot: string): IdeaType | null {
  return getIdeaType(type, repoRoot);
}

// =============================================================================
// Promote Idea to Task
// =============================================================================

/**
 * Options for promoting an idea to a task
 * Extends CreateTaskOptions with idea-specific fields
 */
interface PromoteIdeaOptions extends CreateTaskOptions {
  // Idea-specific options can be added here
}

/**
 * Promote an idea to a task
 *
 * Creates a new task from an idea, using the idea's title and description.
 * Updates the idea's status to "promoted" and links it to the created task.
 *
 * @param repoRoot - Repository root path
 * @param idea - The idea to promote
 * @param options - Task creation options (same as viben task create)
 * @returns Created task info
 */
function promoteIdea(
  repoRoot: string,
  idea: Idea,
  options: PromoteIdeaOptions
): { taskId: string; taskDir: string; dirName: string } {
  // Create task using the idea's title
  const taskOptions: CreateTaskOptions = {
    slug: options.slug,
    assignee: options.assignee,
    priority: options.priority,
    description: options.description || idea.description,
    branch: options.branch,
    agent: options.agent,
    executor: options.executor,
    model: options.model,
    start: options.start,
    worktree: options.worktree,
  };

  const result = createTask(repoRoot, idea.title, taskOptions);

  if (!result.success) {
    throw CliError.operationFailed("Promote idea", result.error || "Failed to create task");
  }

  // Update idea status to promoted
  updateIdeaStatus(repoRoot, idea.id, "promoted", result.dirName);

  return {
    taskId: result.dirName!,
    taskDir: `${DIR_VIBEN}/${DIR_TASKS}/${result.dirName}`,
    dirName: result.dirName!,
  };
}

// =============================================================================
// Command Registration
// =============================================================================

/**
 * Register the idea command
 */
export function registerIdeaCommand(program: Command): void {
  const ideaCmd = program
    .command("idea")
    .description("AI-driven idea generation and management");

  // ============================================================================
  // idea generate
  // ============================================================================
  ideaCmd
    .command("generate")
    .description("Generate ideas by analyzing the codebase")
    .requiredOption("-t, --types <types...>", "Idea types to generate (e.g., code_improvements security_hardening)")
    .option("-o, --output <dir>", "Output directory", `.viben/${IDEAS_DIR}/`)
    .option("-m, --model <model>", "AI model override")
    .option("--max-ideas <n>", "Maximum ideas per type", "5")
    .option("--append", "Append mode - keep existing ideas")
    .option("--override", "Force regenerate all types")
    .option("--json", "JSON format output")
    .action(
      async (options: {
        types: string[];
        output?: string;
        model?: string;
        maxIdeas?: string;
        append?: boolean;
        override?: boolean;
        json?: boolean;
      }) => {
        const ctx = getOutputContext(program);
        if (options.json) {
          ctx.json = true;
        }
        const cwd = process.cwd();

        try {
          const repoRoot = ensureVibenRoot(cwd);

          // Validate types
          const invalidTypes: string[] = [];
          for (const type of options.types) {
            if (!validateIdeaTypeExists(type, repoRoot)) {
              invalidTypes.push(type);
            }
          }

          if (invalidTypes.length > 0) {
            throw CliError.invalidArgument(
              "types",
              `Unknown idea type(s): ${invalidTypes.join(", ")}. Use "viben idea list-types" to see available types.`
            );
          }

          // Ensure output directory
          const outputDir = options.output
            ? join(repoRoot, options.output)
            : ensureIdeasDirExists(repoRoot);

          if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
          }

          // Generate ideas
          if (!ctx.quiet) {
            console.log(chalk.cyan("Generating ideas..."));
          }

          const result = await generateIdeas(
            repoRoot,
            {
              types: options.types,
              output: options.output,
              model: options.model,
              maxIdeas: parseInt(options.maxIdeas || "5", 10),
              append: options.append,
              override: options.override,
            },
            ctx.quiet
              ? undefined
              : (msg: string) => {
                  console.log(chalk.gray(`  ${msg}`));
                }
          );

          // Check for errors
          if (result.errors.length > 0 && result.ideas.length === 0) {
            throw CliError.operationFailed(
              "Generate ideas",
              result.errors.join("\n")
            );
          }

          output(ctx, successResponse(result), () => {
            console.log();
            console.log(chalk.green(`Generated ${result.ideas.length} ideas`));
            console.log();

            console.log(chalk.bold("Summary by type:"));
            for (const [type, count] of Object.entries(result.byType)) {
              console.log(`  ${type}: ${count} idea(s)`);
            }

            if (result.errors.length > 0) {
              console.log();
              console.log(chalk.yellow("Warnings:"));
              for (const error of result.errors) {
                console.log(chalk.yellow(`  ${error}`));
              }
            }

            console.log();
            console.log(chalk.gray(`Session ID: ${result.sessionId}`));
            console.log(chalk.gray(`Output: ${result.sessionDir}`));
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // ============================================================================
  // idea list
  // ============================================================================
  ideaCmd
    .command("list")
    .description("List generated ideas")
    .option("-t, --type <type>", "Filter by type")
    .option("-e, --effort <effort>", "Filter by effort (trivial/small/medium/large/complex)")
    .option("-s, --status <status>", "Filter by status (draft/promoted/dismissed)")
    .option("--json", "JSON format output")
    .action(
      async (options: {
        type?: string;
        effort?: string;
        status?: string;
        json?: boolean;
      }) => {
        const ctx = getOutputContext(program);
        if (options.json) {
          ctx.json = true;
        }
        const cwd = process.cwd();

        try {
          const repoRoot = ensureVibenRoot(cwd);

          // Validate filters
          if (options.effort && !isValidEffortLevel(options.effort)) {
            throw CliError.invalidArgument(
              "effort",
              `Invalid effort level. Must be one of: ${EFFORT_LEVELS.join(", ")}`
            );
          }

          if (options.status && !isValidIdeaStatus(options.status)) {
            throw CliError.invalidArgument(
              "status",
              `Invalid status. Must be one of: ${IDEA_STATUSES.join(", ")}`
            );
          }

          const ideas = getAllIdeas(repoRoot, {
            type: options.type,
            effort: options.effort as EffortLevel,
            status: options.status as IdeaStatus,
          });

          output(ctx, successResponse({ ideas, count: ideas.length }), () => {
            if (ideas.length === 0) {
              console.log(chalk.gray("No ideas found."));
              console.log();
              console.log("Generate ideas with:");
              console.log(chalk.cyan("  viben idea generate --types code_improvements"));
              return;
            }

            console.log(chalk.bold("Ideas:"));
            console.log();
            outputTable(
              ctx,
              ["ID", "TYPE", "TITLE", "EFFORT", "STATUS"],
              ideas.map((idea) => [
                idea.id,
                idea.type,
                idea.title.length > 40 ? idea.title.substring(0, 37) + "..." : idea.title,
                formatEffort(idea.estimatedEffort),
                formatStatus(idea.status),
              ])
            );
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // ============================================================================
  // idea list-types
  // ============================================================================
  ideaCmd
    .command("list-types")
    .description("List available idea types (builtin + custom)")
    .option("--json", "JSON format output")
    .action(async (options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);
        const types = listIdeaTypes(repoRoot);

        output(ctx, successResponse({ types, count: types.length }), () => {
          console.log(chalk.bold("Available Idea Types:"));
          console.log();
          outputTable(
            ctx,
            ["TYPE", "SOURCE", "DESCRIPTION"],
            types.map((t) => [t.name, t.source, t.description])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // idea view
  // ============================================================================
  ideaCmd
    .command("view <idea-id>")
    .description("View idea details")
    .option("--json", "JSON format output")
    .action(async (ideaId: string, options: { json?: boolean }) => {
      const ctx = getOutputContext(program);
      if (options.json) {
        ctx.json = true;
      }
      const cwd = process.cwd();

      try {
        const repoRoot = ensureVibenRoot(cwd);
        const idea = getIdeaById(repoRoot, ideaId);

        if (!idea) {
          throw CliError.notFound("Idea", ideaId);
        }

        output(ctx, successResponse({ idea }), () => {
          console.log(chalk.bold(`Idea: ${idea.title}`));
          console.log();

          outputKeyValue(ctx, {
            ID: idea.id,
            Type: idea.type,
            Status: formatStatus(idea.status),
            Effort: formatEffort(idea.estimatedEffort),
            "Created At": idea.createdAt,
            "Promoted To": idea.promotedTo || "-",
          });

          console.log();
          console.log(chalk.bold("Description:"));
          console.log(`  ${idea.description}`);

          console.log();
          console.log(chalk.bold("Rationale:"));
          console.log(`  ${idea.rationale}`);

          if (idea.affectedFiles && idea.affectedFiles.length > 0) {
            console.log();
            console.log(chalk.bold("Affected Files:"));
            for (const file of idea.affectedFiles) {
              console.log(`  - ${file}`);
            }
          }

          if (idea.existingPatterns && idea.existingPatterns.length > 0) {
            console.log();
            console.log(chalk.bold("Existing Patterns:"));
            for (const pattern of idea.existingPatterns) {
              console.log(`  - ${pattern}`);
            }
          }

          if (idea.implementationApproach) {
            console.log();
            console.log(chalk.bold("Implementation Approach:"));
            console.log(`  ${idea.implementationApproach}`);
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ============================================================================
  // idea promote
  // ============================================================================
  ideaCmd
    .command("promote <idea-id>")
    .description("Convert idea to task (supports all viben task create options)")
    .option("-s, --slug <name>", "Task identifier (auto-generated from idea title if not provided)")
    .option("-b, --branch <branch>", "Custom branch name (default: feature/<slug>)")
    .option("-a, --assignee <dev>", "Assignee developer name")
    .option("-p, --priority <priority>", "Priority (P0, P1, P2, P3) - defaults to effort-based priority")
    .option("-d, --description <text>", "Task description (defaults to idea description)")
    .option("--agent <agent-id>", "Associated agent configuration")
    .option("--executor <type>", "Executor type (CLAUDE_CODE, CURSOR, etc.)")
    .option("--model <model>", "Model to use for execution")
    .option("--start", "Auto-enqueue task for execution (status: queue)")
    .option("--worktree", "Run agent in a git worktree (isolated branch)")
    .option("--json", "JSON format output")
    .action(
      async (
        ideaId: string,
        options: {
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
        }
      ) => {
        const ctx = getOutputContext(program);
        if (options.json) {
          ctx.json = true;
        }
        const cwd = process.cwd();

        try {
          const repoRoot = ensureVibenRoot(cwd);

          // Validate priority if provided
          if (options.priority && !/^P[0-3]$/.test(options.priority)) {
            throw CliError.invalidArgument(
              "priority",
              "Priority must be P0, P1, P2, or P3"
            );
          }

          // Get idea first to validate and get effort for default priority
          const idea = getIdeaById(repoRoot, ideaId);
          if (!idea) {
            throw CliError.notFound("Idea", ideaId);
          }

          if (idea.status === "promoted") {
            throw CliError.operationFailed(
              "Promote idea",
              `Idea "${ideaId}" has already been promoted to task "${idea.promotedTo}"`
            );
          }

          // Use effort-based priority if not specified
          const priority = options.priority || EFFORT_PRIORITY_MAP[idea.estimatedEffort] || "P2";

          const result = promoteIdea(repoRoot, idea, {
            slug: options.slug,
            branch: options.branch,
            assignee: options.assignee,
            priority,
            description: options.description,
            agent: options.agent,
            executor: options.executor,
            model: options.model,
            start: options.start,
            worktree: options.worktree,
          });

          output(ctx, successResponse({
            taskId: result.taskId,
            taskDir: result.taskDir,
            dirName: result.dirName,
            ideaId: ideaId,
            ideaTitle: idea.title,
            priority,
            status: options.start ? "queue" : "backlog",
            worktree: options.worktree || false,
          }), () => {
            outputSuccess(ctx, `Promoted idea "${ideaId}" to task`);
            console.log();
            outputKeyValue(ctx, {
              "Idea": `${ideaId} - ${idea.title}`,
              "Task ID": result.taskId,
              "Task Directory": result.taskDir,
              "Priority": priority,
              "Status": options.start ? "queue" : "backlog",
              "Worktree": options.worktree ? "enabled" : "disabled",
            });
            console.log();
            if (options.start) {
              console.log(chalk.green("Task enqueued for execution."));
              console.log();
              console.log(chalk.blue("Monitor progress:"));
              console.log(`  viben task status ${result.taskId}`);
            } else {
              console.log(chalk.blue("Next steps:"));
              console.log(`  1. Create prd.md with requirements`);
              console.log(`  2. Start working: viben task start ${result.taskId}`);
            }
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // ============================================================================
  // idea remove
  // ============================================================================
  ideaCmd
    .command("remove [idea-ids...]")
    .description("Remove ideas")
    .option("-t, --type <type>", "Remove all ideas of this type")
    .option("--all", "Remove all ideas")
    .action(
      async (
        ideaIds: string[],
        options: {
          type?: string;
          all?: boolean;
        }
      ) => {
        const ctx = getOutputContext(program);
        const cwd = process.cwd();

        try {
          const repoRoot = ensureVibenRoot(cwd);

          // Validate that at least one option is provided
          if (!ideaIds.length && !options.type && !options.all) {
            throw CliError.missingArgument(
              "idea-id or --type or --all"
            );
          }

          // Warn about destructive operation
          if (options.all && !ctx.quiet) {
            outputWarning(ctx, "This will remove ALL ideas. Use with caution.");
          }

          // Perform removal based on options
          let removedCount = 0;
          const removedIds: string[] = [];

          if (options.all) {
            removedCount = removeAllIdeas(repoRoot);
          } else if (options.type) {
            removedCount = removeIdeasByType(repoRoot, options.type);
          } else if (ideaIds.length > 0) {
            for (const id of ideaIds) {
              if (removeIdea(repoRoot, id)) {
                removedIds.push(id);
                removedCount++;
              }
            }
          }

          const result = { removed: removedIds, count: removedCount };

          output(ctx, successResponse(result), () => {
            if (result.count === 0) {
              console.log(chalk.gray("No ideas removed."));
              return;
            }

            outputSuccess(ctx, `Removed ${result.count} idea(s)`);

            if (result.removed.length > 0 && result.removed.length <= 10) {
              for (const id of result.removed) {
                console.log(chalk.gray(`  - ${id}`));
              }
            }
          });
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );
}
