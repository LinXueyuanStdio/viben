export type CodexJsonRpcId = string | number;

export interface CodexJsonRpcRequest {
  id: CodexJsonRpcId;
  method: string;
  params?: unknown;
}

export interface CodexJsonRpcNotification {
  method: string;
  params?: unknown;
}

export interface CodexJsonRpcSuccess {
  id: CodexJsonRpcId;
  result: unknown;
}

export interface CodexJsonRpcFailure {
  id: CodexJsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type CodexJsonRpcMessage =
  | CodexJsonRpcRequest
  | CodexJsonRpcNotification
  | CodexJsonRpcSuccess
  | CodexJsonRpcFailure;

export interface CodexThread {
  id: string;
  sessionId?: string;
  name?: string | null;
  preview?: string;
  ephemeral?: boolean;
  modelProvider?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface CodexTurn {
  id: string;
  status?: "inProgress" | "completed" | "interrupted" | "failed" | string;
  error?: {
    message?: string;
    codexErrorInfo?: unknown;
    additionalDetails?: unknown;
  } | null;
  [key: string]: unknown;
}

export interface CodexThreadResult {
  thread: CodexThread;
}

export interface CodexTurnResult {
  turn: CodexTurn;
}

export interface CodexInputTextItem {
  type: "text";
  text: string;
}

export interface CodexInputImageItem {
  type: "image" | "localImage";
  url?: string;
  path?: string;
}

export type CodexInputItem = CodexInputTextItem | CodexInputImageItem;

export interface CodexNotification {
  method: string;
  params?: Record<string, unknown>;
}

export interface CodexServerRequest {
  id: CodexJsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function isCodexSuccess(message: CodexJsonRpcMessage): message is CodexJsonRpcSuccess {
  return "id" in message && "result" in message;
}

export function isCodexFailure(message: CodexJsonRpcMessage): message is CodexJsonRpcFailure {
  return "id" in message && "error" in message;
}

export function isCodexServerRequest(message: CodexJsonRpcMessage): message is CodexServerRequest {
  return "id" in message && "method" in message && typeof message.method === "string";
}

export function isCodexNotification(message: CodexJsonRpcMessage): message is CodexNotification {
  return !("id" in message) && "method" in message && typeof message.method === "string";
}

export function expectThreadResult(result: unknown): CodexThreadResult {
  const record = asRecord(result);
  const thread = asRecord(record.thread);
  const id = readString(thread.id);
  if (!id) {
    throw new Error("Codex app-server response did not include thread.id");
  }
  return { thread: { ...thread, id } };
}

export function expectTurnResult(result: unknown): CodexTurnResult {
  const record = asRecord(result);
  const turn = asRecord(record.turn);
  const id = readString(turn.id);
  if (!id) {
    throw new Error("Codex app-server response did not include turn.id");
  }
  return { turn: { ...turn, id } };
}
