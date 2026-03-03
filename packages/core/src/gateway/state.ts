/**
 * Gateway application state
 *
 * Holds all the services and shared state for the gateway server.
 */
import { EventService } from "../services/events";
import { SessionStoreService } from "../services/session-store";
import { CronService } from "../services/cron";
import { ContainerService } from "../services/container";
import { HistoryService } from "../services/history";
import { MessageBus } from "../services/message-bus";
import { McpMonitorService } from "../services/mcp-monitor";
import { ConfigWatcherService, getMcpServersConfigPath } from "../services/config-watcher";
import { ChannelRouter, ChannelRuntime, channelManager } from "../channels";
import { TaskQueueManager } from "./queue";

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
    autoStart: true, // Auto-start enabled channels with agent bindings
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
  };
}
