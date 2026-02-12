/**
 * Agent CLI commands
 */
import { Command } from "commander";
import chalk from "chalk";
import type { OutputContext } from "../types";
import { CliError } from "../types";
import {
  output,
  successResponse,
  outputTable,
  handleCommandError,
  outputKeyValue,
  outputSuccess,
} from "../lib";
import { agentManager, templateManager, memoryManager } from "../../agents";
import { configManager } from "../../config";
import { EXECUTOR_TYPES, isExecutorType } from "../../executors";
import type { ExecutorType } from "../../types";

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
 * Register agent commands
 */
export function registerAgentCommand(program: Command): void {
  const agent = program.command("agent").description("Manage AI agents");

  // agent list - list all agents
  agent
    .command("list")
    .description("List all agents")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        const agents = await agentManager.listAgents();
        const defaultAgentId = await configManager.getDefaultAgent();

        output(ctx, successResponse({ agents, defaultAgentId }), () => {
          if (agents.length === 0) {
            console.log(chalk.yellow("No agents found"));
            console.log(
              chalk.gray('Use "viben agent create <name>" to create one')
            );
            return;
          }

          outputTable(
            ctx,
            ["ID", "Name", "Executor", "Model", "Default"],
            agents.map((a) => [
              a.id,
              a.name,
              a.executorType || "-",
              a.model || "-",
              a.id === defaultAgentId ? chalk.green("*") : "",
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent create <name> - create a new agent
  agent
    .command("create")
    .description("Create a new agent")
    .argument("<name>", "Agent name")
    .option("-m, --model <model>", "Model to use")
    .option("-p, --provider <provider>", "Provider ID")
    .option(
      "-e, --executor-type <type>",
      "Executor type (e.g., CLAUDE_CODE, GEMINI)"
    )
    .option("-t, --from-template <id>", "Create from template")
    .option("-d, --description <desc>", "Agent description")
    .option("--system-prompt <prompt>", "System prompt")
    .option("--append-prompt <prompt>", "Append prompt")
    .option("--temperature <temp>", "Temperature (0-2)", parseFloat)
    .option("--max-tokens <tokens>", "Max output tokens", parseInt)
    .option("--plan-mode", "Enable plan mode (Claude Code)")
    .option("--approvals", "Enable approvals (Claude Code)")
    .action(async (name, options) => {
      const ctx = getOutputContext(program);
      try {
        // Validate executor type if provided
        if (options.executorType) {
          const upperType = options.executorType.toUpperCase();
          if (!isExecutorType(upperType)) {
            throw CliError.invalidArgument(
              "executor-type",
              `Invalid executor type: ${options.executorType}. Valid types: ${EXECUTOR_TYPES.join(", ")}`
            );
          }
          options.executorType = upperType as ExecutorType;
        }

        const agent = await agentManager.createAgent({
          name,
          description: options.description,
          model: options.model,
          provider: options.provider,
          executorType: options.executorType,
          systemPrompt: options.systemPrompt,
          appendPrompt: options.appendPrompt,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          planMode: options.planMode,
          approvals: options.approvals,
          fromTemplate: options.fromTemplate,
        });

        output(ctx, successResponse({ agent }), () => {
          outputSuccess(ctx, `Created agent: ${agent.id}`);
          if (ctx.verbose) {
            console.log();
            outputKeyValue(ctx, {
              ID: agent.id,
              Name: agent.name,
              Executor: agent.executorType || "-",
              Model: agent.model || "-",
              Provider: agent.provider || "-",
            });
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent show <id> - show agent details
  agent
    .command("show")
    .description("Show agent details")
    .argument("<id>", "Agent ID")
    .action(async (id: string) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(id);
        if (!agentData) {
          throw CliError.notFound("Agent", id);
        }

        const defaultAgentId = await configManager.getDefaultAgent();
        const isDefault = agentData.id === defaultAgentId;

        output(ctx, successResponse({ agent: agentData, isDefault }), () => {
          console.log(chalk.bold(`Agent: ${agentData.name}`));
          if (isDefault) {
            console.log(chalk.green("(Default Agent)"));
          }
          console.log();

          outputKeyValue(ctx, {
            ID: agentData.id,
            Name: agentData.name,
            Description: agentData.description || "-",
            Executor: agentData.executorType || "-",
            Model: agentData.model || "-",
            Provider: agentData.provider || "-",
            Temperature:
              agentData.temperature !== undefined
                ? String(agentData.temperature)
                : "-",
            "Max Tokens":
              agentData.maxTokens !== undefined
                ? String(agentData.maxTokens)
                : "-",
            "Plan Mode": agentData.planMode ? "Enabled" : "Disabled",
            Approvals: agentData.approvals ? "Enabled" : "Disabled",
            "Created At": agentData.createdAt,
            "Updated At": agentData.updatedAt,
          });

          if (agentData.mcpServers.length > 0) {
            console.log();
            console.log(chalk.bold("MCP Servers:"));
            for (const server of agentData.mcpServers) {
              console.log(`  ${chalk.cyan("•")} ${server}`);
            }
          }

          if (agentData.skills.length > 0) {
            console.log();
            console.log(chalk.bold("Skills:"));
            for (const skill of agentData.skills) {
              console.log(`  ${chalk.cyan("•")} ${skill}`);
            }
          }

          if (agentData.systemPrompt && ctx.verbose) {
            console.log();
            console.log(chalk.bold("System Prompt:"));
            console.log(chalk.gray(agentData.systemPrompt.slice(0, 200)));
            if (agentData.systemPrompt.length > 200) {
              console.log(chalk.gray("..."));
            }
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent remove <id> - remove an agent
  agent
    .command("remove")
    .description("Remove an agent")
    .argument("<id>", "Agent ID")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, options) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(id);
        if (!agentData) {
          throw CliError.notFound("Agent", id);
        }

        // Note: In non-interactive mode, we skip confirmation
        // A proper implementation would prompt the user
        if (!options.force && !ctx.json && !ctx.quiet) {
          console.log(
            chalk.yellow(
              `Warning: This will permanently delete agent "${id}" and all its data.`
            )
          );
          console.log(chalk.gray("Use --force to skip this warning"));
        }

        await agentManager.removeAgent(id);

        output(ctx, successResponse({ removed: id }), () => {
          outputSuccess(ctx, `Removed agent: ${id}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent config <id> - show/edit agent config
  agent
    .command("config")
    .description("Show or edit agent configuration")
    .argument("<id>", "Agent ID")
    .option("-s, --set <key=value>", "Set a configuration value", collect, [])
    .action(async (id: string, options) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(id);
        if (!agentData) {
          throw CliError.notFound("Agent", id);
        }

        // If setting values
        if (options.set && options.set.length > 0) {
          const updates: Record<string, unknown> = {};
          for (const pair of options.set) {
            const [key, ...valueParts] = pair.split("=");
            const value = valueParts.join("=");
            if (!key || value === undefined) {
              throw CliError.invalidArgument(
                "set",
                `Invalid format: ${pair}. Use key=value`
              );
            }
            updates[key] = parseConfigValue(value);
          }

          const updated = await agentManager.updateAgent(id, updates);
          output(ctx, successResponse({ agent: updated }), () => {
            outputSuccess(ctx, `Updated agent: ${id}`);
          });
        } else {
          // Show current config
          output(ctx, successResponse({ agent: agentData }), () => {
            console.log(chalk.bold(`Configuration for agent: ${id}`));
            console.log();
            outputKeyValue(ctx, {
              name: agentData.name,
              description: agentData.description || "",
              model: agentData.model || "",
              provider: agentData.provider || "",
              executorType: agentData.executorType || "",
              temperature:
                agentData.temperature !== undefined
                  ? String(agentData.temperature)
                  : "",
              maxTokens:
                agentData.maxTokens !== undefined
                  ? String(agentData.maxTokens)
                  : "",
              planMode: String(agentData.planMode),
              approvals: String(agentData.approvals),
            });
          });
        }
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent set-default <id> - set default agent
  agent
    .command("set-default")
    .description("Set the default agent")
    .argument("<id>", "Agent ID")
    .action(async (id: string) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(id);
        if (!agentData) {
          throw CliError.notFound("Agent", id);
        }

        await agentManager.setDefault(id);

        output(ctx, successResponse({ defaultAgent: id }), () => {
          outputSuccess(ctx, `Set default agent: ${id}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent status - show agent status
  agent
    .command("status")
    .description("Show agent status and summary")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        const agents = await agentManager.listAgents();
        const defaultAgentId = await configManager.getDefaultAgent();
        const defaultAgent = defaultAgentId
          ? await agentManager.getAgent(defaultAgentId)
          : null;

        // Count by executor type
        const byExecutor: Record<string, number> = {};
        for (const a of agents) {
          const exec = a.executorType || "unset";
          byExecutor[exec] = (byExecutor[exec] || 0) + 1;
        }

        const status = {
          totalAgents: agents.length,
          defaultAgent: defaultAgent
            ? { id: defaultAgent.id, name: defaultAgent.name }
            : null,
          byExecutorType: byExecutor,
        };

        output(ctx, successResponse(status), () => {
          console.log(chalk.bold("Agent Status"));
          console.log();
          outputKeyValue(ctx, {
            "Total Agents": String(agents.length),
            "Default Agent": defaultAgent
              ? `${defaultAgent.name} (${defaultAgent.id})`
              : chalk.gray("(not set)"),
          });

          if (Object.keys(byExecutor).length > 0) {
            console.log();
            console.log(chalk.bold("By Executor Type:"));
            for (const [exec, count] of Object.entries(byExecutor)) {
              console.log(`  ${chalk.cyan(exec)}: ${count}`);
            }
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ========================================================================
  // Nested command: agent template
  // ========================================================================

  const template = agent
    .command("template")
    .description("Manage agent templates");

  // agent template list
  template
    .command("list")
    .description("List all templates")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        const templates = await templateManager.list();

        output(ctx, successResponse({ templates }), () => {
          if (templates.length === 0) {
            console.log(chalk.yellow("No templates found"));
            console.log(
              chalk.gray(
                'Use "viben agent template create <agent-id> <template-id>" to create one'
              )
            );
            return;
          }

          outputTable(
            ctx,
            ["ID", "Name", "Executor", "Model", "Created"],
            templates.map((t) => [
              t.id,
              t.name,
              t.config.executorType || "-",
              t.config.model || "-",
              t.createdAt.split("T")[0],
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent template create <agent-id> <template-id>
  template
    .command("create")
    .description("Create a template from an agent")
    .argument("<agent-id>", "Source agent ID")
    .argument("<template-id>", "Template ID to create")
    .action(async (agentId: string, templateId: string) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(agentId);
        if (!agentData) {
          throw CliError.notFound("Agent", agentId);
        }

        const tpl = await agentManager.createTemplate(agentId, templateId);

        output(ctx, successResponse({ template: tpl }), () => {
          outputSuccess(ctx, `Created template: ${templateId}`);
          if (ctx.verbose) {
            console.log();
            outputKeyValue(ctx, {
              ID: tpl.id,
              Name: tpl.name,
              "Source Agent": agentId,
            });
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent template show <template-id>
  template
    .command("show")
    .description("Show template details")
    .argument("<template-id>", "Template ID")
    .action(async (templateId: string) => {
      const ctx = getOutputContext(program);
      try {
        const tpl = await templateManager.get(templateId);
        if (!tpl) {
          throw CliError.notFound("Template", templateId);
        }

        output(ctx, successResponse({ template: tpl }), () => {
          console.log(chalk.bold(`Template: ${tpl.name}`));
          console.log();

          outputKeyValue(ctx, {
            ID: tpl.id,
            Name: tpl.name,
            Description: tpl.description || "-",
            Executor: tpl.config.executorType || "-",
            Model: tpl.config.model || "-",
            Provider: tpl.config.provider || "-",
            "Created At": tpl.createdAt,
          });
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent template remove <template-id>
  template
    .command("remove")
    .description("Remove a template")
    .argument("<template-id>", "Template ID")
    .action(async (templateId: string) => {
      const ctx = getOutputContext(program);
      try {
        const tpl = await templateManager.get(templateId);
        if (!tpl) {
          throw CliError.notFound("Template", templateId);
        }

        await templateManager.remove(templateId);

        output(ctx, successResponse({ removed: templateId }), () => {
          outputSuccess(ctx, `Removed template: ${templateId}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ========================================================================
  // Nested command: agent session
  // ========================================================================

  const session = agent
    .command("session")
    .description("Manage agent sessions");

  // agent session list <agent-id>
  session
    .command("list")
    .description("List sessions for an agent")
    .argument("<agent-id>", "Agent ID")
    .action(async (agentId: string) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(agentId);
        if (!agentData) {
          throw CliError.notFound("Agent", agentId);
        }

        const sessions = await agentManager.listSessions(agentId);

        output(ctx, successResponse({ sessions }), () => {
          if (sessions.length === 0) {
            console.log(chalk.yellow(`No sessions found for agent: ${agentId}`));
            return;
          }

          outputTable(
            ctx,
            ["ID", "Name", "Created", "Last Accessed"],
            sessions.map((s) => [
              s.id.slice(0, 8) + "...",
              s.name || "-",
              s.createdAt.split("T")[0],
              s.lastAccessedAt.split("T")[0],
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent session create <agent-id>
  session
    .command("create")
    .description("Create a new session")
    .argument("<agent-id>", "Agent ID")
    .option("-n, --name <name>", "Session name")
    .action(async (agentId: string, options) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(agentId);
        if (!agentData) {
          throw CliError.notFound("Agent", agentId);
        }

        const sess = await agentManager.createSession(agentId, options.name);

        output(ctx, successResponse({ session: sess }), () => {
          outputSuccess(ctx, `Created session: ${sess.id}`);
          if (ctx.verbose) {
            console.log();
            outputKeyValue(ctx, {
              ID: sess.id,
              Agent: sess.agentId,
              Name: sess.name || "-",
            });
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent session remove <agent-id> <session-id>
  session
    .command("remove")
    .description("Remove a session")
    .argument("<agent-id>", "Agent ID")
    .argument("<session-id>", "Session ID")
    .action(async (agentId: string, sessionId: string) => {
      const ctx = getOutputContext(program);
      try {
        await agentManager.removeSession(agentId, sessionId);

        output(ctx, successResponse({ removed: sessionId }), () => {
          outputSuccess(ctx, `Removed session: ${sessionId}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // ========================================================================
  // Nested command: agent memory
  // ========================================================================

  const memory = agent.command("memory").description("Manage agent memory");

  // agent memory show <agent-id>
  memory
    .command("show")
    .description("Show agent memory")
    .argument("<agent-id>", "Agent ID")
    .option("-d, --days <days>", "Show daily logs for N days", parseInt, 7)
    .action(async (agentId: string, options) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(agentId);
        if (!agentData) {
          throw CliError.notFound("Agent", agentId);
        }

        const memoryContent = await memoryManager.getMemory(agentId);
        const stats = await memoryManager.getMemoryStats(agentId);
        const recentLogs = await memoryManager.getRecentLogs(
          agentId,
          options.days
        );

        const data = {
          memory: memoryContent,
          stats,
          recentLogs: recentLogs.map((log) => ({
            date: log.date,
            entriesCount: log.entries.length,
          })),
        };

        output(ctx, successResponse(data), () => {
          console.log(chalk.bold(`Memory for agent: ${agentId}`));
          console.log();

          outputKeyValue(ctx, {
            "Main Memory Size": formatBytes(stats.mainMemorySize),
            "Daily Logs Count": String(stats.dailyLogsCount),
            "Total Size": formatBytes(stats.totalSize),
          });

          if (memoryContent.content) {
            console.log();
            console.log(chalk.bold("Main Memory (MEMORY.md):"));
            console.log(chalk.gray("─".repeat(40)));
            const preview = memoryContent.content.slice(0, 500);
            console.log(preview);
            if (memoryContent.content.length > 500) {
              console.log(chalk.gray(`... (${memoryContent.content.length} bytes total)`));
            }
          } else {
            console.log();
            console.log(chalk.gray("No main memory content"));
          }

          if (recentLogs.length > 0) {
            console.log();
            console.log(
              chalk.bold(`Recent Daily Logs (last ${options.days} days):`)
            );
            for (const log of recentLogs) {
              console.log(
                `  ${chalk.cyan(log.date)}: ${log.entries.length} entries`
              );
            }
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent memory append <agent-id> <content>
  memory
    .command("append")
    .description("Append content to agent memory")
    .argument("<agent-id>", "Agent ID")
    .argument("<content>", "Content to append")
    .action(async (agentId: string, content: string) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(agentId);
        if (!agentData) {
          throw CliError.notFound("Agent", agentId);
        }

        await memoryManager.appendMemory(agentId, content);

        output(ctx, successResponse({ appended: true }), () => {
          outputSuccess(ctx, `Appended to memory for agent: ${agentId}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // agent memory clear <agent-id>
  memory
    .command("clear")
    .description("Clear agent memory")
    .argument("<agent-id>", "Agent ID")
    .option("-f, --force", "Skip confirmation")
    .action(async (agentId: string, options) => {
      const ctx = getOutputContext(program);
      try {
        const agentData = await agentManager.getAgent(agentId);
        if (!agentData) {
          throw CliError.notFound("Agent", agentId);
        }

        if (!options.force && !ctx.json && !ctx.quiet) {
          console.log(
            chalk.yellow(
              `Warning: This will clear all memory for agent "${agentId}".`
            )
          );
          console.log(chalk.gray("Use --force to skip this warning"));
        }

        await memoryManager.clearMemory(agentId);

        output(ctx, successResponse({ cleared: true }), () => {
          outputSuccess(ctx, `Cleared memory for agent: ${agentId}`);
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Collect multiple option values
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Parse config value from string
 */
function parseConfigValue(value: string): unknown {
  // Try boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Try number
  const num = Number(value);
  if (!isNaN(num)) return num;

  // Return as string
  return value;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
