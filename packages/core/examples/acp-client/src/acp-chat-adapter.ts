import type { AgentMessage, PendingQuestion, SlashCommand, TaskPlan, TaskPlanStep } from "@viben/chat";
import type { PendingExecApproval } from "@viben/chat";
import type {
  AcpSessionUpdate,
  CallToolResult,
  ClientToolCall,
  ClientToolExecutionRequest,
  ElicitationPropertySchema,
  ElicitationRequest,
  ElicitationRequestLog,
  PermissionDecisionRequest,
  PermissionOption,
  PermissionRequestLog,
} from "./acp-client";

export type AcpUiStep =
  | { kind: "message"; message: AgentMessage; merge?: "text_chunk" | "thinking_chunk" | "tool_use" | "tool_result" }
  | { kind: "approval"; approval: PendingExecApproval }
  | { kind: "question"; question: PendingQuestion }
  | { kind: "slash_commands"; commands: SlashCommand[] };

type MessageStepMerge = Extract<AcpUiStep, { kind: "message" }>["merge"];

export interface ElicitationFormField {
  key: string;
  schema: ElicitationPropertySchema;
}

export function applyAcpUiStep(current: AgentMessage[], step: AcpUiStep): AgentMessage[] {
  if (step.kind !== "message") return current;
  switch (step.merge) {
    case "text_chunk":
      return appendTextChunk(current, "text", step.message.content ?? "");
    case "thinking_chunk":
      return appendTextChunk(current, "thinking", step.message.content ?? "");
    case "tool_use":
      return upsertToolUse(current, step.message);
    case "tool_result":
      return upsertToolResult(current, step.message);
    default:
      return [...current, step.message];
  }
}

export function userPromptToUiSteps(content: string): AcpUiStep[] {
  return [{
    kind: "message",
    message: {
      id: createStepId("user"),
      type: "user",
      content,
      timestamp: Date.now(),
    },
  }];
}

export function systemTextToUiSteps(content: string): AcpUiStep[] {
  return [{
    kind: "message",
    message: {
      id: createStepId("system"),
      type: "text",
      content,
      timestamp: Date.now(),
    },
  }];
}

export function acpSessionUpdateToUiSteps(notification: AcpSessionUpdate): AcpUiStep[] {
  const update = notification.update;
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return messageStep("text_chunk", {
        id: createStepId("text"),
        type: "text",
        content: contentBlockToText(update.content),
        timestamp: Date.now(),
      });
    case "agent_thought_chunk":
      return messageStep("thinking_chunk", {
        id: createStepId("thinking"),
        type: "thinking",
        content: contentBlockToText(update.content),
        timestamp: Date.now(),
      });
    case "tool_call":
      return messageStep("tool_use", {
        id: typeof update.toolCallId === "string" ? update.toolCallId : createStepId("tool"),
        type: "tool_use",
        name: normalizeToolName(update.title),
        toolUseId: update.toolCallId,
        input: normalizeToolInput(update.rawInput),
        timestamp: Date.now(),
      });
    case "tool_call_update":
      return messageStep("tool_result", {
        id: createStepId("tool-result"),
        type: "tool_result",
        toolUseId: update.toolCallId,
        output: toolUpdateOutput(update),
        isError: update.status === "failed" || update.status === "error",
        timestamp: Date.now(),
      });
    case "plan": {
      const plan = updateToPlan(update);
      return plan ? [{ kind: "message", message: { id: plan.id ?? createStepId("plan"), type: "plan", plan, timestamp: Date.now() } }] : [];
    }
    case "session_info_update": {
      const sdkSessionId = readString(update.sessionId) ?? readMetaString(update._meta, "sessionId");
      return sdkSessionId ? systemTextToUiSteps(`Backend session: ${sdkSessionId}`) : [];
    }
    case "usage_update":
      return systemTextToUiSteps(`Usage update: ${safeJson(update)}`);
    case "available_commands_update":
      return [{ kind: "slash_commands", commands: availableCommandsToSlashCommands(update.availableCommands) }];
    case "error":
      return [{
        kind: "message",
        message: {
          id: createStepId("error"),
          type: "error",
          message: diagnosticToText(update.error),
          isError: true,
          timestamp: Date.now(),
        },
      }];
    default:
      return systemTextToUiSteps(`ACP update: ${safeJson(update)}`);
  }
}

export function clientToolRequestedToUiSteps(request: ClientToolExecutionRequest): AcpUiStep[] {
  return messageStep("tool_use", {
    id: request.toolUseId,
    type: "tool_use",
    name: request.toolName,
    toolUseId: request.toolUseId,
    input: normalizeToolInput(request.input),
    timestamp: Date.now(),
  });
}

export function clientToolCallToUiSteps(call: ClientToolCall): AcpUiStep[] {
  if (isRecord(call.result) && call.result.pending === true) {
    return clientToolRequestedToUiSteps({
      sessionId: call.sessionId,
      toolName: call.toolName,
      toolUseId: call.toolUseId,
      input: call.input,
    });
  }
  return messageStep("tool_result", {
    id: createStepId("client-tool-result"),
    type: "tool_result",
    toolUseId: call.toolUseId,
    output: callToolResultToOutput(call.result),
    isError: isCallToolError(call.result),
    timestamp: Date.now(),
  });
}

export function permissionRequestToUiSteps(request: PermissionDecisionRequest): AcpUiStep[] {
  return [{
    kind: "approval",
    approval: {
      id: request.toolCallId,
      tool_call: {
        title: request.title,
        kind: permissionKindFromOptions(request.options),
        command: rawInputToCommand(request.rawInput),
      },
      options: permissionOptionsToApprovalOptions(request.options),
    },
  }];
}

export function permissionDecisionToUiSteps(request: PermissionRequestLog): AcpUiStep[] {
  return messageStep("tool_result", {
    id: createStepId("permission"),
    type: "tool_result",
    toolUseId: request.toolCallId,
    output: `Permission decision: ${request.selectedOptionId}`,
    isError: request.selectedOptionId === "cancelled" || request.selectedOptionId.toLowerCase().includes("reject"),
    timestamp: Date.now(),
  });
}

export function elicitationRequestToUiSteps(request: ElicitationRequest): AcpUiStep[] {
  return [{
    kind: "question",
    question: elicitationRequestToPendingQuestion(request),
  }];
}

export function elicitationResultToUiSteps(request: ElicitationRequestLog): AcpUiStep[] {
  return systemTextToUiSteps(`Elicitation response: ${safeJson(request.action)}`);
}

export function elicitationRequestToPendingQuestion(request: ElicitationRequest): PendingQuestion {
  if (request.mode === "url" && request.url) {
    return {
      id: request.elicitationId ?? createStepId("elicitation"),
      questions: [{
        header: "ACP Elicitation",
        question: `${request.message}\n${request.url}`,
        options: [
          { label: "accept", description: "Open or confirm the URL flow is complete." },
          { label: "decline", description: "Decline this elicitation request." },
        ],
        multiSelect: false,
      }],
    };
  }
  const fields = getElicitationFormFields(request);
  return {
    id: createStepId("elicitation"),
    questions: fields.length === 0
      ? [{
          header: request.requestedSchema?.title ?? "ACP Elicitation",
          question: request.message,
          options: [{ label: "accept" }, { label: "decline" }],
          multiSelect: false,
        }]
      : fields.map((field) => propertyToQuestion(request.message, field)),
  };
}

export function getElicitationFormFields(request: ElicitationRequest): ElicitationFormField[] {
  const properties = request.requestedSchema?.properties;
  if (!properties) return [];
  return Object.entries(properties).map(([key, schema]) => ({ key, schema }));
}

function propertyToQuestion(message: string, field: ElicitationFormField) {
  const label = field.schema.title ?? field.key;
  const description = field.schema.description ?? message;
  const options = propertyOptions(field.schema);
  return {
    header: label,
    question: description,
    options: options.length > 0 ? options : [{ label: "value", description: "Use Other to enter a custom value." }],
    multiSelect: field.schema.type === "array",
  };
}

function propertyOptions(schema: ElicitationPropertySchema): Array<{ label: string; description?: string }> {
  if (Array.isArray(schema.enum)) return schema.enum.map((label) => ({ label }));
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map((option) => ({ label: option.const, description: option.title }));
  if (schema.items && Array.isArray(schema.items.enum)) return schema.items.enum.map((label) => ({ label }));
  if (schema.items && Array.isArray(schema.items.anyOf)) return schema.items.anyOf.map((option) => ({ label: option.const, description: option.title }));
  if (schema.type === "boolean") return [{ label: "true" }, { label: "false" }];
  return [];
}

function availableCommandsToSlashCommands(value: unknown): SlashCommand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((command) => {
    if (!isRecord(command) || typeof command.name !== "string" || !command.name.trim()) return [];
    return [{
      name: command.name,
      description: typeof command.description === "string" ? command.description : "",
      input: isRecord(command.input) ? command.input : null,
    }];
  });
}

function appendTextChunk(current: AgentMessage[], type: "text" | "thinking", text: string): AgentMessage[] {
  if (!text) return current;
  const previous = current[current.length - 1];
  if (previous?.type === type && previous.content !== undefined) {
    return [...current.slice(0, -1), { ...previous, content: `${previous.content}${text}` }];
  }
  return [...current, { id: createStepId(type), type, content: text, timestamp: Date.now() }];
}

function upsertToolUse(current: AgentMessage[], toolUse: AgentMessage): AgentMessage[] {
  if (!toolUse.toolUseId) return [...current, toolUse];
  const existingIndex = current.findIndex((step) => step.type === "tool_use" && step.toolUseId === toolUse.toolUseId);
  if (existingIndex === -1) return [...current, toolUse];
  return current.map((step, index) => (index === existingIndex ? { ...step, ...toolUse } : step));
}

function upsertToolResult(current: AgentMessage[], toolResult: AgentMessage): AgentMessage[] {
  if (!toolResult.toolUseId) return [...current, toolResult];
  const existingIndex = current.findIndex((step) => step.type === "tool_result" && step.toolUseId === toolResult.toolUseId);
  if (existingIndex === -1) return [...current, toolResult];
  return current.map((step, index) => (index === existingIndex ? { ...step, ...toolResult } : step));
}

function messageStep(merge: MessageStepMerge, message: AgentMessage): AcpUiStep[] {
  return [{ kind: "message", merge, message }];
}

function updateToPlan(update: Record<string, unknown>): TaskPlan | null {
  const entries = Array.isArray(update.entries) ? update.entries : [];
  const steps: TaskPlanStep[] = entries.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const description = readString(entry.content) ?? readString(entry.description);
    if (!description) return [];
    return [{ id: readString(entry.id) ?? `step-${index + 1}`, description, status: normalizePlanStepStatus(readString(entry.status)) }];
  });
  const goal = readString(update.goal) ?? readString(update.title) ?? "ACP plan";
  return { id: readString(update.planId) ?? readString(update.id), goal, steps, notes: readString(update.notes) };
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

function permissionKindFromOptions(options: PermissionOption[]): PendingExecApproval["tool_call"]["kind"] {
  const hasRejectAlways = options.some((option) => option.kind === "reject_always");
  return hasRejectAlways ? "execute" : "edit";
}

function permissionOptionsToApprovalOptions(options: PermissionOption[]): PendingExecApproval["options"] {
  if (options.length === 0) {
    return [
      { id: "allow_once", label: "Allow" },
      { id: "allow_always", label: "Always" },
      { id: "reject_once", label: "Reject" },
    ];
  }
  return options.map((option, index) => ({
    id: option.optionId ?? option.kind ?? `option-${index}`,
    label: option.name ?? option.kind ?? option.optionId ?? `Option ${index + 1}`,
  }));
}

function rawInputToCommand(rawInput: unknown): string | undefined {
  if (!isRecord(rawInput)) return undefined;
  if (typeof rawInput.command === "string") return rawInput.command;
  if (typeof rawInput.action === "string") return rawInput.action;
  return safeJson(rawInput);
}

function contentBlockToText(content: unknown): string {
  if (isRecord(content) && content.type === "text" && typeof content.text === "string") return content.text;
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
