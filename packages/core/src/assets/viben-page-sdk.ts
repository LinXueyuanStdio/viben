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

interface PageIdentity {
  clientId: string;
  publicKey: string;
  privateKey: string;
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

// Action definition: full form
interface ActionDef {
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeout?: number;
  execute: (payload: unknown, context: ExecuteContext) => Promise<unknown>;
}

// Action definition accepted by register(): bare function OR full object
type ActionDefinition =
  | ((payload: unknown, context: ExecuteContext) => Promise<unknown>)
  | ActionDef;

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
  execute: (payload: unknown, context: ExecuteContext) => Promise<unknown>;
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
    this.init().catch((error) => {
      this.readyReject?.(error instanceof Error ? error : new Error(String(error)));
    });
  }

  // ─── Identity Utility ──────────────────────────────────────────────────────

  static async generateIdentity(pageUid?: string): Promise<PageIdentity> {
    const privateKeyBytes = ed.utils.randomSecretKey();
    const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
    return {
      clientId: `${pageUid ?? "page"}-${Date.now().toString(36)}`,
      publicKey: bytesToHex(publicKeyBytes),
      privateKey: bytesToHex(privateKeyBytes),
    };
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  private async init(): Promise<void> {
    const config = (window as unknown as { __VIBEN_CONFIG__?: VibenConfig }).__VIBEN_CONFIG__;
    if (config) {
      this.applyConfig(config);
      return;
    }

    await this.selfBootstrap();
  }

  private async selfBootstrap(): Promise<void> {
    const sdkScriptElement = document.querySelector(
      'script[src*="viben-page-sdk"]',
    ) as HTMLScriptElement | null;

    const gatewayUrl = sdkScriptElement
      ? new URL(sdkScriptElement.src).origin
      : window.location.origin;

    const pageUid =
      sdkScriptElement?.dataset.page ??
      sdkScriptElement?.dataset.pageUid ??
      (document.title.toLowerCase().replace(/\s+/g, "-") || "unknown");

    const identity = await this.resolveIdentity(pageUid, sdkScriptElement);

    const config: VibenConfig = {
      gatewayUrl,
      clientId: identity.clientId,
      publicKey: identity.publicKey,
      privateKey: identity.privateKey,
      pageUid,
      source: "standalone",
    };

    (window as unknown as { __VIBEN_CONFIG__?: VibenConfig }).__VIBEN_CONFIG__ = config;
    this.applyConfig(config);
  }

  private async resolveIdentity(
    pageUid: string,
    sdkScriptElement: HTMLScriptElement | null,
  ): Promise<PageIdentity> {
    if (
      sdkScriptElement?.dataset.clientId &&
      sdkScriptElement?.dataset.publicKey &&
      sdkScriptElement?.dataset.privateKey
    ) {
      return {
        clientId: sdkScriptElement.dataset.clientId,
        publicKey: sdkScriptElement.dataset.publicKey,
        privateKey: sdkScriptElement.dataset.privateKey,
      };
    }

    const storageKey = `viben_identity_${pageUid}`;
    const storedIdentity = localStorage.getItem(storageKey);
    if (storedIdentity) {
      try {
        return JSON.parse(storedIdentity);
      } catch {
        // corrupted, regenerate
      }
    }

    const identity = await VibenPageSDK.generateIdentity(pageUid);
    localStorage.setItem(storageKey, JSON.stringify(identity));
    return identity;
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private applyConfig(config: VibenConfig): void {
    this.config = config;
    this._theme = config.theme ?? "light";
    this.connect();
  }

  private connect(): void {
    if (!this.config) return;

    this._state = "connecting";
    this.notifyStateChange();

    const url = this.config.gatewayUrl.replace(/\/$/, "");
    this.socket = io(url, {
      path: "/socket.io/client",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("connect", async () => {
      try {
        const timestamp = Date.now();
        const message = `${this.config!.clientId}:${timestamp}`;
        const signature = await signMessage(message, this.config!.privateKey);

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
            if (ack.success) {
              this._state = "connected";
              this.notifyStateChange();
              this.readyResolve?.(true);
              this.reregisterActions();
              window.dispatchEvent(new CustomEvent("viben:connected", { detail: this }));
            } else {
              this.readyReject?.(new Error(ack.error ?? "Connection failed"));
            }
          },
        );
      } catch (error) {
        this.readyReject?.(error instanceof Error ? error : new Error("Signature failed"));
      }
    });

    this.socket.on("disconnect", (reason) => {
      this._state = "disconnected";
      this.notifyStateChange();
    });

    this.socket.io.on("reconnect_attempt", () => {
      this._state = "reconnecting";
      this.notifyStateChange();
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

  // ─── Result Normalization ──────────────────────────────────────────────────

  private normalizeResult(raw: unknown): ActionResult {
    if (
      raw &&
      typeof raw === "object" &&
      "content" in raw &&
      Array.isArray((raw as ActionResult).content)
    ) {
      return raw as ActionResult;
    }
    if (typeof raw === "string") {
      return { content: [{ type: "text", text: raw }] };
    }
    const text = JSON.stringify(raw, null, 2);
    return {
      content: [{ type: "text", text }],
      structuredContent: typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : { value: raw },
    };
  }

  // ─── Action Execution ──────────────────────────────────────────────────────

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
      const rawResult = await action.execute(data.payload, context);
      const result = this.normalizeResult(rawResult);
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

  // ─── Public API ────────────────────────────────────────────────────────────

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

  get pageUid(): string {
    return this.config?.pageUid ?? "";
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
    register: (namespace: string, actions: Record<string, ActionDefinition>): (() => void) => {
      const actionsToRegister: Record<string, Omit<ActionDef, "execute">> = {};

      for (const [actionName, definition] of Object.entries(actions)) {
        const fullName = `${namespace}.${actionName}`;
        const normalizedAction: RegisteredAction =
          typeof definition === "function"
            ? {
                namespace,
                name: actionName,
                description: actionName,
                execute: definition,
              }
            : {
                namespace,
                name: actionName,
                description: definition.description,
                inputSchema: definition.inputSchema,
                outputSchema: definition.outputSchema,
                timeout: definition.timeout,
                execute: definition.execute,
              };

        this.registeredActions.set(fullName, normalizedAction);
        actionsToRegister[actionName] = {
          description: normalizedAction.description,
          inputSchema: normalizedAction.inputSchema,
          outputSchema: normalizedAction.outputSchema,
          timeout: normalizedAction.timeout,
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

export { vibenPage as VibenPage, VibenPageSDK };
export type { ActionDef, ActionDefinition, ActionResult, ExecuteContext, PageIdentity };
