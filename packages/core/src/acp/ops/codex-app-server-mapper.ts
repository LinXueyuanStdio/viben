import type {
  PermissionOption,
  PlanEntryStatus,
  RequestPermissionResponse,
  StopReason,
  ToolCallContent,
  ToolCallStatus,
  ToolKind,
} from "@agentclientprotocol/sdk";
import type {
  AcpRequestPermissionRequest,
  AcpSessionNotification,
  AcpSessionUpdate,
  AcpTextContent,
} from "../types";
import type {
  CodexNotification,
  CodexServerRequest,
  CodexTurn,
} from "./codex-app-server-protocol";
import {
  asRecord,
  readNumber,
  readString,
} from "./codex-app-server-protocol";

const DEFAULT_APPROVAL_OPTIONS: PermissionOption[] = [
  { optionId: "accept", name: "Accept", kind: "allow_once" },
  { optionId: "acceptForSession", name: "Accept for session", kind: "allow_always" },
  { optionId: "decline", name: "Decline", kind: "reject_once" },
  { optionId: "cancel", name: "Cancel", kind: "reject_always" },
];

export function codexNotificationToAcpSessionUpdate(
  sessionId: string,
  notification: CodexNotification
): AcpSessionNotification | null {
  const params = asRecord(notification.params);
  switch (notification.method) {
    case "error":
      return errorUpdate(sessionId, params);
    case "item/agentMessage/delta":
      return contentChunk(sessionId, "agent_message_chunk", deltaText(params), itemId(params));
    case "item/reasoning/summaryTextDelta":
    case "item/reasoning/textDelta":
      return contentChunk(sessionId, "agent_thought_chunk", deltaText(params), itemId(params));
    case "item/plan/delta":
      return contentChunk(sessionId, "agent_thought_chunk", deltaText(params), itemId(params));
    case "turn/plan/updated":
      return planUpdate(sessionId, params);
    case "thread/tokenUsage/updated":
      return usageUpdate(sessionId, params);
    case "item/started":
      return itemStartedUpdate(sessionId, asRecord(params.item), notification);
    case "item/completed":
      return itemCompletedUpdate(sessionId, asRecord(params.item), notification);
    case "item/commandExecution/outputDelta":
      return toolDeltaUpdate(sessionId, params, "Command output");
    case "item/fileChange/outputDelta":
      return fileChangeDeltaUpdate(sessionId, params);
    case "turn/diff/updated":
      return diffUpdate(sessionId, params);
    case "turn/started":
    case "turn/completed":
    case "thread/status/changed":
      return null;
    default:
      return unknownEventUpdate(sessionId, notification);
  }
}

export function codexApprovalRequestToAcpPermission(
  sessionId: string,
  request: CodexServerRequest
): AcpRequestPermissionRequest {
  const params = asRecord(request.params);
  const itemIdValue = readString(params.itemId) ?? String(request.id);
  const isFileChange = request.method === "item/fileChange/requestApproval";
  const rawInput = approvalRawInput(params, isFileChange);
  return {
    sessionId,
    toolCall: {
      toolCallId: itemIdValue,
      title: isFileChange ? "Apply file changes" : "Run command",
      kind: isFileChange ? "edit" : "execute",
      rawInput,
    },
    options: approvalOptions(params.availableDecisions),
  };
}

export function codexApprovalDecisionFromAcp(response: RequestPermissionResponse): { decision: string } {
  if (response.outcome.outcome === "cancelled") {
    return { decision: "cancel" };
  }
  return { decision: normalizeCodexApprovalDecision(response.outcome.optionId) };
}

export function codexTurnToStopReason(turn: CodexTurn): StopReason | null {
  switch (turn.status) {
    case "completed":
      return "end_turn";
    case "interrupted":
      return "cancelled";
    case "failed":
      return null;
    default:
      return null;
  }
}

export function codexTurnFailureMessage(turn: CodexTurn): string {
  const error = asRecord(turn.error);
  return readString(error.message) ?? `Codex turn ${turn.id} failed`;
}

function contentChunk(
  sessionId: string,
  sessionUpdate: "agent_message_chunk" | "agent_thought_chunk",
  text: string,
  messageId?: string
): AcpSessionNotification {
  return {
    sessionId,
    update: {
      sessionUpdate,
      ...(messageId ? { messageId } : {}),
      content: textContent(text),
    },
  };
}

function planUpdate(sessionId: string, params: Record<string, unknown>): AcpSessionNotification {
  const plan = Array.isArray(params.plan) ? params.plan : [];
  return {
    sessionId,
    update: {
      sessionUpdate: "plan",
      entries: plan.flatMap((entry) => {
        const record = asRecord(entry);
        const content = readString(record.step) ?? readString(record.content) ?? readString(record.text);
        if (!content) return [];
        return [{
          content,
          priority: "medium" as const,
          status: normalizePlanStatus(readString(record.status)),
        }];
      }),
    },
  };
}

function usageUpdate(sessionId: string, params: Record<string, unknown>): AcpSessionNotification {
  const usage = asRecord(params.usage);
  const tokenUsage = asRecord(params.tokenUsage);
  const total = asRecord(tokenUsage.total);
  return {
    sessionId,
    update: {
      sessionUpdate: "usage_update",
      used: readNumber(usage.used)
        ?? readNumber(total.totalTokens)
        ?? readNumber(params.tokensUsed)
        ?? 0,
      size: readNumber(usage.size)
        ?? readNumber(tokenUsage.modelContextWindow)
        ?? readNumber(params.contextWindow)
        ?? 0,
      inputTokens: readNumber(usage.inputTokens)
        ?? readNumber(total.inputTokens)
        ?? readNumber(params.inputTokens),
      outputTokens: readNumber(usage.outputTokens)
        ?? readNumber(total.outputTokens)
        ?? readNumber(params.outputTokens),
      totalTokens: readNumber(usage.totalTokens)
        ?? readNumber(total.totalTokens)
        ?? readNumber(params.totalTokens),
    },
  } as AcpSessionNotification;
}

function itemStartedUpdate(
  sessionId: string,
  item: Record<string, unknown>,
  notification: CodexNotification
): AcpSessionNotification | null {
  const id = readString(item.id);
  const type = readString(item.type);
  if (!id || !type) return unknownEventUpdate(sessionId, notification);
  const tool = toolInfo(item);
  if (!tool) return null;
  return {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId: id,
      title: tool.title,
      kind: tool.kind,
      status: "in_progress",
      rawInput: tool.rawInput,
    },
  };
}

function itemCompletedUpdate(
  sessionId: string,
  item: Record<string, unknown>,
  notification: CodexNotification
): AcpSessionNotification | null {
  const id = readString(item.id);
  const type = readString(item.type);
  if (id && type === "agentMessage") {
    return null;
  }
  if (id && type === "reasoning") {
    const text = reasoningText(item);
    return contentChunk(sessionId, "agent_thought_chunk", text, id);
  }
  if (id && type === "plan") {
    const text = readString(item.text) ?? stableJson(item);
    return contentChunk(sessionId, "agent_thought_chunk", text, id);
  }
  if (id && type === "exitedReviewMode") {
    const text = readString(item.review) ?? stableJson(item);
    return contentChunk(sessionId, "agent_message_chunk", text, id);
  }
  const tool = toolInfo(item);
  if (!id || !type || !tool) {
    return unknownItemUpdate(sessionId, item, notification);
  }

  const output = toolOutput(item);
  const update: Extract<AcpSessionUpdate, { sessionUpdate: "tool_call_update" }> = {
    sessionUpdate: "tool_call_update",
    toolCallId: id,
    title: tool.title,
    kind: tool.kind,
    status: normalizeToolStatus(readString(item.status), output.isError),
    rawInput: tool.rawInput,
    rawOutput: output.rawOutput,
    content: type === "fileChange" ? fileChangeContent(item) : output.text ? [toolTextContent(output.text)] : [],
  };
  return { sessionId, update };
}

function toolDeltaUpdate(
  sessionId: string,
  params: Record<string, unknown>,
  fallbackTitle: string
): AcpSessionNotification | null {
  const toolCallId = readString(params.itemId) ?? readString(params.toolCallId);
  if (!toolCallId) return null;
  const text = deltaText(params);
  return {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      title: fallbackTitle,
      kind: "execute",
      rawOutput: text,
      content: text ? [toolTextContent(text)] : [],
    },
  };
}

function fileChangeDeltaUpdate(sessionId: string, params: Record<string, unknown>): AcpSessionNotification | null {
  const toolCallId = readString(params.itemId) ?? readString(params.toolCallId);
  if (!toolCallId) return null;
  const text = deltaText(params);
  return {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      title: "File changes",
      kind: "edit",
      rawOutput: text,
      content: text ? [toolTextContent(text)] : [],
    },
  };
}

function diffUpdate(sessionId: string, params: Record<string, unknown>): AcpSessionNotification | null {
  const turnId = readString(params.turnId);
  const diff = readString(params.diff);
  if (!turnId || !diff) return null;
  return {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId: `diff-${turnId}`,
      title: "File changes",
      kind: "edit",
      status: "in_progress",
      content: [{ type: "diff", path: "", oldText: "", newText: diff }],
      rawOutput: diff,
    },
  };
}

function unknownEventUpdate(sessionId: string, notification: CodexNotification): AcpSessionNotification {
  return {
    sessionId,
    update: {
      sessionUpdate: "current_mode_update",
      currentModeId: codexEventTitle(notification.method),
      _meta: {
        source: "codex_app_server",
        method: notification.method,
        rawEvent: notification,
      },
    } as Extract<AcpSessionUpdate, { sessionUpdate: "current_mode_update" }>,
  };
}

function unknownItemUpdate(
  sessionId: string,
  item: Record<string, unknown>,
  notification: CodexNotification
): AcpSessionNotification {
  const itemType = readString(item.type);
  const itemIdValue = readString(item.id);
  const update: Extract<AcpSessionUpdate, { sessionUpdate: "codex_item" }> = {
    sessionUpdate: "codex_item",
    ...(itemIdValue ? { itemId: itemIdValue } : {}),
    ...(itemType ? { itemType } : {}),
    title: itemType ?? notification.method,
    content: textContent(stableJson(item)),
    rawItem: item,
  };
  return { sessionId, update };
}

function toolInfo(item: Record<string, unknown>): { title: string; kind: ToolKind; rawInput: unknown } | null {
  const type = readString(item.type);
  switch (type) {
    case "commandExecution":
      return {
        title: "Command",
        kind: "execute",
        rawInput: { command: item.command, cwd: item.cwd },
      };
    case "fileChange":
      return {
        title: "File changes",
        kind: "edit",
        rawInput: { changes: item.changes },
      };
    case "mcpToolCall":
      return {
        title: readString(item.tool) ?? "MCP tool",
        kind: "other",
        rawInput: item.arguments,
      };
    case "dynamicToolCall":
      return {
        title: readString(item.tool) ?? "Dynamic tool",
        kind: "other",
        rawInput: item.arguments,
      };
    case "collabToolCall":
      return {
        title: readString(item.tool) ?? "Collaboration",
        kind: "other",
        rawInput: item.prompt ?? item,
      };
    case "webSearch":
      return {
        title: "Web search",
        kind: "fetch",
        rawInput: item.action ?? item.query,
      };
    case "imageView":
      return {
        title: "View image",
        kind: "read",
        rawInput: { path: item.path },
      };
    default:
      return null;
  }
}

function toolOutput(item: Record<string, unknown>): { text: string; rawOutput: unknown; isError: boolean } {
  if (readString(item.type) === "fileChange") {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    return {
      text: "",
      rawOutput: changes,
      isError: readString(item.status) === "failed",
    };
  }
  const error = item.error;
  const rawOutput = item.aggregatedOutput ?? item.result ?? item.contentItems ?? item.review ?? item;
  const text = typeof rawOutput === "string" ? rawOutput : stableJson(rawOutput);
  return {
    text,
    rawOutput,
    isError: error !== undefined || readString(item.status) === "failed",
  };
}

function toolTextContent(text: string): ToolCallContent {
  return {
    type: "content",
    content: textContent(text),
  };
}

function fileChangeContent(item: Record<string, unknown>): ToolCallContent[] {
  const changes = Array.isArray(item.changes) ? item.changes : [];
  return changes.flatMap((change) => {
    const record = asRecord(change);
    const path = readString(record.path);
    const diff = readString(record.diff);
    if (!path || !diff) return [];
    return [{
      type: "diff" as const,
      path,
      oldText: "",
      newText: diff,
    }];
  });
}

function reasoningText(item: Record<string, unknown>): string {
  return textParts(item.summary).join("\n") || textParts(item.content).join("\n") || readString(item.text) || "";
}

function textParts(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((part) => {
    if (typeof part === "string") return part ? [part] : [];
    const record = asRecord(part);
    const text = readString(record.text) ?? readString(record.summary) ?? readString(record.content);
    return text ? [text] : [];
  });
}

function errorUpdate(sessionId: string, params: Record<string, unknown>): AcpSessionNotification {
  const error = asRecord(params.error);
  return {
    sessionId,
    update: {
      sessionUpdate: "error",
      error: {
        message: readString(error.message) ?? readString(params.message) ?? "Codex app-server error",
        raw: Object.keys(error).length > 0 ? error : params,
      },
    },
  };
}

function codexEventTitle(method: string): string {
  switch (method) {
    case "thread/started":
      return "Codex thread started";
    case "thread/archived":
      return "Codex thread archived";
    case "thread/unarchived":
      return "Codex thread restored";
    case "thread/deleted":
      return "Codex thread deleted";
    case "thread/closed":
      return "Codex thread closed";
    case "item/reasoning/summaryPartAdded":
      return "Codex reasoning updated";
    default:
      return `Codex ${method}`;
  }
}

function textContent(text: string): AcpTextContent {
  return { type: "text", text };
}

function deltaText(params: Record<string, unknown>): string {
  return readString(params.delta)
    ?? readString(params.text)
    ?? readString(params.output)
    ?? "";
}

function itemId(params: Record<string, unknown>): string | undefined {
  return readString(params.itemId) ?? readString(params.id);
}

function normalizePlanStatus(status: string | undefined): PlanEntryStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "inProgress":
    case "in_progress":
      return "in_progress";
    default:
      return "pending";
  }
}

function normalizeToolStatus(status: string | undefined, isError: boolean): ToolCallStatus {
  if (isError) return "failed";
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
    case "declined":
      return "failed";
    case "pending":
      return "pending";
    default:
      return "in_progress";
  }
}

function approvalRawInput(params: Record<string, unknown>, isFileChange: boolean): Record<string, unknown> {
  if (isFileChange) {
    return {
      reason: params.reason,
      grantRoot: params.grantRoot,
    };
  }
  return {
    reason: params.reason,
    command: params.command,
    cwd: params.cwd,
    commandActions: params.commandActions,
    proposedExecpolicyAmendment: params.proposedExecpolicyAmendment,
    networkApprovalContext: params.networkApprovalContext,
  };
}

function approvalOptions(value: unknown): PermissionOption[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_APPROVAL_OPTIONS;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((decision) => {
      const normalized = normalizeCodexApprovalDecision(decision);
      return {
        optionId: normalized,
        name: approvalName(normalized),
        kind: approvalKind(normalized),
      };
    });
}

function normalizeCodexApprovalDecision(optionId: string): string {
  switch (optionId) {
    case "allow_once":
    case "accept_once":
    case "accept":
      return "accept";
    case "allow_always":
    case "accept_always":
    case "acceptForSession":
      return "acceptForSession";
    case "reject_once":
    case "decline":
      return "decline";
    case "reject_always":
    case "cancel":
    case "cancelled":
      return "cancel";
    default:
      return optionId;
  }
}

function approvalName(decision: string): string {
  switch (decision) {
    case "accept":
      return "Accept";
    case "acceptForSession":
      return "Accept for session";
    case "decline":
      return "Decline";
    case "cancel":
      return "Cancel";
    default:
      return decision;
  }
}

function approvalKind(decision: string): PermissionOption["kind"] {
  switch (decision) {
    case "accept":
      return "allow_once";
    case "acceptForSession":
      return "allow_always";
    case "decline":
      return "reject_once";
    default:
      return "reject_always";
  }
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
