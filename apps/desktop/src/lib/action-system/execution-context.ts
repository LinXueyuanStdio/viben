import type { ExecutionContext, ApprovalOptions } from "./types";
import { UserCancelledException } from "./errors";

/**
 * Pending approval state. The action-executor component renders a dialog
 * when this is set, and resolves/rejects the promise accordingly.
 */
export interface PendingApproval {
  message: string;
  options?: ApprovalOptions;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
}

/** Module-level callback to show approval dialog. Set by the ApprovalDialog component. */
let approvalHandler: ((pending: PendingApproval) => void) | null = null;

/**
 * Register the approval dialog handler. Called once by the ApprovalDialog component on mount.
 */
export function setApprovalHandler(handler: (pending: PendingApproval) => void): void {
  approvalHandler = handler;
}

/**
 * Unregister the approval dialog handler. Called on unmount.
 */
export function clearApprovalHandler(): void {
  approvalHandler = null;
}

/**
 * Create an ExecutionContext for a given tool invocation.
 */
export function createExecutionContext(sessionId: string, toolUseId: string): ExecutionContext {
  return {
    sessionId,
    toolUseId,
    requireApproval: (message: string, options?: ApprovalOptions): Promise<boolean> => {
      const handler = approvalHandler;
      if (!handler) {
        return Promise.reject(new UserCancelledException("No approval dialog available"));
      }
      return new Promise<boolean>((resolve, reject) => {
        handler({ message, options, resolve, reject });
      });
    },
  };
}

/**
 * Request local approval using the module-level approvalHandler.
 * This is used when the gateway forwards an approval request to this client
 * and we need to show the local approval dialog.
 */
export function requestLocalApproval(message: string, options?: ApprovalOptions): Promise<boolean> {
  const handler = approvalHandler;
  if (!handler) {
    return Promise.reject(new UserCancelledException("No approval dialog available"));
  }
  return new Promise<boolean>((resolve, reject) => {
    handler({ message, options, resolve, reject });
  });
}

/**
 * Create an ExecutionContext for socket.io-dispatched action execution.
 * Uses a callback for approval that goes through the socket.io protocol.
 */
export function createSocketExecutionContext(
  sessionId: string,
  toolUseId: string,
  emitApprovalRequest: (message: string, options?: ApprovalOptions) => Promise<boolean>
): ExecutionContext {
  return {
    sessionId,
    toolUseId,
    requireApproval: emitApprovalRequest,
  };
}
