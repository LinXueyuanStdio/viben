/**
 * viben init - Initialize a Viben workspace
 *
 * Creates a new workspace in the current directory with default configuration.
 * Supports templates and force initialization options.
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  handleCommandError,
} from "../lib";
import { workspaceManager, initWorkspace, listWorkspaceTemplates } from "../../workspace";

interface InitOptions {
  /** Template to use for initialization */
  from?: string;
  /** Force initialization even if workspace already exists */
  force?: boolean;
  /** List available templates */
  listTemplates?: boolean;
}

/**
 * Register the init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a Viben workspace in the current directory")
    .option("--from <template>", "Initialize from a template")
    .option("--force", "Force initialization even if workspace already exists")
    .option("--list-templates", "List available workspace templates")
    .action(async (options: InitOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        // Handle list templates option
        if (options.listTemplates) {
          const templates = await listWorkspaceTemplates();

          output(
            ctx,
            successResponse({
              templates: templates.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
              })),
              count: templates.length,
            }),
            () => {
              if (templates.length === 0) {
                console.log(chalk.gray("No workspace templates available."));
                console.log();
                console.log("Create a template with:");
                console.log(chalk.cyan("  viben workspace template create <name>"));
                return;
              }

              console.log(chalk.bold("Available Templates:"));
              console.log();

              for (const template of templates) {
                console.log(`  ${chalk.cyan(template.id)}`);
                if (template.name) {
                  console.log(`    Name: ${template.name}`);
                }
                if (template.description) {
                  console.log(`    ${chalk.gray(template.description)}`);
                }
                console.log();
              }
            }
          );
          return;
        }

        // Initialize workspace
        const result = await initWorkspace({
          targetDir: process.cwd(),
          template: options.from,
          force: options.force,
        });

        output(
          ctx,
          successResponse({
            success: result.success,
            path: result.path,
            files: result.files,
            template: options.from,
          }),
          () => {
            console.log(chalk.green("Workspace initialized successfully!"));
            console.log();

            console.log("Created:");
            for (const file of result.files) {
              console.log(chalk.gray(`  .viben/${file}`));
            }

            console.log();
            console.log("Next steps:");
            console.log(chalk.cyan("  viben config list") + "       - View configuration");
            console.log(chalk.cyan("  viben agent list") + "        - List agents");
            console.log(chalk.cyan("  viben mcp install <name>") + "  - Install MCP servers");
            console.log(chalk.cyan("  viben skill install <name>") + " - Install skills");
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
