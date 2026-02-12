/**
 * Executor CLI commands
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
import {
  EXECUTOR_TYPES,
  getAllExecutorsAvailability,
  createExecutor,
  executorSupportsChat,
  CHAT_SUPPORTED_EXECUTORS,
} from "../../executors";
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
        const types = EXECUTOR_TYPES;
        output(ctx, successResponse({ types }), () => {
          console.log(chalk.bold("Available Executor Types:"));
          console.log();
          for (const type of types) {
            const supportsChat = executorSupportsChat(type);
            const chatBadge = supportsChat ? chalk.green(" [chat]") : "";
            console.log(`  ${chalk.cyan(type)}${chatBadge}`);
          }
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
        const availability = getAllExecutorsAvailability();
        let executors = Object.entries(availability).map(
          ([type, info]) => ({
            type: type as ExecutorType,
            available: info.available,
            status: info.executor.getAvailabilityInfo().status,
            capabilities: info.executor.capabilities(),
            supportsChat: executorSupportsChat(type as ExecutorType),
            chatCommand: info.executor.getChatCommand?.() ?? null,
          })
        );

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
            ["Type", "Status", "Chat", "Capabilities"],
            executors.map((e) => [
              e.type,
              e.available
                ? chalk.green(e.status)
                : chalk.red(e.status),
              e.supportsChat
                ? chalk.green("Yes")
                : chalk.gray("No"),
              e.capabilities.join(", ") || "-",
            ])
          );
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // executor show <type> - show details of an executor
  executor
    .command("show")
    .description("Show details of an executor")
    .argument("<type>", "Executor type (e.g., CLAUDE_CODE, GEMINI)")
    .action(async (type: string) => {
      const ctx = getOutputContext(program);
      try {
        // Validate executor type
        const upperType = type.toUpperCase() as ExecutorType;
        if (!EXECUTOR_TYPES.includes(upperType)) {
          throw new Error(
            `Unknown executor type: ${type}. Valid types: ${EXECUTOR_TYPES.join(", ")}`
          );
        }

        const exec = createExecutor(upperType);
        const availabilityInfo = exec.getAvailabilityInfo();
        const capabilities = exec.capabilities();
        const supportsChat = exec.supportsChat?.() ?? false;
        const chatCommand = exec.getChatCommand?.() ?? null;
        const mcpConfigPath = exec.defaultMcpConfigPath();

        const data = {
          type: upperType,
          status: availabilityInfo.status,
          lastAuthTimestamp: availabilityInfo.lastAuthTimestamp,
          capabilities,
          supportsChat,
          chatCommand,
          mcpConfigPath,
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
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
