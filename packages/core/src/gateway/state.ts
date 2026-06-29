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
import { ChannelRouter, ChannelRuntime, channelManager } from "../channels";
import { TaskQueueManager } from "./queue";
import { TaskRecoveryService } from "../task/recovery/task-recovery";
import { taskEventStore } from "../task/events/event-store";
import { TaskSSEManager } from "./sse/task-sse-manager";
import { CommandQueue } from "../queue/core/command-queue";
import { DeviceRegistryService } from "../devices/device-registry";
import { MeshService } from "../mesh/mesh-service";
import { PeerStore } from "../mesh/peer-store";
import { DiscoveryService } from "../discovery/discovery-service";
import { ClientStore } from "./client-store";
import type { ClientSocketServer } from "./client-socket-server";
import { FirebaseService } from "../services/firebase";

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
  /** Task recovery service for stuck task detection */
  taskRecovery: TaskRecoveryService;
  /** Task SSE manager for real-time task state updates */
  taskSSEManager: TaskSSEManager;
  /** Command queue for detached shell command execution (viben task start, etc.) */
  commandQueue: CommandQueue;
  /** Device registry for tracking all mesh devices */
  deviceRegistry: DeviceRegistryService;
  /** Mesh service for gateway-to-gateway connections */
  mesh: MeshService;
  /** Discovery service for mDNS and QR code */
  discovery: DiscoveryService;
  /** Client store for Socket.io connected clients and their actions */
  clientStore: ClientStore;
  /** Client Socket.io server (set after onReady) */
  clientSocketServer?: ClientSocketServer;
  /** Firebase service for push notifications, bug reporting, and analytics */
  firebase: FirebaseService;
}

export interface AppStateConfig {
  /** Gateway host (default: "127.0.0.1") */
  host?: string;
  /** Gateway port (default: 18790) */
  port?: number;
  /** Start background runtime services */
  runtime?: boolean;
}

/**
 * Create application state with default services
 */
export function createAppState(config: AppStateConfig = {}): AppState {
  const { host = "127.0.0.1", port = 18790, runtime = true } = config;
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

  // Create task SSE manager for real-time task state updates
  // Configure with automatic stale subscriber cleanup
  const taskSSEManager = new TaskSSEManager({
    heartbeatIntervalMs: 30000, // 30 seconds heartbeat
    staleTimeoutMs: 120000, // 2 minutes stale timeout
    maxFailedSends: 3, // 3 failed sends = dead connection
    cleanupIntervalMs: 60000, // 1 minute cleanup interval
  });
  if (runtime) {
    taskSSEManager.startHeartbeat();
  }

  // Create task recovery service for stuck task detection
  const taskRecovery = new TaskRecoveryService(taskEventStore, taskSSEManager, {
    stuckThresholdMs: 5 * 60 * 1000, // 5 minutes
    autoRecover: true,
  });

  // Create command queue for detached shell command execution
  // This manages "viben task start <task>" commands in the background
  const commandQueue = new CommandQueue();

  // Create device registry
  const deviceRegistry = new DeviceRegistryService(events);
  const gatewayId = deviceRegistry.getGatewayId();

  // Create peer store for YAML persistence
  const peerStore = new PeerStore();

  // Create mesh service
  const localInfo = {
    gateway_id: gatewayId,
    name: `viben-${gatewayId.slice(0, 8)}`,
    version: "1.0.0",
    capabilities: ["navigate", "notify", "ping"],
    address: `http://${host}:${port}`,
  };
  const mesh = new MeshService(events, deviceRegistry, peerStore, localInfo);

  // Create client store for Socket.io clients
  const clientStore = new ClientStore();

  // Create discovery service
  const discovery = new DiscoveryService(events, {
    gateway_id: gatewayId,
    name: localInfo.name,
    version: "1.0.0",
    port,
  });

  // Create Firebase service (gracefully degrades if not configured)
  const firebase = new FirebaseService();

  if (runtime) {
    discovery.onPeerDiscovered((address) => {
      mesh.connectToPeer(address);
    });
  }

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
    taskRecovery,
    taskSSEManager,
    commandQueue,
    deviceRegistry,
    mesh,
    discovery,
    clientStore,
    firebase,
  };
}
