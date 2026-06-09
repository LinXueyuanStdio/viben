/**
 * Custom hook for managing ACP WebSocket connection and session state.
 * Provides a singleton ACP client connection and session management.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentMessage,
  Artifact,
  CommandQueueItem,
  PendingQuestion,
  QueuedInputRecallItem,
  SlashCommand,
  SlashCommandSelection,
  TaskPlan,
} from "@viben/chat";
import type { PendingExecApproval } from "@viben/chat";
import {
  AcpWebSocketClient,
  type AcpSessionUpdate,
  type AgentConfigPayload,
  type CallToolResult,
  type ClientToolCall,
  type ClientToolExecutionRequest,
  type ConsumedSteerPromptResult,
  type ConnectionStatus,
  type ElicitationRequest,
  type ElicitationRequestLog,
  type PermissionDecisionRequest,
  type PermissionDecisionResult,
  type ElicitationResponse,
  type PermissionRequestLog,
} from "./acp-client";
import {
  acpSessionUpdateToStreamingText,
  acpSessionUpdateToUiSteps,
  clientToolCallToUiSteps,
  clientToolRequestedToUiSteps,
  elicitationRequestToPendingPlan,
  elicitationRequestToPendingQuestion,
  elicitationRequestToUiSteps,
  elicitationResultToUiSteps,
  permissionDecisionToUiSteps,
  permissionRequestToUiSteps,
  slashCommandsToUiSteps,
  systemTextToMessages,
  systemTextToUiSteps,
  userPromptToMessages,
  userPromptToUiSteps,
  getElicitationFormFields,
  type ElicitationFormField,
} from "./acp-chat-adapter";
import {
  appendSessionStreamingText,
  appendUiMessagesImmediately,
  applyQueuedUiStep,
  createUiSession,
  drainSessionUiStepQueue,
  enqueueUiSteps,
  flushSessionStreamingText,
  resolveLiveSubagentMessages,
  resolveSessionApproval,
  resolveSessionQuestion,
  updateSession,
  type SubagentSheetState,
  type UiSessionState,
} from "./acp-chat-state";

const DEFAULT_WS_URL = "ws://127.0.0.1:18790/ws/agent/acp";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface AcpSessionItem {
  id: string;
  title: string;
  subtitle?: string;
}

export interface PermissionDialogState {
  id: string;
  request: PermissionDecisionRequest;
  selectedOptionId: string;
  resolve: (result: PermissionDecisionResult) => void;
}

export interface ElicitationDialogState {
  id: string;
  request: ElicitationRequest;
  pendingQuestion: PendingQuestion;
  formFields: ElicitationFormField[];
  answersText: string;
  resolve: (result: ElicitationResponse) => void;
}

export interface UseAcpSessionOptions {
  wsUrl?: string;
  defaultCwd?: string;
  defaultModel?: string;
  defaultExecutorType?: string;
}

export interface UseAcpSessionReturn {
  // Connection state
  status: ConnectionStatus;
  connected: boolean;
  busy: boolean;
  error: string | null;

  // Session state
  activeSessionId: string | null;
  sessionsById: Record<string, UiSessionState>;
  sessionOrder: string[];
  sessions: AcpSessionItem[];

  // Active session data
  messages: AgentMessage[];
  streamingText: string | null;
  messageUpdates: Record<string, Partial<AgentMessage>>;
  pendingPlan: TaskPlan | null;
  pendingApproval: PendingExecApproval | null;
  pendingQuestion: PendingQuestion | null;
  slashCommands: SlashCommand[];
  artifacts: Artifact[];
  steerQueueItems: CommandQueueItem[];
  isTurnActive: boolean;
  isAgentRunning: boolean;

  // Config
  executorType: string;
  model: string;
  cwd: string;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  createSession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  closeActiveSession: () => Promise<void>;
  selectSession: (id: string) => void;
  sendPrompt: (content: string) => Promise<void>;
  sendSteerPrompt: (content: string) => Promise<string | null>;
  interrupt: () => Promise<void>;
  handleSlashCommand: (command: SlashCommand, selection: SlashCommandSelection) => void;
  handleApprovalDecision: (decision: string) => void;
  handleQuestionAnswers: (answers: Record<string, string[]>) => void;
  handleApprovePlan: () => void;
  handleRejectPlan: () => void;
  recallSteerQueue: (items: QueuedInputRecallItem[]) => Promise<void>;
  removeSteerQueueItem: (id: string) => void;
  clearSteerQueue: () => void;
  setExecutorType: (type: string) => void;
  setModel: (model: string) => void;
  setCwd: (cwd: string) => void;

  // Subagent sheet
  subagentSheet: SubagentSheetState | null;
  liveSubagentMessages: AgentMessage[] | undefined;
  handleExpandSubagent: (title: string, subagentType: string | undefined, messages: AgentMessage[], context?: SubagentSheetState["context"]) => void;
  closeSubagentSheet: () => void;
}

// Singleton client reference for the entire desktop app
let globalClientRef: AcpWebSocketClient | null = null;

function isUserBlockingUiStep(step: { kind: string; plan?: { approvalStatus?: string } }): boolean {
  return (
    step.kind === "approval" ||
    step.kind === "question" ||
    (step.kind === "plan" && step.plan?.approvalStatus === "pending")
  );
}

// Note: shortId is available for future use in UI formatting
// function shortId(id: string): string {
//   return id.length <= 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
// }

function readSessionId(value: unknown): string | null {
  if (typeof value === "object" && value !== null && typeof (value as { sessionId?: unknown }).sessionId === "string") {
    return (value as { sessionId: string }).sessionId;
  }
  return null;
}

function readSessionAvailableCommands(value: unknown): SlashCommand[] | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const commands = record.availableCommands ?? record.available_commands ?? record.commands ?? record.slashCommands ?? record.slash_commands;
  if (!Array.isArray(commands)) return null;
  const parsed = commands.flatMap((cmd): SlashCommand[] => {
    if (typeof cmd !== "object" || cmd === null) return [];
    const name = (cmd as Record<string, unknown>).name;
    if (typeof name !== "string" || !name.trim()) return [];
    const description = (cmd as Record<string, unknown>).description;
    const input = (cmd as Record<string, unknown>).input;
    return [{
      name,
      description: typeof description === "string" ? description : "",
      input: typeof input === "object" && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : null,
    }];
  });
  return parsed.length > 0 ? parsed : null;
}

function selectInitialPermissionOption(options: Array<{ kind?: string; optionId?: string; name?: string }>): { kind?: string; optionId?: string; name?: string } | undefined {
  return (
    options.find((option) => option.kind === "allow_once") ??
    options.find((option) => option.kind === "allow_always") ??
    options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow")) ??
    options[0]
  );
}

function permissionOptionId(option: { optionId?: string; name?: string; kind?: string }, index: number): string {
  return option.optionId ?? option.name ?? option.kind ?? `option-${index}`;
}

function buildDefaultElicitationContent(fields: ElicitationFormField[]): Record<string, string | number | boolean | string[]> {
  const content: Record<string, string | number | boolean | string[]> = {};
  for (const field of fields) {
    const value = field.schema.default;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || (Array.isArray(value) && value.every((v) => typeof v === "string"))) {
      content[field.key] = value;
      continue;
    }
    if (field.schema.type === "boolean") content[field.key] = false;
    else if (field.schema.type === "number" || field.schema.type === "integer") content[field.key] = 0;
    else if (field.schema.type === "array") content[field.key] = [];
    else content[field.key] = "";
  }
  return content;
}

function coerceElicitationValue(schema: { type?: string }, values: string[]): string | number | boolean | string[] {
  if (schema.type === "array") return values;
  const value = values[0] ?? "";
  if (schema.type === "boolean") return value === "true";
  if (schema.type === "number" || schema.type === "integer") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value;
}

function answersToElicitationContent(
  answers: Record<string, string[]>,
  fields: ElicitationFormField[]
): Record<string, string | number | boolean | string[]> {
  if (fields.length === 0) {
    return {
      answer: Object.values(answers).flat().join("\n"),
    };
  }
  const content: Record<string, string | number | boolean | string[]> = {};
  fields.forEach((field, index) => {
    const values = answers[String(index)] ?? [];
    content[field.key] = coerceElicitationValue(field.schema, values);
  });
  return content;
}

function resolvePermissionDecisionOption(options: Array<{ kind?: string; optionId?: string; name?: string }>, decision: string): string {
  if (decision === "reject") {
    const rejectOption =
      options.find((option) => option.kind === "reject_once") ??
      options.find((option) => option.kind === "reject_always") ??
      options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("reject"));
    if (!rejectOption) return "reject_once";
    return permissionOptionId(rejectOption, 0);
  }
  if (decision === "allow_always") {
    const alwaysOption = options.find((option) => option.kind === "allow_always");
    if (!alwaysOption) return "allow_always";
    return permissionOptionId(alwaysOption, 0);
  }
  const allowOnce =
    options.find((option) => option.kind === "allow_once") ??
    options.find((option) => String(option.optionId ?? option.name ?? "").toLowerCase().includes("allow")) ??
    options[0];
  if (!allowOnce) return "allow_once";
  return permissionOptionId(allowOnce, 0);
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function useAcpSession(options: UseAcpSessionOptions = {}): UseAcpSessionReturn {
  const {
    wsUrl = DEFAULT_WS_URL,
    defaultCwd = "",
    defaultModel = DEFAULT_MODEL,
    defaultExecutorType = "CLAUDE_CODE",
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsById, setSessionsById] = useState<Record<string, UiSessionState>>({});
  const [sessionOrder, setSessionOrder] = useState<string[]>([]);
  const [steerQueuesBySessionId, setSteerQueuesBySessionId] = useState<Record<string, CommandQueueItem[]>>({});
  const [permissionDialogs, setPermissionDialogs] = useState<Record<string, PermissionDialogState>>({});
  const [activePermissionDialogId, setActivePermissionDialogId] = useState<string | null>(null);
  const [elicitationDialogs, setElicitationDialogs] = useState<Record<string, ElicitationDialogState>>({});
  const [activeElicitationDialogId, setActiveElicitationDialogId] = useState<string | null>(null);
  const [subagentSheet, setSubagentSheet] = useState<SubagentSheetState | null>(null);
  const [initializeResult, setInitializeResult] = useState<unknown>(null);
  const [executorType, setExecutorType] = useState(defaultExecutorType);
  const [model, setModel] = useState(defaultModel);
  const [cwd, setCwd] = useState(defaultCwd);

  const clientRef = useRef<AcpWebSocketClient | null>(null);

  const busy = status === "connecting";
  const connected = status === "connected";
  const activeSession = activeSessionId ? sessionsById[activeSessionId] : null;
  const sessionId = activeSession?.id ?? null;
  const messages = activeSession?.uiMessages ?? [];
  const streamingText = activeSession?.streamingText ?? null;
  const messageUpdates = activeSession?.messageUpdates ?? {};
  const pendingApproval = activeSession?.pendingApproval ?? null;
  const pendingQuestion = activeSession?.pendingQuestion ?? null;
  const pendingPlan = activeSession?.pendingPlan ?? null;
  const artifacts = activeSession?.artifacts ?? [];
  const slashCommands = activeSession?.slashCommands ?? [];
  const steerQueueItems = sessionId ? steerQueuesBySessionId[sessionId] ?? [] : [];

  const permissionDialog = activePermissionDialogId ? permissionDialogs[activePermissionDialogId] ?? null : null;
  const elicitationDialog = activeElicitationDialogId ? elicitationDialogs[activeElicitationDialogId] ?? null : null;

  const hasQueuedUserBlocker = Boolean(activeSession?.uiStepQueue.some(isUserBlockingUiStep));
  const isTurnActive = Boolean(
    activeSession?.promptInFlight ||
    activeSession?.uiStepQueue.length ||
    activeSession?.pendingPlan ||
    activeSession?.pendingApproval ||
    activeSession?.pendingQuestion
  );
  const isAgentRunning = Boolean(
    activeSession?.promptInFlight &&
    !hasQueuedUserBlocker &&
    !pendingPlan &&
    !pendingApproval &&
    !pendingQuestion
  );

  const sessions = useMemo<AcpSessionItem[]>(
    () =>
      sessionOrder.flatMap((id) => {
        const session = sessionsById[id];
        if (!session) return [];
        return [
          {
            id,
            title: session.title,
            subtitle: session.id,
          },
        ];
      }),
    [sessionOrder, sessionsById]
  );

  const liveSubagentMessages = resolveLiveSubagentMessages(sessionsById, subagentSheet);

  // Auto-connect on mount and maintain connection
  useEffect(() => {
    let mounted = true;

    const autoConnect = async () => {
      if (status === "idle" || status === "closed" || status === "error") {
        try {
          const client = ensureClient();
          await client.connect(wsUrl);
          if (mounted) {
            const initialized = await client.initialize();
            setInitializeResult(initialized);
          }
        } catch (err) {
          if (mounted) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }
      }
    };

    void autoConnect();

    return () => {
      mounted = false;
    };
  }, [ensureClient, status, wsUrl]);

  // Drain UI step queue effect
  useEffect(() => {
    const sessionEntries = Object.values(sessionsById);
    const drainable = sessionEntries.find(
      (session) =>
        !session.pendingPlan &&
        !session.pendingApproval &&
        !session.pendingQuestion &&
        session.uiStepQueue.length > 0
    );
    if (!drainable) return;

    const timer = window.setTimeout(() => {
      setSessionsById((current) => {
        const session = current[drainable.id];
        if (
          !session ||
          session.pendingPlan ||
          session.pendingApproval ||
          session.pendingQuestion ||
          session.uiStepQueue.length === 0
        ) {
          return current;
        }
        const [step, ...rest] = session.uiStepQueue;
        return {
          ...current,
          [session.id]: applyQueuedUiStep(session, step, rest),
        };
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [sessionsById]);

  const appendSessionUpdate = useCallback((notification: AcpSessionUpdate) => {
    const text = acpSessionUpdateToStreamingText(notification);
    if (text !== null) {
      appendSessionStreamingText(setSessionsById, notification.sessionId, text);
      return;
    }
    enqueueUiSteps(setSessionsById, notification.sessionId, acpSessionUpdateToUiSteps(notification));
  }, []);

  const appendClientToolCall = useCallback((call: ClientToolCall) => {
    updateSession(setSessionsById, call.sessionId, (session) => ({
      ...session,
      clientToolCalls: [call, ...session.clientToolCalls],
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, call.sessionId, clientToolCallToUiSteps(call));
  }, []);

  const appendPermissionRequest = useCallback((request: PermissionRequestLog) => {
    updateSession(setSessionsById, request.sessionId, (session) => ({
      ...session,
      permissionRequests: [request, ...session.permissionRequests],
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, request.sessionId, permissionDecisionToUiSteps(request));
  }, []);

  const appendElicitationRequest = useCallback((request: ElicitationRequestLog) => {
    updateSession(setSessionsById, request.sessionId, (session) => ({
      ...session,
      elicitationRequests: [request, ...session.elicitationRequests],
      lastActiveAt: new Date().toISOString(),
    }));
    enqueueUiSteps(setSessionsById, request.sessionId, elicitationResultToUiSteps(request));
  }, []);

  const appendSteerPromptConsumed = useCallback(
    (result: ConsumedSteerPromptResult & { sessionId: string }) => {
      const steerItem = steerQueuesBySessionId[result.sessionId]?.find((item) => item.id === result.promptId);
      setSteerQueuesBySessionId((current) => ({
        ...current,
        [result.sessionId]: (current[result.sessionId] ?? []).filter((item) => item.id !== result.promptId),
      }));
      if (steerItem?.content) {
        appendUiMessagesImmediately(setSessionsById, result.sessionId, userPromptToMessages(steerItem.content));
      } else {
        appendUiMessagesImmediately(setSessionsById, result.sessionId, systemTextToMessages(`Steer prompt consumed: ${result.promptId}`));
      }
    },
    [steerQueuesBySessionId]
  );

  const executeClientTool = useCallback((_request: ClientToolExecutionRequest): CallToolResult => {
    return {
      content: [{ type: "text", text: "Desktop client tool execution not implemented." }],
      isError: true,
    };
  }, []);

  const requestClientToolResult = useCallback(
    (request: ClientToolExecutionRequest, draft: CallToolResult): Promise<CallToolResult> => {
      enqueueUiSteps(setSessionsById, request.sessionId, clientToolRequestedToUiSteps(request));
      // For now, auto-approve client tool calls
      return Promise.resolve(draft);
    },
    []
  );

  const requestPermissionDecision = useCallback((request: PermissionDecisionRequest): Promise<PermissionDecisionResult> => {
    const steps = permissionRequestToUiSteps(request);
    const approval = steps.find((step) => step.kind === "approval")?.approval;
    const dialogId = approval?.id ?? request.toolCallId;
    enqueueUiSteps(setSessionsById, request.sessionId, steps);
    return new Promise((resolve) => {
      const selected = selectInitialPermissionOption(request.options);
      const dialog: PermissionDialogState = {
        id: dialogId,
        request,
        selectedOptionId: selected ? permissionOptionId(selected, request.options.indexOf(selected)) : "",
        resolve,
      };
      setPermissionDialogs((current) => ({ ...current, [dialogId]: dialog }));
      setActivePermissionDialogId((current) => current ?? dialogId);
    });
  }, []);

  const requestElicitationResponse = useCallback((request: ElicitationRequest): Promise<ElicitationResponse> => {
    const pendingQuestion = elicitationRequestToPendingQuestion(request);
    const pendingPlan = elicitationRequestToPendingPlan(request);
    const dialogId = pendingPlan?.id ?? pendingQuestion.id;
    enqueueUiSteps(setSessionsById, request.sessionId, elicitationRequestToUiSteps(request, pendingQuestion));
    return new Promise((resolve) => {
      const formFields = getElicitationFormFields(request);
      const dialog: ElicitationDialogState = {
        id: dialogId,
        request,
        pendingQuestion,
        formFields,
        answersText: formatJson(buildDefaultElicitationContent(formFields)),
        resolve,
      };
      setElicitationDialogs((current) => ({ ...current, [dialogId]: dialog }));
      setActiveElicitationDialogId((current) => current ?? dialogId);
    });
  }, []);

  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      if (globalClientRef) {
        clientRef.current = globalClientRef;
      } else {
        clientRef.current = new AcpWebSocketClient({
          onTraffic: () => {},
          onSessionUpdate: appendSessionUpdate,
          onClientToolCall: appendClientToolCall,
          onPermissionRequest: appendPermissionRequest,
          onElicitationRequest: appendElicitationRequest,
          onSteerPromptConsumed: appendSteerPromptConsumed,
          executeClientTool,
          requestClientToolResult,
          requestPermissionDecision,
          requestElicitationResponse,
          onStatus: setStatus,
          onError: setError,
        });
        globalClientRef = clientRef.current;
      }
    }
    return clientRef.current;
  }, [
    appendClientToolCall,
    appendElicitationRequest,
    appendPermissionRequest,
    appendSessionUpdate,
    appendSteerPromptConsumed,
    executeClientTool,
    requestClientToolResult,
    requestElicitationResponse,
    requestPermissionDecision,
  ]);

  const buildAgentConfig = useCallback((): AgentConfigPayload => {
    return {
      executor_type: executorType,
      model: model.trim() || undefined,
      permission_mode: "default",
      mcp_servers: ["client_side"],
    };
  }, [executorType, model]);

  const connect = useCallback(async () => {
    setError(null);
    setInitializeResult(null);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      const initialized = await client.initialize();
      setInitializeResult(initialized);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : String(connectError));
    }
  }, [ensureClient, wsUrl]);

  const createSession = useCallback(async () => {
    setError(null);
    try {
      const client = ensureClient();
      await client.connect(wsUrl);
      if (!initializeResult) {
        setInitializeResult(await client.initialize());
      }
      const session = await client.newSession({
        cwd,
        agent_config: buildAgentConfig(),
      });
      const id = readSessionId(session);
      if (!id) throw new Error("session/new did not return sessionId");
      const record = createUiSession(id, cwd, session);
      setSessionsById((current) => ({ ...current, [id]: record }));
      setSessionOrder((current) => [id, ...current.filter((item) => item !== id)]);
      setActiveSessionId(id);
      enqueueUiSteps(setSessionsById, id, systemTextToUiSteps(`Session ready: ${id}`));
      const commands = readSessionAvailableCommands(session);
      if (commands) {
        enqueueUiSteps(setSessionsById, id, slashCommandsToUiSteps(commands));
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
    }
  }, [buildAgentConfig, cwd, ensureClient, initializeResult, wsUrl]);

  const loadSession = useCallback(
    async (loadSessionId: string) => {
      const id = loadSessionId.trim();
      if (!id) return;
      setError(null);
      try {
        const client = ensureClient();
        await client.connect(wsUrl);
        if (!initializeResult) {
          setInitializeResult(await client.initialize());
        }
        const session = await client.loadSession({
          session_id: id,
          cwd,
          agent_config: buildAgentConfig(),
        });
        const loadedId = readSessionId(session) ?? id;
        setSessionsById((current) => ({
          ...current,
          [loadedId]: createUiSession(loadedId, cwd, session, current[loadedId]),
        }));
        setSessionOrder((current) => [loadedId, ...current.filter((item) => item !== loadedId)]);
        setActiveSessionId(loadedId);
        enqueueUiSteps(setSessionsById, loadedId, systemTextToUiSteps(`Session loaded: ${loadedId}`));
        const commands = readSessionAvailableCommands(session);
        if (commands) {
          enqueueUiSteps(setSessionsById, loadedId, slashCommandsToUiSteps(commands));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      }
    },
    [buildAgentConfig, cwd, ensureClient, initializeResult, wsUrl]
  );

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    globalClientRef = null;
    setStatus("closed");
  }, []);

  const sendPrompt = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) return;

      setError(null);

      // Auto-create session if none exists
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        try {
          const client = ensureClient();
          // Ensure connected
          if (status !== "connected") {
            await client.connect(wsUrl);
            if (!initializeResult) {
              const initialized = await client.initialize();
              setInitializeResult(initialized);
            }
          }
          // Create session
          const session = await client.newSession({
            cwd,
            agent_config: buildAgentConfig(),
          });
          const id = readSessionId(session);
          if (!id) throw new Error("session/new did not return sessionId");
          const record = createUiSession(id, cwd, session);
          setSessionsById((current) => ({ ...current, [id]: record }));
          setSessionOrder((current) => [id, ...current.filter((item) => item !== id)]);
          setActiveSessionId(id);
          targetSessionId = id;
          // Don't show "Session ready" system message for auto-created sessions
          const commands = readSessionAvailableCommands(session);
          if (commands) {
            enqueueUiSteps(setSessionsById, id, slashCommandsToUiSteps(commands));
          }
        } catch (sessionError) {
          setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
          return;
        }
      }

      enqueueUiSteps(setSessionsById, targetSessionId, userPromptToUiSteps(text));
      updateSession(setSessionsById, targetSessionId, (session) => ({
        ...session,
        promptInFlight: true,
        promptResult: null,
        lastActiveAt: new Date().toISOString(),
      }));
      try {
        const result = await clientRef.current?.prompt(targetSessionId, text);
        updateSession(setSessionsById, targetSessionId, (session) => ({
          ...flushSessionStreamingText(drainSessionUiStepQueue(session)),
          promptInFlight: false,
          promptResult: result,
          lastActiveAt: new Date().toISOString(),
        }));
      } catch (promptError) {
        updateSession(setSessionsById, targetSessionId, (session) => ({
          ...flushSessionStreamingText(drainSessionUiStepQueue(session)),
          promptInFlight: false,
          lastActiveAt: new Date().toISOString(),
        }));
        setError(promptError instanceof Error ? promptError.message : String(promptError));
      }
    },
    [buildAgentConfig, cwd, ensureClient, initializeResult, sessionId, status, wsUrl]
  );

  const sendSteerPrompt = useCallback(
    async (content: string): Promise<string | null> => {
      if (!sessionId) return null;
      const text = content.trim();
      if (!text) return null;

      setError(null);
      appendUiMessagesImmediately(setSessionsById, sessionId, systemTextToMessages(`Steer queued: ${text}`));
      try {
        const result = await clientRef.current?.steerPrompt({
          sessionId,
          text,
          agentId: executorType,
          userId: "desktop-client",
          meta: { source: "desktop-acp-chat" },
        });
        if (result?.promptId) {
          setSteerQueuesBySessionId((current) => ({
            ...current,
            [sessionId]: [...(current[sessionId] ?? []), { id: result.promptId, content: text, createdAt: Date.now() }],
          }));
          return result.promptId;
        }
      } catch (steerError) {
        setError(steerError instanceof Error ? steerError.message : String(steerError));
      }
      return null;
    },
    [executorType, sessionId]
  );

  const interrupt = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    if (permissionDialog) {
      permissionDialog.resolve({ outcome: "cancelled" });
      setPermissionDialogs((current) => {
        const { [permissionDialog.id]: _, ...rest } = current;
        return rest;
      });
      setActivePermissionDialogId((current) => (current === permissionDialog.id ? null : current));
    }
    if (elicitationDialog) {
      elicitationDialog.resolve({ action: { action: "cancel" } });
      setElicitationDialogs((current) => {
        const { [elicitationDialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === elicitationDialog.id ? null : current));
    }
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      pendingApproval: null,
      pendingQuestion: null,
      pendingPlan: null,
      lastActiveAt: new Date().toISOString(),
    }));
    try {
      await clientRef.current?.interrupt(sessionId);
    } catch (interruptError) {
      setError(interruptError instanceof Error ? interruptError.message : String(interruptError));
    }
  }, [elicitationDialog, permissionDialog, sessionId]);

  const closeActiveSession = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      await clientRef.current?.closeSession(sessionId);
      setSessionsById((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setSteerQueuesBySessionId((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setSessionOrder((current) => current.filter((id) => id !== sessionId));
      setActiveSessionId((current) => (current === sessionId ? null : current));
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : String(closeError));
    }
  }, [sessionId]);

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const handleSlashCommand = useCallback(
    (command: SlashCommand, selection: SlashCommandSelection) => {
      const args = selection.args.trim();
      const text = `/${command.name}${args ? ` ${args}` : ""}`;
      void sendPrompt(text);
    },
    [sendPrompt]
  );

  const handleApprovalDecision = useCallback(
    (decision: string) => {
      const dialogId = pendingApproval?.id;
      const dialog = dialogId ? permissionDialogs[dialogId] : null;
      if (!dialog) return;
      const selectedOptionId = resolvePermissionDecisionOption(dialog.request.options, decision);
      dialog.resolve({ outcome: "selected", optionId: selectedOptionId });
      resolveSessionApproval(setSessionsById, dialog.request.sessionId);
      setPermissionDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActivePermissionDialogId((current) => (current === dialog.id ? null : current));
    },
    [pendingApproval, permissionDialogs]
  );

  const handleQuestionAnswers = useCallback(
    (answers: Record<string, string[]>) => {
      const dialogId = pendingQuestion?.id;
      const dialog = dialogId ? elicitationDialogs[dialogId] : null;
      if (!dialog) return;
      const content = answersToElicitationContent(answers, dialog.formFields);
      dialog.resolve({ action: { action: "accept", content } });
      resolveSessionQuestion(setSessionsById, dialog.request.sessionId);
      setElicitationDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === dialog.id ? null : current));
    },
    [elicitationDialogs, pendingQuestion]
  );

  const handleApprovePlan = useCallback(() => {
    if (!sessionId) return;
    const dialog = pendingPlan?.id ? elicitationDialogs[pendingPlan.id] : null;
    if (dialog) {
      dialog.resolve({ action: { action: "accept", content: { decision: "approved" } } });
      setElicitationDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === dialog.id ? null : current));
    }
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      pendingPlan: null,
      uiMessages: session.uiMessages.map((message) =>
        message.type === "plan" && message.plan
          ? { ...message, plan: { ...message.plan, approvalStatus: "approved" } }
          : message
      ),
    }));
    if (!dialog) void sendSteerPrompt("Plan approved. Continue.");
  }, [elicitationDialogs, pendingPlan, sendSteerPrompt, sessionId]);

  const handleRejectPlan = useCallback(() => {
    if (!sessionId) return;
    const dialog = pendingPlan?.id ? elicitationDialogs[pendingPlan.id] : null;
    if (dialog) {
      dialog.resolve({ action: { action: "decline" } });
      setElicitationDialogs((current) => {
        const { [dialog.id]: _, ...rest } = current;
        return rest;
      });
      setActiveElicitationDialogId((current) => (current === dialog.id ? null : current));
    }
    updateSession(setSessionsById, sessionId, (session) => ({
      ...session,
      pendingPlan: null,
      uiMessages: session.uiMessages.map((message) =>
        message.type === "plan" && message.plan
          ? { ...message, plan: { ...message.plan, approvalStatus: "rejected" } }
          : message
      ),
    }));
    if (!dialog) void sendSteerPrompt("Plan rejected. Stop and ask for revised instructions.");
  }, [elicitationDialogs, pendingPlan, sendSteerPrompt, sessionId]);

  const cancelSteerQueueItems = useCallback(
    async (items: QueuedInputRecallItem[], _reason: string) => {
      if (!sessionId || items.length === 0) return;
      const cancellableItems = items.filter((item) => typeof item.id === "string" && item.id.trim().length > 0);
      if (cancellableItems.length === 0) return;
      setError(null);
      try {
        await Promise.all(cancellableItems.map((item) => clientRef.current?.cancelSteerPrompt(sessionId, item.id!)));
        setSteerQueuesBySessionId((current) => ({
          ...current,
          [sessionId]: (current[sessionId] ?? []).filter((item) => !cancellableItems.some((cancelled) => cancelled.id === item.id)),
        }));
      } catch (cancelError) {
        setError(cancelError instanceof Error ? cancelError.message : String(cancelError));
      }
    },
    [sessionId]
  );

  const recallSteerQueue = useCallback(
    async (items: QueuedInputRecallItem[]) => {
      if (!sessionId || items.length === 0) return;
      await cancelSteerQueueItems(items, "recall");
    },
    [cancelSteerQueueItems, sessionId]
  );

  const removeSteerQueueItem = useCallback(
    (id: string) => {
      const item = steerQueueItems.find((candidate) => candidate.id === id);
      if (!item) return;
      void cancelSteerQueueItems([item], "remove");
    },
    [cancelSteerQueueItems, steerQueueItems]
  );

  const clearSteerQueue = useCallback(() => {
    void cancelSteerQueueItems(steerQueueItems, "clear");
  }, [cancelSteerQueueItems, steerQueueItems]);

  const handleExpandSubagent = useCallback(
    (title: string, subagentType: string | undefined, subagentMessages: AgentMessage[], context?: SubagentSheetState["context"]) => {
      setSubagentSheet({ title, subagentType, messages: subagentMessages, context });
    },
    []
  );

  const closeSubagentSheet = useCallback(() => {
    setSubagentSheet(null);
  }, []);

  return {
    status,
    connected,
    busy,
    error,
    activeSessionId,
    sessionsById,
    sessionOrder,
    sessions,
    messages,
    streamingText,
    messageUpdates,
    pendingPlan,
    pendingApproval,
    pendingQuestion,
    slashCommands,
    artifacts,
    steerQueueItems,
    isTurnActive,
    isAgentRunning,
    executorType,
    model,
    cwd,
    connect,
    disconnect,
    createSession,
    loadSession,
    closeActiveSession,
    selectSession,
    sendPrompt,
    sendSteerPrompt,
    interrupt,
    handleSlashCommand,
    handleApprovalDecision,
    handleQuestionAnswers,
    handleApprovePlan,
    handleRejectPlan,
    recallSteerQueue,
    removeSteerQueueItem,
    clearSteerQueue,
    setExecutorType,
    setModel,
    setCwd,
    subagentSheet,
    liveSubagentMessages,
    handleExpandSubagent,
    closeSubagentSheet,
  };
}
