import { io, type Socket } from "socket.io-client";
import * as ed from "@noble/ed25519";
import { useActionStore } from "@/stores/action-store";
import { executeGUIAction } from "./action-executor";
import { executeBuiltin } from "./builtins";
import { getRegistrableBuiltins } from "./builtins";
import { createSocketExecutionContext } from "./execution-context";
import { UserCancelledException } from "./errors";
import type { ClientIdentity } from "@/stores/client-id-store";
import type { ClientToolResult } from "../client-side-tool/types";
import type { ApprovalOptions, JSONSchema7 } from "./types";

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

interface ActionExecuteEvent {
  requestId: string;
  namespace: string;
  action: string;
  payload: unknown;
  context: {
    sessionId: string;
    toolUseId: string;
    callerClientId?: string;
    source: string;
  };
}

interface ActionMeta {
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
}

const DESKTOP_MAIN_NAMESPACE = "desktop_main";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

class GatewayActionSocket {
  private socket: Socket | null = null;
  private _state: ConnectionState = "disconnected";
  private identity: ClientIdentity | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private pendingApprovals = new Map<
    string,
    { resolve: (v: boolean) => void; reject: (e: unknown) => void }
  >();
  private lastRegisteredSnapshot = new Map<string, Map<string, ActionMeta>>();

  get state(): ConnectionState {
    return this._state;
  }

  connect(gatewayUrl: string, identity: ClientIdentity): void {
    if (this.socket) {
      this.disconnect();
    }

    this.identity = identity;
    this._state = "connecting";

    this.socket = io(gatewayUrl, {
      path: "/socket.io/client",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });

    this.socket.on("connect", () => this.handleConnect());
    this.socket.on("disconnect", () => this.handleDisconnect());
    this.socket.io.on("reconnect_attempt", () => {
      this._state = "reconnecting";
    });
    this.socket.on(
      "action:execute",
      (data: ActionExecuteEvent) => void this.handleExecute(data)
    );
    this.socket.on(
      "action:approval:result",
      (data: { requestId: string; approved: boolean; error?: string }) => {
        this.handleApprovalResult(data);
      }
    );

    this.startStoreSubscription();
  }

  disconnect(): void {
    this.stopStoreSubscription();
    this.rejectAllPendingApprovals();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this._state = "disconnected";
    this.lastRegisteredSnapshot.clear();
  }

  private async handleConnect(): Promise<void> {
    if (!this.socket || !this.identity) return;

    const timestamp = Date.now();
    const message = `${this.identity.clientId}:${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);
    const privateKeyBytes = hexToBytes(this.identity.privateKey);
    const signatureBytes = await ed.signAsync(messageBytes, privateKeyBytes);
    const signature = bytesToHex(signatureBytes);

    this.socket.emit(
      "client:connect",
      {
        clientId: this.identity.clientId,
        source: "main_window",
        publicKey: this.identity.publicKey,
        signature,
        timestamp,
      },
      (ack: { success: boolean; error?: string }) => {
        if (ack.success) {
          this._state = "connected";
          console.info("[GatewayActionSocket] Connected and authenticated");
          this.syncFullRegistration();
        } else {
          console.error("[GatewayActionSocket] Auth failed:", ack.error);
          this._state = "disconnected";
        }
      }
    );
  }

  private handleDisconnect(): void {
    this._state = "disconnected";
    this.lastRegisteredSnapshot.clear();
    this.rejectAllPendingApprovals();
    console.info("[GatewayActionSocket] Disconnected");
  }

  private async handleExecute(data: ActionExecuteEvent): Promise<void> {
    const { requestId, namespace, action, payload, context } = data;
    let result: ClientToolResult;

    try {
      const ctx = createSocketExecutionContext(
        context.sessionId,
        context.toolUseId,
        (message, options) => this.emitApprovalRequest(requestId, message, options)
      );

      if (
        namespace === DESKTOP_MAIN_NAMESPACE &&
        (action === "read_window" || action === "navigate_to")
      ) {
        const builtinResult = await executeBuiltin(action, payload ?? {}, ctx);
        result = builtinResult ?? {
          content: [{ type: "text", text: `Builtin "${action}" returned null` }],
          isError: true,
        };
      } else {
        const fullName = `${namespace}.${action}`;
        result = await executeGUIAction({ action: fullName, payload }, ctx);
      }
    } catch (err) {
      if (err instanceof UserCancelledException) {
        result = { content: [{ type: "text", text: "User rejected" }], isError: true };
      } else {
        result = {
          content: [{ type: "text", text: `execution_error: ${String(err)}` }],
          isError: true,
        };
      }
    }

    this.socket?.emit("action:result", { requestId, result });
  }

  private emitApprovalRequest(
    executeRequestId: string,
    message: string,
    options?: ApprovalOptions
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (!this.socket) {
        reject(new UserCancelledException("Socket disconnected"));
        return;
      }

      const requestId = crypto.randomUUID();
      this.pendingApprovals.set(requestId, { resolve, reject });

      this.socket.emit("action:approval:request", {
        requestId,
        executeRequestId,
        message,
        options: options ? { timeout: 30000, ...options } : { timeout: 30000 },
      });
    });
  }

  private handleApprovalResult(data: {
    requestId: string;
    approved: boolean;
    error?: string;
  }): void {
    const pending = this.pendingApprovals.get(data.requestId);
    if (!pending) return;
    this.pendingApprovals.delete(data.requestId);

    if (data.error) {
      pending.reject(new UserCancelledException(data.error));
    } else {
      pending.resolve(data.approved);
    }
  }

  private rejectAllPendingApprovals(): void {
    for (const [, pending] of this.pendingApprovals) {
      pending.reject(new UserCancelledException("Socket disconnected"));
    }
    this.pendingApprovals.clear();
  }

  private startStoreSubscription(): void {
    this.unsubscribeStore = useActionStore.subscribe((state, prevState) => {
      if (this._state !== "connected") return;
      if (state.registry === prevState.registry) return;
      this.syncDiff(state.registry, prevState.registry);
    });
  }

  private stopStoreSubscription(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
  }

  private syncFullRegistration(): void {
    const state = useActionStore.getState();
    const grouped = this.buildNamespaceMap(state.registry);

    // Add builtins to the desktop_main namespace
    const builtins = getRegistrableBuiltins();
    if (!grouped.has(DESKTOP_MAIN_NAMESPACE)) {
      grouped.set(DESKTOP_MAIN_NAMESPACE, new Map());
    }
    const desktopMainActions = grouped.get(DESKTOP_MAIN_NAMESPACE)!;
    for (const [name, meta] of Object.entries(builtins)) {
      desktopMainActions.set(name, meta);
    }

    for (const [namespace, actions] of grouped) {
      this.emitRegister(namespace, actions);
    }

    this.lastRegisteredSnapshot = grouped;
  }

  private syncDiff(
    current: ReturnType<typeof useActionStore.getState>["registry"],
    _previous: ReturnType<typeof useActionStore.getState>["registry"]
  ): void {
    const currentGrouped = this.buildNamespaceMap(current);

    // Add builtins to the desktop_main namespace
    const builtins = getRegistrableBuiltins();
    if (!currentGrouped.has(DESKTOP_MAIN_NAMESPACE)) {
      currentGrouped.set(DESKTOP_MAIN_NAMESPACE, new Map());
    }
    const desktopMainActions = currentGrouped.get(DESKTOP_MAIN_NAMESPACE)!;
    for (const [name, meta] of Object.entries(builtins)) {
      desktopMainActions.set(name, meta);
    }

    // Register new or changed namespaces
    for (const [namespace, actions] of currentGrouped) {
      const lastActions = this.lastRegisteredSnapshot.get(namespace);
      if (!lastActions || !this.namespaceActionsEqual(actions, lastActions)) {
        this.emitRegister(namespace, actions);
      }
    }

    // Unregister removed namespaces
    for (const namespace of this.lastRegisteredSnapshot.keys()) {
      if (!currentGrouped.has(namespace)) {
        this.socket?.emit("action:unregister", { namespace });
      }
    }

    this.lastRegisteredSnapshot = currentGrouped;
  }

  private buildNamespaceMap(
    registry: Map<
      string,
      { namespace: string; actions: { name: string; description: string; input_schema?: JSONSchema7; output_schema?: JSONSchema7 }[]; registeredAt?: number }
    >
  ): Map<string, Map<string, ActionMeta>> {
    const grouped = new Map<string, Map<string, ActionMeta>>();

    // Sort providers by registration time (most recent first for priority)
    const providers = [...registry.values()].sort((a, b) => {
      const aReg = a.registeredAt ?? 0;
      const bReg = b.registeredAt ?? 0;
      return bReg - aReg;
    });

    for (const provider of providers) {
      if (!grouped.has(provider.namespace)) {
        grouped.set(provider.namespace, new Map());
      }
      const nsMap = grouped.get(provider.namespace)!;
      for (const action of provider.actions) {
        if (!nsMap.has(action.name)) {
          nsMap.set(action.name, {
            description: action.description,
            inputSchema: action.input_schema,
            outputSchema: action.output_schema,
          });
        }
      }
    }

    return grouped;
  }

  private namespaceActionsEqual(
    a: Map<string, ActionMeta>,
    b: Map<string, ActionMeta>
  ): boolean {
    if (a.size !== b.size) return false;
    for (const [name, meta] of a) {
      const other = b.get(name);
      if (!other) return false;
      if (meta.description !== other.description) return false;
      if (JSON.stringify(meta.inputSchema) !== JSON.stringify(other.inputSchema)) return false;
      if (JSON.stringify(meta.outputSchema) !== JSON.stringify(other.outputSchema)) return false;
    }
    return true;
  }

  private emitRegister(namespace: string, actions: Map<string, ActionMeta>): void {
    if (!this.socket || actions.size === 0) return;

    const actionsPayload: Record<
      string,
      { description: string; inputSchema?: JSONSchema7; outputSchema?: JSONSchema7 }
    > = {};
    for (const [name, meta] of actions) {
      actionsPayload[name] = {
        description: meta.description,
        inputSchema: meta.inputSchema,
        outputSchema: meta.outputSchema,
      };
    }

    this.socket.emit("action:register", { namespace, actions: actionsPayload });
  }
}

export const gatewayActionSocket = new GatewayActionSocket();
