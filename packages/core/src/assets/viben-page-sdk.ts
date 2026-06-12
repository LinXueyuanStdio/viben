import { io, type Socket } from "socket.io-client";
import * as ed from "@noble/ed25519";

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";
type Theme = "light" | "dark";
type SocketSource = "main_window" | "page_iframe" | "chat_window" | "standalone";

interface VibenConfig {
  gatewayUrl: string;
  clientId: string;
  publicKey: string;
  privateKey: string;
  theme?: Theme;
  workspacePath?: string;
  source?: SocketSource;
  pageUid?: string;
}

async function signMessage(message: string, privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const messageBytes = new TextEncoder().encode(message);
  const signature = await ed.signAsync(messageBytes, privateKey);
  return bytesToHex(signature);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface ActionDef {
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeout?: number;
  execute: (payload: unknown, context: ExecuteContext) => Promise<ActionResult>;
}

interface ExecuteContext {
  sessionId: string;
  toolUseId: string;
  source: string;
  requireApproval: (message: string, options?: { timeout?: number }) => Promise<boolean>;
}

interface ActionResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface RegisteredAction {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeout?: number;
  execute: ActionDef["execute"];
}

class VibenPageSDK {
  private socket: Socket | null = null;
  private config: VibenConfig | null = null;
  private _state: ConnectionState = "disconnected";
  private _theme: Theme = "light";
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private themeListeners: Set<(theme: Theme) => void> = new Set();
  private registeredActions: Map<string, RegisteredAction> = new Map();
  private pendingApprovals: Map<
    string,
    { resolve: (approved: boolean) => void; reject: (err: Error) => void }
  > = new Map();
  private readyResolve: ((value: boolean) => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;

  readonly ready: Promise<boolean>;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.init();
  }

  private init(): void {
    console.log("[VibenSDK] init() called");
    const config = (window as unknown as { __VIBEN_CONFIG__?: VibenConfig }).__VIBEN_CONFIG__;
    console.log("[VibenSDK] __VIBEN_CONFIG__:", config ? JSON.stringify({ gatewayUrl: config.gatewayUrl, clientId: config.clientId, source: config.source, pageUid: config.pageUid }) : "null");
    if (config) {
      this.applyConfig(config);
      return;
    }

    console.log("[VibenSDK] no config found, waiting for postMessage from parent...");
    // Config not yet available — wait for postMessage from parent
    const timeout = setTimeout(() => {
      console.error("[VibenSDK] TIMEOUT: no viben-config postMessage received in 5s");
      window.removeEventListener("message", handler);
      this.readyReject?.(new Error("config_missing: window.__VIBEN_CONFIG__ not set (timeout)"));
    }, 5000);

    const handler = (e: MessageEvent) => {
      console.log("[VibenSDK] postMessage received:", e.data?.type, "origin:", e.origin);
      if (e.data && e.data.type === "viben-config") {
        console.log("[VibenSDK] got viben-config via postMessage:", JSON.stringify({ gatewayUrl: e.data.payload?.gatewayUrl, clientId: e.data.payload?.clientId }));
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        (window as unknown as { __VIBEN_CONFIG__?: VibenConfig }).__VIBEN_CONFIG__ = e.data.payload;
        this.applyConfig(e.data.payload);
      }
    };
    window.addEventListener("message", handler);
  }

  private applyConfig(config: VibenConfig): void {
    console.log("[VibenSDK] applyConfig:", { gatewayUrl: config.gatewayUrl, clientId: config.clientId, source: config.source, pageUid: config.pageUid });
    this.config = config;
    this._theme = config.theme ?? "light";
    this.connect();
  }

  private connect(): void {
    if (!this.config) return;

    this._state = "connecting";
    this.notifyStateChange();

    const url = this.config.gatewayUrl.replace(/\/$/, "");
    console.log("[VibenSDK] connecting to:", url, "path: /socket.io/client");
    this.socket = io(url, {
      path: "/socket.io/client",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("connect", async () => {
      console.log("[VibenSDK] socket.io 'connect' event fired, socket.id:", this.socket?.id);
      try {
        const timestamp = Date.now();
        const message = `${this.config!.clientId}:${timestamp}`;
        console.log("[VibenSDK] signing message:", message);
        const signature = await signMessage(message, this.config!.privateKey);
        console.log("[VibenSDK] signature generated, emitting client:connect...");

        this.socket!.emit(
          "client:connect",
          {
            clientId: this.config!.clientId,
            source: this.config!.source ?? this.detectSource(),
            pageUid: this.config!.pageUid,
            publicKey: this.config!.publicKey,
            signature,
            timestamp,
          },
          (ack: { success: boolean; error?: string }) => {
            console.log("[VibenSDK] client:connect ack received:", JSON.stringify(ack));
            if (ack.success) {
              this._state = "connected";
              this.notifyStateChange();
              this.readyResolve?.(true);
              this.reregisterActions();
            } else {
              console.error("[VibenSDK] client:connect FAILED:", ack.error);
              this.readyReject?.(new Error(ack.error ?? "Connection failed"));
            }
          },
        );
      } catch (error) {
        console.error("[VibenSDK] error in connect handler:", error);
        this.readyReject?.(error instanceof Error ? error : new Error("Signature failed"));
      }
    });

    this.socket.on("connect_error", (err) => {
      console.error("[VibenSDK] connect_error:", err.message, "type:", (err as any).type, "description:", (err as any).description);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[VibenSDK] disconnected, reason:", reason);
      this._state = "disconnected";
      this.notifyStateChange();
    });

    this.socket.io.on("reconnect_attempt", (attempt) => {
      console.log("[VibenSDK] reconnect_attempt #" + attempt);
      this._state = "reconnecting";
      this.notifyStateChange();
    });

    this.socket.io.on("reconnect_failed", () => {
      console.error("[VibenSDK] reconnect_failed (all attempts exhausted)");
    });

    this.socket.io.on("error", (err) => {
      console.error("[VibenSDK] manager error:", err);
    });

    this.socket.on("client:init", (data: { theme: Theme; workspacePath?: string }) => {
      if (data.theme !== this._theme) {
        this._theme = data.theme;
        this.notifyThemeChange();
      }
    });

    this.socket.on("client:theme", (data: { theme: Theme }) => {
      if (data.theme !== this._theme) {
        this._theme = data.theme;
        this.notifyThemeChange();
      }
    });

    this.socket.on(
      "action:execute",
      async (data: {
        requestId: string;
        namespace: string;
        action: string;
        payload: unknown;
        context: { sessionId: string; toolUseId: string; source: string };
      }) => {
        await this.handleExecute(data);
      },
    );

    this.socket.on(
      "action:approval:result",
      (data: { requestId: string; approved: boolean; error?: string }) => {
        const pending = this.pendingApprovals.get(data.requestId);
        if (pending) {
          this.pendingApprovals.delete(data.requestId);
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data.approved);
          }
        }
      },
    );
  }

  private detectSource(): SocketSource {
    if (window.parent !== window) {
      return "page_iframe";
    }
    return "standalone";
  }

  private notifyStateChange(): void {
    for (const listener of this.stateListeners) {
      listener(this._state);
    }
  }

  private notifyThemeChange(): void {
    document.documentElement.classList.toggle("dark", this._theme === "dark");
    for (const listener of this.themeListeners) {
      listener(this._theme);
    }
  }

  private reregisterActions(): void {
    const byNamespace = new Map<string, Record<string, Omit<ActionDef, "execute">>>();

    for (const action of this.registeredActions.values()) {
      if (!byNamespace.has(action.namespace)) {
        byNamespace.set(action.namespace, {});
      }
      byNamespace.get(action.namespace)![action.name] = {
        description: action.description,
        inputSchema: action.inputSchema,
        outputSchema: action.outputSchema,
        timeout: action.timeout,
      };
    }

    for (const [namespace, actions] of byNamespace) {
      this.socket?.emit("action:register", { namespace, actions });
    }
  }

  private async handleExecute(data: {
    requestId: string;
    namespace: string;
    action: string;
    payload: unknown;
    context: { sessionId: string; toolUseId: string; source: string };
  }): Promise<void> {
    const fullName = `${data.namespace}.${data.action}`;
    const action = this.registeredActions.get(fullName);

    if (!action) {
      this.socket?.emit("action:result", {
        requestId: data.requestId,
        result: {
          content: [{ type: "text", text: `Action not found: ${fullName}` }],
          isError: true,
        },
      });
      return;
    }

    const context: ExecuteContext = {
      sessionId: data.context.sessionId,
      toolUseId: data.context.toolUseId,
      source: data.context.source,
      requireApproval: (message, options) =>
        this.requestApproval(data.requestId, message, options),
    };

    try {
      const result = await action.execute(data.payload, context);
      this.socket?.emit("action:result", {
        requestId: data.requestId,
        result,
      });
    } catch (error) {
      this.socket?.emit("action:result", {
        requestId: data.requestId,
        result: {
          content: [
            { type: "text", text: error instanceof Error ? error.message : String(error) },
          ],
          isError: true,
        },
      });
    }
  }

  private requestApproval(
    executeRequestId: string,
    message: string,
    options?: { timeout?: number },
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const timeout = options?.timeout ?? 30000;
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(requestId);
        reject(new Error("approval_timeout"));
      }, timeout);

      this.pendingApprovals.set(requestId, {
        resolve: (approved) => {
          clearTimeout(timer);
          resolve(approved);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.socket?.emit("action:approval:request", {
        requestId,
        executeRequestId,
        message,
        options,
      });
    });
  }

  // Public API

  get state(): ConnectionState {
    return this._state;
  }

  get theme(): Theme {
    return this._theme;
  }

  get clientId(): string {
    return this.config?.clientId ?? "";
  }

  get workspacePath(): string | null {
    return this.config?.workspacePath ?? null;
  }

  get gatewayUrl(): string {
    return this.config?.gatewayUrl ?? "";
  }

  onStateChange(fn: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  onThemeChange(fn: (theme: Theme) => void): () => void {
    this.themeListeners.add(fn);
    return () => this.themeListeners.delete(fn);
  }

  actions = {
    register: (namespace: string, actions: Record<string, ActionDef>): (() => void) => {
      const actionsToRegister: Record<string, Omit<ActionDef, "execute">> = {};

      for (const [name, def] of Object.entries(actions)) {
        const fullName = `${namespace}.${name}`;
        this.registeredActions.set(fullName, {
          namespace,
          name,
          description: def.description,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          timeout: def.timeout,
          execute: def.execute,
        });
        actionsToRegister[name] = {
          description: def.description,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          timeout: def.timeout,
        };
      }

      if (this._state === "connected") {
        this.socket?.emit("action:register", { namespace, actions: actionsToRegister });
      }

      return () => this.actions.unregister(namespace);
    },

    unregister: (namespace?: string): void => {
      if (namespace) {
        for (const [fullName, action] of this.registeredActions) {
          if (action.namespace === namespace) {
            this.registeredActions.delete(fullName);
          }
        }
      } else {
        this.registeredActions.clear();
      }

      if (this._state === "connected") {
        this.socket?.emit("action:unregister", { namespace });
      }
    },

    list: (): Array<{ namespace: string; name: string; description: string }> => {
      return Array.from(this.registeredActions.values()).map((a) => ({
        namespace: a.namespace,
        name: a.name,
        description: a.description,
      }));
    },
  };
}

// Create and export singleton
const vibenPage = new VibenPageSDK();
(window as unknown as { VibenPage?: VibenPageSDK }).VibenPage = vibenPage;

export { vibenPage as VibenPage };
export type { VibenPageSDK, ActionDef, ActionResult, ExecuteContext };
