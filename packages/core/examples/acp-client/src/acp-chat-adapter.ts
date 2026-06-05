import type { AgentMessage, TaskPlan, TaskPlanStep } from "@viben/chat";
import type {
  AcpSessionUpdate,
  CallToolResult,
  ClientToolCall,
  ClientToolExecutionRequest,
  ElicitationRequestLog,
  PermissionRequestLog,
} from "./acp-client";

export type AcpUiStep = AgentMessage;

export function appendUserPromptStep(current: AcpUiStep[], content: string): AcpUiStep[] {
  return appendStep(current, {
    id: createStepId("user"),
    type: "user",
    content,
    timestamp: Date.now(),
  });
}

export function appendSystemStep(current: AcpUiStep[], content: string): AcpUiStep[] {
  return appendStep(current, {
    id: createStepId("system"),
    type: "text",
    content,
    timestamp: Date.now(),
  });
}

export function applyAcpSessionUpdateStep(current: AcpUiStep[], notification: AcpSessionUpdate): AcpUiStep[] {
  const update = notification.update;
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return appendTextChunk(current, "text", contentBlockToText(update.content));
    case "agent_thought_chunk":
      return appendTextChunk(current, "thinking", contentBlockToText(update.content));
    case "tool_call":
      return upsertToolUse(current, {
        id: typeof update.toolCallId === "string" ? update.toolCallId : createStepId("tool"),
        type: "tool_use",
        name: normalizeToolName(update.title),
        toolUseId: update.toolCallId,
        input: normalizeToolInput(update.rawInput),
        timestamp: Date.now(),
      });
    case "tool_call_update":
      return upsertToolResult(current, {
        id: createStepId("tool-result"),
        type: "tool_result",
        toolUseId: update.toolCallId,
        output: toolUpdateOutput(update),
        isError: update.status === "failed" || update.status === "error",
        timestamp: Date.now(),
      });
    case "plan": {
      const plan = updateToPlan(update);
      return plan ? appendStep(current, { id: plan.id ?? createStepId("plan"), type: "plan", plan, timestamp: Date.now() }) : current;
    }
    case "session_info_update": {
      const sdkSessionId = readString(update.sessionId) ?? readMetaString(update._meta, "sessionId");
      return sdkSessionId ? appendSystemStep(current, `Backend session: ${sdkSessionId}`) : current;
    }
    case "usage_update":
      return appendSystemStep(current, `Usage update: ${safeJson(update)}`);
    case "error":
      return appendStep(current, {
        id: createStepId("error"),
        type: "error",
        message: diagnosticToText(update.error),
        isError: true,
        timestamp: Date.now(),
      });
    default:
      return appendSystemStep(current, `ACP update: ${safeJson(update)}`);
  }
}

export function appendClientToolRequestedStep(
  current: AcpUiStep[],
  request: ClientToolExecutionRequest
): AcpUiStep[] {
  return upsertToolUse(current, {
    id: request.toolUseId,
    type: "tool_use",
    name: request.toolName,
    toolUseId: request.toolUseId,
    input: normalizeToolInput(request.input),
    timestamp: Date.now(),
  });
}

export function appendClientToolResultStep(current: AcpUiStep[], call: ClientToolCall): AcpUiStep[] {
  if (isRecord(call.result) && call.result.pending === true) {
    return appendClientToolRequestedStep(current, {
      sessionId: call.sessionId,
      toolName: call.toolName,
      toolUseId: call.toolUseId,
      input: call.input,
    });
  }
  return upsertToolResult(current, {
    id: createStepId("client-tool-result"),
    type: "tool_result",
    toolUseId: call.toolUseId,
    output: callToolResultToOutput(call.result),
    isError: isCallToolError(call.result),
    timestamp: Date.now(),
  });
}

export function appendPermissionDecisionStep(current: AcpUiStep[], request: PermissionRequestLog): AcpUiStep[] {
  return upsertToolResult(current, {
    id: createStepId("permission"),
    type: "tool_result",
    toolUseId: request.toolCallId,
    output: `Permission decision: ${request.selectedOptionId}`,
    isError: request.selectedOptionId === "cancelled" || request.selectedOptionId.toLowerCase().includes("reject"),
    timestamp: Date.now(),
  });
}

export function appendElicitationResultStep(current: AcpUiStep[], request: ElicitationRequestLog): AcpUiStep[] {
  return appendStep(current, {
    id: request.id,
    type: "text",
    content: `Elicitation response: ${safeJson(request.action)}`,
    timestamp: Date.now(),
  });
}

function appendStep(current: AcpUiStep[], step: AcpUiStep): AcpUiStep[] {
  return [...current, step];
}

function appendTextChunk(current: AcpUiStep[], type: "text" | "thinking", text: string): AcpUiStep[] {
  if (!text) return current;
  const previous = current[current.length - 1];
  if (previous?.type === type && previous.content !== undefined) {
    return [
      ...current.slice(0, -1),
      {
        ...previous,
        content: `${previous.content}${text}`,
      },
    ];
  }
  return appendStep(current, {
    id: createStepId(type),
    type,
    content: text,
    timestamp: Date.now(),
  });
}

function upsertToolUse(current: AcpUiStep[], toolUse: AcpUiStep): AcpUiStep[] {
  if (!toolUse.toolUseId) return appendStep(current, toolUse);
  const existingIndex = current.findIndex((step) => step.type === "tool_use" && step.toolUseId === toolUse.toolUseId);
  if (existingIndex === -1) return appendStep(current, toolUse);
  return current.map((step, index) => (index === existingIndex ? { ...step, ...toolUse } : step));
}

function upsertToolResult(current: AcpUiStep[], toolResult: AcpUiStep): AcpUiStep[] {
  if (!toolResult.toolUseId) return appendStep(current, toolResult);
  const existingIndex = current.findIndex((step) => step.type === "tool_result" && step.toolUseId === toolResult.toolUseId);
  if (existingIndex === -1) return appendStep(current, toolResult);
  return current.map((step, index) => (index === existingIndex ? { ...step, ...toolResult } : step));
}

function updateToPlan(update: Record<string, unknown>): TaskPlan | null {
  const entries = Array.isArray(update.entries) ? update.entries : [];
  const steps: TaskPlanStep[] = entries.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const description = readString(entry.content) ?? readString(entry.description);
    if (!description) return [];
    return [{
      id: readString(entry.id) ?? `step-${index + 1}`,
      description,
      status: normalizePlanStepStatus(readString(entry.status)),
    }];
  });
  const goal = readString(update.goal) ?? readString(update.title) ?? "ACP plan";
  if (steps.length === 0 && !goal) return null;
  return {
    id: readString(update.planId) ?? readString(update.id),
    goal,
    steps,
    notes: readString(update.notes),
  };
}

function normalizePlanStepStatus(status: string | undefined): TaskPlanStep["status"] {
  switch (status) {
    case "in_progress":
    case "completed":
    case "failed":
    case "cancelled":
      return status;
    default:
      return "pending";
  }
}

function normalizeToolName(title: unknown): string {
  return typeof title === "string" && title.trim() ? title : "ACP tool";
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  return isRecord(input) ? input : { value: input ?? null };
}

function contentBlockToText(content: unknown): string {
  if (isRecord(content) && content.type === "text" && typeof content.text === "string") {
    return content.text;
  }
  if (content === undefined || content === null) return "";
  return safeJson(content);
}

function toolUpdateOutput(update: Record<string, unknown>): string {
  if (typeof update.rawOutput === "string") return update.rawOutput;
  if (update.rawOutput !== undefined) return safeJson(update.rawOutput);
  if (Array.isArray(update.content)) return safeJson(update.content);
  if (typeof update.status === "string") return update.status;
  return safeJson(update);
}

function callToolResultToOutput(result: unknown): string {
  if (!isRecord(result)) return diagnosticToText(result);
  const content = result.content;
  if (!Array.isArray(content)) return safeJson(result);
  const text = content
    .map((block) => {
      if (isRecord(block) && block.type === "text" && typeof block.text === "string") return block.text;
      return safeJson(block);
    })
    .filter(Boolean)
    .join("\n");
  return text || safeJson(result);
}

function isCallToolError(result: unknown): boolean {
  return isRecord(result) && result.isError === true;
}

function diagnosticToText(value: unknown): string {
  if (value === undefined || value === null) return "Unknown ACP error";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return safeJson(value);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readMetaString(meta: unknown, key: string): string | undefined {
  if (!isRecord(meta)) return undefined;
  return readString(meta[key]);
}

function createStepId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
