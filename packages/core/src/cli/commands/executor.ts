/**
 * Executor CLI commands
 *
 * Uses the unified executor module (src/executor) for all executor operations.
 */
import { Command } from "commander";
import chalk from "chalk";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  outputTable,
  handleCommandError,
  outputKeyValue,
} from "../lib";
// Use unified executor module
import {
  getExecutor,
  getRegisteredTypes,
} from "../../executor";
// Legacy imports for chat proxy (not yet migrated to unified module)
import {
  createChatProxyAsync,
  chatProxyFactory,
} from "../../executors";
import { agentManager } from "../../agents";
import type { ExecutorType } from "../../types";
import type { ChatFormat } from "../../executors";

/**
 * Chat-supported executor types
 * TODO: Move to unified module when chat is migrated
 */
const CHAT_SUPPORTED_EXECUTORS: ExecutorType[] = ["CLAUDE_CODE", "GEMINI", "CODEX"];

/**
 * Check if an executor type supports non-interactive chat mode
 */
function executorSupportsChat(executorType: ExecutorType): boolean {
  return CHAT_SUPPORTED_EXECUTORS.includes(executorType);
}

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
 * Register executor commands
 */
export function registerExecutorCommand(program: Command): void {
  const executor = program
    .command("executor")
    .description("Manage AI coding agent executors");

  // executor types - list all executor types
  executor
    .command("types")
    .description("List all available executor types")
    .action(async () => {
      const ctx = getOutputContext(program);
      try {
        const types = getRegisteredTypes();
        output(ctx, successResponse({ types }), () => {
          console.log(chalk.bold("Available Executor Types:"));
          console.log();
          outputTable(
            ctx,
            ["Type", "Chat Support"],
            types.map((type) => [
              type,
              executorSupportsChat(type) ? chalk.green("Yes") : chalk.gray("No"),
            ])
          );
          console.log();
          console.log(
            chalk.gray(`Total: ${types.length} executor types`)
          );
          console.log(
            chalk.gray(
              `Chat-enabled: ${CHAT_SUPPORTED_EXECUTORS.length} (${CHAT_SUPPORTED_EXECUTORS.join(", ")})`
            )
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // executor list - list executors with availability status
  executor
    .command("list")
    .description("List executors with availability status")
    .option("-a, --available", "Show only available executors")
    .action(async (options) => {
      const ctx = getOutputContext(program);
      try {
        // Get all registered types and build executor info
        const types = getRegisteredTypes();
        let executors = types.map((type) => {
          const exec = getExecutor(type);
          const availInfo = exec.getAvailabilityInfo();
          const isAvailable = availInfo.status === "LOGIN_DETECTED" || availInfo.status === "INSTALLATION_FOUND";
          return {
            type,
            available: isAvailable,
            status: availInfo.status,
            path: availInfo.path ?? null,
            capabilities: exec.capabilities(),
            supportsChat: executorSupportsChat(type),
            chatCommand: exec.supports("CHAT") ? exec.getCliName() : null,
          };
        });

        // Filter by available if requested
        if (options.available) {
          executors = executors.filter((e) => e.available);
        }

        output(ctx, successResponse({ executors }), () => {
          if (executors.length === 0) {
            console.log(chalk.yellow("No executors found"));
            if (options.available) {
              console.log(
                chalk.gray("Try without --available to see all executors")
              );
            }
            return;
          }

          outputTable(
            ctx,
            ["Type", "Status", "Chat", "Path"],
            executors.map((e) => [
              e.type,
              e.available
                ? chalk.green(e.status)
                : chalk.red(e.status),
              e.supportsChat
                ? chalk.green("Yes")
                : chalk.gray("No"),
              e.path ?? chalk.gray("-"),
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // executor show - show details of an executor
  // Supports both: `executor show -n CLAUDE_CODE` (spec) and `executor show CLAUDE_CODE` (legacy)
  executor
    .command("show")
    .description("Show details of an executor")
    .argument("[type]", "Executor type (e.g., CLAUDE_CODE, GEMINI)")
    .option("-n, --name <name>", "Executor name/type")
    .action(async (type: string | undefined, options: { name?: string }) => {
      const ctx = getOutputContext(program);
      try {
        // Get executor type from -n option or positional argument
        const executorType = options.name || type;
        if (!executorType) {
          throw new Error(
            "Executor type is required. Use -n <type> or provide as argument."
          );
        }

        // Validate executor type
        const upperType = executorType.toUpperCase() as ExecutorType;
        const registeredTypes = getRegisteredTypes();
        if (!registeredTypes.includes(upperType)) {
          throw new Error(
            `Unknown executor type: ${executorType}. Valid types: ${registeredTypes.join(", ")}`
          );
        }

        const exec = getExecutor(upperType);
        const availabilityInfo = exec.getAvailabilityInfo();
        const capabilities = exec.capabilities();
        const supportsChat = exec.supports("CHAT");
        const chatCommand = supportsChat ? exec.getCliName() : null;
        const mcpConfigPath = exec.defaultMcpConfigPath();

        // Get agents using this executor
        const allAgents = await agentManager.listAgents();
        const defaultAgentId = await agentManager.getDefault();
        const agentsUsingExecutor = allAgents.filter(
          (agent) => agent.executorType === upperType
        );

        // Get session counts for each agent
        const agentsWithSessions = await Promise.all(
          agentsUsingExecutor.map(async (agent) => {
            const sessions = await agentManager.listSessions(agent.id);
            return {
              id: agent.id,
              name: agent.name,
              sessionCount: sessions.length,
              isDefault: agent.id === defaultAgentId,
            };
          })
        );

        const data = {
          type: upperType,
          status: availabilityInfo.status,
          lastAuthTimestamp: availabilityInfo.lastAuthTimestamp,
          capabilities,
          supportsChat,
          chatCommand,
          mcpConfigPath,
          agents: agentsWithSessions,
        };

        output(ctx, successResponse(data), () => {
          console.log(chalk.bold(`Executor: ${upperType}`));
          console.log();
          outputKeyValue(ctx, {
            Status:
              availabilityInfo.status === "LOGIN_DETECTED" ||
              availabilityInfo.status === "INSTALLATION_FOUND"
                ? chalk.green(availabilityInfo.status)
                : chalk.red(availabilityInfo.status),
            "Last Auth":
              availabilityInfo.lastAuthTimestamp
                ? new Date(
                    availabilityInfo.lastAuthTimestamp
                  ).toISOString()
                : "-",
            "Supports Chat": supportsChat
              ? chalk.green("Yes")
              : chalk.gray("No"),
            "Chat Command": chatCommand ?? "-",
            "MCP Config Path": mcpConfigPath ?? "-",
          });

          if (capabilities.length > 0) {
            console.log();
            console.log(chalk.bold("Capabilities:"));
            for (const cap of capabilities) {
              console.log(`  ${chalk.cyan("•")} ${cap}`);
            }
          }

          // Display agents using this executor
          if (agentsWithSessions.length > 0) {
            console.log();
            console.log(chalk.bold("Agents using this executor:"));
            for (const agent of agentsWithSessions) {
              const sessionLabel =
                agent.sessionCount === 1 ? "session" : "sessions";
              const defaultLabel = agent.isDefault
                ? chalk.cyan(" (default)")
                : "";
              console.log(
                `  ${chalk.cyan("•")} ${agent.name}  ${chalk.gray(
                  `${agent.sessionCount} ${sessionLabel}`
                )}${defaultLabel}`
              );
            }
          } else {
            console.log();
            console.log(chalk.gray("No agents using this executor."));
          }
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // executor chat - run non-interactive chat with an executor
  executor
    .command("chat")
    .description("Run non-interactive chat with an executor (like claude -p)")
    .requiredOption("-n, --name <name>", "Executor name (e.g., CLAUDE_CODE, GEMINI)")
    .option("-p, --prompt <prompt>", "Prompt (reads from stdin if not provided)")
    .option("-C, --cwd <dir>", "Working directory")
    .option("--input-format <format>", "Input format: text (default) or stream-json", "text")
    .option("--output-format <format>", "Output format: text (default) or stream-json", "text")
    .option("--session-id <id>", "Session ID")
    .option("--resume <sessionId>", "Resume existing session")
    .option("--model <model>", "Model to use")
    .option("--dangerously-skip-permissions", "Skip permission checks")
    .option("--use-sdk", "Use SDK proxy mode (default for CLAUDE_CODE)")
    .option("--no-sdk", "Force spawn proxy mode instead of SDK")
    .action(async (options) => {
      const ctx = getOutputContext(program);
      try {
        // Validate executor type
        const upperType = options.name.toUpperCase() as ExecutorType;
        const registeredTypes = getRegisteredTypes();
        if (!registeredTypes.includes(upperType)) {
          throw new Error(
            `Unknown executor type: ${options.name}. Valid types: ${registeredTypes.join(", ")}`
          );
        }

        // Check if executor supports chat
        if (!executorSupportsChat(upperType)) {
          throw new Error(
            `Chat not supported for executor: ${upperType}. Chat-enabled executors: ${CHAT_SUPPORTED_EXECUTORS.join(", ")}`
          );
        }

        // Get prompt (from -p option or stdin)
        let prompt = options.prompt;
        if (!prompt) {
          // Read from stdin if no prompt provided
          const stdin = process.stdin;
          if (stdin.isTTY) {
            throw new Error(
              "No prompt provided. Use -p <prompt> or pipe input via stdin."
            );
          }
          // Read stdin synchronously for simplicity
          const chunks: Buffer[] = [];
          for await (const chunk of stdin) {
            chunks.push(chunk);
          }
          prompt = Buffer.concat(chunks).toString("utf-8").trim();
          if (!prompt) {
            throw new Error(
              "No prompt provided and stdin is empty. Use -p <prompt> or pipe input."
            );
          }
        }

        // Determine SDK preference
        // --use-sdk sets options.sdk to true
        // --no-sdk sets options.sdk to false
        // If neither is specified, options.sdk is undefined (default to true)
        const preferSdk = options.sdk !== false;

        // Create chat proxy using factory
        const proxy = await createChatProxyAsync(upperType, preferSdk);

        // Log proxy type in verbose mode
        if (ctx.verbose) {
          const sdkSupported = chatProxyFactory.isSdkAvailable(upperType);
          console.log(chalk.gray(`Using ${proxy.proxyType} proxy for ${upperType}`));
          if (sdkSupported && proxy.proxyType === "spawn") {
            console.log(chalk.gray("SDK mode available but not used (--no-sdk or SDK not installed)"));
          }
        }

        // Execute chat via proxy
        const result = await proxy.execute({
          prompt,
          cwd: options.cwd,
          inputFormat: options.inputFormat as ChatFormat,
          outputFormat: options.outputFormat as ChatFormat,
          verbose: ctx.verbose,
          sessionId: options.sessionId,
          resume: options.resume,
          model: options.model,
          dangerouslySkipPermissions: options.dangerouslySkipPermissions,
        });

        // Handle result
        if (result.error && ctx.verbose) {
          console.error(chalk.red(`Error: ${result.error}`));
        }

        process.exit(result.exitCode);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
