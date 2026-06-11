import type { ClientToolResult } from "@/lib/client-side-tool/types";
import type { ActionDef, ExecutionContext, JSONSchema7 } from "@/lib/action-system/types";

const PAGE_NAMESPACE = "page";
const MAX_ACTIONS_PER_IFRAME = 50;
const MAX_SEGMENT_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SCHEMA_BYTES = 32 * 1024;
const DEFAULT_EXECUTE_TIMEOUT_MS = 30_000;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]+$/;

type TimeoutHandle = ReturnType<typeof setTimeout>;

interface PageActionMetadata {
  description: string;
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
}

interface PageActionsRegisterMessage {
  type: "viben-page-actions-register";
  request_id: string;
  namespace: string;
  actions: Record<string, PageActionMetadata>;
}

interface PageActionsUnregisterMessage {
  type: "viben-page-actions-unregister";
  request_id: string;
  namespace?: string;
}

interface PageActionResultMessage {
  type: "viben-page-action-result";
  request_id: string;
  result: ClientToolResult;
  diagnostic_error?: string;
}

interface PageActionApprovalRequestMessage {
  type: "viben-page-action-approval-request";
  request_id: string;
  execute_request_id: string;
  message: string;
  options?: Parameters<ExecutionContext["requireApproval"]>[1];
}

type PageMessage =
  | { type: "viben-page-ready" }
  | PageActionsRegisterMessage
  | PageActionsUnregisterMessage
  | PageActionResultMessage
  | PageActionApprovalRequestMessage;

interface PendingExecute {
  requestId: string;
  namespace: string;
  action: string;
  fullAction: string;
  context: ExecutionContext;
  timer: TimeoutHandle;
  resolve: (result: ClientToolResult) => void;
}

export interface PageActionBridgeOptions {
  iframe: HTMLIFrameElement;
  gatewayOrigin: string;
  workspacePath: string;
  workspaceId?: string | null;
  pageUid: string;
  theme: "light" | "dark";
  registerActions: (providerId: string, namespace: string, actions: ActionDef[]) => void;
  unregisterActions: (providerId: string) => void;
  addWindowMessageListener?: (handler: (event: MessageEvent) => void) => () => void;
  executeTimeoutMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export class PageActionBridge {
  private iframe: HTMLIFrameElement;
  private readonly gatewayOrigin: string;
  private readonly workspacePath: string;
  private readonly workspaceKey: string;
  private readonly pageUid: string;
  private readonly pageKey: string;
  private readonly registerActions: (providerId: string, namespace: string, actions: ActionDef[]) => void;
  private readonly unregisterActions: (providerId: string) => void;
  private readonly removeWindowMessageListener: () => void;
  private readonly executeTimeoutMs: number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly iframeInstanceId = createRequestId();
  private readonly iframeInstanceKey: string;
  private theme: "light" | "dark";
  private disposed = false;
  private registeredProviders = new Map<string, string>();
  private pendingExecutes = new Map<string, PendingExecute>();

  constructor(options: PageActionBridgeOptions) {
    this.iframe = options.iframe;
    this.gatewayOrigin = options.gatewayOrigin;
    this.workspacePath = options.workspacePath;
    this.workspaceKey = makeWorkspaceKey(options.workspaceId, options.workspacePath);
    this.pageUid = options.pageUid;
    this.pageKey = encodePageActionSegment(options.pageUid);
    this.theme = options.theme;
    this.registerActions = options.registerActions;
    this.unregisterActions = options.unregisterActions;
    this.executeTimeoutMs = options.executeTimeoutMs ?? DEFAULT_EXECUTE_TIMEOUT_MS;
    this.setTimeoutFn = options.setTimeoutFn ?? window.setTimeout.bind(window);
    this.clearTimeoutFn = options.clearTimeoutFn ?? window.clearTimeout.bind(window);
    this.iframeInstanceKey = encodePageActionSegment(this.iframeInstanceId).slice(0, 12);
    const addWindowMessageListener =
      options.addWindowMessageListener ??
      ((handler: (event: MessageEvent) => void) => {
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
      });
    this.removeWindowMessageListener = addWindowMessageListener((event) => this.handleMessage(event));
  }

  handleLoad(iframe: HTMLIFrameElement): void {
    this.cleanupProviders();
    this.cancelPending("page_action_cancelled");
    this.iframe = iframe;
  }

  sendInit(): void {
    this.postToIframe({
      type: "viben-page-init",
      theme: this.theme,
      workspace_path: this.workspacePath,
    });
  }

  updateTheme(theme: "light" | "dark"): void {
    this.theme = theme;
    this.postToIframe({ type: "viben-page-theme", theme });
  }

  dispose(reason = "page_action_unavailable"): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeWindowMessageListener();
    this.cleanupProviders();
    this.cancelPending(reason);
  }

  private handleMessage(event: MessageEvent): void {
    if (this.disposed) return;
    if (event.origin !== this.gatewayOrigin) return;
    if (event.source !== this.iframe.contentWindow) return;

    const data = event.data as PageMessage | undefined;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "viben-page-ready") {
      this.sendInit();
      return;
    }
    if (data.type === "viben-page-actions-register") {
      this.handleRegister(data);
      return;
    }
    if (data.type === "viben-page-actions-unregister") {
      this.handleUnregister(data);
      return;
    }
    if (data.type === "viben-page-action-result") {
      this.handleActionResult(data);
      return;
    }
    if (data.type === "viben-page-action-approval-request") {
      void this.handleApprovalRequest(data);
    }
  }

  private handleRegister(message: PageActionsRegisterMessage): void {
    const rejected: Array<{ action: string; reason: string }> = [];
    const accepted: string[] = [];

    if (!isValidSegment(message.namespace)) {
      this.postRegisterResult(message.request_id, [], [{ action: "*", reason: "invalid_namespace" }]);
      return;
    }

    const actionEntries = Object.entries(message.actions || {});
    const limitedEntries = actionEntries.slice(0, MAX_ACTIONS_PER_IFRAME);
    if (actionEntries.length > MAX_ACTIONS_PER_IFRAME) {
      rejected.push({ action: "*", reason: "too_many_actions" });
    }

    const defs: ActionDef[] = [];
    for (const [actionName, metadata] of limitedEntries) {
      const reason = validateActionMetadata(actionName, metadata);
      if (reason) {
        rejected.push({ action: actionName, reason });
        continue;
      }
      accepted.push(actionName);
      defs.push({
        name: this.buildShortName(message.namespace, actionName),
        description: metadata.description,
        input_schema: metadata.input_schema,
        output_schema: metadata.output_schema,
        execute: (payload, context) => this.executePageAction(message.namespace, actionName, payload, context),
      });
    }

    const providerId = this.providerIdFor(message.namespace);
    const existingProviderId = this.registeredProviders.get(message.namespace);
    if (existingProviderId) {
      this.unregisterActions(existingProviderId);
      this.registeredProviders.delete(message.namespace);
    }
    if (defs.length > 0) {
      this.registeredProviders.set(message.namespace, providerId);
      this.registerActions(providerId, PAGE_NAMESPACE, defs);
    }
    this.postRegisterResult(message.request_id, accepted, rejected);
  }

  private handleUnregister(message: PageActionsUnregisterMessage): void {
    if (message.namespace) {
      const providerId = this.registeredProviders.get(message.namespace);
      if (!providerId) return;
      this.unregisterActions(providerId);
      this.registeredProviders.delete(message.namespace);
      return;
    }
    this.cleanupProviders();
  }

  private executePageAction(
    namespace: string,
    action: string,
    payload: unknown,
    context: ExecutionContext
  ): Promise<ClientToolResult> {
    if (this.disposed || !this.iframe.contentWindow) {
      return Promise.resolve(errorResult("page_action_unavailable"));
    }

    const requestId = createRequestId();
    const fullAction = `${PAGE_NAMESPACE}.${this.buildShortName(namespace, action)}`;
    const timer = this.setTimeoutFn(() => {
      const pending = this.pendingExecutes.get(requestId);
      if (!pending) return;
      this.pendingExecutes.delete(requestId);
      this.postApprovalCancellations(requestId, "page_action_timeout");
      pending.resolve(errorResult("page_action_timeout: iframe action did not finish within timeout"));
    }, this.executeTimeoutMs);

    const promise = new Promise<ClientToolResult>((resolve) => {
      this.pendingExecutes.set(requestId, {
        requestId,
        namespace,
        action,
        fullAction,
        context,
        timer,
        resolve,
      });
    });

    this.postToIframe({
      type: "viben-page-action-execute",
      request_id: requestId,
      namespace,
      action,
      payload,
      context: {
        session_id: context.sessionId,
        tool_use_id: context.toolUseId,
        full_action: fullAction,
        page_uid: this.pageUid,
        workspace_path: this.workspacePath,
      },
    });

    return promise;
  }

  private handleActionResult(message: PageActionResultMessage): void {
    const pending = this.pendingExecutes.get(message.request_id);
    if (!pending) return;
    this.pendingExecutes.delete(message.request_id);
    this.clearTimeoutFn(pending.timer);
    pending.resolve(normalizeResult(message.result));
  }

  private async handleApprovalRequest(message: PageActionApprovalRequestMessage): Promise<void> {
    const pending = this.pendingExecutes.get(message.execute_request_id);
    if (!pending) return;

    try {
      const approved = await pending.context.requireApproval(message.message, message.options);
      if (!this.pendingExecutes.has(message.execute_request_id)) return;
      this.postToIframe({
        type: "viben-page-action-approval-result",
        request_id: message.request_id,
        execute_request_id: message.execute_request_id,
        approved: approved === true,
      });
    } catch (err) {
      if (!this.pendingExecutes.has(message.execute_request_id)) return;
      this.postToIframe({
        type: "viben-page-action-approval-result",
        request_id: message.request_id,
        execute_request_id: message.execute_request_id,
        approved: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private postRegisterResult(
    requestId: string,
    accepted: string[],
    rejected: Array<{ action: string; reason: string }>
  ): void {
    this.postToIframe({
      type: "viben-page-actions-register-result",
      request_id: requestId,
      accepted,
      rejected,
    });
  }

  private postToIframe(message: unknown): void {
    this.iframe.contentWindow?.postMessage(message, this.gatewayOrigin);
  }

  private buildShortName(namespace: string, action: string): string {
    return `${this.workspaceKey}.${this.pageKey}.${this.iframeInstanceKey}.${namespace}.${action}`;
  }

  private providerIdFor(namespace: string): string {
    return `page:${this.workspaceKey}:${this.pageKey}:${this.iframeInstanceId}:${namespace}`;
  }

  private cleanupProviders(): void {
    for (const providerId of this.registeredProviders.values()) {
      this.unregisterActions(providerId);
    }
    this.registeredProviders.clear();
  }

  private cancelPending(reason: string): void {
    for (const pending of this.pendingExecutes.values()) {
      this.clearTimeoutFn(pending.timer);
      this.postApprovalCancellations(pending.requestId, reason);
      pending.resolve(errorResult(reason));
    }
    this.pendingExecutes.clear();
  }

  private postApprovalCancellations(executeRequestId: string, reason: string): void {
    this.postToIframe({
      type: "viben-page-action-approval-result",
      request_id: `cancel_${executeRequestId}`,
      execute_request_id: executeRequestId,
      approved: false,
      error: reason,
    });
  }
}

export function createPageActionBridge(options: PageActionBridgeOptions): PageActionBridge {
  return new PageActionBridge(options);
}

export function encodePageActionSegment(value: string): string {
  if (!value) return "empty";
  var encoded = "";
  for (const char of value) {
    if (/^[a-zA-Z0-9_-]$/.test(char)) {
      encoded += char;
      continue;
    }
    const hex = char.codePointAt(0)?.toString(16).toUpperCase() ?? "0";
    encoded += `_${hex}`;
  }
  if (encoded.length <= MAX_SEGMENT_LENGTH) return encoded;
  return `${encoded.slice(0, MAX_SEGMENT_LENGTH - 9)}_${shortHash(value)}`;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function makeWorkspaceKey(workspaceId: string | null | undefined, workspacePath: string): string {
  if (workspaceId) return encodePageActionSegment(workspaceId);
  return `ws_${shortHash(workspacePath)}`;
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isValidSegment(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SEGMENT_LENGTH &&
    IDENTIFIER_PATTERN.test(value)
  );
}

function validateActionMetadata(actionName: string, metadata: PageActionMetadata): string | null {
  if (!isValidSegment(actionName)) return "invalid_action_name";
  if (!metadata || typeof metadata !== "object") return "invalid_action_metadata";
  if (typeof metadata.description !== "string" || metadata.description.length === 0) return "missing_description";
  if (metadata.description.length > MAX_DESCRIPTION_LENGTH) return "description_too_long";
  if (schemaByteLength(metadata.input_schema) > MAX_SCHEMA_BYTES) return "input_schema_too_large";
  if (schemaByteLength(metadata.output_schema) > MAX_SCHEMA_BYTES) return "output_schema_too_large";
  return null;
}

function schemaByteLength(schema: JSONSchema7 | undefined): number {
  if (!schema) return 0;
  try {
    return new TextEncoder().encode(JSON.stringify(schema)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeResult(result: ClientToolResult | undefined): ClientToolResult {
  if (result && Array.isArray(result.content)) {
    return {
      content: result.content,
      ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
      ...(result.isError === true ? { isError: true } : {}),
    };
  }
  return errorResult("page_action_invalid_result");
}

function errorResult(text: string): ClientToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}
