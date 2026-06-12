import { io, type Socket } from "socket.io-client";
import * as ed from "@noble/ed25519";
import { useActionStore } from "@/stores/action-store";
import { executeGUIAction } from "./action-executor";
import { executeBuiltin } from "./builtins";
import { getRegistrableBuiltins } from "./builtins";
import { createSocketExecutionContext, requestLocalApproval } from "./execution-context";
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
const APPROVAL_TIMEOUT_MS = 30000;

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
    this.socket.on(
      "action:approval:request",
      (data: {
        requestId: string;
        executeRequestId: string;
        message: string;
        options?: { timeout?: number; title?: string; description?: string; confirmLabel?: string; cancelLabel?: string };
      }) => {
        void this.handleIncomingApprovalRequest(data);
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
    const { requestId, action, payload, context } = data;
    let result: ClientToolResult;

    try {
      const ctx = createSocketExecutionContext(
        context.sessionId,
        context.toolUseId,
        (message, options) => this.emitApprovalRequest(requestId, message, options)
      );

      if (action === "read_window" || action === "navigate_to") {
        const builtinResult = await executeBuiltin(action, payload ?? {}, ctx);
        result = builtinResult ?? {
          content: [{ type: "text", text: `Builtin "${action}" returned null` }],
          isError: true,
        };
      } else {
        // Find the action in local store by name (across all providers)
        const localAction = this.findLocalAction(action);
        if (localAction) {
          result = await executeGUIAction({ action: localAction, payload }, ctx);
        } else {
          result = {
            content: [{ type: "text", text: `Action not found locally: ${action}` }],
            isError: true,
          };
        }
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

  private findLocalAction(actionName: string): string | undefined {
    const state = useActionStore.getState();
    // actionName might be "presentation.spotlight" (sub-namespace.name) or "read_window" (flat builtin)
    // Try exact match as provider_namespace.action_name first
    const dotIdx = actionName.indexOf(".");
    if (dotIdx > 0) {
      const subNs = actionName.slice(0, dotIdx);
      const name = actionName.slice(dotIdx + 1);
      for (const provider of state.registry.values()) {
        if (provider.namespace === subNs) {
          const found = provider.actions.find(a => a.name === name);
          if (found) return `${provider.namespace}.${found.name}`;
        }
      }
    }
    // Fallback: search by bare name across all providers
    for (const provider of state.registry.values()) {
      const found = provider.actions.find(a => a.name === actionName);
      if (found) return `${provider.namespace}.${found.name}`;
    }
    return undefined;
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

      const timer = setTimeout(() => {
        const pending = this.pendingApprovals.get(requestId);
        if (pending) {
          this.pendingApprovals.delete(requestId);
          pending.reject(new UserCancelledException("Approval timeout"));
        }
      }, APPROVAL_TIMEOUT_MS);

      this.pendingApprovals.set(requestId, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      this.socket.emit("action:approval:request", {
        requestId,
        executeRequestId,
        message,
        options: options ? { timeout: APPROVAL_TIMEOUT_MS, ...options } : { timeout: APPROVAL_TIMEOUT_MS },
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

  private async handleIncomingApprovalRequest(data: {
    requestId: string;
    executeRequestId: string;
    message: string;
    options?: { timeout?: number; title?: string; description?: string; confirmLabel?: string; cancelLabel?: string };
  }): Promise<void> {
    try {
      const approvalOptions: ApprovalOptions | undefined = data.options
        ? {
            title: data.options.title,
            description: data.options.description,
            confirmLabel: data.options.confirmLabel,
            cancelLabel: data.options.cancelLabel,
          }
        : undefined;
      const approved = await requestLocalApproval(data.message, approvalOptions);
      this.socket?.emit("action:approval:response", {
        requestId: data.requestId,
        approved,
      });
    } catch (err) {
      this.socket?.emit("action:approval:response", {
        requestId: data.requestId,
        approved: false,
        error: err instanceof UserCancelledException ? err.message : String(err),
      });
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
    // Flatten all actions under desktop_main namespace.
    // Non-builtin providers prefix their original namespace into the action name:
    //   presentation.spotlight, test.hello (while builtins stay flat: read_window)
    const flat = new Map<string, ActionMeta>();

    // Sort providers by registration time (most recent first for priority)
    const providers = [...registry.values()].sort((a, b) => {
      const aReg = a.registeredAt ?? 0;
      const bReg = b.registeredAt ?? 0;
      return bReg - aReg;
    });

    for (const provider of providers) {
      const isBuiltin = provider.namespace === DESKTOP_MAIN_NAMESPACE;
      for (const action of provider.actions) {
        const name = isBuiltin ? action.name : `${provider.namespace}.${action.name}`;
        if (!flat.has(name)) {
          flat.set(name, {
            description: action.description,
            inputSchema: action.input_schema,
            outputSchema: action.output_schema,
          });
        }
      }
    }

    const grouped = new Map<string, Map<string, ActionMeta>>();
    grouped.set(DESKTOP_MAIN_NAMESPACE, flat);
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

  async queryRemoteActions(): Promise<Array<{ namespace: string; name: string; description: string }>> {
    if (!this.socket || this._state !== "connected") {
      return [];
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve([]), 5000);
      this.socket!.emit("action:list", {}, (response: { actions: Array<{ namespace: string; name: string; description: string }> }) => {
        clearTimeout(timeout);
        resolve(response.actions ?? []);
      });
    });
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

export function queryRemoteActions(): Promise<Array<{ namespace: string; name: string; description: string }>> {
  return gatewayActionSocket.queryRemoteActions();
}
