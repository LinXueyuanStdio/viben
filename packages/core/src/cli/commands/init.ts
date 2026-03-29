/**
 * viben init - Initialize a Viben workspace
 *
 * Creates a complete AI-assisted development workflow structure with:
 * - .viben/ - Workflow files, config, workspace, tasks
 * - docs/specs/ - Development guidelines
 * - docs/idea-types/ - Idea templates
 * - Executor configs (.claude/, .cursor/, etc.)
 * - AGENTS.md - Root instructions
 */
import chalk from "chalk";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import { initWorkspace, EXECUTOR_TEMPLATE_CONFIGS } from "../../workspace";
import type { ExecutorType } from "../../workspace/types";

/**
 * Valid executor types for init (these have template support)
 */
const VALID_EXECUTORS = Object.keys(EXECUTOR_TEMPLATE_CONFIGS) as ExecutorType[];

/**
 * Detect developer name from git config
 */
function detectDeveloperName(cwd: string): string | undefined {
  const isGitRepo = existsSync(join(cwd, ".git"));
  if (!isGitRepo) return undefined;

  try {
    return execSync("git config user.name", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return undefined;
  }
}

interface InitOptions {
  /** Developer name */
  user?: string;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip existing files without error */
  skipExisting?: boolean;
  /** Non-interactive mode */
  yes?: boolean;
  /** Executors to configure */
  executor: string[];
}

/**
 * Register the init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a Viben workspace with AI-assisted development workflow")
    .argument("[target-dir]", "Target directory (default: current directory)", ".")
    .option("-u, --user <name>", "Developer name (auto-detected from git if not provided)")
    .option("-f, --force", "Force overwrite existing files")
    .option("-s, --skip-existing", "Skip existing files without error")
    .option("-y, --yes", "Skip prompts and use defaults")
    .option("-e, --executor <type>", "AI executor to configure (can be used multiple times)", (value: string, previous: string[]) => {
      return previous.concat([value]);
    }, [] as string[])
    .action(async (targetDir: string, options: InitOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolvedDir = resolve(targetDir);

        // Determine developer name
        let developerName = options.user;
        if (!developerName) {
          developerName = detectDeveloperName(resolvedDir);
        }

        // In non-interactive mode (-y), require user name or git detection
        if (!developerName && options.yes) {
          output(
            ctx,
            errorResponse("MISSING_USER_NAME", "Developer name required. Use --user <name> or configure git user.name"),
            () => {
              console.log(chalk.red("Error: Developer name is required in non-interactive mode."));
              console.log();
              console.log("Options:");
              console.log(chalk.cyan("  viben init -y --user <name>"));
              console.log(chalk.cyan("  git config user.name \"Your Name\""));
            }
          );
          process.exit(1);
        }

        // If still no name and not in yes mode, we could prompt, but for now require it
        if (!developerName) {
          output(
            ctx,
            errorResponse("MISSING_USER_NAME", "Developer name is required. Use --user <name>"),
            () => {
              console.log(chalk.red("Error: Developer name is required."));
              console.log();
              console.log("Usage:");
              console.log(chalk.cyan("  viben init --user <name> [target-dir]"));
              console.log(chalk.cyan("  viben init -y --user <name>  # Non-interactive mode"));
              console.log();
              console.log("Example:");
              console.log(chalk.gray("  viben init --user john-doe ./my-project"));
            }
          );
          process.exit(1);
        }

        // Determine which executors to configure
        let executors: ExecutorType[] = [];

        // Process --executor flags
        for (const exec of options.executor) {
          const executorKey = exec.toUpperCase() as ExecutorType;
          if (VALID_EXECUTORS.includes(executorKey)) {
            if (!executors.includes(executorKey)) {
              executors.push(executorKey);
            }
          } else {
            output(
              ctx,
              errorResponse("INVALID_EXECUTOR", `Invalid executor: ${exec}`),
              () => {
                console.log(chalk.red(`Error: Invalid executor "${exec}".`));
                console.log();
                console.log("Valid executors:");
                console.log(chalk.gray(`  ${VALID_EXECUTORS.join(", ")}`));
              }
            );
            process.exit(1);
          }
        }

        // Default: CURSOR + CLAUDE_CODE if no explicit selection
        if (executors.length === 0) {
          executors = ["CURSOR", "CLAUDE_CODE"];
        }

        // Deduplicate (preserving order)
        const uniqueExecutors = [...new Set(executors)];

        if (!ctx.quiet) {
          console.log(chalk.cyan("Initializing Viben workspace..."));
          console.log(chalk.gray(`  Target: ${resolvedDir}`));
          console.log(chalk.gray(`  Developer: ${developerName}`));
          console.log(chalk.gray(`  Executors: ${uniqueExecutors.join(", ")}`));
          console.log();
        }

        const result = await initWorkspace({
          targetDir: resolvedDir,
          developerName,
          force: options.force,
          skipExisting: options.skipExisting,
          executors: uniqueExecutors,
        });

        output(
          ctx,
          successResponse({
            path: result.path,
            files: result.files,
            count: result.files.length,
            warnings: result.warnings,
          }),
          () => {
            console.log(chalk.green("✓ Workspace initialized successfully!"));
            console.log();
            console.log(`Created ${chalk.bold(result.files.length)} files:`);
            console.log(chalk.gray("  .viben/     - Workflow files, scripts, specs"));

            for (const executor of uniqueExecutors) {
              const config = EXECUTOR_TEMPLATE_CONFIGS[executor as keyof typeof EXECUTOR_TEMPLATE_CONFIGS];
              if (config) {
                console.log(chalk.gray(`  ${config.configDir.padEnd(12)} - ${config.name} configuration`));
              }
            }

            console.log(chalk.gray("  AGENTS.md   - Root instructions file"));

            if (result.warnings && result.warnings.length > 0) {
              console.log();
              console.log(chalk.yellow("Warnings:"));
              for (const warning of result.warnings) {
                console.log(chalk.yellow(`  ⚠ ${warning}`));
              }
            }

            console.log();
            console.log("Next steps:");
            console.log(chalk.cyan("  1. Review and customize docs/specs/ guidelines"));
            console.log(chalk.cyan("  2. Run `viben context` to verify setup"));
            console.log(chalk.cyan("  3. Start developing with AI assistance!"));
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
