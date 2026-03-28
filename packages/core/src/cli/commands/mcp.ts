/**
 * CLI mcp command - MCP (Model Context Protocol) utilities
 *
 * Uses mcpManager from mcp module.
 */
import chalk from "chalk";
import { spawn } from "node:child_process";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  outputKeyValue,
  outputSuccess,
  handleCommandError,
} from "../lib";
import { mcpManager } from "../../mcp";

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
 * Inspector command options
 */
interface InspectorOptions {
  config?: string;
  server?: string;
  cli?: boolean;
  transport?: string;
  serverUrl?: string;
  env?: string[];
}

/**
 * Start the MCP Inspector
 * This is a thin wrapper around @modelcontextprotocol/inspector
 */
async function startInspector(
  args: string[],
  options: InspectorOptions,
  ctx: OutputContext
): Promise<void> {
  // Build arguments for mcp-inspector
  const inspectorArgs: string[] = [];

  // Add options
  if (options.config) {
    inspectorArgs.push("--config", options.config);
  }

  if (options.server) {
    inspectorArgs.push("--server", options.server);
  }

  if (options.cli) {
    inspectorArgs.push("--cli");
  }

  if (options.transport) {
    inspectorArgs.push("--transport", options.transport);
  }

  if (options.serverUrl) {
    inspectorArgs.push("--server-url", options.serverUrl);
  }

  // Add environment variables
  if (options.env && options.env.length > 0) {
    for (const envVar of options.env) {
      inspectorArgs.push("-e", envVar);
    }
  }

  // Add remaining arguments (command and its args)
  if (args.length > 0) {
    inspectorArgs.push("--", ...args);
  }

  if (!ctx.quiet) {
    console.log("Starting MCP Inspector Proxy...");
    if (ctx.verbose) {
      console.log(
        `Arguments: npx @modelcontextprotocol/inspector ${inspectorArgs.join(" ")}`
      );
    }
  }

  // Spawn the inspector using npx
  // Disable auto browser opening - we only want the proxy server
  const child = spawn(
    "npx",
    ["@modelcontextprotocol/inspector", ...inspectorArgs],
    {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        MCP_AUTO_OPEN_ENABLED: "false",
      },
    }
  );

  // Handle process exit
  child.on("error", (err) => {
    console.error(`Failed to start MCP Inspector: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      process.exit(code);
    } else if (signal) {
      console.log(`MCP Inspector terminated by signal ${signal}`);
    }
  });

  // Handle SIGINT/SIGTERM to gracefully shutdown
  const shutdown = () => {
    child.kill("SIGTERM");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Wait for process to complete
  await new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
  });
}

/**
 * Register the mcp command
 */
export function registerMcpCommand(program: Command): void {
  const mcp = program
    .command("mcp")
    .description("MCP (Model Context Protocol) utilities");

  // mcp list - list installed MCP servers
  mcp
    .command("list")
    .description("List installed MCP servers")
    .option("--agent <id>", "List MCP servers for a specific agent")
    .action(async (options: { agent?: string }) => {
      const ctx = getOutputContext(program);
      try {
        if (options.agent) {
          // List servers for specific agent
          const servers = await mcpManager.getAgentServers(options.agent);

          output(
            ctx,
            successResponse({ agent: options.agent, servers, count: servers.length }),
            () => {
              if (servers.length === 0) {
                console.log(
                  chalk.gray(`No MCP servers configured for agent "${options.agent}".`)
                );
                return;
              }

              console.log(chalk.bold(`MCP Servers for Agent: ${options.agent}`));
              console.log();
              outputTable(
                ctx,
                ["Name", "Command", "Enabled"],
                servers.map((s) => [
                  s.name,
                  `${s.command} ${s.args?.join(" ") || ""}`.trim(),
                  s.enabled ? chalk.green("yes") : chalk.gray("no"),
                ])
              );
            }
          );
        } else {
          // List globally installed MCPs
          const installed = await mcpManager.listInstalled();

          output(
            ctx,
            successResponse({ installed, count: installed.length }),
            () => {
              if (installed.length === 0) {
                console.log(chalk.gray("No MCP servers installed globally."));
                console.log();
                console.log("To configure MCP servers for an agent:");
                console.log(chalk.cyan("  viben mcp list --agent <agent-id>"));
                return;
              }

              console.log(chalk.bold("Installed MCP Servers:"));
              console.log();
              outputTable(
                ctx,
                ["Name", "Version", "Path", "Installed At"],
                installed.map((m) => [
                  m.name,
                  m.version,
                  m.path,
                  formatDate(m.installed_at),
                ])
              );
            }
          );
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // mcp show <name> - show MCP server details
  mcp
    .command("show <name>")
    .description("Show MCP server details")
    .option("--agent <id>", "Agent ID (for agent-specific servers)")
    .action(async (name: string, options: { agent?: string }) => {
      const ctx = getOutputContext(program);
      try {
        if (options.agent) {
          // Show agent-specific server
          const servers = await mcpManager.getAgentServers(options.agent);
          const server = servers.find((s) => s.name === name);

          if (!server) {
            throw new Error(
              `MCP server "${name}" not found for agent "${options.agent}"`
            );
          }

          output(ctx, successResponse({ server }), () => {
            console.log(chalk.bold(`MCP Server: ${server.name}`));
            console.log();
            outputKeyValue(ctx, {
              Name: server.name,
              Command: server.command,
              Args: server.args?.join(" ") || "-",
              Enabled: server.enabled ? "yes" : "no",
            });

            if (server.env && Object.keys(server.env).length > 0) {
              console.log();
              console.log(chalk.bold("Environment Variables:"));
              console.log();
              const envPairs: Record<string, string> = {};
              for (const [k, v] of Object.entries(server.env)) {
                // Mask potentially sensitive values
                envPairs[k] = k.toLowerCase().includes("secret") ||
                  k.toLowerCase().includes("token") ||
                  k.toLowerCase().includes("key")
                  ? maskSecret(v)
                  : v;
              }
              outputKeyValue(ctx, envPairs);
            }
          });
        } else {
          // Show globally installed MCP
          const installed = await mcpManager.listInstalled();
          const mcpServer = installed.find((m) => m.name === name);

          if (!mcpServer) {
            throw new Error(`MCP server "${name}" not found`);
          }

          output(ctx, successResponse({ mcp: mcpServer }), () => {
            console.log(chalk.bold(`MCP Server: ${mcpServer.name}`));
            console.log();
            outputKeyValue(ctx, {
              Name: mcpServer.name,
              Version: mcpServer.version,
              Path: mcpServer.path,
              "Installed At": formatDate(mcpServer.installed_at),
            });
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // mcp inspector [command] [args...] - launch MCP inspector
  mcp
    .command("inspector [command] [args...]")
    .description("Start the MCP Inspector for testing and debugging MCP servers")
    .option("-c, --config <path>", "Path to config file (JSON format with mcpServers)")
    .option("-s, --server <name>", "Server name from config file")
    .option("--cli", "Run in CLI mode (non-interactive)")
    .option("-t, --transport <type>", "Transport type (stdio, sse, http)")
    .option("-u, --server-url <url>", "Server URL for SSE/HTTP transport")
    .option(
      "-e, --env <key=value...>",
      "Environment variables to pass to the MCP server"
    )
    .allowUnknownOption()
    .action(
      async (
        command: string | undefined,
        args: string[],
        options: InspectorOptions
      ) => {
        const ctx = getOutputContext(program);
        const allArgs = command ? [command, ...args] : [];
        await startInspector(allArgs, options, ctx);
      }
    );

  // mcp serve - serve as MCP server
  mcp
    .command("serve")
    .description("Start the MCP server (browse-mcp)")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .allowUnknownOption()
    .action(async () => {
      const ctx = getOutputContext(program);

      if (!ctx.quiet) {
        console.log(chalk.yellow("Note: MCP server functionality is handled by browse-mcp."));
        console.log();
        console.log("To start the MCP server, run:");
        console.log(chalk.cyan("  uvx browse-mcp"));
        console.log();
        console.log("Or install and run:");
        console.log(chalk.cyan("  pip install browse-mcp"));
        console.log(chalk.cyan("  browse-mcp"));
      }
    });

  // mcp add <name> - add an MCP server to an agent
  mcp
    .command("add <name>")
    .description("Add an MCP server configuration to an agent")
    .requiredOption("--agent <id>", "Agent ID")
    .requiredOption("--command <cmd>", "Command to run the MCP server")
    .option("--args <args...>", "Command arguments")
    .option("--env <key=value...>", "Environment variables")
    .option("--disabled", "Add server as disabled")
    .action(
      async (
        name: string,
        options: {
          agent: string;
          command: string;
          args?: string[];
          env?: string[];
          disabled?: boolean;
        }
      ) => {
        const ctx = getOutputContext(program);
        try {
          // Parse environment variables
          const env: Record<string, string> = {};
          if (options.env) {
            for (const e of options.env) {
              const [key, ...valueParts] = e.split("=");
              if (key) {
                env[key] = valueParts.join("=");
              }
            }
          }

          await mcpManager.setAgentServer(options.agent, {
            name,
            command: options.command,
            args: options.args,
            env: Object.keys(env).length > 0 ? env : undefined,
            enabled: !options.disabled,
          });

          output(
            ctx,
            successResponse({ name, agent: options.agent, added: true }),
            () => {
              outputSuccess(
                ctx,
                `MCP server "${name}" added to agent "${options.agent}"`
              );
              console.log();
              outputKeyValue(ctx, {
                Name: name,
                Command: options.command,
                Args: options.args?.join(" ") || "-",
                Enabled: !options.disabled ? "yes" : "no",
              });
            }
          );
        } catch (error) {
          handleCommandError(ctx, error);
        }
      }
    );

  // mcp remove <name> - remove an MCP server from an agent
  mcp
    .command("remove <name>")
    .description("Remove an MCP server configuration from an agent")
    .requiredOption("--agent <id>", "Agent ID")
    .action(async (name: string, options: { agent: string }) => {
      const ctx = getOutputContext(program);
      try {
        await mcpManager.removeAgentServer(options.agent, name);

        output(
          ctx,
          successResponse({ name, agent: options.agent, removed: true }),
          () => {
            outputSuccess(
              ctx,
              `MCP server "${name}" removed from agent "${options.agent}"`
            );
          }
        );
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return "-";
  }

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        if (minutes === 0) {
          return "just now";
        }
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }

    // Format as date
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

/**
 * Mask a secret value for display
 */
function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}
