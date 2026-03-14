/**
 * viben queue - Command queue management
 *
 * CLI for managing the command queue system.
 * Uses the shared ops layer directly (no Gateway required for basic operations).
 * Uses Gateway only for streaming operations (watch, follow logs).
 */
import chalk from "chalk";
import type { Command } from "commander";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  outputTable,
  outputKeyValue,
  handleCommandError,
} from "../lib";

// Import queue ops
import {
  status,
  list,
  inspect,
  enqueue,
  cancel,
  retry,
  logs,
  getConfig,
  updateConfig,
  clean,
  type QueueItemStatus,
  type QueueConfig,
} from "../../queue/ops";
import { getQueueDir } from "../../queue/core/persistence";

// Default Gateway configuration (for watch/stream operations)
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18790";
const DEFAULT_TIMEOUT = 30000;

/**
 * Gateway HTTP client (for streaming operations only)
 */
class GatewayClient {
  constructor(
    private baseUrl: string = DEFAULT_GATEWAY_URL,
    private timeout: number = DEFAULT_TIMEOUT
  ) {}

  /**
   * Make HTTP request to Gateway
   */
  async request<T = unknown>(
    method: string,
    path: string,
    data?: unknown,
    options?: { timeout?: number }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const requestTimeout = options?.timeout || this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        throw new Error(`Request timeout after ${requestTimeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Test Gateway connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("GET", "/health");
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Format task status for display
 */
function formatStatus(statusVal: string): string {
  switch (statusVal) {
    case "pending":
      return chalk.yellow("pending");
    case "running":
      return chalk.blue("running");
    case "completed":
      return chalk.green("completed");
    case "failed":
      return chalk.red("failed");
    case "cancelled":
      return chalk.gray("cancelled");
    default:
      return chalk.gray(statusVal);
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Format duration from milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
}

/**
 * Get output context from program options
 */
function getContext(program: Command): OutputContext {
  const opts = program.opts();
  return {
    json: opts.json || false,
    verbose: opts.verbose || false,
    quiet: opts.quiet || false,
  };
}

/**
 * Get Gateway client from program options
 */
function getGatewayClient(program: Command): GatewayClient {
  const opts = program.opts();
  return new GatewayClient(
    opts.gateway || DEFAULT_GATEWAY_URL,
    opts.timeout || DEFAULT_TIMEOUT
  );
}

/**
 * Show queue status (uses ops directly)
 */
async function showQueueStatus(ctx: OutputContext): Promise<void> {
  const result = status({ include_items: true });

  if (!result.success) {
    output(ctx, errorResponse("QUEUE_ERROR", result.error || "Failed to get queue status"), () => {
      console.error(chalk.red(`Error: ${result.error}`));
    });
    return;
  }

  output(
    ctx,
    successResponse(result),
    () => {
      console.log(chalk.bold("Queue Status"));
      console.log("────────────────────────────────────────");
      console.log(`  Pending:     ${result.pending} task(s)`);
      console.log(`  Running:     ${result.running} / ${result.max_concurrency} (max concurrency)`);
      console.log(`  Completed:   ${result.completed} task(s)`);

      if (result.items?.running && result.items.running.length > 0) {
        console.log();
        console.log("Running Tasks:");
        for (const item of result.items.running) {
          const elapsed = Date.now() - item.started_at;
          console.log(`  ${item.id}  pid:${item.pid}  ${formatDuration(elapsed)}`);
        }
      }

      console.log();
      console.log(`Storage: ${getQueueDir()}`);
    }
  );
}

/**
 * List queue items (uses ops directly)
 */
async function listItems(
  ctx: OutputContext,
  options: { status?: string; limit?: number; all?: boolean }
): Promise<void> {
  // Convert status string to proper filter
  let statusFilter: QueueItemStatus[] | undefined;
  if (options.status) {
    statusFilter = [options.status as QueueItemStatus];
  } else if (!options.all) {
    // Default: show pending + running
    statusFilter = ["pending", "running"];
  }

  const result = list({
    status: statusFilter,
    limit: options.limit || 50,
  });

  if (!result.success) {
    output(ctx, errorResponse("QUEUE_ERROR", result.error || "Failed to list items"), () => {
      console.error(chalk.red(`Error: ${result.error}`));
    });
    return;
  }

  output(
    ctx,
    successResponse(result),
    () => {
      if (result.items.length === 0) {
        console.log(chalk.gray("No items found"));
        return;
      }

      const headers = ["ID", "STATUS", "COMMAND", "CWD", "CREATED"];
      const rows = result.items.map((item) => {
        // Determine status based on item type
        let itemStatus: string = "pending";
        if ("pid" in item) {
          if ("completed_at" in item) {
            const completed = item as { exit_code: number };
            itemStatus = completed.exit_code === 0 ? "completed" :
                        completed.exit_code === -1 ? "cancelled" : "failed";
          } else {
            itemStatus = "running";
          }
        }

        const cmdPreview = item.command.length > 40
          ? item.command.slice(0, 40) + "..."
          : item.command;
        const cwdPreview = item.cwd.length > 30
          ? "..." + item.cwd.slice(-27)
          : item.cwd;

        return [
          item.id,
          formatStatus(itemStatus),
          cmdPreview,
          cwdPreview,
          formatTimestamp(item.created_at).split(" ")[1], // Time only
        ];
      });

      outputTable(ctx, headers, rows);
      console.log();
      console.log(`Showing ${result.items.length} of ${result.total} items`);
    }
  );
}

/**
 * Inspect a specific item (uses ops directly)
 */
async function inspectItem(ctx: OutputContext, itemId: string): Promise<void> {
  const result = inspect({ id: itemId });

  if (!result.success) {
    output(
      ctx,
      errorResponse("NOT_FOUND", result.error || `Item not found: ${itemId}`),
      () => {
        console.error(chalk.red(result.error || `Item not found: ${itemId}`));
      }
    );
    return;
  }

  const item = result.item!;
  const itemStatus = result.status!;

  output(ctx, successResponse({ item, status: itemStatus }), () => {
    console.log(chalk.bold(`Item: ${item.id}`));
    console.log("────────────────────────────────────────");
    console.log(`Status:   ${formatStatus(itemStatus)}`);
    console.log(`Command:  ${item.command}`);
    console.log(`CWD:      ${item.cwd}`);
    console.log(`Created:  ${formatTimestamp(item.created_at)}`);

    if ("pid" in item) {
      const runningItem = item as { pid: number; started_at: number; log_file: string };
      console.log();
      console.log("Execution:");
      console.log(`  PID:       ${runningItem.pid}`);
      console.log(`  Started:   ${formatTimestamp(runningItem.started_at)}`);
      console.log(`  Log file:  ${runningItem.log_file}`);

      if ("completed_at" in item) {
        const completedItem = item as { completed_at: number; exit_code: number };
        console.log(`  Completed: ${formatTimestamp(completedItem.completed_at)}`);
        console.log(`  Exit code: ${completedItem.exit_code}`);
        console.log(`  Duration:  ${formatDuration(completedItem.completed_at - runningItem.started_at)}`);
      } else {
        const elapsed = Date.now() - runningItem.started_at;
        console.log(`  Elapsed:   ${formatDuration(elapsed)}`);
      }
    }

    if (item.metadata && Object.keys(item.metadata).length > 0) {
      console.log();
      console.log("Metadata:");
      for (const [key, value] of Object.entries(item.metadata)) {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }
    }
  });
}

/**
 * Enqueue a new command (uses ops directly)
 */
async function enqueueCommand(
  ctx: OutputContext,
  options: {
    command: string;
    cwd: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const result = enqueue({
    command: options.command,
    cwd: options.cwd,
    metadata: options.metadata,
  });

  if (!result.success) {
    output(
      ctx,
      errorResponse("ENQUEUE_ERROR", result.error || "Failed to enqueue command"),
      () => {
        console.error(chalk.red(`Error: ${result.error}`));
      }
    );
    return;
  }

  output(ctx, successResponse(result), () => {
    console.log(chalk.green("Command enqueued successfully"));
    console.log(`  ID:        ${result.id}`);
    console.log(`  Position:  ${result.position}`);
    console.log(`  Command:   ${options.command}`);
    console.log(`  CWD:       ${options.cwd}`);
    console.log();
    console.log(`Use 'viben queue inspect ${result.id}' to view details`);
    console.log(`Use 'viben queue logs ${result.id}' to view output`);
  });
}

/**
 * Cancel an item (uses ops directly)
 */
async function cancelItem(
  ctx: OutputContext,
  itemId: string,
  options: { force?: boolean }
): Promise<void> {
  const result = cancel({ id: itemId, force: options.force });

  if (!result.success) {
    output(
      ctx,
      errorResponse("CANCEL_ERROR", result.error || `Failed to cancel: ${itemId}`),
      () => {
        console.error(chalk.red(`Error: ${result.error}`));
      }
    );
    return;
  }

  output(ctx, successResponse(result), () => {
    console.log(chalk.green("Item cancelled successfully"));
    console.log(`  ID: ${result.cancelled}`);
  });
}

/**
 * Retry a failed item (uses ops directly)
 */
async function retryItem(
  ctx: OutputContext,
  itemId: string,
  options: { resetCount?: boolean }
): Promise<void> {
  const result = retry({ id: itemId, reset_count: options.resetCount });

  if (!result.success) {
    output(
      ctx,
      errorResponse("RETRY_ERROR", result.error || `Failed to retry: ${itemId}`),
      () => {
        console.error(chalk.red(`Error: ${result.error}`));
      }
    );
    return;
  }

  output(ctx, successResponse(result), () => {
    console.log(chalk.green("Item queued for retry"));
    console.log(`  New ID:    ${result.id}`);
    console.log(`  Position:  ${result.position}`);
  });
}

/**
 * View item logs (uses ops directly)
 */
async function viewLogs(
  ctx: OutputContext,
  itemId: string,
  options: { tail?: number; follow?: boolean }
): Promise<void> {
  const result = logs({
    id: itemId,
    tail: options.tail !== undefined,
    lines: options.tail,
  });

  if (!result.success) {
    output(
      ctx,
      errorResponse("LOGS_ERROR", result.error || `Failed to get logs: ${itemId}`),
      () => {
        console.error(chalk.red(`Error: ${result.error}`));
      }
    );
    return;
  }

  if (ctx.json) {
    output(ctx, successResponse(result), () => {});
  } else {
    if (result.content) {
      console.log(result.content);
    } else {
      console.log(chalk.gray("No log content available"));
    }

    if (result.truncated) {
      console.log();
      console.log(chalk.yellow(`(Truncated - ${result.size} bytes total)`));
    }
  }
}

/**
 * Manage queue configuration (uses ops directly)
 */
async function manageConfig(
  ctx: OutputContext,
  options: { set?: string[]; reset?: boolean }
): Promise<void> {
  if (options.reset) {
    // Reset to defaults
    const result = updateConfig({
      max_concurrency: 3,
      promoter_interval_ms: 5000,
      monitor_interval_ms: 30000,
      log_retention_days: 7,
      completed_retention_days: 30,
      default_max_retries: 3,
    });

    if (!result.success) {
      output(ctx, errorResponse("CONFIG_ERROR", result.error || "Failed to reset config"), () => {
        console.error(chalk.red(`Error: ${result.error}`));
      });
      return;
    }

    output(ctx, successResponse(result), () => {
      console.log(chalk.green("Queue configuration reset to defaults"));
      if (result.config) {
        outputKeyValue(ctx, result.config as unknown as Record<string, string | number | boolean | undefined>);
      }
    });
  } else if (options.set && options.set.length > 0) {
    // Set configuration values
    const updates: Partial<QueueConfig> = {};

    for (const setting of options.set) {
      const [key, value] = setting.split("=", 2);
      if (!key || value === undefined) {
        output(
          ctx,
          errorResponse("VALIDATION_ERROR", `Invalid setting format: ${setting}`),
          () => {
            console.error(chalk.red(`Invalid setting format: ${setting}`));
            console.error("Expected format: key=value");
          }
        );
        return;
      }

      // Convert to appropriate type
      const numValue = Number(value);
      (updates as Record<string, unknown>)[key] = isNaN(numValue) ? value : numValue;
    }

    const result = updateConfig(updates);

    if (!result.success) {
      output(ctx, errorResponse("CONFIG_ERROR", result.error || "Failed to update config"), () => {
        console.error(chalk.red(`Error: ${result.error}`));
      });
      return;
    }

    output(ctx, successResponse(result), () => {
      console.log(chalk.green("Queue configuration updated"));
      if (result.config) {
        outputKeyValue(ctx, result.config as unknown as Record<string, string | number | boolean | undefined>);
      }
    });
  } else {
    // Get current configuration
    const result = getConfig();

    if (!result.success) {
      output(ctx, errorResponse("CONFIG_ERROR", result.error || "Failed to get config"), () => {
        console.error(chalk.red(`Error: ${result.error}`));
      });
      return;
    }

    output(ctx, successResponse(result), () => {
      console.log(chalk.bold("Queue Configuration"));
      console.log("────────────────────────────────────────");
      if (result.config) {
        outputKeyValue(ctx, result.config as unknown as Record<string, string | number | boolean | undefined>);
      }
      console.log();
      console.log(`Config file: ${getQueueDir()}/config.json`);
    });
  }
}

/**
 * Clean old items (uses ops directly)
 */
async function cleanItems(
  ctx: OutputContext,
  options: { dryRun?: boolean; force?: boolean }
): Promise<void> {
  const result = clean({
    dry_run: options.dryRun,
  });

  if (!result.success) {
    output(ctx, errorResponse("CLEAN_ERROR", result.error || "Failed to clean items"), () => {
      console.error(chalk.red(`Error: ${result.error}`));
    });
    return;
  }

  output(ctx, successResponse(result), () => {
    if (options.dryRun) {
      console.log("Would clean:");
      if (result.items) {
        for (const item of result.items) {
          console.log(`  ${item}`);
        }
      }
      console.log();
      console.log(`Total: ${result.cleaned} item(s)`);
    } else {
      console.log(chalk.green(`Cleaned ${result.cleaned} item(s)`));
      console.log(`  Removed from ${getQueueDir()}/`);
    }
  });
}

/**
 * Watch queue events (uses Gateway for real-time updates)
 */
async function watchQueue(
  ctx: OutputContext,
  client: GatewayClient
): Promise<void> {
  if (ctx.json) {
    console.log(JSON.stringify({ type: "watch_started", timestamp: Date.now() }));
  } else {
    console.log("Watching queue (Ctrl+C to stop)");
    console.log("────────────────────────────────────────");
  }

  // Polling implementation using local ops
  let lastPending = -1;
  let lastRunning = -1;

  const poll = () => {
    const result = status();
    if (result.success) {
      if (lastPending >= 0 && (result.pending !== lastPending || result.running !== lastRunning)) {
        const event = {
          type: "queue:changed",
          timestamp: Date.now(),
          pending: result.pending,
          running: result.running,
        };

        if (ctx.json) {
          console.log(JSON.stringify(event));
        } else {
          const time = new Date().toTimeString().split(" ")[0];
          console.log(`[${time}] queue:changed    pending=${result.pending} running=${result.running}`);
        }
      }
      lastPending = result.pending;
      lastRunning = result.running;
    }
  };

  // Poll every 2 seconds
  const intervalId = setInterval(poll, 2000);

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    clearInterval(intervalId);
    if (!ctx.json) {
      console.log();
      console.log("Watch stopped");
    }
    process.exit(0);
  });

  // Initial poll
  poll();

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Register the queue command
 */
export function registerQueueCommand(program: Command): void {
  const queueCmd = program
    .command("queue")
    .description("Manage command queue")
    .option("--gateway <url>", "Gateway URL (for watch/stream)", DEFAULT_GATEWAY_URL)
    .option("--timeout <ms>", "Request timeout", String(DEFAULT_TIMEOUT));

  // queue status
  queueCmd
    .command("status")
    .description("Show queue status")
    .action(async () => {
      const ctx = getContext(program);
      try {
        await showQueueStatus(ctx);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue list
  queueCmd
    .command("list")
    .description("List queue items")
    .option("-s, --status <status>", "Filter by status (pending, running, completed, failed, cancelled)")
    .option("-n, --limit <num>", "Limit results", (val) => parseInt(val, 10))
    .option("--all", "Show all items (including completed)")
    .action(async (options: { status?: string; limit?: number; all?: boolean }) => {
      const ctx = getContext(program);
      try {
        await listItems(ctx, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue inspect <id>
  queueCmd
    .command("inspect")
    .argument("<id>", "Item ID")
    .description("Show item details")
    .action(async (itemId: string) => {
      const ctx = getContext(program);
      try {
        await inspectItem(ctx, itemId);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue enqueue
  queueCmd
    .command("enqueue")
    .description("Enqueue a new command")
    .requiredOption("-c, --command <command>", "Command to execute")
    .requiredOption("--cwd <path>", "Working directory")
    .option("-m, --metadata <json>", "Metadata (JSON string)")
    .action(async (options: {
      command: string;
      cwd: string;
      metadata?: string;
    }) => {
      const ctx = getContext(program);
      try {
        let metadata: Record<string, unknown> | undefined;
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            output(
              ctx,
              errorResponse("VALIDATION_ERROR", "Invalid JSON in metadata"),
              () => {
                console.error(chalk.red("Invalid JSON in metadata"));
              }
            );
            return;
          }
        }

        await enqueueCommand(ctx, {
          command: options.command,
          cwd: options.cwd,
          metadata,
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue cancel <id>
  queueCmd
    .command("cancel")
    .argument("<id>", "Item ID")
    .description("Cancel an item")
    .option("-f, --force", "Force kill running process (SIGKILL)")
    .action(async (itemId: string, options: { force?: boolean }) => {
      const ctx = getContext(program);
      try {
        await cancelItem(ctx, itemId, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue retry <id>
  queueCmd
    .command("retry")
    .argument("<id>", "Item ID")
    .description("Retry a failed item")
    .option("--reset-count", "Reset retry counter")
    .action(async (itemId: string, options: { resetCount?: boolean }) => {
      const ctx = getContext(program);
      try {
        await retryItem(ctx, itemId, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue logs <id>
  queueCmd
    .command("logs")
    .argument("<id>", "Item ID")
    .description("View item logs")
    .option("-n, --tail <num>", "Show last N lines", (val) => parseInt(val, 10))
    .option("-f, --follow", "Follow log output (not implemented)")
    .action(async (itemId: string, options: {
      tail?: number;
      follow?: boolean;
    }) => {
      const ctx = getContext(program);
      try {
        await viewLogs(ctx, itemId, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue watch
  queueCmd
    .command("watch")
    .description("Watch queue events")
    .action(async () => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await watchQueue(ctx, client);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue config
  queueCmd
    .command("config")
    .description("Manage queue configuration")
    .option("--set <key=value...>", "Set configuration values")
    .option("--reset", "Reset to default values")
    .action(async (options: { set?: string[]; reset?: boolean }) => {
      const ctx = getContext(program);
      try {
        await manageConfig(ctx, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue clean
  queueCmd
    .command("clean")
    .description("Clean completed and failed items")
    .option("--dry-run", "Show what would be cleaned")
    .option("-f, --force", "Skip confirmation")
    .action(async (options: { dryRun?: boolean; force?: boolean }) => {
      const ctx = getContext(program);
      try {
        await cleanItems(ctx, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}
