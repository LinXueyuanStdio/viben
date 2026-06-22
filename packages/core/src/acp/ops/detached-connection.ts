import type {
  AcpConnection,
  AcpPermissionMode,
  AcpRequestPermissionRequest,
  AcpRequestPermissionResponse,
  AcpSessionEvent,
  AcpSessionNotification,
} from "../types";
import {
  buildSelectedPermissionResponse,
  createDefaultPermissionHandler,
  type PermissionHandler,
} from "./permission-handler";
import type { AcpSessionEventRecorder } from "./session-event-recorder";

type PendingKind = "permission" | "client_tool";

interface PendingRequest<T> {
  kind: PendingKind;
  seq: number;
  params: unknown;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class DetachedConnection implements AcpConnection {
  private readonly pending = new Map<number, PendingRequest<unknown>>();
  private closed = false;

  constructor(
    private readonly recorder: AcpSessionEventRecorder,
    private readonly sessionId: string,
    private readonly permissionMode: AcpPermissionMode = "default",
    private readonly permissionHandler: PermissionHandler = createDefaultPermissionHandler(),
    private readonly clientToolTimeoutMs = 60_000
  ) {}

  async sessionUpdate(params: AcpSessionNotification): Promise<void> {
    await this.recorder.append({
      type: "session_update",
      ts: nowIso(),
      data: params,
    });
  }

  async requestPermission(params: AcpRequestPermissionRequest): Promise<AcpRequestPermissionResponse> {
    this.assertOpen();

    const response = await this.evaluatePermission(params);
    this.assertOpen();
    if (response) {
      await this.recorder.append({
        type: "permission_response",
        ts: nowIso(),
        data: response,
      });
      return response;
    }

    const seq = await this.recorder.append({
      type: "permission_request",
      ts: nowIso(),
      status: "pending",
      request_id: params.toolCall.toolCallId,
      data: params,
    });

    return await this.createPending<AcpRequestPermissionResponse>("permission", seq, params);
  }

  async requestClient(method: string, params?: Record<string, unknown>): Promise<unknown> {
    this.assertOpen();

    const seq = await this.recorder.append({
      type: "client_tool_call",
      ts: nowIso(),
      status: "pending",
      data: { method, params },
    });

    return await this.createPending("client_tool", seq, { method, params }, this.clientToolTimeoutMs);
  }

  async notifyClient(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.recorder.append({
      type: "notification",
      ts: nowIso(),
      data: { method, params },
    });
  }

  async resume(newConnection: AcpConnection): Promise<AcpSessionEvent[]> {
    const history = await this.recorder.loadHistory();
    const pendingRequests = [...this.pending.values()];

    pendingRequests.forEach((pending) => {
      this.drainPending(pending, newConnection);
    });

    return history;
  }

  async close(): Promise<void> {
    this.closed = true;
    const pendingRequests = [...this.pending.values()];
    await Promise.all(
      pendingRequests.map(async (pending) => {
        this.clearPending(pending);
        await this.recorder.updateStatus(pending.seq, "cancelled");
        pending.reject(new Error("Detached connection closed"));
      })
    );
  }

  private async evaluatePermission(
    params: AcpRequestPermissionRequest
  ): Promise<AcpRequestPermissionResponse | null> {
    if (this.permissionMode === "bypassPermissions") {
      return buildSelectedPermissionResponse(params);
    }

    const decision = await this.permissionHandler.evaluate(params, this.permissionMode);
    return decision.auto ? decision.response : null;
  }

  private async createPending<T>(
    kind: PendingKind,
    seq: number,
    params: unknown,
    timeoutMs?: number
  ): Promise<T> {
    if (this.closed) {
      await this.recorder.updateStatus(seq, "cancelled");
      throw new Error("Detached connection closed");
    }

    return await new Promise<T>((resolve, reject) => {
      const pending: PendingRequest<T> = {
        kind,
        seq,
        params,
        resolve,
        reject,
      };
      if (timeoutMs !== undefined) {
        pending.timer = setTimeout(() => {
          this.pending.delete(seq);
          this.recorder
            .updateStatus(seq, "abandoned")
            .catch(() => undefined)
            .finally(() => {
              reject(new Error("Client tool request timed out"));
            });
        }, timeoutMs);
      }
      this.pending.set(seq, pending as PendingRequest<unknown>);
    });
  }

  private drainPending(pending: PendingRequest<unknown>, newConnection: AcpConnection): void {
    const task = pending.kind === "permission"
      ? newConnection.requestPermission(pending.params as AcpRequestPermissionRequest)
      : this.requestClientOnConnection(newConnection, pending.params);

    task
      .then(async (response) => {
        this.clearPending(pending);
        await this.recorder.updateStatus(pending.seq, "resolved");
        pending.resolve(response);
      })
      .catch(async (error: unknown) => {
        this.clearPending(pending);
        await this.recorder.updateStatus(pending.seq, "cancelled");
        pending.reject(toError(error));
      });
  }

  private async requestClientOnConnection(newConnection: AcpConnection, params: unknown): Promise<unknown> {
    const record = params as { method: string; params?: Record<string, unknown> };
    return await newConnection.requestClient(record.method, record.params);
  }

  private clearPending(pending: PendingRequest<unknown>): void {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    this.pending.delete(pending.seq);
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Detached connection closed");
    }
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
