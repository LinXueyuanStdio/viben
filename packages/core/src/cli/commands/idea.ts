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
import { findVibenRoot } from "../lib/viben-workspace";

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
// Stub functions for features not yet implemented
// =============================================================================

/**
 * Stub: Generate ideas using AI
 * TODO: Implement with IdeaGenerator when ready
 */
async function generateIdeasStub(
  _repoRoot: string,
  _options: {
    types: string[];
    outputDir?: string;
    model?: string;
    maxIdeas?: number;
    append?: boolean;
    override?: boolean;
  }
): Promise<{ sessionId: string; ideas: Idea[]; summary: IdeaSession["summary"] }> {
  throw CliError.operationFailed(
    "Generate ideas",
    "IdeaGenerator not yet implemented. This feature is coming soon."
  );
}

/**
 * Stub: Promote idea to task
 * TODO: Implement with task creation integration
 */
async function promoteIdeaStub(
  _repoRoot: string,
  _ideaId: string,
  _options: {
    slug?: string;
    priority?: string;
    assignee?: string;
  }
): Promise<{ taskId: string; taskDir: string }> {
  throw CliError.operationFailed(
    "Promote idea",
    "Task integration not yet implemented. This feature is coming soon."
  );
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
          const result = await generateIdeasStub(repoRoot, {
            types: options.types,
            outputDir,
            model: options.model,
            maxIdeas: parseInt(options.maxIdeas || "5", 10),
            append: options.append,
            override: options.override,
          });

          output(ctx, successResponse(result), () => {
            console.log(chalk.green(`Generated ${result.summary.totalIdeas} ideas`));
            console.log();

            console.log(chalk.bold("Summary by type:"));
            for (const [type, count] of Object.entries(result.summary.byType)) {
              console.log(`  ${type}: ${count} idea(s)`);
            }
            console.log();

            console.log(chalk.gray(`Session ID: ${result.sessionId}`));
            console.log(chalk.gray(`Output: ${outputDir}`));
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
    .description("Convert idea to task")
    .option("--slug <slug>", "Task slug override")
    .option("--priority <priority>", "Task priority override (P0-P3)")
    .option("--assignee <assignee>", "Task assignee")
    .action(
      async (
        ideaId: string,
        options: {
          slug?: string;
          priority?: string;
          assignee?: string;
        }
      ) => {
        const ctx = getOutputContext(program);
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

          const result = await promoteIdeaStub(repoRoot, ideaId, {
            slug: options.slug,
            priority,
            assignee: options.assignee,
          });

          output(ctx, successResponse(result), () => {
            outputSuccess(ctx, `Promoted idea "${ideaId}" to task`);
            console.log();
            outputKeyValue(ctx, {
              "Task ID": result.taskId,
              "Task Directory": result.taskDir,
              "Priority": priority,
            });
            console.log();
            console.log(chalk.blue("Next steps:"));
            console.log(`  1. Review the task PRD: ${result.taskDir}/prd.md`);
            console.log(`  2. Start working: viben task start ${result.taskId}`);
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
