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

  return {
    events,
    sessionStore,
    cron,
    container,
    history,
    messageBus,
  };
}
