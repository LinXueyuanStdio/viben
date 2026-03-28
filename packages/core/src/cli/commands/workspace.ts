/**
 * viben workspace - Workspace management commands
 *
 * Subcommands:
 * - list: List all known workspaces
 * - current: Show current workspace information
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  outputTable,
  handleCommandError,
} from "../lib";
import { workspaceManager } from "../../workspace";

/**
 * Register the workspace command
 */
export function registerWorkspaceCommand(program: Command): void {
  const workspaceCmd = program
    .command("workspace")
    .description("Workspace operations");

  // workspace list
  workspaceCmd
    .command("list")
    .description("List all known workspaces")
    .action(async () => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const workspaces = await workspaceManager.listWorkspaces();
        const currentPath = workspaceManager.getCurrentWorkspacePath();

        output(
          ctx,
          successResponse({
            current: currentPath,
            workspaces: workspaces.map((ws) => ({
              path: ws.path,
              name: ws.name,
              mcp: ws.mcp?.enabled || [],
              skills: ws.skills?.enabled || [],
              agents: ws.agents || [],
              isCurrent: ws.path === currentPath,
            })),
            count: workspaces.length,
          }),
          () => {
            if (workspaces.length === 0) {
              console.log(chalk.gray("No known workspaces."));
              console.log();
              console.log("Initialize a workspace with:");
              console.log(chalk.cyan("  viben init"));
              return;
            }

            console.log(chalk.bold("Known Workspaces:"));
            console.log();

            const headers = ["Name", "Path", "MCP", "Skills"];
            const rows = workspaces.map((ws) => {
              const name =
                ws.path === currentPath
                  ? `${ws.name}${chalk.yellow("*")}`
                  : ws.name;

              const mcpCount = ws.mcp?.enabled?.length || 0;
              const skillsCount = ws.skills?.enabled?.length || 0;

              return [
                name,
                chalk.gray(ws.path),
                mcpCount > 0
                  ? chalk.green(`${mcpCount} enabled`)
                  : chalk.gray("none"),
                skillsCount > 0
                  ? chalk.green(`${skillsCount} enabled`)
                  : chalk.gray("none"),
              ];
            });

            outputTable({ ...ctx, json: false }, headers, rows);

            if (currentPath) {
              console.log();
              console.log(chalk.yellow("* = current workspace"));
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // workspace current
  workspaceCmd
    .command("current")
    .description("Show current workspace information")
    .action(async () => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const workspace = await workspaceManager.getCurrentWorkspace();

        if (!workspace) {
          output(
            ctx,
            errorResponse("NOT_IN_WORKSPACE", "Not in a workspace"),
            () => {
              console.log(chalk.gray("Not in a workspace."));
              console.log();
              console.log("Initialize a workspace with:");
              console.log(chalk.cyan("  viben init"));
            }
          );
          return;
        }

        const mcpEnabled = workspace.mcp?.enabled || [];
        const skillsEnabled = workspace.skills?.enabled || [];
        const agents = workspace.agents || [];

        output(
          ctx,
          successResponse({
            path: workspace.path,
            name: workspace.name,
            configPath: workspace.configPath,
            mcp: {
              enabled: mcpEnabled,
              count: mcpEnabled.length,
            },
            skills: {
              enabled: skillsEnabled,
              count: skillsEnabled.length,
            },
            agents: {
              list: agents,
              count: agents.length,
            },
            created_at: workspace.created_at,
            updated_at: workspace.updated_at,
          }),
          () => {
            console.log(chalk.bold("Current Workspace:"));
            console.log();

            console.log(`  ${chalk.cyan("Path:")}    ${workspace.path}`);
            console.log(`  ${chalk.cyan("Name:")}    ${workspace.name}`);

            // MCP
            if (mcpEnabled.length > 0) {
              console.log(
                `  ${chalk.cyan("MCP:")}     ${mcpEnabled.join(", ")} (${mcpEnabled.length} enabled)`
              );
            } else {
              console.log(`  ${chalk.cyan("MCP:")}     ${chalk.gray("none")}`);
            }

            // Skills
            if (skillsEnabled.length > 0) {
              console.log(
                `  ${chalk.cyan("Skills:")}  ${skillsEnabled.join(", ")} (${skillsEnabled.length} enabled)`
              );
            } else {
              console.log(`  ${chalk.cyan("Skills:")}  ${chalk.gray("none")}`);
            }

            // Agents
            if (agents.length > 0) {
              console.log(
                `  ${chalk.cyan("Agents:")}  ${agents.join(", ")} (${agents.length})`
              );
            } else {
              console.log(`  ${chalk.cyan("Agents:")}  ${chalk.gray("none")}`);
            }

            // Timestamps
            if (ctx.verbose) {
              if (workspace.created_at) {
                console.log(
                  `  ${chalk.cyan("Created:")} ${workspace.created_at}`
                );
              }
              if (workspace.updated_at) {
                console.log(
                  `  ${chalk.cyan("Updated:")} ${workspace.updated_at}`
                );
              }
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
