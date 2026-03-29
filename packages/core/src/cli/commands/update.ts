/**
 * viben update - Update Viben workspace components
 *
 * Subcommands/Options:
 * - --idea-types: Update idea-types templates in docs/idea-types/
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
import { updateIdeaTypes, updateRewardTypes } from "../../workspace/update";

interface UpdateOptions {
  /** Update idea-types templates */
  ideaTypes?: boolean;
  /** Update reward-types templates */
  rewardTypes?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip existing files without error */
  skipExisting?: boolean;
}

/**
 * Register the update command
 */
export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update Viben workspace components")
    .argument("[target-dir]", "Target directory (default: current directory)", ".")
    .option("--idea-types", "Update idea-types templates in docs/idea-types/")
    .option("--reward-types", "Update reward-types templates in docs/reward-types/")
    .option("-f, --force", "Force overwrite existing files")
    .option("-s, --skip-existing", "Skip existing files without error")
    .action(async (targetDir: string, options: UpdateOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolvedDir = resolve(targetDir);
        const createdFiles: string[] = [];

        // Check if at least one update option is specified
        if (!options.ideaTypes && !options.rewardTypes) {
          output(
            ctx,
            errorResponse("NO_UPDATE_OPTION", "No update option specified. Use --idea-types or --reward-types."),
            () => {
              console.log(chalk.red("Error: No update option specified."));
              console.log();
              console.log("Available options:");
              console.log(chalk.cyan("  --idea-types     Update idea-types templates in docs/idea-types/"));
              console.log(chalk.cyan("  --reward-types   Update reward-types templates in docs/reward-types/"));
              console.log();
              console.log("Example:");
              console.log(chalk.gray("  viben update --idea-types"));
              console.log(chalk.gray("  viben update --reward-types"));
            }
          );
          process.exit(1);
        }

        const writeOpts = {
          force: options.force,
          skipExisting: options.skipExisting,
        };

        if (!ctx.quiet) {
          console.log(chalk.cyan("Updating Viben workspace..."));
          console.log(chalk.gray(`  Target: ${resolvedDir}`));
          console.log();
        }

        // Update idea-types templates
        if (options.ideaTypes) {
          if (!ctx.quiet) {
            console.log(chalk.gray("  Updating idea-types templates..."));
          }
          await updateIdeaTypes(resolvedDir, writeOpts, createdFiles);
        }

        // Update reward-types templates
        if (options.rewardTypes) {
          if (!ctx.quiet) {
            console.log(chalk.gray("  Updating reward-types templates..."));
          }
          await updateRewardTypes(resolvedDir, writeOpts, createdFiles);
        }

        output(
          ctx,
          successResponse({
            path: resolvedDir,
            files: createdFiles,
            count: createdFiles.length,
          }),
          () => {
            console.log(chalk.green("✓ Workspace updated successfully!"));
            console.log();
            if (createdFiles.length > 0) {
              console.log(`Updated ${chalk.bold(createdFiles.length)} files:`);
              for (const file of createdFiles) {
                console.log(chalk.gray(`  ${file}`));
              }
            } else {
              console.log(chalk.gray("No files were updated (all files already exist)."));
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
