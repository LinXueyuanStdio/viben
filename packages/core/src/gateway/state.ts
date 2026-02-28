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
import { ChannelRouter, ChannelRuntime, channelManager } from "../channels";

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

  return {
    events,
    sessionStore,
    cron,
    container,
    history,
    messageBus,
    channelRouter,
    channelRuntime,
  };
}
