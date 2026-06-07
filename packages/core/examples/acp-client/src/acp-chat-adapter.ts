import type { AgentMessage, ContentBlock, PendingQuestion, SlashCommand, TaskPlan, TaskPlanStep } from "@viben/chat";
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
  | { kind: "plan"; plan: TaskPlan }
  | { kind: "summary"; summary: Record<string, unknown> }
  | { kind: "slash_commands"; commands: SlashCommand[] };

type MessageStepMerge = Extract<AcpUiStep, { kind: "message" }>["merge"];

export interface ElicitationFormField {
  key: string;
  schema: ElicitationPropertySchema;
}

export function applyAcpUiStep(current: AgentMessage[], step: AcpUiStep): AgentMessage[] {
  if (step.kind === "plan") {
    return [...current, { id: step.plan.id ?? createStepId("plan"), type: "plan", plan: step.plan, timestamp: Date.now() }];
  }
  if (step.kind === "summary") {
    return [...current, { id: createStepId("summary"), type: "summary", summary: step.summary, timestamp: Date.now() }];
  }
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
        input: normalizeToolInput(update.rawInput, normalizeToolName(update.title)),
        subagentId: readString(update.subagentId) ?? readMetaString(update._meta, "subagentId"),
        timestamp: Date.now(),
      });
    case "tool_call_update":
      if (isToolInputOnlyUpdate(update)) {
        return messageStep("tool_use", {
          id: typeof update.toolCallId === "string" ? update.toolCallId : createStepId("tool"),
          type: "tool_use",
          name: normalizeToolName(update.title),
          toolUseId: update.toolCallId,
          input: normalizeToolInput(update.rawInput, normalizeToolName(update.title)),
          subagentId: readString(update.subagentId) ?? readMetaString(update._meta, "subagentId"),
          timestamp: Date.now(),
        });
      }
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
      return plan ? [{ kind: "plan", plan }] : [];
    }
    case "session_info_update": {
      const sdkSessionId = readString(update.sessionId) ?? readMetaString(update._meta, "sessionId");
      return sdkSessionId ? systemTextToUiSteps(`Backend session: ${sdkSessionId}`) : [];
    }
    case "usage_update":
      return [{ kind: "summary", summary: update }];
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
    id: request.toolCallId,
    type: "tool_use",
    name: request.toolName,
    toolUseId: request.toolCallId,
    input: normalizeToolInput(request.input, request.toolName),
    timestamp: Date.now(),
  });
}

export function clientToolCallToUiSteps(call: ClientToolCall): AcpUiStep[] {
  if (isRecord(call.result) && call.result.pending === true) {
    return clientToolRequestedToUiSteps({
      sessionId: call.sessionId,
      toolName: call.toolName,
      toolCallId: call.toolCallId,
      input: call.input,
    });
  }
  return messageStep("tool_result", {
    id: createStepId("client-tool-result"),
    type: "tool_result",
    toolUseId: call.toolCallId,
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
        command: permissionCommandSummary(request),
        toolCallId: request.toolCallId,
        toolName: permissionToolName(request),
        input: request.rawInput,
        details: permissionDetails(request),
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

export function elicitationRequestToUiSteps(request: ElicitationRequest, pendingQuestion?: PendingQuestion): AcpUiStep[] {
  const plan = elicitationRequestToPendingPlan(request);
  if (plan) return [{ kind: "plan", plan }];
  return [{
    kind: "question",
    question: pendingQuestion ?? elicitationRequestToPendingQuestion(request),
  }];
}

export function elicitationResultToUiSteps(request: ElicitationRequestLog): AcpUiStep[] {
  return systemTextToUiSteps(`Elicitation response: ${safeJson(request.action)}`);
}

export function acpSessionUpdateToStreamingText(notification: AcpSessionUpdate): string | null {
  if (notification.update.sessionUpdate !== "agent_message_chunk") return null;
  const text = contentBlockToText(notification.update.content);
  return text ? text : null;
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
    id: request.elicitationId ?? createStepId("elicitation"),
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

export function elicitationRequestToPendingPlan(request: ElicitationRequest): TaskPlan | null {
  const input = isRecord(request.rawInput) ? request.rawInput : {};
  const planInput = isRecord(input.plan) ? input.plan : input;
  const entries = Array.isArray(planInput.entries) ? planInput.entries : Array.isArray(planInput.steps) ? planInput.steps : [];
  const isPlanLike = entries.length > 0 || readString(planInput.planId) || readString(planInput.goal);
  if (!isPlanLike || !isPlanApprovalElicitation(request)) return null;
  const steps: TaskPlanStep[] = entries.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const description = readString(entry.content) ?? readString(entry.description) ?? readString(entry.title);
    if (!description) return [];
    return [{ id: readString(entry.id) ?? `step-${index + 1}`, description, status: normalizePlanStepStatus(readString(entry.status)) }];
  });
  return {
    id: request.elicitationId ?? readString(planInput.planId) ?? readString(planInput.id) ?? createStepId("plan-elicitation"),
    goal: readString(planInput.goal) ?? readString(planInput.title) ?? request.message,
    steps,
    notes: readString(planInput.notes),
    approvalStatus: "pending",
  };
}

function isPlanApprovalElicitation(request: ElicitationRequest): boolean {
  const haystack = [
    request.message,
    request.requestedSchema?.title ?? "",
    request.requestedSchema?.description ?? "",
  ].join(" ").toLowerCase();
  return haystack.includes("plan");
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
  return {
    id: readString(update.planId) ?? readString(update.id),
    goal,
    steps,
    notes: readString(update.notes),
    approvalStatus: inferPlanApprovalStatus(update, steps),
  };
}

function inferPlanApprovalStatus(update: Record<string, unknown>, steps: TaskPlanStep[]): TaskPlan["approvalStatus"] {
  const status = readString(update.approvalStatus) ?? readString(update.status);
  if (status === "approved" || status === "rejected" || status === "pending") return status;
  const isExecuting = steps.some((step) => step.status === "in_progress" || step.status === "completed");
  const isCancelled = steps.some((step) => step.status === "cancelled");
  if (isCancelled) return "rejected";
  return isExecuting ? "approved" : "pending";
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

function normalizeToolInput(input: unknown, toolName?: string): Record<string, unknown> {
  const normalized: Record<string, unknown> = isRecord(input) ? { ...input } : { value: input ?? null };
  if (toolName !== "Task" && toolName !== "Agent") return normalized;

  return {
    ...normalized,
    description: readString(normalized.description) ?? readString(normalized.title) ?? readString(normalized.task) ?? toolName,
    subagent_type: readString(normalized.subagent_type) ?? readString(normalized.agentType) ?? readString(normalized.type),
    prompt: readString(normalized.prompt) ?? readString(normalized.instructions) ?? readString(normalized.message),
  };
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
    id: option.optionId ?? option.kind ?? option.name ?? `option-${index}`,
    label: permissionOptionLabel(option, index),
  }));
}

function permissionCommandSummary(request: PermissionDecisionRequest): string | undefined {
  return rawInputToCommand(request.rawInput) ?? request.title;
}

function permissionOptionLabel(option: PermissionOption, index: number): string {
  const base = option.name ?? option.kind ?? option.optionId ?? `Option ${index + 1}`;
  const id = option.optionId && option.optionId !== base ? ` (${option.optionId})` : "";
  return `${base}${id}`;
}

function permissionToolName(request: PermissionDecisionRequest): string | undefined {
  const toolCall = request.toolCall;
  if (!isRecord(toolCall)) return undefined;
  return readString(toolCall.title) ?? readString(toolCall.name) ?? readString(toolCall.toolName);
}

function permissionDetails(request: PermissionDecisionRequest): Array<{ label: string; value: string }> {
  const details: Array<{ label: string; value: string }> = [];
  const input = isRecord(request.rawInput) ? request.rawInput : {};
  const action = readString(input.action);
  const command = readString(input.command);
  const payload = input.payload;
  if (action) details.push({ label: "Action", value: action });
  if (command) details.push({ label: "Command", value: command });
  if (payload !== undefined) details.push({ label: "Payload", value: compactJson(payload) });
  if (request.options.length > 0) {
    details.push({ label: "Options", value: request.options.map((option, index) => permissionOptionLabel(option, index)).join(", ") });
  }
  return details;
}

function rawInputToCommand(rawInput: unknown): string | undefined {
  if (!isRecord(rawInput)) return undefined;
  if (typeof rawInput.command === "string") return rawInput.command;
  if (typeof rawInput.action === "string") {
    const payload = rawInput.payload;
    return payload === undefined
      ? `${rawInput.action}()`
      : `${rawInput.action}(${compactJson(payload)})`;
  }
  return safeJson(rawInput);
}

function contentBlockToText(content: unknown): string {
  if (isRecord(content) && content.type === "text" && typeof content.text === "string") return content.text;
  if (content === undefined || content === null) return "";
  return safeJson(content);
}

function compactJson(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

function isToolInputOnlyUpdate(update: Record<string, unknown>): boolean {
  return update.rawInput !== undefined &&
    update.rawOutput === undefined &&
    (update.content === undefined || isEmptyArray(update.content)) &&
    update.artifact === undefined &&
    update.artifacts === undefined &&
    update.files === undefined &&
    !readClaudeToolResponse(update._meta) &&
    !isFinishedToolStatus(readString(update.status));
}

function isFinishedToolStatus(status: string | undefined): boolean {
  return status === "completed" || status === "failed" || status === "error";
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function toolUpdateOutput(update: Record<string, unknown>): AgentMessage["output"] {
  if (typeof update.rawOutput === "string") return update.rawOutput;
  const rawOutputBlocks = mcpContentToChatOutput(update.rawOutput);
  if (rawOutputBlocks) return rawOutputBlocks;
  if (update.rawOutput !== undefined) return safeJson(update.rawOutput);
  const contentBlocks = acpToolUpdateContentToChatOutput(update.content);
  if (contentBlocks) return contentBlocks;
  if (Array.isArray(update.content)) return safeJson(update.content);
  const toolResponse = readClaudeToolResponse(update._meta);
  if (toolResponse) return toolResponse;
  if (isRecord(update.artifact) || Array.isArray(update.artifacts) || Array.isArray(update.files)) {
    return safeJson({
      artifact: update.artifact,
      artifacts: update.artifacts,
      files: update.files,
    });
  }
  if (typeof update.status === "string") return update.status;
  return safeJson(update);
}

function callToolResultToOutput(result: unknown): AgentMessage["output"] {
  if (!isRecord(result)) return diagnosticToText(result);
  const content = result.content;
  const output = mcpContentToChatOutput(content);
  return output ?? safeJson(result);
}

function isCallToolError(result: unknown): boolean {
  return isRecord(result) && result.isError === true;
}

function readClaudeToolResponse(meta: unknown): AgentMessage["output"] | null {
  if (!isRecord(meta) || !isRecord(meta.claudeCode)) return null;
  const toolResponse = meta.claudeCode.toolResponse;
  return mcpContentToChatOutput(toolResponse);
}

function acpToolUpdateContentToChatOutput(value: unknown): AgentMessage["output"] | null {
  if (!Array.isArray(value)) return null;
  const unwrapped = value.map((block) => {
    if (isRecord(block) && block.type === "content" && "content" in block) return block.content;
    return block;
  });
  return mcpContentToChatOutput(unwrapped);
}

function mcpContentToChatOutput(value: unknown): AgentMessage["output"] | null {
  if (!Array.isArray(value)) return null;
  const blocks = value.flatMap((block): ContentBlock[] => {
    const converted = mcpContentBlockToChatBlock(block);
    return converted ? [converted] : [];
  });
  return blocks.length > 0 ? blocks : null;
}

function mcpContentBlockToChatBlock(block: unknown): ContentBlock | null {
  if (!isRecord(block)) return blockToTextContentBlock(block);
  if (block.type === "text" && typeof block.text === "string") {
    return { type: "text", text: block.text };
  }
  if (block.type === "image") {
    if (typeof block.data === "string" && typeof block.mimeType === "string") {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: block.mimeType,
          data: block.data,
        },
      };
    }
    if (isRecord(block.source) && block.source.type === "base64" && typeof block.source.data === "string") {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: typeof block.source.media_type === "string" ? block.source.media_type : "image/png",
          data: block.source.data,
        },
      };
    }
  }
  return blockToTextContentBlock(block);
}

function blockToTextContentBlock(value: unknown): ContentBlock {
  return {
    type: "text",
    text: safeJson(value),
  };
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
