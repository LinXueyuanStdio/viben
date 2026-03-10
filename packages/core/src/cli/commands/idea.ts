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
import { existsSync, mkdirSync, rmSync } from "node:fs";
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
import {
  findVibenRoot,
  DIR_VIBEN,
} from "../lib/viben-workspace";

// Import from lib modules (will be created by other agents)
// TODO: Import actual implementations when modules are ready
// import { IdeaStore } from "../lib/idea-store";
// import { IdeaGenerator } from "../lib/idea-generator";
// import type { Idea, IdeaType, IdeaStatus, IdeaEffort, IdeaTypeInfo } from "../lib/idea-types";

// =============================================================================
// Constants
// =============================================================================

/** Ideas directory name under .viben */
const DIR_IDEAS = "ideas";

/** Custom idea types directory under docs */
const DIR_CUSTOM_TYPES = "docs/idea-types";

/** Built-in idea types */
const BUILTIN_TYPES = [
  "code_improvements",
  "ui_ux_improvements",
  "documentation_gaps",
  "security_hardening",
  "performance_optimizations",
  "code_quality",
] as const;

/** Valid effort levels */
const EFFORT_LEVELS = ["trivial", "small", "medium", "large", "complex"] as const;

/** Valid idea statuses */
const IDEA_STATUSES = ["draft", "promoted", "dismissed"] as const;

/** Effort to priority mapping */
const EFFORT_TO_PRIORITY: Record<string, string> = {
  trivial: "P3",
  small: "P3",
  medium: "P2",
  large: "P1",
  complex: "P1",
};

// =============================================================================
// Types (minimal, import from idea-types when module is ready)
// =============================================================================

type IdeaEffort = (typeof EFFORT_LEVELS)[number];
type IdeaStatus = (typeof IDEA_STATUSES)[number];

interface Idea {
  id: string;
  type: string;
  title: string;
  description: string;
  rationale: string;
  estimated_effort: IdeaEffort;
  status: IdeaStatus;
  promoted_to: string | null;
  created_at: string;
  affected_files?: string[];
  existing_patterns?: string[];
  implementation_approach?: string;
}

interface IdeaTypeInfo {
  name: string;
  source: "builtin" | "custom";
  description: string;
  path?: string;
}

interface IdeaSession {
  id: string;
  types: string[];
  model: string;
  summary: {
    total_ideas: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
  };
  generated_at: string;
  updated_at: string;
}

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
 * Get ideas directory path
 */
function getIdeasDir(repoRoot: string): string {
  return join(repoRoot, DIR_VIBEN, DIR_IDEAS);
}

/**
 * Ensure ideas directory exists
 */
function ensureIdeasDir(repoRoot: string): string {
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
 * Validate idea type exists
 */
function validateIdeaType(type: string, repoRoot: string): IdeaTypeInfo | null {
  // Check builtin types first
  if (BUILTIN_TYPES.includes(type as (typeof BUILTIN_TYPES)[number])) {
    return {
      name: type,
      source: "builtin",
      description: getBuiltinTypeDescription(type),
    };
  }

  // Check custom types
  const customTypePath = join(repoRoot, DIR_CUSTOM_TYPES, `${type}.md`);
  if (existsSync(customTypePath)) {
    return {
      name: type,
      source: "custom",
      description: customTypePath,
      path: customTypePath,
    };
  }

  return null;
}

/**
 * Get builtin type description
 */
function getBuiltinTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    code_improvements: "Code improvements - pattern-based improvement opportunities",
    ui_ux_improvements: "UI/UX improvements - visual and interaction enhancements",
    documentation_gaps: "Documentation gaps - missing or insufficient docs",
    security_hardening: "Security hardening - vulnerabilities and hardening measures",
    performance_optimizations: "Performance optimizations - bottlenecks and optimization techniques",
    code_quality: "Code quality - code quality improvements and refactoring patterns",
  };
  return descriptions[type] || type;
}

/**
 * List all available idea types (builtin + custom)
 */
function listAvailableTypes(repoRoot: string): IdeaTypeInfo[] {
  const types: IdeaTypeInfo[] = [];

  // Add builtin types
  for (const type of BUILTIN_TYPES) {
    types.push({
      name: type,
      source: "builtin",
      description: getBuiltinTypeDescription(type),
    });
  }

  // Add custom types from docs/idea-types/
  const customTypesDir = join(repoRoot, DIR_CUSTOM_TYPES);
  if (existsSync(customTypesDir)) {
    try {
      const { readdirSync } = require("node:fs");
      const files = readdirSync(customTypesDir) as string[];
      for (const file of files) {
        if (file.endsWith(".md")) {
          const name = file.replace(/\.md$/, "");
          // Skip if it's a builtin type (shouldn't happen, but be safe)
          if (!BUILTIN_TYPES.includes(name as (typeof BUILTIN_TYPES)[number])) {
            types.push({
              name,
              source: "custom",
              description: join(customTypesDir, file),
              path: join(customTypesDir, file),
            });
          }
        }
      }
    } catch {
      // Ignore errors reading custom types directory
    }
  }

  return types;
}

// =============================================================================
// Stub functions (replace with actual implementations)
// =============================================================================

// TODO: Replace these stubs with actual IdeaStore and IdeaGenerator calls

/**
 * Stub: Generate ideas using AI
 */
async function generateIdeas(
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
  // TODO: Implement with IdeaGenerator
  throw CliError.operationFailed(
    "Generate ideas",
    "IdeaGenerator not yet implemented. This feature is coming soon."
  );
}

/**
 * Stub: List ideas
 */
async function listIdeas(
  _repoRoot: string,
  _filters?: {
    type?: string;
    effort?: IdeaEffort;
    status?: IdeaStatus;
  }
): Promise<Idea[]> {
  // TODO: Implement with IdeaStore
  return [];
}

/**
 * Stub: Get idea by ID
 */
async function getIdea(_repoRoot: string, _ideaId: string): Promise<Idea | null> {
  // TODO: Implement with IdeaStore
  return null;
}

/**
 * Stub: Promote idea to task
 */
async function promoteIdea(
  _repoRoot: string,
  _ideaId: string,
  _options: {
    slug?: string;
    priority?: string;
    assignee?: string;
  }
): Promise<{ taskId: string; taskDir: string }> {
  // TODO: Implement with IdeaStore and task creation
  throw CliError.operationFailed(
    "Promote idea",
    "IdeaStore not yet implemented. This feature is coming soon."
  );
}

/**
 * Stub: Remove ideas
 */
async function removeIdeas(
  _repoRoot: string,
  _options: {
    ideaIds?: string[];
    type?: string;
    all?: boolean;
  }
): Promise<{ removed: string[]; count: number }> {
  // TODO: Implement with IdeaStore
  return { removed: [], count: 0 };
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
    .option("-o, --output <dir>", "Output directory", `.viben/${DIR_IDEAS}/`)
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
            if (!validateIdeaType(type, repoRoot)) {
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
            : ensureIdeasDir(repoRoot);

          if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
          }

          // Generate ideas
          const result = await generateIdeas(repoRoot, {
            types: options.types,
            outputDir,
            model: options.model,
            maxIdeas: parseInt(options.maxIdeas || "5", 10),
            append: options.append,
            override: options.override,
          });

          output(ctx, successResponse(result), () => {
            console.log(chalk.green(`Generated ${result.summary.total_ideas} ideas`));
            console.log();

            console.log(chalk.bold("Summary by type:"));
            for (const [type, count] of Object.entries(result.summary.by_type)) {
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
          if (options.effort && !EFFORT_LEVELS.includes(options.effort as IdeaEffort)) {
            throw CliError.invalidArgument(
              "effort",
              `Invalid effort level. Must be one of: ${EFFORT_LEVELS.join(", ")}`
            );
          }

          if (options.status && !IDEA_STATUSES.includes(options.status as IdeaStatus)) {
            throw CliError.invalidArgument(
              "status",
              `Invalid status. Must be one of: ${IDEA_STATUSES.join(", ")}`
            );
          }

          const ideas = await listIdeas(repoRoot, {
            type: options.type,
            effort: options.effort as IdeaEffort,
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
                formatEffort(idea.estimated_effort),
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
        const types = listAvailableTypes(repoRoot);

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
        const idea = await getIdea(repoRoot, ideaId);

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
            Effort: formatEffort(idea.estimated_effort),
            "Created At": idea.created_at,
            "Promoted To": idea.promoted_to || "-",
          });

          console.log();
          console.log(chalk.bold("Description:"));
          console.log(`  ${idea.description}`);

          console.log();
          console.log(chalk.bold("Rationale:"));
          console.log(`  ${idea.rationale}`);

          if (idea.affected_files && idea.affected_files.length > 0) {
            console.log();
            console.log(chalk.bold("Affected Files:"));
            for (const file of idea.affected_files) {
              console.log(`  - ${file}`);
            }
          }

          if (idea.existing_patterns && idea.existing_patterns.length > 0) {
            console.log();
            console.log(chalk.bold("Existing Patterns:"));
            for (const pattern of idea.existing_patterns) {
              console.log(`  - ${pattern}`);
            }
          }

          if (idea.implementation_approach) {
            console.log();
            console.log(chalk.bold("Implementation Approach:"));
            console.log(`  ${idea.implementation_approach}`);
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
          const idea = await getIdea(repoRoot, ideaId);
          if (!idea) {
            throw CliError.notFound("Idea", ideaId);
          }

          if (idea.status === "promoted") {
            throw CliError.operationFailed(
              "Promote idea",
              `Idea "${ideaId}" has already been promoted to task "${idea.promoted_to}"`
            );
          }

          // Use effort-based priority if not specified
          const priority = options.priority || EFFORT_TO_PRIORITY[idea.estimated_effort] || "P2";

          const result = await promoteIdea(repoRoot, ideaId, {
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

          const result = await removeIdeas(repoRoot, {
            ideaIds: ideaIds.length > 0 ? ideaIds : undefined,
            type: options.type,
            all: options.all,
          });

          output(ctx, successResponse(result), () => {
            if (result.count === 0) {
              console.log(chalk.gray("No ideas removed."));
              return;
            }

            outputSuccess(ctx, `Removed ${result.count} idea(s)`);

            if (result.removed.length <= 10) {
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
