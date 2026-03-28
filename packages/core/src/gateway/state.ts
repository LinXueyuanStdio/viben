/**
 * Gateway application state
 *
 * Holds all the services and shared state for the gateway server.
 */
import { EventService } from "../services/events";
import { SessionStoreService } from "../services/session-store";
import { CronService } from "../cron";
import { ContainerService } from "../services/container";
import { HistoryService } from "../services/history";
import { MessageBus } from "../services/message-bus";
import { McpMonitorService } from "../services/mcp-monitor";
import { ConfigWatcherService, getMcpServersConfigPath } from "../services/config-watcher";
import { ChannelRouter, ChannelRuntime, channelManager } from "../channels";
import { TaskQueueManager } from "./queue";
import { TaskRecoveryService } from "../task/recovery/task-recovery";
import { taskEventStore } from "../task/events/event-store";
import { TaskSSEManager } from "./sse/task-sse-manager";
import { CommandQueue } from "../queue/core/command-queue";

/**
 * Application state for the gateway
 */
export interface AppState {
  /** Event service for SSE/WebSocket streaming */
  events: EventService;
  /** Session store service for file-based session persistence */
  sessionStore: SessionStoreService;
  /** Cron service for scheduled jobs */
  cron: CronService;
  /** Container service for process management */
  container: ContainerService;
  /** History service for agent history */
  history: HistoryService;
  /** Message bus for channel routing */
  messageBus: MessageBus;
  /** Channel router for routing messages to bound agents */
  channelRouter: ChannelRouter;
  /** Channel runtime for managing polling clients */
  channelRuntime: ChannelRuntime;
  /** Task queue for concurrent agent execution control */
  taskQueue: TaskQueueManager;
  /** MCP monitor for tracking MCP server process status */
  mcpMonitor: McpMonitorService;
  /** Config watcher for monitoring MCP config file changes */
  configWatcher: ConfigWatcherService;
  /** Task recovery service for stuck task detection */
  taskRecovery: TaskRecoveryService;
  /** Task SSE manager for real-time task state updates */
  taskSSEManager: TaskSSEManager;
  /** Command queue for detached shell command execution (viben task start, etc.) */
  commandQueue: CommandQueue;
}

/**
 * Create application state with default services
 */
export function createAppState(): AppState {
  const events = new EventService();
  const sessionStore = new SessionStoreService();
  const cron = new CronService(events);
  const container = new ContainerService(events, sessionStore);
  const history = new HistoryService();
  const messageBus = new MessageBus(events);

  // Create channel router with container service for agent execution
  const channelRouter = new ChannelRouter({
    events,
    channels: channelManager,
    container,
    responseTimeout: 120000, // 2 minutes timeout for agent responses
  });

  // Create channel runtime for polling (receives messages from external channels)
  const channelRuntime = new ChannelRuntime({
    channelManager,
    messageBus,
    auto_start: true, // Auto-start enabled channels with agent bindings
    pollingTimeout: 30,
  });

  // Create task queue manager
  const taskQueue = new TaskQueueManager(events);

  // Create MCP monitor service (checks every 30 seconds)
  const mcpMonitor = new McpMonitorService(events, {
    checkInterval: 30000, // 30 seconds
  });
  mcpMonitor.start();

  // Create config watcher service
  const configWatcher = new ConfigWatcherService(events, {
    debounceMs: 500, // 500ms debounce
  });
  configWatcher.start();
  // Watch the MCP servers config file
  configWatcher.watch(getMcpServersConfigPath());

  // Create task SSE manager for real-time task state updates
  // Configure with automatic stale subscriber cleanup
  const taskSSEManager = new TaskSSEManager({
    heartbeatIntervalMs: 30000, // 30 seconds heartbeat
    staleTimeoutMs: 120000, // 2 minutes stale timeout
    maxFailedSends: 3, // 3 failed sends = dead connection
    cleanupIntervalMs: 60000, // 1 minute cleanup interval
  });
  // Start heartbeat and cleanup intervals
  taskSSEManager.startHeartbeat();

  // Create task recovery service for stuck task detection
  const taskRecovery = new TaskRecoveryService(taskEventStore, taskSSEManager, {
    stuckThresholdMs: 5 * 60 * 1000, // 5 minutes
    autoRecover: true,
  });

  // Create command queue for detached shell command execution
  // This manages "viben task start <task>" commands in the background
  const commandQueue = new CommandQueue();

  return {
    events,
    sessionStore,
    cron,
    container,
    history,
    messageBus,
    channelRouter,
    channelRuntime,
    taskQueue,
    mcpMonitor,
    configWatcher,
    taskRecovery,
    taskSSEManager,
    commandQueue,
  };
}
