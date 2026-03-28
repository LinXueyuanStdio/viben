/**
 * viben config - Git-style configuration management
 *
 * Provides git-like config operations: get, set, list, edit, unset.
 * Supports both global (~/.viben/config.yaml) and workspace (.viben/config.yaml) configs.
 */
import { spawn } from "node:child_process";
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import { CliError } from "../types";
import {
  output,
  successResponse,
  outputKeyValue,
  handleCommandError,
  outputError,
} from "../lib";
import {
  gitConfigManager,
  getConfigPath,
  getWorkspaceConfigPath,
} from "../../config";
import { workspaceManager } from "../../workspace";

interface ConfigOptions {
  /** Use global config */
  global?: boolean;
  /** Use workspace config */
  workspace?: boolean;
  /** Show the origin of each config value */
  showOrigin?: boolean;
}

/**
 * Get the editor to use for editing config files
 */
function getEditor(): string {
  return process.env.EDITOR || process.env.VISUAL || "vi";
}

/**
 * Resolve config options to determine which config to use
 */
function resolveConfigOptions(
  options: ConfigOptions,
  globalOpts: { global?: boolean }
): { global: boolean; workspace_path?: string } {
  // Explicit global flag takes precedence
  if (options.global || globalOpts.global) {
    return { global: true };
  }

  // Explicit workspace flag
  if (options.workspace) {
    const workspacePath = workspaceManager.getCurrentWorkspacePath();
    if (!workspacePath) {
      throw new CliError(
        "Not in a workspace. Use --global to access global config.",
        "NOT_IN_WORKSPACE",
        1
      );
    }
    return { global: false, workspace_path: workspacePath };
  }

  // Default: prefer workspace if in one, otherwise global
  const workspacePath = workspaceManager.getCurrentWorkspacePath();
  if (workspacePath) {
    return { global: false, workspace_path: workspacePath };
  }

  return { global: true };
}

/**
 * Get config file path for the resolved options
 */
function getConfigPathForOptions(options: {
  global: boolean;
  workspace_path?: string;
}): string {
  if (options.global) {
    return getConfigPath();
  }
  return getWorkspaceConfigPath(options.workspace_path || process.cwd());
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Register the config command
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage Viben configuration (git-style)");

  // config get <key>
  configCmd
    .command("get <key>")
    .description("Get a config value")
    .option("-g, --global", "Use global config")
    .option("-w, --workspace", "Use workspace config")
    .action(async (key: string, options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolved = resolveConfigOptions(options, program.opts());
        const value = await gitConfigManager.get(key, resolved);

        output(
          ctx,
          successResponse({ key, value: value ?? null }),
          () => {
            if (value !== undefined) {
              console.log(formatValue(value));
            }
            // No output for undefined values (git config behavior)
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // config set <key> <value>
  configCmd
    .command("set <key> <value>")
    .description("Set a config value")
    .option("-g, --global", "Use global config")
    .option("-w, --workspace", "Use workspace config")
    .action(async (key: string, value: string, options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolved = resolveConfigOptions(options, program.opts());
        await gitConfigManager.set(key, value, resolved);

        const scope = resolved.global ? "global" : "workspace";
        output(
          ctx,
          successResponse({ key, value, scope }),
          () => {
            console.log(
              chalk.green("OK") + ` Set ${chalk.cyan(key)} = ${formatValue(value)}`
            );
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // config unset <key>
  configCmd
    .command("unset <key>")
    .description("Remove a config value")
    .option("-g, --global", "Use global config")
    .option("-w, --workspace", "Use workspace config")
    .action(async (key: string, options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolved = resolveConfigOptions(options, program.opts());
        const deleted = await gitConfigManager.unset(key, resolved);

        if (!deleted) {
          outputError(ctx, "KEY_NOT_FOUND", `Key "${key}" not found in config`);
          process.exit(1);
        }

        output(
          ctx,
          successResponse({ key, deleted: true }),
          () => {
            console.log(chalk.green("OK") + ` Unset ${chalk.cyan(key)}`);
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // config list
  configCmd
    .command("list")
    .description("List all config values")
    .option("-g, --global", "Use global config")
    .option("-w, --workspace", "Use workspace config")
    .option("--show-origin", "Show the origin of each config value")
    .action(async (options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        if (options.showOrigin) {
          // Show merged config with origins
          const workspacePath = workspaceManager.getCurrentWorkspacePath();
          const entries = await gitConfigManager.getMerged(workspacePath || undefined);

          output(
            ctx,
            successResponse({ items: entries }),
            () => {
              if (entries.length === 0) {
                console.log(chalk.gray("No configuration values."));
                return;
              }

              const pairs: Record<string, string> = {};
              for (const entry of entries) {
                const origin = entry.origin ? chalk.gray(` (${entry.origin})`) : "";
                pairs[entry.key] = `${formatValue(entry.value)}${origin}`;
              }
              outputKeyValue(ctx, pairs);
            }
          );
          return;
        }

        // List config for specific scope
        const resolved = resolveConfigOptions(options, program.opts());
        const entries = await gitConfigManager.list(resolved);

        const scope = resolved.global ? "global" : "workspace";
        output(
          ctx,
          successResponse({ items: entries, scope }),
          () => {
            if (entries.length === 0) {
              console.log(chalk.gray("No configuration values."));
              return;
            }

            for (const entry of entries) {
              console.log(`${chalk.cyan(entry.key)}=${formatValue(entry.value)}`);
            }
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // config edit
  configCmd
    .command("edit")
    .description("Open config in editor")
    .option("-g, --global", "Edit global config")
    .option("-w, --workspace", "Edit workspace config")
    .action(async (options: ConfigOptions) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        verbose: program.opts().verbose ?? false,
        quiet: program.opts().quiet ?? false,
      };

      try {
        const resolved = resolveConfigOptions(options, program.opts());
        const configPath = getConfigPathForOptions(resolved);
        const editor = getEditor();

        output(
          ctx,
          successResponse({ configPath, editor }),
          () => {
            console.log(
              `Opening ${chalk.cyan(configPath)} in ${chalk.yellow(editor)}...`
            );
          }
        );

        // Spawn editor
        const child = spawn(editor, [configPath], {
          stdio: "inherit",
          shell: true,
        });

        await new Promise<void>((resolve, reject) => {
          child.on("error", (error) => {
            reject(
              new CliError(
                `Failed to open editor: ${error.message}`,
                "EDITOR_ERROR",
                1
              )
            );
          });
          child.on("close", () => {
            resolve();
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
