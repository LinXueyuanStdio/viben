/**
 * viben team - Team and workspace initialization commands
 *
 * Subcommands:
 * - init: Initialize a Viben team workspace with AI-assisted development workflow
 */
import chalk from "chalk";
import { resolve } from "node:path";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  handleCommandError,
} from "../lib";
import { initTeam, type ProjectType } from "../../team";

/**
 * Register the team command
 */
export function registerTeamCommand(program: Command): void {
  const teamCmd = program
    .command("team")
    .description("Team and workspace initialization");

  // team init
  teamCmd
    .command("init")
    .description("Initialize a Viben team workspace with AI-assisted development workflow")
    .argument("[target-dir]", "Target directory (default: current directory)", ".")
    .option("-n, --developer-name <name>", "Developer name (required)")
    .option("-t, --type <type>", "Project type: frontend, backend, fullstack", "fullstack")
    .option("-f, --force", "Force overwrite existing files")
    .option("-s, --skip-existing", "Skip existing files without error")
    .option("--no-cursor", "Skip Cursor configuration")
    .action(async (targetDir: string, options: {
      developerName?: string;
      type?: string;
      force?: boolean;
      skipExisting?: boolean;
      cursor?: boolean;
    }) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        // Validate developer name
        if (!options.developerName) {
          output(
            ctx,
            errorResponse("MISSING_DEVELOPER_NAME", "Developer name is required. Use --developer-name <name>"),
            () => {
              console.log(chalk.red("Error: Developer name is required."));
              console.log();
              console.log("Usage:");
              console.log(chalk.cyan("  viben team init --developer-name <name> [target-dir]"));
              console.log();
              console.log("Example:");
              console.log(chalk.gray("  viben team init --developer-name john-doe ./my-project"));
            }
          );
          process.exit(1);
        }

        // Validate project type
        const projectType = options.type as ProjectType;
        if (!["frontend", "backend", "fullstack"].includes(projectType)) {
          output(
            ctx,
            errorResponse("INVALID_PROJECT_TYPE", `Invalid project type: ${options.type}`),
            () => {
              console.log(chalk.red(`Error: Invalid project type "${options.type}".`));
              console.log();
              console.log("Valid types: frontend, backend, fullstack");
            }
          );
          process.exit(1);
        }

        const resolvedDir = resolve(targetDir);

        if (!ctx.quiet) {
          console.log(chalk.cyan("Initializing Viben team workspace..."));
          console.log(chalk.gray(`  Target: ${resolvedDir}`));
          console.log(chalk.gray(`  Developer: ${options.developerName}`));
          console.log(chalk.gray(`  Type: ${projectType}`));
          console.log();
        }

        const result = await initTeam({
          targetDir: resolvedDir,
          developerName: options.developerName,
          projectType,
          force: options.force,
          skipExisting: options.skipExisting,
          includeCursor: options.cursor !== false,
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
            console.log(chalk.gray("  .claude/    - Claude Code configuration"));
            if (options.cursor !== false) {
              console.log(chalk.gray("  .cursor/    - Cursor IDE configuration"));
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
            console.log(chalk.cyan("  1. Review and customize .viben/spec/ guidelines"));
            console.log(chalk.cyan("  2. Run ./.viben/scripts/get-context.sh to verify setup"));
            console.log(chalk.cyan("  3. Start developing with AI assistance!"));
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
