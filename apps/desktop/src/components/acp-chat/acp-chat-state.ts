import type { AgentMessage, Artifact, CommandQueueItem, PendingQuestion, SlashCommand, TaskPlan } from "@viben/chat";
import type { PendingExecApproval } from "@viben/chat";
import { applyAcpUiStep, type AcpUiStep } from "./acp-chat-adapter";
import type {
  ClientToolCall,
  ElicitationRequestLog,
  PermissionRequestLog,
} from "./acp-client";

/**
 * Type for session state setter that works with both React.Dispatch and Zustand store setters.
 * Both use the same pattern: accepts a function that takes current state and returns new state.
 */
export type SessionsByIdSetter = (updater: (current: Record<string, UiSessionState>) => Record<string, UiSessionState>) => void;

export interface UiSessionState {
  id: string;
  title: string;
  cwd: string;
  createdAt: string;
  lastActiveAt: string;
  sessionResult: unknown;
  promptResult: unknown;
  promptInFlight: boolean;
  uiMessages: AgentMessage[];
  streamingText: string | null;
  messageUpdates: Record<string, Partial<AgentMessage>>;
  uiSteps: AcpUiStep[];
  uiStepQueue: AcpUiStep[];
  pendingPlan: TaskPlan | null;
  artifacts: Artifact[];
  pendingApproval: PendingExecApproval | null;
  pendingQuestion: PendingQuestion | null;
  slashCommands: SlashCommand[];
  clientToolCalls: ClientToolCall[];
  permissionRequests: PermissionRequestLog[];
  elicitationRequests: ElicitationRequestLog[];
}

export interface SubagentSheetState {
  title: string;
  subagentType?: string;
  messages: AgentMessage[];
  context?: {
    subagentId?: string;
    toolUseId?: string;
    parentMessage?: AgentMessage;
    messages?: AgentMessage[];
  };
}

export function createUiSession(
  id: string,
  cwd: string,
  sessionResult: unknown,
  existing?: UiSessionState
): UiSessionState {
  const now = new Date().toISOString();
  return {
    id,
    title: existing?.title ?? `Session ${shortId(id)}`,
    cwd,
    createdAt: existing?.createdAt ?? now,
    lastActiveAt: now,
    sessionResult,
    promptResult: existing?.promptResult ?? null,
    promptInFlight: existing?.promptInFlight ?? false,
    uiMessages: existing?.uiMessages ?? [],
    streamingText: existing?.streamingText ?? null,
    messageUpdates: existing?.messageUpdates ?? {},
    uiSteps: existing?.uiSteps ?? [],
    uiStepQueue: existing?.uiStepQueue ?? [],
    pendingPlan: existing?.pendingPlan ?? null,
    artifacts: existing?.artifacts ?? [],
    pendingApproval: existing?.pendingApproval ?? null,
    pendingQuestion: existing?.pendingQuestion ?? null,
    slashCommands: existing?.slashCommands ?? [],
    clientToolCalls: existing?.clientToolCalls ?? [],
    permissionRequests: existing?.permissionRequests ?? [],
    elicitationRequests: existing?.elicitationRequests ?? [],
  };
}

export function updateSession(
  setSessionsById: SessionsByIdSetter,
  sessionId: string,
  updater: (session: UiSessionState) => UiSessionState
): void {
  setSessionsById((current) => {
    const existing = current[sessionId] ?? createUiSession(sessionId, "", { sessionId });
    return {
      ...current,
      [sessionId]: updater(existing),
    };
  });
}

export function enqueueUiSteps(
  setSessionsById: SessionsByIdSetter,
  sessionId: string,
  steps: AcpUiStep[]
): void {
  if (steps.length === 0) return;
  updateSession(setSessionsById, sessionId, (session) => ({
    ...session,
    uiStepQueue: [...session.uiStepQueue, ...steps],
    lastActiveAt: new Date().toISOString(),
  }));
}

/**
 * Append messages directly to uiMessages without going through the queue.
 * Use this for events that should appear immediately in chronological order,
 * such as steer-related events (queued, consumed).
 */
export function appendUiMessagesImmediately(
  setSessionsById: SessionsByIdSetter,
  sessionId: string,
  messages: AgentMessage[]
): void {
  if (messages.length === 0) return;
  updateSession(setSessionsById, sessionId, (session) => ({
    ...session,
    uiMessages: [...session.uiMessages, ...messages],
    lastActiveAt: new Date().toISOString(),
  }));
}

export function appendSessionStreamingText(
  setSessionsById: SessionsByIdSetter,
  sessionId: string,
  text: string
): void {
  if (!text) return;
  updateSession(setSessionsById, sessionId, (session) => ({
    ...session,
    streamingText: `${session.streamingText ?? ""}${text}`,
    lastActiveAt: new Date().toISOString(),
  }));
}

export function flushSessionStreamingText(
  session: UiSessionState,
  extraMessages: AgentMessage[] = []
): UiSessionState {
  const text = session.streamingText;
  if (!text) {
    return extraMessages.length === 0
      ? session
      : {
          ...session,
          uiMessages: [...session.uiMessages, ...extraMessages],
          lastActiveAt: new Date().toISOString(),
        };
  }
  return {
    ...session,
    streamingText: null,
    uiMessages: [
      ...session.uiMessages,
      {
        id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "text",
        content: text,
        timestamp: Date.now(),
      },
      ...extraMessages,
    ],
    lastActiveAt: new Date().toISOString(),
  };
}

export function drainSessionUiStepQueue(session: UiSessionState): UiSessionState {
  let next = session;
  while (
    !next.pendingPlan &&
    !next.pendingApproval &&
    !next.pendingQuestion &&
    next.uiStepQueue.length > 0
  ) {
    const [step, ...rest] = next.uiStepQueue;
    next = applyQueuedUiStep(next, step, rest);
  }
  return next;
}

export function resolveSessionApproval(
  setSessionsById: SessionsByIdSetter,
  sessionId: string
): void {
  updateSession(setSessionsById, sessionId, (session) => ({ ...session, pendingApproval: null }));
}

export function resolveSessionQuestion(
  setSessionsById: SessionsByIdSetter,
  sessionId: string
): void {
  updateSession(setSessionsById, sessionId, (session) => ({ ...session, pendingQuestion: null }));
}

export function applyQueuedUiStep(session: UiSessionState, step: AcpUiStep, rest: AcpUiStep[]): UiSessionState {
  if (isSubagentChildStep(session, step)) {
    return {
      ...session,
      uiSteps: [...session.uiSteps, step],
      uiStepQueue: rest,
      messageUpdates: mergeMessageUpdates(session.messageUpdates, step, session.uiMessages),
      lastActiveAt: new Date().toISOString(),
    };
  }

  const nextMessages = applyAcpUiStep(session.uiMessages, step);
  if (step.kind === "approval") {
    return {
      ...session,
      uiSteps: [...session.uiSteps, step],
      uiStepQueue: rest,
      pendingApproval: step.approval,
      lastActiveAt: new Date().toISOString(),
    };
  }
  if (step.kind === "question") {
    return {
      ...session,
      uiSteps: [...session.uiSteps, step],
      uiStepQueue: rest,
      pendingQuestion: step.question,
      lastActiveAt: new Date().toISOString(),
    };
  }
  if (step.kind === "plan") {
    return {
      ...session,
      uiSteps: [...session.uiSteps, step],
      uiStepQueue: rest,
      pendingPlan: step.plan.approvalStatus === "pending" ? step.plan : null,
      uiMessages: nextMessages,
      lastActiveAt: new Date().toISOString(),
    };
  }
  if (step.kind === "slash_commands") {
    return {
      ...session,
      uiSteps: [...session.uiSteps, step],
      uiStepQueue: rest,
      slashCommands: step.commands,
      lastActiveAt: new Date().toISOString(),
    };
  }
  return {
    ...session,
    uiSteps: [...session.uiSteps, step],
    uiStepQueue: rest,
    uiMessages: nextMessages,
    messageUpdates: mergeMessageUpdates(session.messageUpdates, step, nextMessages),
    artifacts: mergeArtifacts(session.artifacts, step, nextMessages),
    lastActiveAt: new Date().toISOString(),
  };
}

export function resolveLiveSubagentMessages(
  sessionsById: Record<string, UiSessionState>,
  sheet: SubagentSheetState | null
): AgentMessage[] | undefined {
  const toolUseId = sheet?.context?.toolUseId;
  const subagentId = sheet?.context?.subagentId;
  if (!toolUseId && !subagentId) return undefined;
  for (const session of Object.values(sessionsById)) {
    const parent = session.uiMessages.find((message) =>
      message.type === "tool_use" &&
      (message.name === "Task" || message.name === "Agent") &&
      (
        (toolUseId && message.toolUseId === toolUseId) ||
        (subagentId && (message.subagentId === subagentId || message.toolUseId === subagentId))
      ) &&
      message.id
    );
    if (parent?.id) {
      return session.messageUpdates[parent.id]?.subagentMessages;
    }
  }
  return undefined;
}

function isSubagentChildStep(session: UiSessionState, step: AcpUiStep): boolean {
  if (step.kind !== "message") return false;
  const message = step.message;
  if (message.type === "tool_use") {
    return Boolean(findSubagentParentMessage(session.uiMessages, message));
  }
  if (message.type === "tool_result" && message.toolUseId) {
    return Boolean(findSubagentParentForToolResult(session.uiMessages, message.toolUseId, session.messageUpdates, message.subagentId));
  }
  if ((message.type === "text" || message.type === "thinking") && message.subagentId) {
    return Boolean(findSubagentParentById(session.uiMessages, message.subagentId));
  }
  return false;
}

function mergeMessageUpdates(
  current: Record<string, Partial<AgentMessage>>,
  step: AcpUiStep,
  messages: AgentMessage[]
): Record<string, Partial<AgentMessage>> {
  if (step.kind !== "message") return current;
  if (step.message.type === "tool_use") {
    const parent = findSubagentParentMessage(messages, step.message);
    if (!parent?.id) return current;
    return appendSubagentMessage(current, parent.id, subagentPreviewMessageFromToolUse(step.message));
  }
  if (step.message.type === "tool_result" && step.message.toolUseId) {
    const parent = findSubagentParentForToolResult(messages, step.message.toolUseId, current, step.message.subagentId);
    if (!parent?.id) return current;
    return appendSubagentMessage(current, parent.id, subagentPreviewMessageFromToolResult(step.message));
  }
  if ((step.message.type === "text" || step.message.type === "thinking") && step.message.subagentId) {
    const parent = findSubagentParentById(messages, step.message.subagentId);
    if (!parent?.id) return current;
    return appendSubagentTextChunk(current, parent.id, step.message);
  }
  return current;
}

function appendSubagentMessage(
  current: Record<string, Partial<AgentMessage>>,
  parentMessageId: string,
  message: AgentMessage | null
): Record<string, Partial<AgentMessage>> {
  if (!message) return current;
  const existingMessages = current[parentMessageId]?.subagentMessages ?? [];
  const nextMessages = existingMessages.filter((item) => item.id !== message.id);
  return {
    ...current,
    [parentMessageId]: {
      ...current[parentMessageId],
      subagentMessages: [...nextMessages, message],
    },
  };
}

function appendSubagentTextChunk(
  current: Record<string, Partial<AgentMessage>>,
  parentMessageId: string,
  message: AgentMessage
): Record<string, Partial<AgentMessage>> {
  const existingMessages = current[parentMessageId]?.subagentMessages ?? [];
  const lastIndex = existingMessages.length - 1;
  const last = lastIndex >= 0 ? existingMessages[lastIndex] : undefined;
  if (last && last.type === message.type) {
    const updatedMessages = [...existingMessages];
    updatedMessages[lastIndex] = { ...last, content: (last.content ?? "") + (message.content ?? "") };
    return {
      ...current,
      [parentMessageId]: {
        ...current[parentMessageId],
        subagentMessages: updatedMessages,
      },
    };
  }
  return {
    ...current,
    [parentMessageId]: {
      ...current[parentMessageId],
      subagentMessages: [...existingMessages, message],
    },
  };
}

function findSubagentParentMessage(messages: AgentMessage[], candidate: AgentMessage): AgentMessage | undefined {
  const subagentId = candidate.subagentId;
  if (!subagentId || candidate.name === "Task" || candidate.name === "Agent") return undefined;
  return messages.find((message) =>
    message.type === "tool_use" &&
    (message.name === "Task" || message.name === "Agent") &&
    (message.subagentId === subagentId || message.toolUseId === subagentId)
  );
}

function findSubagentParentById(messages: AgentMessage[], subagentId: string): AgentMessage | undefined {
  return messages.find((message) =>
    message.type === "tool_use" &&
    (message.name === "Task" || message.name === "Agent") &&
    (message.subagentId === subagentId || message.toolUseId === subagentId)
  );
}

function findSubagentParentForToolResult(
  messages: AgentMessage[],
  toolUseId: string,
  messageUpdates?: Record<string, Partial<AgentMessage>>,
  resultSubagentId?: string
): AgentMessage | undefined {
  // First try to find via tool_use in main messages
  const tool = messages.find((message) => message.type === "tool_use" && message.toolUseId === toolUseId);
  if (tool) return findSubagentParentMessage(messages, tool);

  // If tool_result has subagentId, try direct matching against Task/Agent messages
  if (resultSubagentId) {
    const directMatch = messages.find((message) =>
      message.type === "tool_use" &&
      (message.name === "Task" || message.name === "Agent") &&
      (message.subagentId === resultSubagentId || message.toolUseId === resultSubagentId)
    );
    if (directMatch) return directMatch;
  }

  // Look in subagentMessages for the tool_use
  for (const parent of messages) {
    if (parent.type !== "tool_use" || (parent.name !== "Task" && parent.name !== "Agent") || !parent.id) continue;
    const previewTool = messageUpdates?.[parent.id]?.subagentMessages?.find((message) =>
      message.type === "tool_use" && message.toolUseId === toolUseId
    );
    if (previewTool) return parent;
  }
  return undefined;
}

function subagentPreviewMessageFromToolUse(message: AgentMessage): AgentMessage | null {
  if (!message.subagentId || message.name === "Task" || message.name === "Agent") return null;
  return {
    ...message,
    id: message.id ?? message.toolUseId ?? `subagent-tool-${Date.now()}`,
  };
}

function subagentPreviewMessageFromToolResult(message: AgentMessage): AgentMessage | null {
  if (!message.toolUseId) return null;
  return {
    ...message,
    id: message.id ?? `subagent-result-${message.toolUseId}`,
  };
}

function mergeArtifacts(current: Artifact[], step: AcpUiStep, messages: AgentMessage[]): Artifact[] {
  if (step.kind !== "message") return current;
  const artifacts = artifactsFromStep(step.message, messages);
  if (artifacts.length === 0) return current;
  const next = current.filter((item) => !artifacts.some((artifact) =>
    artifact.id === item.id ||
    (
      artifact.sourceMessageId &&
      item.sourceMessageId === artifact.sourceMessageId &&
      item.toolName === artifact.toolName
    )
  ));
  return [...next, ...artifacts];
}

function artifactsFromStep(message: AgentMessage, messages: AgentMessage[]): Artifact[] {
  if (message.type === "tool_use") {
    const artifact = artifactFromToolMessage(message);
    return artifact ? [artifact] : [];
  }
  if (message.type !== "tool_result" || !message.toolUseId) return [];
  const sourceMessage = messages.find((candidate) => candidate.type === "tool_use" && candidate.toolUseId === message.toolUseId);
  return artifactsFromToolResult(message, sourceMessage);
}

function artifactFromToolMessage(message: AgentMessage): Artifact | null {
  if (!message.id || !message.input) return null;
  const toolName = message.name ?? "";
  if (toolName !== "Write" && toolName !== "Edit") return null;
  const filePath = readStringValue(message.input.file_path) ?? readStringValue(message.input.path);
  if (!filePath) return null;
  return {
    id: `artifact-${message.id}`,
    name: filePath.split("/").filter(Boolean).at(-1) ?? filePath,
    type: inferArtifactType(filePath),
    sourceMessageId: message.id,
    toolName,
  };
}

function artifactsFromToolResult(message: AgentMessage, sourceMessage: AgentMessage | undefined): Artifact[] {
  const candidates = readArtifactCandidates(message.output);
  return candidates.flatMap((candidate, index) => {
    const path = readStringValue(candidate.path) ?? readStringValue(candidate.file_path) ?? readStringValue(candidate.name);
    if (!path) return [];
    const sourceId = sourceMessage?.id ?? message.toolUseId ?? message.id ?? `artifact-${index}`;
    return [{
      id: readStringValue(candidate.id) ?? `artifact-${sourceId}-${index}`,
      name: readStringValue(candidate.name) ?? path.split("/").filter(Boolean).at(-1) ?? path,
      type: readStringValue(candidate.type) ?? inferArtifactType(path),
      sourceMessageId: sourceMessage?.id ?? message.id,
      toolName: sourceMessage?.name,
    }];
  });
}

function readArtifactCandidates(output: AgentMessage["output"]): Record<string, unknown>[] {
  const value = typeof output === "string" ? parseJsonOrFallback(output, null) : output;
  if (Array.isArray(value)) {
    return value.flatMap((item) => readArtifactCandidatesFromValue(item));
  }
  return readArtifactCandidatesFromValue(value);
}

function readArtifactCandidatesFromValue(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  const artifact = isRecord(value.artifact) ? [value.artifact] : [];
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.filter(isRecord)
    : [];
  const files = Array.isArray(value.files)
    ? value.files.filter(isRecord)
    : [];
  const directPath = readStringValue(value.path) || readStringValue(value.file_path);
  return directPath ? [value, ...artifact, ...artifacts, ...files] : [...artifact, ...artifacts, ...files];
}

function inferArtifactType(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return "image";
    case "md":
    case "txt":
      return "text";
    case "json":
      return "json";
    case "tsx":
    case "ts":
    case "jsx":
    case "js":
    case "css":
    case "html":
      return "code";
    default:
      return "file";
  }
}

function parseJsonOrFallback<T>(text: unknown, fallback: T): T | unknown {
  if (typeof text !== "string") return text ?? fallback;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fallback;
  }
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export type { CommandQueueItem };
