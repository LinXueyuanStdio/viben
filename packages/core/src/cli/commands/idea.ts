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

// Import from idea/ops module
import {
  // Types
  type EffortLevel,
  type IdeaStatus,
  EFFORT_LEVELS,
  IDEA_STATUSES,
  IDEAS_DIR,
  // Store operations
  getIdeasDir,
  // CRUD operations
  listIdeas,
  listTypes,
  viewIdea,
  promoteIdea,
  removeIdeas,
  validateIdeaTypes,
  // Generator
  generateIdeas,
} from "../../idea/ops";

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
          const validation = validateIdeaTypes(repoRoot, options.types);
          if (!validation.valid) {
            throw CliError.invalidArgument(
              "types",
              `Unknown idea type(s): ${validation.invalidTypes.join(", ")}. Use "viben idea list-types" to see available types.`
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

          const result = listIdeas(repoRoot, {
            type: options.type,
            effort: options.effort as EffortLevel,
            status: options.status as IdeaStatus,
          });

          if (!result.success) {
            throw CliError.operationFailed("List ideas", result.error || "Unknown error");
          }

          output(ctx, successResponse({ ideas: result.ideas, count: result.count }), () => {
            if (result.ideas.length === 0) {
              console.log(chalk.gray("No ideas found."));
              console.log();
              console.log("Generate ideas with:");
              console.log(chalk.cyan("  viben idea generate --types code_improvements"));
              return;
            }

            console.log(chalk.bold(`Ideas (${result.ideas.length}):`));
            console.log();

            for (const idea of result.ideas) {
              // Header: ID, Type, Status, Effort
              console.log(
                chalk.cyan(`[${idea.id}]`) +
                  chalk.gray(` ${idea.type}`) +
                  `  ${formatStatus(idea.status)}` +
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
        const result = listTypes(repoRoot);

        if (!result.success) {
          throw CliError.operationFailed("List types", result.error || "Unknown error");
        }

        output(ctx, successResponse({ types: result.types, count: result.count }), () => {
          console.log(chalk.bold("Available Idea Types:"));
          console.log();
          outputTable(
            ctx,
            ["TYPE", "SOURCE", "DESCRIPTION"],
            result.types.map((t) => [t.name, t.source, t.description])
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
        const result = viewIdea(repoRoot, ideaId);

        if (!result.success || !result.idea) {
          throw CliError.notFound("Idea", ideaId);
        }

        const idea = result.idea;

        output(ctx, successResponse({ idea }), () => {
          // Header
          console.log(
            chalk.cyan(`[${idea.id}]`) +
              chalk.gray(` ${idea.type}`) +
              `  ${formatStatus(idea.status)}` +
              `  ${formatEffort(idea.estimatedEffort)}`
          );
          console.log(chalk.bold(idea.title));
          console.log(chalk.gray(`Created: ${idea.createdAt}`));
          if (idea.promotedTo) {
            console.log(chalk.green(`Task: ${idea.promotedTo}`));
          }
          console.log();

          // Description
          console.log(chalk.bold("Description"));
          console.log(idea.description);
          console.log();

          // Rationale
          console.log(chalk.bold("Rationale"));
          console.log(idea.rationale);

          // Affected Files
          if (idea.affectedFiles && idea.affectedFiles.length > 0) {
            console.log();
            console.log(chalk.bold("Affected Files"));
            for (const file of idea.affectedFiles) {
              console.log(chalk.gray(`  - ${file}`));
            }
          }

          // Existing Patterns
          if (idea.existingPatterns && idea.existingPatterns.length > 0) {
            console.log();
            console.log(chalk.bold("Existing Patterns"));
            for (const pattern of idea.existingPatterns) {
              console.log(chalk.gray(`  - ${pattern}`));
            }
          }

          // Implementation Approach (full content, no truncation)
          if (idea.implementationApproach) {
            console.log();
            console.log(chalk.bold("Implementation"));
            for (const line of idea.implementationApproach.split("\n")) {
              console.log(line);
            }
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
    .option("-p, --priority <priority>", "Priority (urgent, high, medium, low, none) - defaults to effort-based priority")
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
          const validPriorities = ["urgent", "high", "medium", "low", "none"];
          if (options.priority && !validPriorities.includes(options.priority)) {
            throw CliError.invalidArgument(
              "priority",
              "Priority must be one of: urgent, high, medium, low, none"
            );
          }

          const result = promoteIdea(repoRoot, ideaId, {
            slug: options.slug,
            branch: options.branch,
            assignee: options.assignee,
            priority: options.priority,
            description: options.description,
            agent: options.agent,
            executor: options.executor,
            model: options.model,
            start: options.start,
            worktree: options.worktree,
          });

          if (!result.success) {
            if (result.error?.includes("not found")) {
              throw CliError.notFound("Idea", ideaId);
            }
            throw CliError.operationFailed("Promote idea", result.error || "Unknown error");
          }

          output(ctx, successResponse(result), () => {
            outputSuccess(ctx, `Promoted idea "${ideaId}" to task`);
            console.log();
            outputKeyValue(ctx, {
              "Idea": `${result.ideaId} - ${result.ideaTitle}`,
              "Task ID": result.taskId || "",
              "Task Directory": result.taskDir || "",
              "Priority": result.priority || "",
              "Status": result.status || "",
              "Worktree": result.worktree ? "enabled" : "disabled",
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

          const result = removeIdeas(repoRoot, ideaIds, {
            type: options.type,
            all: options.all,
          });

          if (!result.success) {
            throw CliError.operationFailed("Remove ideas", result.error || "Unknown error");
          }

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
