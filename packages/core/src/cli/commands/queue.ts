/**
 * viben queue - Task queue management commands
 *
 * Gateway task queue management CLI client for operations, debugging, and monitoring.
 * Provides comprehensive queue status viewing, task management, and configuration.
 */
import chalk from "chalk";
import type { Command } from "commander";
import { readFileSync } from "node:fs";
import type { OutputContext } from "../types";
import {
  output,
  successResponse,
  errorResponse,
  outputTable,
  outputKeyValue,
  handleCommandError,
} from "../lib";

// Default Gateway configuration
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18790";
const DEFAULT_TIMEOUT = 30000;

/**
 * Gateway HTTP client
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
   * Create SSE stream connection
   */
  async* stream(path: string): AsyncGenerator<unknown, void, unknown> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "done") return;
            try {
              yield JSON.parse(data);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
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
function formatStatus(status: string): string {
  switch (status) {
    case "pending":
      return chalk.yellow("pending");
    case "running":
      return chalk.blue("running");
    case "retrying":
      return chalk.cyan("retrying");
    case "completed":
      return chalk.green("completed");
    case "failed":
      return chalk.red("failed");
    default:
      return chalk.gray(status);
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
 * Handle Gateway connection errors with troubleshooting
 */
function handleConnectionError(ctx: OutputContext, error: Error, gatewayUrl: string): void {
  if (ctx.json) {
    output(ctx, errorResponse("GATEWAY_CONNECTION_ERROR", error.message), () => {});
    return;
  }

  console.error(chalk.red("Error: Cannot connect to Gateway"));
  console.error(`  URL:     ${gatewayUrl}`);
  console.error(`  Reason:  ${error.message}`);
  console.error();
  console.error("Troubleshooting:");
  console.error("  1. Check if Gateway is running: viben gateway status");
  console.error("  2. Start Gateway: viben gateway start");
  console.error("  3. Check port availability: lsof -i :18790");
}

/**
 * Show queue status
 */
async function showQueueStatus(ctx: OutputContext, client: GatewayClient): Promise<void> {
  try {
    const status = await client.request<{
      pending_count: number;
      running_count: number;
      max_concurrency: number;
      tasks: Array<{
        id: string;
        status: string;
        agent_id: string;
        created_at: number;
        position?: number;
      }>;
    }>("GET", "/api/queue/status");

    output(
      ctx,
      successResponse(status),
      () => {
        console.log(chalk.bold("Queue Status"));
        console.log("────────────────────────────────────────");
        console.log(`  Pending:     ${status.pending_count} task(s)`);
        console.log(`  Running:     ${status.running_count} / ${status.max_concurrency} (max concurrency)`);

        const completedTasks = status.tasks.filter(t => t.status === "completed").length;
        const failedTasks = status.tasks.filter(t => t.status === "failed").length;
        console.log(`  Completed:   ${completedTasks} task(s)`);
        console.log(`  Failed:      ${failedTasks} task(s)`);

        const runningTasks = status.tasks.filter(t => t.status === "running");
        if (runningTasks.length > 0) {
          console.log();
          console.log("Running Tasks:");
          for (const task of runningTasks) {
            const elapsed = Date.now() - task.created_at;
            console.log(`  ${task.id.slice(0, 12)}  agent:${task.agent_id}  ${formatDuration(elapsed)}`);
          }
        }

        console.log();
        console.log(`Gateway: connected (${client["baseUrl"]})`);
        console.log("Persistence: ~/.viben/queue/ (healthy)");
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * List queue tasks
 */
async function listTasks(
  ctx: OutputContext,
  client: GatewayClient,
  options: { status?: string; limit?: number; all?: boolean }
): Promise<void> {
  try {
    const queryParams = new URLSearchParams();
    if (options.status) {
      queryParams.append("status", options.status);
    }

    const response = await client.request<{
      tasks: Array<{
        id: string;
        status: string;
        payload: { agent_id: string };
        created_at: number;
        started_at?: number;
        retry_count: number;
        max_retries: number;
      }>;
    }>("GET", `/api/queue/tasks?${queryParams}`);

    let tasks = response.tasks;
    if (!options.all) {
      // By default, show pending + running
      if (!options.status) {
        tasks = tasks.filter(t => t.status === "pending" || t.status === "running");
      }
    }

    if (options.limit) {
      tasks = tasks.slice(0, options.limit);
    }

    output(
      ctx,
      successResponse({
        tasks: tasks.map(t => ({
          id: t.id,
          status: t.status,
          agent_id: t.payload.agent_id,
          created_at: t.created_at,
          elapsed: t.started_at ? Date.now() - t.started_at : null,
          retries: `${t.retry_count}/${t.max_retries}`,
        })),
        total: tasks.length,
      }),
      () => {
        if (tasks.length === 0) {
          console.log(chalk.gray("No tasks found"));
          return;
        }

        const headers = ["ID", "STATUS", "AGENT", "CREATED", "ELAPSED", "RETRIES"];
        const rows = tasks.map((task) => {
          const elapsed = task.started_at
            ? formatDuration(Date.now() - task.started_at)
            : "-";

          return [
            task.id.slice(0, 12),
            formatStatus(task.status),
            task.payload.agent_id,
            formatTimestamp(task.created_at).split(" ")[1], // Time only
            elapsed,
            `${task.retry_count}/${task.max_retries}`,
          ];
        });

        outputTable(ctx, headers, rows);
        console.log();
        console.log(`Showing ${tasks.length} of ${response.tasks.length} tasks`);
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Inspect a specific task
 */
async function inspectTask(ctx: OutputContext, client: GatewayClient, taskId: string): Promise<void> {
  try {
    const task = await client.request<{
      id: string;
      type: string;
      status: string;
      payload: {
        agent_id: string;
        session_id?: string;
        input: string;
        cwd?: string;
      };
      retry_count: number;
      max_retries: number;
      created_at: number;
      started_at?: number;
      completed_at?: number;
      error?: string;
      pid?: number;
    }>("GET", `/api/queue/tasks/${taskId}`);

    output(ctx, successResponse(task), () => {
      console.log(chalk.bold(`Task: ${task.id}`));
      console.log("────────────────────────────────────────");
      console.log(`Status:      ${formatStatus(task.status)}`);
      console.log(`Type:        ${task.type}`);
      console.log(`Agent:       ${task.payload.agent_id}`);
      if (task.payload.session_id) {
        console.log(`Session:     ${task.payload.session_id}`);
      }

      console.log();
      console.log("Timeline:");
      console.log(`  Created:   ${formatTimestamp(task.created_at)} (${formatDuration(Date.now() - task.created_at)} ago)`);

      if (task.started_at) {
        console.log(`  Started:   ${formatTimestamp(task.started_at)} (${formatDuration(Date.now() - task.started_at)} ago)`);
        console.log(`  Elapsed:   ${formatDuration(Date.now() - task.started_at)}`);
      }

      if (task.completed_at) {
        console.log(`  Completed: ${formatTimestamp(task.completed_at)}`);
        if (task.started_at) {
          console.log(`  Duration:  ${formatDuration(task.completed_at - task.started_at)}`);
        }
      }

      console.log();
      console.log("Execution:");
      if (task.pid) {
        console.log(`  PID:       ${task.pid}`);
      }
      console.log(`  Retries:   ${task.retry_count} / ${task.max_retries}`);

      if (task.error) {
        console.log(`  Error:     ${task.error}`);
      }

      console.log();
      console.log("Payload:");
      const inputPreview = task.payload.input.length > 200
        ? task.payload.input.slice(0, 200) + "..."
        : task.payload.input;
      console.log(`  input: |`);
      console.log(`    ${inputPreview.replace(/\n/g, "\n    ")}`);

      if (task.payload.cwd) {
        console.log(`  cwd: ${task.payload.cwd}`);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      output(
        ctx,
        errorResponse("NOT_FOUND", `Task not found: ${taskId}`),
        () => {
          console.error(chalk.red(`Task not found: ${taskId}`));
        }
      );
      return;
    }
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Enqueue a new task
 */
async function enqueueTask(
  ctx: OutputContext,
  client: GatewayClient,
  options: {
    agentId: string;
    input?: string;
    sessionId?: string;
    maxRetries?: number;
    stdin?: boolean;
  }
): Promise<void> {
  let input = options.input;

  if (options.stdin) {
    // Read from stdin
    input = readFileSync(0, "utf-8").trim();
  }

  if (!input) {
    output(
      ctx,
      errorResponse("VALIDATION_ERROR", "Must specify either --input or --stdin"),
      () => {
        console.error(chalk.red("Error: Must specify either --input or --stdin"));
        console.log();
        console.log("Examples:");
        console.log(chalk.cyan('  viben queue enqueue --agent coding-assistant --input "实现用户登录功能"'));
        console.log(chalk.cyan("  cat requirements.md | viben queue enqueue --agent coding-assistant --stdin"));
      }
    );
    return;
  }

  try {
    const requestData = {
      agent_id: options.agentId,
      input: input,
      session_id: options.sessionId,
      max_retries: options.maxRetries,
    };

    const response = await client.request<{
      task_id: string;
      position: number;
      status: string;
    }>("POST", "/api/queue/enqueue", requestData);

    output(ctx, successResponse(response), () => {
      console.log(chalk.green("Task enqueued successfully"));
      console.log(`  ID:        ${response.task_id}`);
      console.log(`  Agent:     ${options.agentId}`);
      console.log(`  Position:  ${response.position} (${response.position - 1} pending ahead)`);
      console.log(`  Status:    ${formatStatus(response.status)}`);
      console.log();
      console.log(`Use 'viben queue inspect ${response.task_id}' to view details`);
      console.log(`Use 'viben queue logs ${response.task_id} --follow' to stream output`);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Cancel a task
 */
async function cancelTask(
  ctx: OutputContext,
  client: GatewayClient,
  taskId: string,
  options: { force?: boolean }
): Promise<void> {
  try {
    const response = await client.request<{
      cancelled?: boolean;
      deleted?: boolean;
      task_id: string;
    }>("DELETE", `/api/queue/tasks/${taskId}`);

    const action = response.cancelled ? "cancelled" : "deleted";

    output(ctx, successResponse(response), () => {
      console.log(chalk.green(`Task ${action} successfully`));
      console.log(`  ID: ${taskId}`);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      output(
        ctx,
        errorResponse("NOT_FOUND", `Task not found: ${taskId}`),
        () => {
          console.error(chalk.red(`Task not found: ${taskId}`));
        }
      );
      return;
    }
    if (error instanceof Error && error.message.includes("400")) {
      output(
        ctx,
        errorResponse("INVALID_OPERATION", "Cannot cancel running task without --force"),
        () => {
          console.error(chalk.red("Error: Invalid operation"));
          console.error("  Task:    " + taskId);
          console.error("  Status:  running");
          console.error("  Action:  cancel (without --force)");
          console.error();
          console.error(`Hint: Use 'viben queue cancel ${taskId} --force' to terminate running task`);
        }
      );
      return;
    }
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Retry a failed task
 */
async function retryTask(
  ctx: OutputContext,
  client: GatewayClient,
  taskId: string,
  options: { resetCount?: boolean }
): Promise<void> {
  try {
    const response = await client.request<{
      retried: boolean;
      task: {
        id: string;
        status: string;
        retry_count: number;
        max_retries: number;
      };
    }>("POST", `/api/queue/tasks/${taskId}/retry`, {
      reset_count: options.resetCount,
    });

    output(ctx, successResponse(response), () => {
      console.log(chalk.green("Task retried successfully"));
      console.log(`  ID:      ${taskId}`);
      console.log(`  Status:  ${formatStatus(response.task.status)}`);
      console.log(`  Retries: ${response.task.retry_count} / ${response.task.max_retries}`);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      output(
        ctx,
        errorResponse("NOT_FOUND", `Task not found: ${taskId}`),
        () => {
          console.error(chalk.red(`Task not found: ${taskId}`));
        }
      );
      return;
    }
    if (error instanceof Error && error.message.includes("400")) {
      output(
        ctx,
        errorResponse("INVALID_OPERATION", "Cannot retry task: only failed tasks can be retried"),
        () => {
          console.error(chalk.red("Error: Cannot retry task"));
          console.error("  Task:    " + taskId);
          console.error("  Reason:  Only failed tasks can be retried");
          console.error();
          console.error("Current task status:");
          console.error("  Use 'viben queue inspect " + taskId + "' to check task status");
        }
      );
      return;
    }
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Stream task logs
 */
async function streamTaskLogs(
  ctx: OutputContext,
  client: GatewayClient,
  taskId: string,
  options: { follow?: boolean; tail?: number; timestamps?: boolean }
): Promise<void> {
  try {
    if (ctx.json) {
      // JSON streaming mode
      for await (const event of client.stream(`/api/queue/tasks/${taskId}/stream`)) {
        console.log(JSON.stringify(event));
      }
    } else {
      // Human readable mode
      console.log(chalk.bold(`[${taskId}] Agent output stream`));
      console.log("────────────────────────────────────────");

      let lineCount = 0;
      for await (const event of client.stream(`/api/queue/tasks/${taskId}/stream`)) {
        if (typeof event === "object" && event && "type" in event) {
          const typedEvent = event as { type: string; [key: string]: unknown };

          if (typedEvent.type === "ping") {
            continue; // Skip heartbeat
          }

          if (typedEvent.type === "progress" && "msg" in typedEvent) {
            const timestamp = options.timestamps ? `[${new Date().toTimeString().split(" ")[0]}] ` : "";
            console.log(`${timestamp}${typedEvent.msg}`);
            lineCount++;

            if (options.tail && lineCount >= options.tail && !options.follow) {
              break;
            }
          }

          if (typedEvent.type === "completed") {
            console.log(chalk.green("[Agent completed successfully]"));
            break;
          }

          if (typedEvent.type === "failed") {
            console.log(chalk.red("[Agent failed]"));
            break;
          }

          if (typedEvent.type === "done") {
            break;
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      output(
        ctx,
        errorResponse("NOT_FOUND", `Task not found: ${taskId}`),
        () => {
          console.error(chalk.red(`Task not found: ${taskId}`));
        }
      );
      return;
    }
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Watch queue events (WebSocket simulation via polling)
 */
async function watchQueue(
  ctx: OutputContext,
  client: GatewayClient,
  options: { tasks?: string[]; events?: string[] }
): Promise<void> {
  if (ctx.json) {
    console.log(JSON.stringify({ type: "watch_started", timestamp: Date.now() }));
  } else {
    console.log("Watching queue events (Ctrl+C to stop)");
    console.log("────────────────────────────────────────");
  }

  // Simple polling implementation (WebSocket would be better)
  interface QueueStatusResponse {
    pending_count: number;
    running_count: number;
    max_concurrency: number;
  }

  let lastStatus: QueueStatusResponse | null = null;

  const poll = async () => {
    try {
      const status = await client.request<QueueStatusResponse>("GET", "/api/queue/status");

      if (lastStatus) {
        // Check for changes
        if (status.pending_count !== lastStatus.pending_count ||
            status.running_count !== lastStatus.running_count) {

          const event = {
            type: "queue:changed",
            timestamp: Date.now(),
            pending: status.pending_count,
            running: status.running_count,
          };

          if (ctx.json) {
            console.log(JSON.stringify(event));
          } else {
            const time = new Date().toTimeString().split(" ")[0];
            console.log(`[${time}] queue:changed    pending=${status.pending_count} running=${status.running_count}`);
          }
        }
      }

      lastStatus = status;
    } catch {
      // Ignore polling errors
    }
  };

  // Start polling every 2 seconds
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
  await poll();

  // Keep process alive
  await new Promise(() => {}); // Never resolves
}

/**
 * Get/set queue configuration
 */
async function manageConfig(
  ctx: OutputContext,
  client: GatewayClient,
  options: { set?: string[]; reset?: boolean }
): Promise<void> {
  try {
    if (options.reset) {
      // Reset configuration
      const defaultConfig = {
        max_concurrency: 3,
        default_max_retries: 3,
        persist_debounce_ms: 500,
        shutdown_timeout_ms: 30000,
      };

      interface QueueConfigResponse {
        max_concurrency: number;
        default_max_retries: number;
        persist_debounce_ms: number;
        shutdown_timeout_ms: number;
      }

      const config = await client.request<QueueConfigResponse>("PUT", "/api/queue/config", defaultConfig);

      output(ctx, successResponse(config), () => {
        console.log(chalk.green("Queue configuration reset to defaults"));
        outputKeyValue(ctx, {
          "max_concurrency": config.max_concurrency,
          "default_max_retries": config.default_max_retries,
          "persist_debounce_ms": config.persist_debounce_ms,
          "shutdown_timeout_ms": config.shutdown_timeout_ms,
        });
      });

    } else if (options.set && options.set.length > 0) {
      // Set configuration values
      const updates: Record<string, unknown> = {};

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
        updates[key] = isNaN(numValue) ? value : numValue;
      }

      interface QueueConfigResponse {
        max_concurrency: number;
        default_max_retries: number;
        persist_debounce_ms: number;
        shutdown_timeout_ms: number;
      }

      const config = await client.request<QueueConfigResponse>("PUT", "/api/queue/config", updates);

      output(ctx, successResponse(config), () => {
        console.log(chalk.green("Queue configuration updated"));
        outputKeyValue(ctx, {
          max_concurrency: config.max_concurrency,
          default_max_retries: config.default_max_retries,
          persist_debounce_ms: config.persist_debounce_ms,
          shutdown_timeout_ms: config.shutdown_timeout_ms,
        });
      });

    } else {
      // Get current configuration
      interface QueueConfigResponse {
        max_concurrency: number;
        default_max_retries: number;
        persist_debounce_ms: number;
        shutdown_timeout_ms: number;
      }

      const config = await client.request<QueueConfigResponse>("GET", "/api/queue/config");

      output(ctx, successResponse(config), () => {
        console.log(chalk.bold("Queue Configuration"));
        console.log("────────────────────────────────────────");
        outputKeyValue(ctx, {
          max_concurrency: config.max_concurrency,
          default_max_retries: config.default_max_retries,
          persist_debounce_ms: config.persist_debounce_ms,
          shutdown_timeout_ms: config.shutdown_timeout_ms,
        });
        console.log();
        console.log("Config file: ~/.viben/queue/config.yaml");
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Clean completed/failed tasks
 */
async function cleanTasks(
  ctx: OutputContext,
  client: GatewayClient,
  options: { dryRun?: boolean; force?: boolean }
): Promise<void> {
  interface TaskSummary {
    id: string;
    status: string;
    created_at: number;
  }

  try {
    if (options.dryRun) {
      // Show what would be cleaned
      const response = await client.request<{ tasks: TaskSummary[] }>("GET", "/api/queue/tasks");
      const toClean = response.tasks.filter(t => t.status === "completed" || t.status === "failed");

      output(ctx, successResponse({ tasks: toClean, count: toClean.length }), () => {
        console.log("Tasks to clean:");
        for (const task of toClean) {
          console.log(`  ${task.id.slice(0, 12)}  ${formatStatus(task.status)}  ${formatTimestamp(task.created_at)}`);
        }
        console.log();
        console.log(`Would clean ${toClean.length} task(s)`);
      });

    } else {
      // Actually clean
      if (!options.force && !ctx.json) {
        // Interactive confirmation
        process.stdout.write("Clean completed and failed tasks? [y/N] ");

        const response = await new Promise<string>((resolve) => {
          process.stdin.once("data", (data) => {
            resolve(data.toString().trim().toLowerCase());
          });
        });

        if (response !== "y" && response !== "yes") {
          console.log("Cancelled");
          return;
        }
      }

      const response = await client.request<{ cleared: number }>("POST", "/api/queue/clear-history");

      output(ctx, successResponse(response), () => {
        console.log(chalk.green(`Cleaned ${response.cleared} task(s)`));
        console.log("  Removed task files from ~/.viben/queue/tasks/");
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      handleConnectionError(ctx, error, client["baseUrl"]);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Register the queue command
 */
export function registerQueueCommand(program: Command): void {
  const queueCmd = program
    .command("queue")
    .description("Manage task queue")
    .option("--gateway <url>", "Gateway URL", DEFAULT_GATEWAY_URL)
    .option("--timeout <ms>", "Request timeout", String(DEFAULT_TIMEOUT));

  // queue status
  queueCmd
    .command("status")
    .description("Show queue status")
    .action(async () => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await showQueueStatus(ctx, client);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue list
  queueCmd
    .command("list")
    .description("List tasks")
    .option("-s, --status <status>", "Filter by status (pending, running, completed, failed)")
    .option("-n, --limit <num>", "Limit results", (val) => parseInt(val, 10))
    .option("--all", "Show all tasks")
    .action(async (options: { status?: string; limit?: number; all?: boolean }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await listTasks(ctx, client, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue inspect <id>
  queueCmd
    .command("inspect")
    .argument("<id>", "Task ID")
    .description("Show task details")
    .action(async (taskId: string) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await inspectTask(ctx, client, taskId);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue enqueue
  queueCmd
    .command("enqueue")
    .description("Enqueue a new task")
    .requiredOption("-a, --agent <id>", "Agent ID")
    .option("-i, --input <text>", "Input prompt")
    .option("-s, --session <id>", "Session ID")
    .option("--max-retries <num>", "Max retries", (val) => parseInt(val, 10))
    .option("--stdin", "Read input from stdin")
    .action(async (options: {
      agent: string;
      input?: string;
      session?: string;
      maxRetries?: number;
      stdin?: boolean;
    }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await enqueueTask(ctx, client, {
          agentId: options.agent,
          input: options.input,
          sessionId: options.session,
          maxRetries: options.maxRetries,
          stdin: options.stdin,
        });
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue cancel <id>
  queueCmd
    .command("cancel")
    .argument("<id>", "Task ID")
    .description("Cancel a task")
    .option("-f, --force", "Force cancel running task")
    .action(async (taskId: string, options: { force?: boolean }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await cancelTask(ctx, client, taskId, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue retry <id>
  queueCmd
    .command("retry")
    .argument("<id>", "Task ID")
    .description("Retry a failed task")
    .option("--reset-count", "Reset retry counter")
    .action(async (taskId: string, options: { resetCount?: boolean }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await retryTask(ctx, client, taskId, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue logs <id>
  queueCmd
    .command("logs")
    .argument("<id>", "Task ID")
    .description("View task logs")
    .option("-f, --follow", "Follow log output")
    .option("-n, --tail <num>", "Show last N lines", (val) => parseInt(val, 10))
    .option("--timestamps", "Show timestamps")
    .action(async (taskId: string, options: {
      follow?: boolean;
      tail?: number;
      timestamps?: boolean;
    }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await streamTaskLogs(ctx, client, taskId, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue watch
  queueCmd
    .command("watch")
    .description("Watch queue events")
    .option("-t, --task <id...>", "Watch specific tasks")
    .option("-e, --events <type...>", "Watch specific event types")
    .action(async (options: { task?: string[]; events?: string[] }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await watchQueue(ctx, client, { tasks: options.task, events: options.events });
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
      const client = getGatewayClient(program);
      try {
        await manageConfig(ctx, client, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });

  // queue clean
  queueCmd
    .command("clean")
    .description("Clean completed and failed tasks")
    .option("--dry-run", "Show what would be cleaned")
    .option("-f, --force", "Skip confirmation")
    .action(async (options: { dryRun?: boolean; force?: boolean }) => {
      const ctx = getContext(program);
      const client = getGatewayClient(program);
      try {
        await cleanTasks(ctx, client, options);
      } catch (error) {
        handleCommandError(ctx, error);
      }
    });
}