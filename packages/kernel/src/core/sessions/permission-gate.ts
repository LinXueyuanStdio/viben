import type { PermissionRequest } from "../types.js";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Blocks the prompt pipeline until the user approves or denies a permission request.
 *
 * When an agent requests permission (e.g., to run a shell command), AgentInstance
 * calls its `onPermissionRequest` callback. SessionBridge handles this by calling
 * `setPending()`, which returns a promise that blocks the ACP prompt/response cycle
 * until `resolve()` or `reject()` is called. If the user doesn't respond within
 * the timeout, the request is automatically rejected.
 *
 * Only one permission request can be pending at a time — setting a new one
 * supersedes (rejects) the previous.
 *
 * When `bypassPermissions` is enabled on the session, SessionBridge short-circuits
 * this gate entirely: `setPending()` is never called, and permissions are auto-approved
 * upstream before the request reaches this class.
 */
export class PermissionGate {
  private request?: PermissionRequest;
  private resolveFn?: (optionId: string) => void;
  private rejectFn?: (reason: Error) => void;
  private settled = false;
  private timeoutTimer?: ReturnType<typeof setTimeout>;
  private timeoutMs: number;

  constructor(timeoutMs?: number) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Register a new permission request and return a promise that resolves with the
   * chosen option ID when the user responds, or rejects on timeout / supersession.
   */
  setPending(request: PermissionRequest): Promise<string> {
    // Reject any existing pending promise so callers don't hang forever
    if (!this.settled && this.rejectFn) {
      this.rejectFn(new Error("Superseded by new permission request"));
    }
    this.request = request;
    this.settled = false;
    this.clearTimeout();

    return new Promise<string>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;

      this.timeoutTimer = setTimeout(() => {
        this.reject("Permission request timed out (no response received)");
      }, this.timeoutMs);
      // unref() prevents the timeout from keeping the process alive during shutdown
      if (typeof this.timeoutTimer === 'object' && 'unref' in this.timeoutTimer) {
        (this.timeoutTimer as NodeJS.Timeout).unref();
      }
    });
  }

  /** Approve the pending request with the given option ID. No-op if already settled. */
  resolve(optionId: string): void {
    if (this.settled || !this.resolveFn) return;
    this.settled = true;
    this.clearTimeout();
    this.resolveFn(optionId);
    this.cleanup();
  }

  /** Deny the pending request. No-op if already settled. */
  reject(reason?: string): void {
    if (this.settled || !this.rejectFn) return;
    this.settled = true;
    this.clearTimeout();
    this.rejectFn(new Error(reason ?? "Permission rejected"));
    this.cleanup();
  }

  get isPending(): boolean {
    return !!this.request && !this.settled;
  }

  get currentRequest(): PermissionRequest | undefined {
    return this.isPending ? this.request : undefined;
  }

  /** The request ID of the current pending request, undefined after settlement */
  get requestId(): string | undefined {
    return this.request?.id;
  }

  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
  }

  private cleanup(): void {
    this.request = undefined;
    this.resolveFn = undefined;
    this.rejectFn = undefined;
  }
}
