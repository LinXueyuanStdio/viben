import type { JSONSchema7 } from "json-schema";
import { logger as globalLogger } from "../telemetry";

const log = globalLogger.child({ module: "client-store" });

const DEFAULT_GRACE_PERIOD_MS = 30000;
const MAX_ACTIONS_PER_CLIENT = 1000;
const MAX_PAYLOAD_SIZE = 1024 * 1024;

export type SocketSource = "main_window" | "page_iframe" | "chat_window" | "standalone";

export interface SocketInfo {
  socketId: string;
  source: SocketSource;
  pageUid?: string;
  connectedAt: number;
}

export interface ActionEntry {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
  socketId: string;
  registeredAt: number;
  hash: string;
  timeout?: number;
}

export interface ClientState {
  clientId: string;
  publicKey: string;
  sockets: Map<string, SocketInfo>;
  actionStore: Map<string, ActionEntry>;
  metadata: {
    theme: "light" | "dark";
    workspacePath: string;
  };
  disconnectTimer?: NodeJS.Timeout;
}

export interface RegisterClientOptions {
  source: SocketSource;
  socketId: string;
  pageUid?: string;
  theme?: "light" | "dark";
  workspacePath?: string;
  publicKey: string;
  signature: string;
  timestamp: number;
}

export interface RegisterActionOptions {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
  timeout?: number;
}

export interface ActionWithClient extends ActionEntry {
  clientId: string;
}

export interface ClientStoreConfig {
  gracePeriodMs?: number;
  maxActionsPerClient?: number;
  maxPayloadSize?: number;
}

function fnv1aHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function computeActionHash(clientId: string, action: RegisterActionOptions): string {
  const content = clientId +
    action.namespace +
    action.name +
    action.description +
    JSON.stringify(action.inputSchema ?? null) +
    JSON.stringify(action.outputSchema ?? null);
  return fnv1aHash(content);
}

export class ClientStore {
  private clients = new Map<string, ClientState>();
  private readonly config: Required<ClientStoreConfig>;
  private nameIndex = new Map<string, ActionWithClient[]>();
  private _globalTheme: "light" | "dark" = "light";

  constructor(config: ClientStoreConfig = {}) {
    this.config = {
      gracePeriodMs: config.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS,
      maxActionsPerClient: config.maxActionsPerClient ?? MAX_ACTIONS_PER_CLIENT,
      maxPayloadSize: config.maxPayloadSize ?? MAX_PAYLOAD_SIZE,
    };
  }

  get globalTheme(): "light" | "dark" {
    return this._globalTheme;
  }

  setGlobalTheme(theme: "light" | "dark"): void {
    this._globalTheme = theme;
  }

  getClient(clientId: string): ClientState | undefined {
    return this.clients.get(clientId);
  }

  private async verifySignature(
    clientId: string,
    publicKey: string,
    signature: string,
    timestamp: number
  ): Promise<boolean> {
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      log.warn({ clientId, timestamp, now }, "Signature timestamp expired");
      return false;
    }

    try {
      const { verify } = await import("../utils/crypto");
      const message = `${clientId}:${timestamp}`;
      return await verify(message, signature, publicKey);
    } catch (error) {
      log.error({ clientId, error }, "Signature verification failed");
      return false;
    }
  }

  async registerClient(clientId: string, options: RegisterClientOptions): Promise<ClientState> {
    let client = this.clients.get(clientId);

    if (!client) {
      const valid = await this.verifySignature(
        clientId,
        options.publicKey,
        options.signature,
        options.timestamp
      );
      if (!valid) {
        throw new Error("Invalid signature for clientId");
      }

      client = {
        clientId,
        publicKey: options.publicKey,
        sockets: new Map(),
        actionStore: new Map(),
        metadata: {
          theme: options.theme ?? "light",
          workspacePath: options.workspacePath ?? "",
        },
      };
      this.clients.set(clientId, client);
      log.info({ clientId }, "Client registered");
    } else {
      if (client.publicKey !== options.publicKey) {
        throw new Error("Public key mismatch for existing client");
      }
      const valid = await this.verifySignature(
        clientId,
        options.publicKey,
        options.signature,
        options.timestamp
      );
      if (!valid) {
        throw new Error("Invalid signature for clientId");
      }

      if (client.disconnectTimer) {
        clearTimeout(client.disconnectTimer);
        client.disconnectTimer = undefined;
        log.info({ clientId }, "Grace period cancelled (new socket connected)");
      }
    }

    if (!client.sockets.has(options.socketId)) {
      client.sockets.set(options.socketId, {
        socketId: options.socketId,
        source: options.source,
        pageUid: options.pageUid,
        connectedAt: Date.now(),
      });
      log.info({ clientId, socketId: options.socketId, source: options.source }, "Socket added to client");
    }

    if (options.theme) {
      client.metadata.theme = options.theme;
    }
    if (options.workspacePath) {
      client.metadata.workspacePath = options.workspacePath;
    }

    return client;
  }

  removeSocket(clientId: string, socketId: string): { actionsRemoved: string[]; clientRemoved: boolean } {
    const client = this.clients.get(clientId);
    if (!client) return { actionsRemoved: [], clientRemoved: false };

    client.sockets.delete(socketId);
    log.info({ clientId, socketId }, "Socket removed from client");

    const actionsFromSocket: string[] = [];
    for (const [fullName, action] of client.actionStore) {
      if (action.socketId === socketId) {
        actionsFromSocket.push(fullName);
      }
    }

    if (client.sockets.size > 0) {
      for (const fullName of actionsFromSocket) {
        const action = client.actionStore.get(fullName);
        if (action) {
          this.removeFromNameIndex(clientId, action);
        }
        client.actionStore.delete(fullName);
        log.info({ clientId, action: fullName }, "Action removed (socket disconnected)");
      }
      return { actionsRemoved: actionsFromSocket, clientRemoved: false };
    }

    log.info({ clientId, gracePeriodMs: this.config.gracePeriodMs }, "All sockets disconnected, starting grace period");

    client.disconnectTimer = setTimeout(() => {
      const removedClient = this.clients.get(clientId);
      if (removedClient && removedClient.sockets.size === 0) {
        for (const action of removedClient.actionStore.values()) {
          this.removeFromNameIndex(clientId, action);
        }
        this.clients.delete(clientId);
        log.info({ clientId, actionsRemoved: Array.from(removedClient.actionStore.keys()) },
          "Client removed after grace period");
      }
    }, this.config.gracePeriodMs);

    return { actionsRemoved: [], clientRemoved: false };
  }

  registerAction(
    clientId: string,
    socketId: string,
    action: RegisterActionOptions
  ): { updated: boolean; fullName: string; error?: string } {
    const client = this.clients.get(clientId);
    if (!client) {
      return { updated: false, fullName: "", error: `Client not found: ${clientId}` };
    }

    if (client.actionStore.size >= this.config.maxActionsPerClient) {
      log.warn({ clientId, count: client.actionStore.size }, "Max actions limit reached");
      return { updated: false, fullName: "", error: "Max actions limit reached" };
    }

    const fullName = `${action.namespace}.${action.name}`;
    const hash = computeActionHash(clientId, action);
    const existing = client.actionStore.get(fullName);

    if (existing && existing.hash === hash) {
      if (existing.socketId !== socketId) {
        existing.socketId = socketId;
        log.info({ clientId, action: fullName, oldSocketId: existing.socketId, newSocketId: socketId }, "Action socketId updated (reconnect)");
      }
      return { updated: false, fullName };
    }

    const entry: ActionEntry = {
      namespace: action.namespace,
      name: action.name,
      description: action.description,
      inputSchema: action.inputSchema,
      outputSchema: action.outputSchema,
      socketId,
      registeredAt: Date.now(),
      hash,
      timeout: action.timeout,
    };

    const oldEntry = client.actionStore.get(fullName);
    if (oldEntry) {
      this.removeFromNameIndex(clientId, oldEntry);
    }

    client.actionStore.set(fullName, entry);
    this.addToNameIndex(clientId, entry);
    log.info({ clientId, action: fullName, socketId, timeout: action.timeout }, "Action registered");

    return { updated: true, fullName };
  }

  unregisterAction(clientId: string, namespace?: string, socketId?: string): string[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const removed: string[] = [];

    for (const [fullName, action] of client.actionStore) {
      const matchNamespace = !namespace || action.namespace === namespace;
      const matchSocket = !socketId || action.socketId === socketId;

      if (matchNamespace && matchSocket) {
        client.actionStore.delete(fullName);
        this.removeFromNameIndex(clientId, action);
        removed.push(fullName);
      }
    }

    if (removed.length > 0) {
      log.info({ clientId, removed }, "Actions unregistered");
    }

    return removed;
  }

  findAction(
    clientId: string,
    namespace: string,
    name: string
  ): ActionEntry | undefined {
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    return client.actionStore.get(`${namespace}.${name}`);
  }

  getAllActions(): ActionWithClient[] {
    const result: ActionWithClient[] = [];

    for (const [clientId, client] of this.clients) {
      for (const action of client.actionStore.values()) {
        result.push({ ...action, clientId });
      }
    }

    return result;
  }

  removeStaleActions(clientId: string, namespace: string, socketId: string, keepNames: Set<string>): string[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const removed: string[] = [];
    for (const [fullName, entry] of client.actionStore) {
      if (entry.namespace === namespace && entry.socketId === socketId && !keepNames.has(entry.name)) {
        this.removeFromNameIndex(clientId, entry);
        client.actionStore.delete(fullName);
        removed.push(fullName);
      }
    }
    return removed;
  }

  findActionByName(name: string): ActionWithClient | undefined {
    const entries = this.nameIndex.get(name);
    return entries?.[0];
  }

  findActionByFullName(fullName: string): ActionWithClient | undefined {
    for (const [clientId, client] of this.clients) {
      const entry = client.actionStore.get(fullName);
      if (entry) return { ...entry, clientId };
    }
    return undefined;
  }

  /**
   * Resolve an action string to its owning client + metadata.
   * Tries strategies in priority order without assuming dot-segment count:
   * 1. Exact match as fullName (namespace.name) across all clients
   * 2. Exact match as bare action name via nameIndex
   * 3. Prefix is a known clientId → remainder is a fullName under that client
   */
  resolveAction(action: string): ActionWithClient | undefined {
    // Strategy 1: try as fullName (e.g. "presentation.slide_next")
    const byFullName = this.findActionByFullName(action);
    if (byFullName) return byFullName;

    // Strategy 2: try as bare name (e.g. "read_window")
    const byName = this.findActionByName(action);
    if (byName) return byName;

    // Strategy 3: first dot-segment might be a clientId prefix
    const dotIndex = action.indexOf(".");
    if (dotIndex > 0) {
      const maybeClientId = action.slice(0, dotIndex);
      const remainder = action.slice(dotIndex + 1);
      const client = this.clients.get(maybeClientId);
      if (client) {
        const entry = client.actionStore.get(remainder);
        if (entry) return { ...entry, clientId: maybeClientId };
      }
    }

    return undefined;
  }

  private addToNameIndex(clientId: string, entry: ActionEntry): void {
    const list = this.nameIndex.get(entry.name);
    const item: ActionWithClient = { ...entry, clientId };
    if (list) {
      list.push(item);
    } else {
      this.nameIndex.set(entry.name, [item]);
    }
  }

  private removeFromNameIndex(clientId: string, entry: ActionEntry): void {
    const list = this.nameIndex.get(entry.name);
    if (!list) return;
    const idx = list.findIndex(a => a.clientId === clientId && a.namespace === entry.namespace);
    if (idx !== -1) {
      list.splice(idx, 1);
      if (list.length === 0) {
        this.nameIndex.delete(entry.name);
      }
    }
  }

  getSocketInfo(clientId: string, socketId: string): SocketInfo | undefined {
    return this.clients.get(clientId)?.sockets.get(socketId);
  }

  getAllClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getConfig(): Required<ClientStoreConfig> {
    return { ...this.config };
  }

  shutdown(): void {
    for (const client of this.clients.values()) {
      if (client.disconnectTimer) {
        clearTimeout(client.disconnectTimer);
      }
    }
    this.clients.clear();
    this.nameIndex.clear();
    log.info("ClientStore shut down");
  }
}
